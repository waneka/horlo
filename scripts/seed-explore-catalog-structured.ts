/**
 * Quick task 260614-f82: Batch catalog adds via structured (LLM-only) mode.
 * Usage: PROD_DATABASE_URL=postgresql://... ANTHROPIC_API_KEY=sk-... npm run explore:catalog-add-structured
 *
 * Reads scripts/seed-data/explore-structured-triples.json, processes each
 * { brand, model, reference, label? } triple sequentially through:
 *   extractFromStructuredInput → upsertCatalogFromUserInput → enrichTasteAttributes → updateCatalogTaste
 *
 * Writes a JSON manifest to scripts/seed-data/explore-catalog-structured-adds.json.
 *
 * NEVER modifies per-user `watches` table — writes to `watches_catalog` only.
 * NEVER calls revalidateTag — irrelevant outside Next.js Server Component context.
 * Idempotent — upsertCatalogFromUserInput uses ON CONFLICT DO NOTHING + UNION ALL semantics.
 *
 * NOTE: Does NOT use --env-file=.env.local — PROD_DATABASE_URL must NOT live there.
 * Supply via shell env: PROD_DATABASE_URL=... ANTHROPIC_API_KEY=... npm run explore:catalog-add-structured
 *
 * Why structured mode here (not URL mode):
 *   URL mode runs fetchAndExtract, which calls the graceful-degradation pipeline
 *   (structured HTML → regex → LLM). The HTML extraction stage prefers static
 *   og:title over the LLM result for NON_AMBIGUOUS_FIELDS (extractors/index.ts:14),
 *   causing ~50% garbage results on manufacturer pages with clean og:tags but
 *   incomplete structured data. Structured mode (extractFromStructuredInput) is
 *   LLM-only — the user-supplied (brand, model, reference) triple is the identity;
 *   only spec fields (caseSizeMm, dialColor, etc.) are inferred by the LLM.
 *
 * Pitfall 5 mitigation (catalog upsert):
 *   upsertCatalogFromUserInput writes the natural key (brand, model, reference) only.
 *   Spec columns stay NULL for taste enrichment to fill via UPDATE.
 *   upsertCatalogFromExtractedUrl MUST NOT be used here — it would overwrite truthful
 *   NULLs with potentially hallucinated LLM values at the SQL layer.
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
  console.error('[seed-catalog-structured] ERROR: Missing required environment variables:')
  for (const v of missing) {
    console.error(`  - ${v}`)
  }
  console.error('')
  console.error('Run with:')
  console.error(
    '  PROD_DATABASE_URL=postgresql://... ANTHROPIC_API_KEY=sk-... npm run explore:catalog-add-structured',
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

// extractFromStructuredInput has no DB dependency and `server-only` is shimmed in
// tsconfig.json for script contexts — safe to import statically.
// Use relative path; tsx does not resolve @/* aliases.
import { extractFromStructuredInput } from '../src/lib/extractors/llm-structured'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntryStatus = 'success' | 'failed' | 'extraction-empty'

interface TripleInput {
  brand: string
  model: string
  reference: string
  label?: string
}

interface ManifestEntry {
  brand: string
  model: string
  reference: string | null
  status: EntryStatus
  catalogId?: string | null
  catalogIdError?: string | null
  errorReason?: string
  extractedData?: {
    brand: string | null
    model: string | null
    reference: string | null
    movement: string | null
    caseSizeMm: number | null
    waterResistanceM: number | null
    dialColor: string | null
    isChronometer: boolean | null
  }
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const SEED_DATA_DIR = path.join(process.cwd(), 'scripts/seed-data')
const TRIPLES_FILE = path.join(SEED_DATA_DIR, 'explore-structured-triples.json')
const MANIFEST_FILE = path.join(SEED_DATA_DIR, 'explore-catalog-structured-adds.json')

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Step 2: Read triples JSON
  if (!fs.existsSync(TRIPLES_FILE)) {
    console.error(`[seed-catalog-structured] ERROR: Triples file not found at ${TRIPLES_FILE}`)
    process.exit(1)
  }

  let triples: TripleInput[]
  try {
    triples = JSON.parse(fs.readFileSync(TRIPLES_FILE, 'utf8')) as TripleInput[]
  } catch (err) {
    console.error(
      `[seed-catalog-structured] ERROR: Failed to parse ${TRIPLES_FILE}:`,
      err instanceof Error ? err.message : String(err),
    )
    process.exit(1)
  }

  if (!Array.isArray(triples) || triples.length === 0) {
    console.log('[seed-catalog-structured] Triples file is empty — nothing to do.')
    process.exit(0)
  }

  console.log(`[seed-catalog-structured] Loaded ${triples.length} triple(s) from ${TRIPLES_FILE}`)

  // Dynamic imports: these modules read DATABASE_URL at init time (src/db/index.ts).
  // Dynamic import ensures process.env.DATABASE_URL is already set to PROD_DB_URL above.
  const { upsertCatalogFromUserInput, updateCatalogTaste } = await import('../src/data/catalog')
  const { enrichTasteAttributes } = await import('../src/lib/taste/enricher')

  const manifest: ManifestEntry[] = []
  let successCount = 0
  let failedCount = 0
  let emptyCount = 0

  for (let i = 0; i < triples.length; i++) {
    const { brand, model, reference } = triples[i]
    const n = i + 1
    const total = triples.length

    // Step (a): Print progress
    console.log(`[${n}/${total}] ${brand} ${model} (${reference})`)

    let manifestEntry: ManifestEntry = { brand, model, reference: reference ?? null, status: 'failed' }

    try {
      // Step (b): extractFromStructuredInput — LLM-only, no URL fetch
      const extracted = await extractFromStructuredInput({ brand, model, reference })

      const brandPopulated = Boolean(extracted.brand?.trim())
      const modelPopulated = Boolean(extracted.model?.trim())

      if (!brandPopulated && !modelPopulated) {
        console.log(`  ✗ ${brand} ${model} — extraction produced no brand/model`)
        manifestEntry = {
          ...manifestEntry,
          status: 'extraction-empty',
          errorReason: 'extraction produced no brand/model',
        }
        emptyCount++
        manifest.push(manifestEntry)
        continue
      }

      // Capture extracted spec fields for the manifest (informational only — not
      // written to catalog via this path; taste enrichment handles spec columns).
      const extractedData: ManifestEntry['extractedData'] = {
        brand: extracted.brand ?? null,
        model: extracted.model ?? null,
        reference: extracted.reference ?? null,
        movement: extracted.movement ?? null,
        caseSizeMm: extracted.caseSizeMm ?? null,
        waterResistanceM: extracted.waterResistanceM ?? null,
        dialColor: extracted.dialColor ?? null,
        isChronometer: extracted.isChronometer ?? null,
      }

      // Step (c): Catalog upsert via upsertCatalogFromUserInput (Pitfall 5 — use the
      // input triple, NOT the extracted values; LLM-inferred brand/model/ref must not
      // overwrite truthful user-supplied values at the SQL layer).
      let catalogId: string | null = null
      let catalogIdError: string | null = null

      try {
        // Phase 81 D-81-01 — upsert helper now returns { catalogId, brandName, familyName }.
        // Seed script discards the canonical names; unwrap via `?? null`.
        const upsertResult = await upsertCatalogFromUserInput({
          brand,
          model,
          reference: reference ?? null,
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
        console.log(`  ✗ ${brand} ${model} — ${catalogIdError}`)
        manifestEntry = {
          ...manifestEntry,
          status: 'failed',
          catalogId: null,
          catalogIdError,
          errorReason: catalogIdError,
          extractedData,
        }
        failedCount++
        manifest.push(manifestEntry)
        continue
      }

      // Step (d): Taste enrichment — non-fatal (mirrors route lines 388-416 with
      // source: 'structured-input').
      if (catalogId) {
        try {
          const taste = await enrichTasteAttributes({
            catalogId,
            source: 'structured-input',
            spec: {
              brand,
              model,
              reference: reference ?? null,
              movement: extracted.movement ?? null,
              caseSizeMm: extracted.caseSizeMm ?? null,
              lugToLugMm: extracted.lugToLugMm ?? null,
              waterResistanceM: extracted.waterResistanceM ?? null,
              crystalType: extracted.crystalType ?? null,
              dialColor: extracted.dialColor ?? null,
              isChronometer: extracted.isChronometer ?? null,
              productionYear: null,
              complications: extracted.complications ?? [],
            },
            photoSourcePath: null,
          })

          if (taste) {
            await updateCatalogTaste(catalogId, taste)
          }
        } catch (err) {
          // Non-fatal — log warning but continue (mirrors live route's try/catch).
          const reason = err instanceof Error ? err.message.slice(0, 200) : String(err)
          console.warn(
            `  [warn] ${brand} ${model} — taste enrichment failed (non-fatal): ${reason}`,
          )
        }
      }

      // Step (e): Success log
      const refPart = reference ? ` (${reference})` : ''
      console.log(`  ✓ ${brand} ${model}${refPart} — catalogId=${catalogId ?? 'null'}`)
      if (catalogIdError) {
        console.warn(`  [warn] ${brand} ${model} — catalog upsert issue: ${catalogIdError}`)
      }

      manifestEntry = {
        ...manifestEntry,
        status: 'success',
        catalogId,
        catalogIdError: catalogIdError ?? null,
        extractedData,
      }
      successCount++
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.log(`  ✗ ${brand} ${model} — ${reason}`)
      manifestEntry = {
        ...manifestEntry,
        status: 'failed',
        errorReason: reason,
      }
      failedCount++
    }

    manifest.push(manifestEntry)
  }

  // Step 3: Write JSON manifest
  fs.mkdirSync(SEED_DATA_DIR, { recursive: true })
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8')

  // Step 4: Summary
  console.log('')
  console.log('─────────────────────────────────────────')
  console.log(
    `Results: ${successCount} success / ${failedCount} failed / ${emptyCount} extraction-empty (total ${triples.length})`,
  )
  console.log(`Manifest: ${MANIFEST_FILE}`)
  console.log('─────────────────────────────────────────')

  process.exit(0)
}

main().catch((err) => {
  console.error('[seed-catalog-structured] fatal:', err)
  process.exit(1)
})
