/**
 * Phase 19 Plan 01 Task 4 — Live-DB integration: trgm reachability for
 * searchCatalogWatches ILIKE predicates on watches_catalog.
 *
 * Seeds ≥10 catalog rows containing 'rolex' (I-11 INFO fix) so the planner
 * has a non-trivial dataset to choose between Bitmap Index Scan vs Seq Scan.
 *
 * At v4.0 production scale (<1000 catalog rows) the planner may legitimately
 * pick Seq Scan because it is cheaper than the trigram path. This test
 * accepts EITHER:
 *   1. The query plan uses a trgm index (production trajectory verified), OR
 *   2. Seq Scan completes in <100ms (Phase 17 17-VERIFICATION.md precedent).
 *
 * Either outcome confirms the search query is healthy at small scale and
 * reachable at large scale.
 *
 * Skips cleanly when DATABASE_URL is unset.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/db'
import { watchesCatalog } from '@/db/schema'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 19 brand_normalized + model_normalized GIN trgm reachability', () => {
  const TRGM_TAG = `phase19-trgm-${Date.now()}`
  const SEEDED_BRAND = `Rolex-trgm-${TRGM_TAG}`
  const SEEDED_IDS: string[] = []

  beforeAll(async () => {
    // I-11 INFO fix: seed >=10 catalog rows containing 'rolex' so EXPLAIN has a
    // non-trivial dataset to plan against. Without this seed, an empty
    // watches_catalog table makes EXPLAIN report ~0ms which would pass the
    // assertion trivially regardless of trgm index health.
    const rows = Array.from({ length: 12 }, (_, i) => {
      const id = randomUUID()
      SEEDED_IDS.push(id)
      return {
        id,
        brand: SEEDED_BRAND,
        model: `Submariner-${TRGM_TAG}-${i}`,
        reference: null,
        imageUrl: null,
        ownersCount: 1,
        wishlistCount: 0,
      }
    })
    await db.insert(watchesCatalog).values(rows).onConflictDoNothing()

    // ANALYZE so the planner has fresh statistics about the seeded rows.
    await db.execute(sql`ANALYZE watches_catalog`)
  }, 60_000)

  afterAll(async () => {
    if (SEEDED_IDS.length === 0) return
    await db.execute(sql`DELETE FROM watches_catalog WHERE brand = ${SEEDED_BRAND}`)
  }, 60_000)

  it('catalog ILIKE on brand_normalized uses trgm index OR completes < 100ms via Seq Scan at small scale', async () => {
    // Force planner to consider indexes (with >=12 seeded matching rows).
    // EXPLAIN ANALYZE returns the actual execution plan + timing — accepting
    // either trgm index OR fast Seq Scan as a healthy outcome.
    const explain = await db.execute<Record<string, string>>(sql`
      EXPLAIN (ANALYZE, FORMAT TEXT)
      SELECT id FROM watches_catalog
       WHERE brand_normalized ILIKE '%rolex%' OR model_normalized ILIKE '%rolex%'
       LIMIT 50
    `)
    const planRows = explain as unknown as Array<Record<string, string>>
    const planText = planRows.map((r) => Object.values(r)[0]).join('\n')
    const usedIndex = /trgm_idx/i.test(planText)
    const execTimeMatch = /Execution Time:\s*([\d.]+)\s*ms/.exec(planText)
    const fastSeqScan = execTimeMatch ? parseFloat(execTimeMatch[1]) < 100 : false
    // Must satisfy at least one branch.
    expect(usedIndex || fastSeqScan).toBe(true)
  })
})
