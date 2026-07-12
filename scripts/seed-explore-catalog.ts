/**
 * Quick task 260614-f82: Batch catalog adds from a list of manufacturer URLs.
 * Usage: PROD_DATABASE_URL=postgresql://... ANTHROPIC_API_KEY=sk-... npm run explore:catalog-add
 *
 * Reads .planning/quick/260614-f82-seed-explore-page-editorial-content-8-cu/URLS.md,
 * processes each { label, url } pair sequentially through:
 *   fetchAndExtract → upsertCatalogFromExtractedUrl → updateCatalogTaste
 *
 * Writes a JSON manifest to scripts/seed-data/explore-catalog-adds.json.
 *
 * NEVER modifies per-user `watches` table — writes to `watches_catalog` only.
 * NEVER calls revalidateTag — irrelevant outside Next.js Server Component context.
 * Idempotent — upsertCatalogFromExtractedUrl uses ON CONFLICT COALESCE semantics.
 *
 * NOTE: Does NOT use --env-file=.env.local — PROD_DATABASE_URL must NOT live there.
 * Supply via shell env: PROD_DATABASE_URL=... ANTHROPIC_API_KEY=... npm run explore:catalog-add
 *
 * Path alias note: tsx does not resolve @/* aliases; use relative imports.
 * server-only note: tsconfig.json maps `server-only` → tests/shims/server-only.ts (no-op),
 * so src/data/catalog and src/lib/taste/enricher are importable in tsx scripts.
 *
 * DB routing: PROD_DATABASE_URL is assigned to DATABASE_URL before the Drizzle client
 * module is loaded, ensuring src/db/index.ts connects to prod. Dynamic imports are used
 * for all DB-dependent modules so process.env.DATABASE_URL is set before module init.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

// ---------------------------------------------------------------------------
// Step 1: Env validation (before any DB imports)
// ---------------------------------------------------------------------------

const PROD_DB_URL = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const missing: string[] = []
if (!PROD_DB_URL) missing.push('PROD_DATABASE_URL (or DATABASE_URL as fallback)')
if (!ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY')

if (missing.length > 0) {
  console.error('[seed-catalog] ERROR: Missing required environment variables:')
  for (const v of missing) {
    console.error(`  - ${v}`)
  }
  console.error('')
  console.error('Run with:')
  console.error(
    '  PROD_DATABASE_URL=postgresql://... ANTHROPIC_API_KEY=sk-... npm run explore:catalog-add',
  )
  process.exit(1)
}

// Route the Drizzle client (src/db/index.ts) to prod BEFORE importing it.
// src/db/index.ts runs `postgres(process.env.DATABASE_URL!, ...)` at module init;
// dynamic imports below ensure this env var is set first.
process.env.DATABASE_URL = PROD_DB_URL

// ---------------------------------------------------------------------------
// Static imports (no DB dependency)
// ---------------------------------------------------------------------------

// fetchAndExtract has no `server-only` and no DB dependency — safe to import statically.
// Use relative path; tsx does not resolve @/* aliases.
import { fetchAndExtract } from '../src/lib/extractors/index'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntryStatus = 'success' | 'failed' | 'extraction-empty'

interface ManifestEntry {
  label: string
  url: string
  status: EntryStatus
  brand?: string
  model?: string
  reference?: string | null
  catalogId?: string | null
  catalogIdError?: string | null
  errorReason?: string
}

interface ParsedUrl {
  label: string
  url: string
}

// ---------------------------------------------------------------------------
// Step 2: Parse URLS.md
// ---------------------------------------------------------------------------

const TASK_DIR = path.join(
  process.cwd(),
  '.planning/quick/260614-f82-seed-explore-page-editorial-content-8-cu',
)
const URLS_FILE = path.join(TASK_DIR, 'URLS.md')
const SEED_DATA_DIR = path.join(process.cwd(), 'scripts/seed-data')
const MANIFEST_FILE = path.join(SEED_DATA_DIR, 'explore-catalog-adds.json')

/**
 * Parse URLS.md. Extracts all lines matching:
 *   `^- (.+?):\s*(https?://\S+)\s*$`
 * Ignores: ### headers, <!-- comments -->, blank lines, prose.
 */
function parseUrlsMd(filePath: string): ParsedUrl[] {
  if (!fs.existsSync(filePath)) {
    console.error(`[seed-catalog] URLS.md not found at ${filePath}`)
    process.exit(1)
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const results: ParsedUrl[] = []
  const ENTRY_RE = /^-\s+(.+?):\s*(https?:\/\/\S+)\s*$/

  for (const line of lines) {
    // Skip headers
    if (line.trim().startsWith('###') || line.trim().startsWith('#')) continue
    // Skip HTML comments
    if (line.trim().startsWith('<!--')) continue
    // Skip blank/prose lines
    const match = ENTRY_RE.exec(line)
    if (match) {
      results.push({ label: match[1].trim(), url: match[2].trim() })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const entries = parseUrlsMd(URLS_FILE)
  console.log(`[seed-catalog] Parsed ${entries.length} URL(s) from URLS.md`)

  if (entries.length === 0) {
    console.log('[seed-catalog] URLS.md is empty — nothing to do.')
    process.exit(0)
  }

  // Dynamic imports: these modules read DATABASE_URL at init time (src/db/index.ts).
  // Dynamic import ensures process.env.DATABASE_URL is already set to PROD_DB_URL above.
  const { upsertCatalogFromExtractedUrl, updateCatalogTaste } = await import(
    '../src/data/catalog'
  )
  const { enrichTasteAttributes } = await import('../src/lib/taste/enricher')

  const manifest: ManifestEntry[] = []
  let successCount = 0
  let failedCount = 0
  let emptyCount = 0

  for (let i = 0; i < entries.length; i++) {
    const { label, url } = entries[i]
    const n = i + 1
    const total = entries.length

    console.log(`[${n}/${total}] ${label}`)
    console.log(`  → fetching ${url}`)

    let manifestEntry: ManifestEntry = { label, url, status: 'failed' }

    try {
      // Step (c): extract watch data
      const result = await fetchAndExtract(url)

      const brand = result.data?.brand?.trim()
      const model = result.data?.model?.trim()

      if (!brand && !model) {
        console.log(`  ✗ ${label} — extraction produced no brand/model`)
        manifestEntry = {
          ...manifestEntry,
          status: 'extraction-empty',
          errorReason: 'extraction produced no brand/model',
        }
        emptyCount++
        manifest.push(manifestEntry)
        continue
      }

      // Step (d): upsert to watches_catalog
      let catalogId: string | null = null
      let catalogIdError: string | null = null

      try {
        // Phase 81 D-81-01 — upsert helper now returns { catalogId, brandName, familyName }.
        // Seed script discards the canonical names; unwrap via `?? null`.
        const upsertResult = await upsertCatalogFromExtractedUrl({
          brand: brand ?? '',
          model: model ?? '',
          reference: result.data.reference ?? null,
          movementType: result.data.movement ?? null,
          caseSizeMm: result.data.caseSizeMm ?? null,
          lugToLugMm: result.data.lugToLugMm ?? null,
          waterResistanceM: result.data.waterResistanceM ?? null,
          crystalType: result.data.crystalType ?? null,
          dialColor: result.data.dialColor ?? null,
          isChronometer: result.data.isChronometer ?? null,
          productionYear: null,
          imageUrl: result.data.imageUrl ?? null,
          imageSourceUrl: url,
          imageSourceQuality: 'unknown',
          styleTags: result.data.styleTags ?? [],
          designTraits: result.data.designTraits ?? [],
          roleTags: [],
          complications: result.data.complications ?? [],
        })
        catalogId = upsertResult?.catalogId ?? null

        if (!catalogId) {
          catalogIdError = 'catalog upsert returned null id'
        }
      } catch (err) {
        catalogIdError =
          err instanceof Error
            ? `catalog upsert threw: ${err.message.slice(0, 200)}`
            : 'catalog upsert threw'
        console.log(`  ✗ ${label} — ${catalogIdError}`)
        manifestEntry = {
          ...manifestEntry,
          status: 'failed',
          brand,
          model,
          reference: result.data.reference ?? null,
          catalogId: null,
          catalogIdError,
          errorReason: catalogIdError,
        }
        failedCount++
        manifest.push(manifestEntry)
        continue
      }

      // Step (e): taste enrichment — non-fatal
      if (catalogId && brand && model) {
        try {
          const taste = await enrichTasteAttributes({
            catalogId,
            source: 'url-extract',
            spec: {
              brand,
              model,
              reference: result.data.reference ?? null,
              movement: result.data.movement ?? null,
              caseSizeMm: result.data.caseSizeMm ?? null,
              lugToLugMm: result.data.lugToLugMm ?? null,
              waterResistanceM: result.data.waterResistanceM ?? null,
              crystalType: result.data.crystalType ?? null,
              dialColor: result.data.dialColor ?? null,
              isChronometer: result.data.isChronometer ?? null,
              productionYear: null,
              complications: result.data.complications ?? [],
            },
            photoSourcePath: null,
          })

          if (taste) {
            await updateCatalogTaste(catalogId, taste)
          }
        } catch (err) {
          // Non-fatal — log warning but continue (mirrors live route's try/catch).
          const reason = err instanceof Error ? err.message.slice(0, 200) : String(err)
          console.warn(`  [warn] ${label} — taste enrichment failed (non-fatal): ${reason}`)
        }
      }

      // Step (f): success log
      const ref = result.data.reference ?? null
      const refPart = ref ? ` (${ref})` : ''
      console.log(
        `  ✓ ${label} → ${brand} ${model}${refPart} — catalogId=${catalogId ?? 'null'}`,
      )
      if (catalogIdError) {
        console.warn(`  [warn] ${label} — catalog upsert issue: ${catalogIdError}`)
      }

      manifestEntry = {
        ...manifestEntry,
        status: 'success',
        brand,
        model,
        reference: ref,
        catalogId,
        catalogIdError: catalogIdError ?? null,
      }
      successCount++
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.log(`  ✗ ${label} — ${reason}`)
      manifestEntry = {
        ...manifestEntry,
        status: 'failed',
        errorReason: reason,
      }
      failedCount++
    }

    manifest.push(manifestEntry)
  }

  // Step 4: Write JSON manifest
  fs.mkdirSync(SEED_DATA_DIR, { recursive: true })
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8')

  // Step 5: Summary
  console.log('')
  console.log('─────────────────────────────────────────')
  console.log(
    `Results: ${successCount} success / ${failedCount} failed / ${emptyCount} extraction-empty (total ${entries.length})`,
  )
  console.log(`Manifest: ${MANIFEST_FILE}`)
  console.log('─────────────────────────────────────────')

  process.exit(0)
}

main().catch((err) => {
  console.error('[seed-catalog] fatal:', err)
  process.exit(1)
})
