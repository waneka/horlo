/**
 * Phase 18 Plan 01 Task 2 — Integration tests for getTrendingCatalogWatches.
 *
 * Covers DISC-05. Score = owners_count + 0.5 * wishlist_count, ordered DESC,
 * tie-break by brand_normalized ASC, model_normalized ASC (D-15). Excludes
 * score === 0 rows (no-signal noise per RESEARCH Pattern 5 line 577).
 *
 * Gating mirrors the canonical pattern (Phase 17 / Phase 16):
 *   const maybe = process.env.DATABASE_URL ? describe : describe.skip
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('getTrendingCatalogWatches — DAL integration', () => {
  type DalT = typeof import('@/data/discovery')
  type SchemaT = typeof import('@/db/schema')
  type DbT = typeof import('@/db')

  let dal: DalT
  let schema: SchemaT
  let dbModule: DbT
  // Per-test-run stamp prevents collisions with other rows in the catalog
  // (e.g., Phase 17 backfill, other tests, dev data) by giving each test a
  // unique brand prefix it can scope its assertions to.
  const stamp = `trend-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`
  const insertedIds: string[] = []

  beforeAll(async () => {
    dal = await import('@/data/discovery')
    schema = await import('@/db/schema')
    dbModule = await import('@/db')
  }, 30_000)

  afterAll(async () => {
    if (insertedIds.length === 0) return
    const { sql } = await import('drizzle-orm')
    await dbModule.db.execute(
      sql`DELETE FROM watches_catalog WHERE id = ANY(ARRAY[${sql.raw(
        insertedIds.map((id) => `'${id}'`).join(','),
      )}]::uuid[])`,
    )
  }, 30_000)

  const insertCatalog = async (
    brand: string,
    model: string,
    ownersCount: number,
    wishlistCount: number,
  ) => {
    const id = randomUUID()
    insertedIds.push(id)
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

  beforeEach(async () => {
    if (insertedIds.length === 0) return
    const { sql } = await import('drizzle-orm')
    await dbModule.db.execute(
      sql`DELETE FROM watches_catalog WHERE id = ANY(ARRAY[${sql.raw(
        insertedIds.map((id) => `'${id}'`).join(','),
      )}]::uuid[])`,
    )
    insertedIds.length = 0
  })

  it('Test 1: orders rows by (owners_count + 0.5 * wishlist_count) DESC + excludes score=0', async () => {
    // Three rows with brand prefix scoped to this test's stamp.
    // Row 1: owners=10, wishlist=0 → score 10
    // Row 2: owners=5,  wishlist=10 → score 10 (tie with Row 1)
    // Row 3: owners=0,  wishlist=0  → score 0 (excluded)
    await insertCatalog(`${stamp}-aaa`, 'Sub10', 10, 0)
    await insertCatalog(`${stamp}-bbb`, 'Sub10', 5, 10)
    await insertCatalog(`${stamp}-ccc`, 'Zero', 0, 0)

    const result = await dal.getTrendingCatalogWatches({ limit: 50 })
    const ours = result.filter((r) => r.brand.startsWith(stamp))
    // Row 3 (score 0) must NOT appear.
    expect(ours.find((r) => r.brand.endsWith('-ccc'))).toBeUndefined()
    // Both score=10 rows should appear.
    expect(ours.length).toBe(2)
    // Score=10 rows should both be returned, ordered by brand_normalized ASC
    // for tie-break (aaa before bbb).
    expect(ours[0].brand.endsWith('-aaa')).toBe(true)
    expect(ours[1].brand.endsWith('-bbb')).toBe(true)
  })

  it('Test 2: tie-breaks by brand_normalized ASC then model_normalized ASC', async () => {
    // Two rows with identical owners + wishlist (score 5).
    // Same brand prefix → tie-break falls through to model.
    const sameBrand = `${stamp}-tie`
    await insertCatalog(sameBrand, 'BetaModel', 5, 0)
    await insertCatalog(sameBrand, 'AlphaModel', 5, 0)

    const result = await dal.getTrendingCatalogWatches({ limit: 50 })
    const ours = result.filter((r) => r.brand === sameBrand)
    expect(ours.length).toBe(2)
    // model_normalized lower-trim makes 'AlphaModel' < 'BetaModel'.
    expect(ours[0].model).toBe('AlphaModel')
    expect(ours[1].model).toBe('BetaModel')
  })

  it('Test 3: respects opts.limit (returns at most N rows)', async () => {
    // Insert 7 trending rows scoped to this stamp.
    for (let i = 0; i < 7; i++) {
      await insertCatalog(`${stamp}-lim-${String(i).padStart(2, '0')}`, 'M', i + 1, 0)
    }
    const result = await dal.getTrendingCatalogWatches({ limit: 3 })
    // We can't assert exactly 3 from "ours" — the DAL returns the global top 3.
    // But we can assert the overall result is at most 3.
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('Test 4: zero-signal exclusion — owners=0 + wishlist=0 row never returned', async () => {
    await insertCatalog(`${stamp}-zero`, 'M', 0, 0)
    const result = await dal.getTrendingCatalogWatches({ limit: 50 })
    expect(result.find((r) => r.brand === `${stamp}-zero`)).toBeUndefined()
  })

  it('Test 5: returns the denormalized counts populated by Phase 17 cron', async () => {
    await insertCatalog(`${stamp}-counts`, 'CheckCounts', 42, 10)
    const result = await dal.getTrendingCatalogWatches({ limit: 50 })
    const row = result.find((r) => r.brand === `${stamp}-counts`)
    expect(row).toBeDefined()
    expect(row!.ownersCount).toBe(42)
    expect(row!.wishlistCount).toBe(10)
  })
})
