/**
 * Phase 19.1 / Phase 44 backfill script — D-15, ENRH-01/02, D-14.
 * Usage:
 *   npm run db:backfill-taste -- --dry-run
 *   npm run db:backfill-taste -- --batch-size=20
 *   npm run db:backfill-taste -- --resume       (default; idempotent)
 *
 * Populates the 8 taste columns on watches_catalog rows that have NULL confidence.
 * Mirrors scripts/backfill-catalog.ts shape (Phase 17 D-14).
 *
 * Per D-13 first-write-wins, this script uses default updateCatalogTaste mode
 * (predicate `AND confidence IS NULL`) — runs after a successful enrichment
 * become no-ops on the same rows. Use scripts/reenrich-taste.ts for force overwrites.
 *
 * Per D-10, residual NULL rows are acceptable (transient API failures expected at scale).
 * Final assertion logs the residual count but does NOT exit 1.
 *
 * Phase 44 hardening (ENRH-01/02, D-14):
 *   - INTER_ROW_DELAY_MS pacing keeps sustained request rate ~1/sec
 *   - SDK_MAX_RETRIES raised from default 2 to 3 for batch resilience
 *   - Per-row structured JSON log with catalog_id and status (success|failure)
 *   - Live run emits a 14-digit-timestamped phase44_taste_data.sql migration
 *     into supabase/migrations/ for prod sync via `supabase db push --linked` (D-14)
 *
 * Cost estimates (RESEARCH §"Cost / Capacity Notes"):
 *   - Text-only call: ~$0.005 per row
 *   - Vision call: ~$0.013 per row (only when image_source_quality is set)
 *   - At v4.0 personal-MVP scale (<500 rows): under $5 total.
 */
// Use relative imports — tsx does not resolve @/* path aliases.
import { db } from '../src/db'
import { watchesCatalog } from '../src/db/schema'
import { sql } from 'drizzle-orm'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { enrichTasteAttributes } from '../src/lib/taste/enricher'
import { updateCatalogTaste } from '../src/data/catalog'

const COST_PER_TEXT_CALL = 0.005
const COST_PER_VISION_CALL = 0.013

// ENRH-01: Pacing and retry constants (Phase 44 hardening)
const INTER_ROW_DELAY_MS = 1000  // 1 req/sec sustained — well below Anthropic limits
const SDK_MAX_RETRIES = 3        // raise from SDK default 2 for batch runs

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/**
 * D-14: Generate a 14-digit-timestamped migration filename.
 * CRITICAL: Supabase CLI silently skips files whose prefix is not exactly 14 digits.
 * Pattern: YYYYMMDDHHMMSS_<suffix>.sql
 */
function generateMigrationFilename(suffix: string): string {
  const now = new Date()
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('')
  return `${ts}_${suffix}.sql`
}

interface ParsedArgs {
  dryRun: boolean
  batchSize: number
  resume: boolean
}

function parseArgs(): ParsedArgs {
  const args = new Map<string, string>(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }))
  return {
    dryRun: args.get('dry-run') === 'true',
    batchSize: parseInt(args.get('batch-size') ?? '20', 10),
    resume: args.get('resume') === 'true' || !args.has('force'),  // resume is the default
  }
}

async function fetchRowsToBackfill(batchSize: number) {
  return await db.select({
    id: watchesCatalog.id,
    brand: watchesCatalog.brand,
    model: watchesCatalog.model,
    reference: watchesCatalog.reference,
    movementType: watchesCatalog.movementType,
    caseSizeMm: watchesCatalog.caseSizeMm,
    lugToLugMm: watchesCatalog.lugToLugMm,
    waterResistanceM: watchesCatalog.waterResistanceM,
    crystalType: watchesCatalog.crystalType,
    dialColor: watchesCatalog.dialColor,
    isChronometer: watchesCatalog.isChronometer,
    productionYear: watchesCatalog.productionYear,
    complications: watchesCatalog.complications,
    imageSourceUrl: watchesCatalog.imageSourceUrl,
    imageSourceQuality: watchesCatalog.imageSourceQuality,
  })
    .from(watchesCatalog)
    .where(sql`confidence IS NULL`)
    .limit(batchSize)
}

async function dryRun() {
  const totalNull = await db.execute<{ c: number }>(sql`
    SELECT count(*)::int AS c FROM watches_catalog WHERE confidence IS NULL
  `)
  const nullCount = (totalNull as unknown as Array<{ c: number }>)[0]?.c ?? 0

  const visionCandidates = await db.execute<{ c: number }>(sql`
    SELECT count(*)::int AS c FROM watches_catalog
      WHERE confidence IS NULL
        AND image_source_quality = 'user_uploaded'
  `)
  const visionCount = (visionCandidates as unknown as Array<{ c: number }>)[0]?.c ?? 0
  const textCount = nullCount - visionCount

  const estCost = textCount * COST_PER_TEXT_CALL + visionCount * COST_PER_VISION_CALL

  console.log(`[backfill-taste] DRY RUN`)
  console.log(`[backfill-taste]   rows with NULL confidence: ${nullCount}`)
  console.log(`[backfill-taste]   text-mode rows:            ${textCount}`)
  console.log(`[backfill-taste]   vision-mode rows:          ${visionCount}`)
  console.log(`[backfill-taste]   estimated cost:            $${estCost.toFixed(4)}`)
  console.log(`[backfill-taste]   estimated runtime:         ~${Math.ceil(nullCount / 60)} minutes`)
  console.log(`[backfill-taste]   (no API calls made)`)
  console.log(`[backfill-taste] migration: DRY RUN — would capture ${nullCount} rows WOULD be captured (migration NOT written)`)
  process.exit(0)
}

/**
 * D-14: Query enriched rows and emit an UPDATE SQL data migration.
 * Written to supabase/migrations/<14-digit>_phase44_taste_data.sql.
 * Apply to prod via: supabase db push --linked
 *
 * Security (T-44-05): values constrained by TASTE_TOOL strict schema +
 * validateAndCleanTaste before reaching this function. Numbers unquoted,
 * enum/text single-quote-escaped, design_motifs as typed text[] literal.
 */
async function emitTasteMigration(): Promise<void> {
  type EnrichedRow = {
    id: string
    formality: string | null
    sportiness: string | null
    heritage_score: string | null
    primary_archetype: string | null
    era_signal: string | null
    design_motifs: string[] | null
    confidence: string | null
    extracted_from_photo: boolean | null
  }

  const enrichedRows = await db.execute<EnrichedRow>(sql`
    SELECT id, formality, sportiness, heritage_score, primary_archetype,
           era_signal, design_motifs, confidence, extracted_from_photo
    FROM watches_catalog
    WHERE confidence IS NOT NULL
    ORDER BY id
  `)
  const rows = enrichedRows as unknown as Array<EnrichedRow>

  if (rows.length === 0) {
    console.log('[backfill-taste] migration: no enriched rows found — migration NOT written')
    return
  }

  function sqlLiteralValue(v: string | null): string {
    if (v === null) return 'NULL'
    // Single-quote-escape: replace ' with ''
    return `'${v.replace(/'/g, "''")}'`
  }

  function sqlArrayLiteral(arr: string[] | null): string {
    if (!arr || arr.length === 0) return `'{}'::text[]`
    const escaped = arr.map(v => v.replace(/'/g, "''")).join("','")
    return `ARRAY['${escaped}']::text[]`
  }

  const updateStatements = rows.map((row) => {
    const formality = row.formality !== null ? Number(row.formality) : 'NULL'
    const sportiness = row.sportiness !== null ? Number(row.sportiness) : 'NULL'
    const heritageScore = row.heritage_score !== null ? Number(row.heritage_score) : 'NULL'
    const confidence = row.confidence !== null ? Number(row.confidence) : 'NULL'
    const extractedFromPhoto = row.extracted_from_photo !== null ? (row.extracted_from_photo ? 'true' : 'false') : 'NULL'
    const primaryArchetype = sqlLiteralValue(row.primary_archetype)
    const eraSignal = sqlLiteralValue(row.era_signal)
    const designMotifs = sqlArrayLiteral(row.design_motifs)

    return [
      `UPDATE watches_catalog SET`,
      `  formality            = ${formality},`,
      `  sportiness           = ${sportiness},`,
      `  heritage_score       = ${heritageScore},`,
      `  primary_archetype    = ${primaryArchetype},`,
      `  era_signal           = ${eraSignal},`,
      `  design_motifs        = ${designMotifs},`,
      `  confidence           = ${confidence},`,
      `  extracted_from_photo = ${extractedFromPhoto},`,
      `  updated_at           = now()`,
      `WHERE id = '${row.id}';`,
    ].join('\n')
  })

  const filename = generateMigrationFilename('phase44_taste_data')
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
  const filePath = path.join(migrationsDir, filename)

  const header = [
    `-- Phase 44 data migration: taste attributes backfill.`,
    `-- Generated by: npm run db:backfill-taste (local run)`,
    `-- Source: Phase 44 CONTEXT.md D-14`,
    `-- Apply: supabase db push --linked (never drizzle-kit push for prod)`,
    `-- Idempotent: each UPDATE is WHERE id = '<uuid>' — re-running is a no-op on already-updated rows.`,
    `-- Rows: ${rows.length}`,
    ``,
  ].join('\n')

  const body = `BEGIN;\n${updateStatements.join('\n\n')}\nCOMMIT;\n`
  await writeFile(filePath, header + body, 'utf-8')
  console.log(`[backfill-taste] migration: written ${rows.length} rows to ${filePath}`)
}

async function main() {
  const args = parseArgs()

  if (args.dryRun) {
    await dryRun()
    return
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`[backfill-taste] ANTHROPIC_API_KEY not set — cannot run live backfill. Use --dry-run for cost preview.`)
    process.exit(1)
  }

  // ENRH-01: SDK_MAX_RETRIES is threaded into enrichTasteAttributes via clientOptions.
  // The enricher constructs the Anthropic client with this value, raising from SDK default 2.
  // The SDK handles 429 / Retry-After automatically; INTER_ROW_DELAY_MS prevents triggering
  // sustained rate limits between rows.

  let totalProcessed = 0
  let totalSucceeded = 0
  let totalFailed = 0
  let pass = 0
  const startedAt = Date.now()

  while (true) {
    pass++
    const rows = await fetchRowsToBackfill(args.batchSize)
    if (rows.length === 0) break

    for (const row of rows) {
      totalProcessed++
      try {
        const taste = await enrichTasteAttributes({
          catalogId: row.id,
          source: 'backfill',
          spec: {
            brand: row.brand,
            model: row.model,
            reference: row.reference ?? null,
            movement: row.movementType ?? null,
            caseSizeMm: row.caseSizeMm ?? null,
            lugToLugMm: row.lugToLugMm ?? null,
            waterResistanceM: row.waterResistanceM ?? null,
            crystalType: row.crystalType ?? null,
            dialColor: row.dialColor ?? null,
            isChronometer: row.isChronometer ?? null,
            productionYear: row.productionYear ?? null,
            complications: row.complications,
          },
          photoSourcePath: row.imageSourceQuality === 'user_uploaded' ? row.imageSourceUrl : null,
        }, { maxRetries: SDK_MAX_RETRIES })
        if (taste) {
          await updateCatalogTaste(row.id, taste)  // default mode — first-write-wins
          totalSucceeded++
          // ENRH-02: Per-row success log — T-44-01: only catalog_id, status, confidence, timestamp
          console.log(JSON.stringify({
            event: 'backfill_row_result',
            catalog_id: row.id,
            status: 'success',
            confidence: taste.confidence,
            timestamp: new Date().toISOString(),
          }))
        } else {
          totalFailed++
          // ENRH-02: Per-row failure log — enrichment returned null
          console.log(JSON.stringify({
            event: 'backfill_row_result',
            catalog_id: row.id,
            status: 'failure',
            error: 'enrichment returned null',
            timestamp: new Date().toISOString(),
          }))
        }
      } catch (err) {
        totalFailed++
        // ENRH-02: Per-row failure log — caught exception (T-44-01: err.message only)
        console.log(JSON.stringify({
          event: 'backfill_row_result',
          catalog_id: row.id,
          status: 'failure',
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        }))
      }
      // ENRH-01: Inter-row pacing — keeps sustained rate ~1 req/sec
      await sleep(INTER_ROW_DELAY_MS)
    }

    console.log(`[backfill-taste] pass ${pass}: processed ${rows.length} (cumulative success ${totalSucceeded}, failed ${totalFailed})`)
  }

  // Residual assertion — D-10 acceptable; log but do NOT exit 1.
  const remaining = await db.execute<{ c: number }>(sql`
    SELECT count(*)::int AS c FROM watches_catalog WHERE confidence IS NULL
  `)
  const residual = (remaining as unknown as Array<{ c: number }>)[0]?.c ?? 0

  const elapsedMs = Date.now() - startedAt
  console.log(`[backfill-taste] DONE — processed ${totalProcessed}, succeeded ${totalSucceeded}, failed ${totalFailed}, residual NULL ${residual}, elapsed ${elapsedMs}ms`)
  if (residual > 0) {
    console.warn(`[backfill-taste] ${residual} rows still have NULL confidence — re-run later or use db:reenrich-taste --catalog-id=<id> for individual rows.`)
  }

  // D-14: Emit SQL data migration for prod sync (live run only)
  await emitTasteMigration()

  process.exit(0)
}

main().catch((err) => {
  console.error('[backfill-taste] fatal:', err)
  process.exit(1)
})
