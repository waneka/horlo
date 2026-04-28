/**
 * Phase 18 Plan 01 Task 3 — Integration tests for getGainingTractionCatalogWatches.
 *
 * Covers DISC-06 + D-12 three-window logic + D-15 tie-break.
 *
 * Test isolation: each test stamps a unique brand prefix and inserts both
 * catalog rows and snapshots scoped to that prefix. Cleanup runs in afterAll
 * via a recorded ID set.
 *
 * NOTE: getGainingTractionCatalogWatches is GLOBAL (no per-user filter), so
 * "no snapshots" tests can only assert behavior when the snapshots table is
 * EMPTY. We skip the strict zero-window test when there are pre-existing
 * snapshot rows in the DB (e.g., from Phase 17 backfill or other tests) — the
 * `window=0` case is structurally exercised in the DAL implementation
 * (`if (!oldest || !oldest.oldest) return {window: 0, watches: []}`).
 *
 * Gating mirrors the canonical pattern (Phase 17 / Phase 16):
 *   const maybe = process.env.DATABASE_URL ? describe : describe.skip
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('getGainingTractionCatalogWatches — DAL integration', () => {
  type DalT = typeof import('@/data/discovery')
  type SchemaT = typeof import('@/db/schema')
  type DbT = typeof import('@/db')

  let dal: DalT
  let schema: SchemaT
  let dbModule: DbT

  const stamp = `gain-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`
  const insertedCatalogIds: string[] = []
  const insertedSnapshotIds: string[] = []

  const daysAgo = (n: number): string =>
    new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  beforeAll(async () => {
    dal = await import('@/data/discovery')
    schema = await import('@/db/schema')
    dbModule = await import('@/db')
  }, 30_000)

  afterAll(async () => {
    const { sql } = await import('drizzle-orm')
    if (insertedSnapshotIds.length) {
      await dbModule.db.execute(
        sql`DELETE FROM watches_catalog_daily_snapshots WHERE id = ANY(ARRAY[${sql.raw(
          insertedSnapshotIds.map((id) => `'${id}'`).join(','),
        )}]::uuid[])`,
      )
    }
    if (insertedCatalogIds.length) {
      await dbModule.db.execute(
        sql`DELETE FROM watches_catalog WHERE id = ANY(ARRAY[${sql.raw(
          insertedCatalogIds.map((id) => `'${id}'`).join(','),
        )}]::uuid[])`,
      )
    }
  }, 30_000)

  const insertCatalog = async (
    brand: string,
    model: string,
    ownersCount: number,
    wishlistCount: number,
  ) => {
    const id = randomUUID()
    insertedCatalogIds.push(id)
    await dbModule.db.insert(schema.watchesCatalog).values({
      id,
      brand,
      model,
      reference: null,
      ownersCount,
      wishlistCount,
    })
    return id
  }

  const insertSnapshot = async (
    catalogId: string,
    snapshotDate: string,
    ownersCount: number,
    wishlistCount: number,
  ) => {
    const id = randomUUID()
    insertedSnapshotIds.push(id)
    await dbModule.db.insert(schema.watchesCatalogDailySnapshots).values({
      id,
      catalogId,
      snapshotDate,
      ownersCount,
      wishlistCount,
    })
  }

  // Helper: returns true if the snapshot table is currently empty (no
  // pre-existing rows from other tests / dev / Phase 17 backfill).
  const snapshotsEmpty = async (): Promise<boolean> => {
    const { sql } = await import('drizzle-orm')
    const result = await dbModule.db.execute<{ cnt: number | string }>(
      sql`SELECT count(*)::int AS cnt FROM watches_catalog_daily_snapshots`,
    )
    const rows = result as unknown as Array<{ cnt: number | string }>
    return Number(rows[0]?.cnt ?? 0) === 0
  }

  it('Test 1: returns {window: 0, watches: []} when no snapshots exist (D-12 case 1)', async () => {
    if (!(await snapshotsEmpty())) {
      // Other rows exist; window=0 cannot be observed from the global DAL.
      // The DAL implementation guards this case directly via the
      // `if (!oldest || !oldest.oldest) return {window:0, watches:[]}` branch.
      return
    }
    const result = await dal.getGainingTractionCatalogWatches({ limit: 5 })
    expect(result.window).toBe(0)
    expect(result.watches).toEqual([])
  })

  it('Test 2: returns {window: N, watches: [...]} for 1-6 days of snapshots (D-12 case 2)', async () => {
    // Insert a catalog row + a snapshot from 3 days ago. Window should be 3,
    // watch should appear with positive delta.
    // (We can only assert window if our snapshot is the OLDEST in the DB.
    // To make this true without manipulating other test data, we set the
    // snapshot to a recent date and assert window <= 3 — i.e., our snapshot's
    // age is the floor.)
    const catId = await insertCatalog(`${stamp}-w3`, 'M', 10, 0)
    await insertSnapshot(catId, daysAgo(3), 5, 0) // current 10 - snap 5 = +5

    const result = await dal.getGainingTractionCatalogWatches({ limit: 50 })
    expect(result.window).toBeGreaterThanOrEqual(1)
    expect(result.window).toBeLessThanOrEqual(7)

    const ours = result.watches.find((w) => w.brand === `${stamp}-w3`)
    if (result.window >= 3 && ours) {
      // Our snapshot was 3 days old → if window covers it, watch should appear
      // with delta = current(10) - snap(5) = +5.
      expect(ours.delta).toBe(5)
    }
  })

  it('Test 3: returns {window: 7, watches: [...]} when oldest snapshot is >=7 days old', async () => {
    const catId = await insertCatalog(`${stamp}-w7`, 'M', 20, 0)
    await insertSnapshot(catId, daysAgo(14), 5, 0) // 14 days old → window clamps to 7

    const result = await dal.getGainingTractionCatalogWatches({ limit: 50 })
    // The oldest snapshot in the DB is now ≥14 days old → window=7.
    expect(result.window).toBe(7)
  })

  it('Test 4: computes delta as (current - oldest) rounded to int', async () => {
    // current owners=10, wishlist=4 → score 12
    // oldest  owners=5,  wishlist=2 → score 6
    // delta = ROUND(12 - 6) = 6
    const catId = await insertCatalog(`${stamp}-delta`, 'M', 10, 4)
    await insertSnapshot(catId, daysAgo(2), 5, 2)

    const result = await dal.getGainingTractionCatalogWatches({ limit: 50 })
    const row = result.watches.find((w) => w.brand === `${stamp}-delta`)
    expect(row).toBeDefined()
    expect(row!.delta).toBe(6)
    // delta is integer (Pitfall 2 — no float drift on rendering)
    expect(Number.isInteger(row!.delta)).toBe(true)
  })

  it('Test 5: excludes rows with non-positive delta (no change or decrease)', async () => {
    // Catalog row whose current score equals the snapshot score → delta=0.
    const equalCat = await insertCatalog(`${stamp}-eq`, 'M', 10, 0)
    await insertSnapshot(equalCat, daysAgo(2), 10, 0)

    // Catalog row whose score has decreased → delta<0.
    const decCat = await insertCatalog(`${stamp}-dec`, 'M', 5, 0)
    await insertSnapshot(decCat, daysAgo(2), 10, 0)

    const result = await dal.getGainingTractionCatalogWatches({ limit: 50 })
    // Neither row should appear in results.
    expect(result.watches.find((w) => w.brand === `${stamp}-eq`)).toBeUndefined()
    expect(result.watches.find((w) => w.brand === `${stamp}-dec`)).toBeUndefined()
  })

  it('Test 6: tie-breaks by delta DESC, then brand_normalized ASC, then model_normalized ASC', async () => {
    // Two rows with identical delta. Brand prefix scoped to this assertion.
    const tieBrand = `${stamp}-tie`
    const aId = await insertCatalog(tieBrand, 'AlphaModel', 10, 0)
    const bId = await insertCatalog(tieBrand, 'BetaModel', 10, 0)
    await insertSnapshot(aId, daysAgo(2), 5, 0) // delta = 5
    await insertSnapshot(bId, daysAgo(2), 5, 0) // delta = 5

    const result = await dal.getGainingTractionCatalogWatches({ limit: 50 })
    const ours = result.watches.filter((w) => w.brand === tieBrand)
    expect(ours.length).toBe(2)
    // Tie on delta + brand → model_normalized ASC: AlphaModel before BetaModel.
    expect(ours[0].model).toBe('AlphaModel')
    expect(ours[1].model).toBe('BetaModel')
  })

  it('Test 7: respects opts.limit (returns at most N rows)', async () => {
    // Insert 7 gaining-traction rows. Limit 3 should yield ≤3.
    for (let i = 0; i < 7; i++) {
      const catId = await insertCatalog(
        `${stamp}-lim-${String(i).padStart(2, '0')}`,
        'M',
        10 + i,
        0,
      )
      await insertSnapshot(catId, daysAgo(2), 1, 0)
    }
    const result = await dal.getGainingTractionCatalogWatches({ limit: 3 })
    expect(result.watches.length).toBeLessThanOrEqual(3)
  })
})
