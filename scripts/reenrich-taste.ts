/**
 * Phase 19.1 / Phase 44 re-enrichment script — D-13, ENRH-01/02.
 *
 * Usage:
 *   npm run db:reenrich-taste -- --force --confidence-below=0.5
 *   npm run db:reenrich-taste -- --force --catalog-id=<uuid>
 *   npm run db:reenrich-taste -- --dry-run --confidence-below=0.7
 *
 * Force-mode overwrite of taste on rows matching the predicate. Live enrichment
 * paths skip rows with any taste data (D-13 first-write-wins) — this script is
 * the only path to refresh taste once written.
 *
 * Safety: --force is required for any actual write. Without --force, the script
 * exits with a usage hint.
 *
 * Phase 44 hardening (ENRH-01/02):
 *   - INTER_ROW_DELAY_MS pacing keeps sustained request rate ~1/sec
 *   - SDK_MAX_RETRIES raised from default 2 to 3 for batch resilience
 *   - Per-row structured JSON log: event reenrich_row_result with status
 *     success | guard_blocked (based on updateCatalogTaste return value)
 *   - guard_blocked surfaces when D-07/D-08 downgrade guard rejects a write
 */
// Use relative imports — tsx does not resolve @/* path aliases.
import { db } from '../src/db'
import { watchesCatalog } from '../src/db/schema'
import { sql, eq, lt, and } from 'drizzle-orm'
import { enrichTasteAttributes } from '../src/lib/taste/enricher'
import { updateCatalogTaste } from '../src/data/catalog'

// ENRH-01: Pacing and retry constants (Phase 44 hardening)
const INTER_ROW_DELAY_MS = 1000  // 1 req/sec sustained — well below Anthropic limits
const SDK_MAX_RETRIES = 3        // raise from SDK default 2 for batch runs

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

interface ParsedArgs {
  dryRun: boolean
  force: boolean
  confidenceBelow: number | null
  catalogId: string | null
  batchSize: number
}

function parseArgs(): ParsedArgs {
  const args = new Map<string, string>(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }))
  return {
    dryRun: args.get('dry-run') === 'true',
    force: args.get('force') === 'true',
    confidenceBelow: args.has('confidence-below') ? parseFloat(args.get('confidence-below')!) : null,
    catalogId: args.get('catalog-id') ?? null,
    batchSize: parseInt(args.get('batch-size') ?? '20', 10),
  }
}

function buildPredicate(args: ParsedArgs) {
  if (args.catalogId) return eq(watchesCatalog.id, args.catalogId)
  if (args.confidenceBelow !== null) {
    return and(
      sql`${watchesCatalog.confidence} IS NOT NULL`,
      lt(watchesCatalog.confidence, String(args.confidenceBelow)),
    )
  }
  // No predicate = entire catalog. Only allowed in --dry-run.
  return undefined
}

async function main() {
  const args = parseArgs()

  if (!args.dryRun && !args.force) {
    console.error(`[reenrich-taste] missing --force flag. Use --dry-run for preview, --force to overwrite.`)
    console.error(`Usage:`)
    console.error(`  npm run db:reenrich-taste -- --dry-run --confidence-below=0.7`)
    console.error(`  npm run db:reenrich-taste -- --force --confidence-below=0.5`)
    console.error(`  npm run db:reenrich-taste -- --force --catalog-id=<uuid>`)
    process.exit(1)
  }

  if (!args.confidenceBelow && !args.catalogId && !args.dryRun) {
    console.error(`[reenrich-taste] --force without --confidence-below or --catalog-id would re-enrich the ENTIRE catalog. Refusing.`)
    console.error(`If you really want full-catalog re-enrichment, run with --confidence-below=1.0`)
    process.exit(1)
  }

  const predicate = buildPredicate(args)

  if (args.dryRun) {
    const countResult = await db.execute<{ c: number }>(sql`
      SELECT count(*)::int AS c FROM watches_catalog
       WHERE ${predicate ?? sql`true`}
    `)
    const count = (countResult as unknown as Array<{ c: number }>)[0]?.c ?? 0
    const estCost = count * 0.005  // assume text mode for upper bound; vision adds buffer
    console.log(`[reenrich-taste] DRY RUN`)
    console.log(`[reenrich-taste]   rows matching predicate: ${count}`)
    console.log(`[reenrich-taste]   estimated cost:          ~$${estCost.toFixed(4)}`)
    console.log(`[reenrich-taste] (no API calls made)`)
    process.exit(0)
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`[reenrich-taste] ANTHROPIC_API_KEY not set.`)
    process.exit(1)
  }

  let totalProcessed = 0
  let totalSucceeded = 0
  let totalGuardBlocked = 0
  let pass = 0
  const startedAt = Date.now()

  while (true) {
    pass++
    const rows = await db.select({
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
      .where(predicate ?? sql`true`)
      .limit(args.batchSize)
      .offset(totalProcessed)  // OFFSET-based paging — safe at v4.0 scale (<500 rows)

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
          // ENRH-02: Capture D-07/D-08 guard result from updateCatalogTaste return value
          const writeResult = await updateCatalogTaste(row.id, taste, { force: true })  // FORCE
          if (writeResult.updated) {
            totalSucceeded++
            console.log(JSON.stringify({
              event: 'reenrich_row_result',
              catalog_id: row.id,
              status: 'success',
              timestamp: new Date().toISOString(),
            }))
          } else {
            totalGuardBlocked++
            console.log(JSON.stringify({
              event: 'reenrich_row_result',
              catalog_id: row.id,
              status: 'guard_blocked',
              timestamp: new Date().toISOString(),
            }))
          }
        }
      } catch (err) {
        console.error(`[reenrich-taste] row ${row.id} failed:`, err)
      }
      // ENRH-01: Inter-row pacing — keeps sustained rate ~1 req/sec
      await sleep(INTER_ROW_DELAY_MS)
    }

    console.log(`[reenrich-taste] pass ${pass}: processed ${rows.length} (cumulative success ${totalSucceeded}/${totalProcessed}, guard_blocked ${totalGuardBlocked})`)

    // Single catalog-id mode: only one pass needed.
    if (args.catalogId) break
  }

  console.log(`[reenrich-taste] DONE — succeeded ${totalSucceeded}/${totalProcessed}, guard_blocked ${totalGuardBlocked}, elapsed ${Date.now() - startedAt}ms`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[reenrich-taste] fatal:', err)
  process.exit(1)
})
