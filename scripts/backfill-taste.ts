/**
 * Phase 19.1 backfill script — D-15.
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
 * Cost estimates (RESEARCH §"Cost / Capacity Notes"):
 *   - Text-only call: ~$0.005 per row
 *   - Vision call: ~$0.013 per row (only when image_source_quality is set)
 *   - At v4.0 personal-MVP scale (<500 rows): under $5 total.
 */
// Use relative imports — tsx does not resolve @/* path aliases.
import { db } from '../src/db'
import { watchesCatalog } from '../src/db/schema'
import { sql } from 'drizzle-orm'
import { enrichTasteAttributes } from '../src/lib/taste/enricher'
import { updateCatalogTaste } from '../src/data/catalog'

const COST_PER_TEXT_CALL = 0.005
const COST_PER_VISION_CALL = 0.013

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
    movement: watchesCatalog.movement,
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
  console.log(`[backfill-taste] (no API calls made)`)
  process.exit(0)
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
            movement: row.movement ?? null,
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
        })
        if (taste) {
          await updateCatalogTaste(row.id, taste)  // default mode — first-write-wins
          totalSucceeded++
        } else {
          totalFailed++
        }
      } catch (err) {
        console.error(`[backfill-taste] row ${row.id} failed:`, err)
        totalFailed++
      }
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

  process.exit(0)
}

main().catch((err) => {
  console.error('[backfill-taste] fatal:', err)
  process.exit(1)
})
