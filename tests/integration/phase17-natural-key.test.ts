/**
 * Phase 17 Plan 01 — Wave 0 RED stubs for natural-key dedup behavior.
 * Tests cover: CAT-01 behavior (D-01 NULLS NOT DISTINCT, D-02 casing collapse, D-03 reference normalization).
 *
 * Gated on DATABASE_URL so CI stays green without the local stack.
 * These tests are RED until Task 4's [BLOCKING] schema push runs the migrations.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/db'
import { watchesCatalog } from '@/db/schema'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 17 natural-key dedup — CAT-01 behavior (D-01, D-02, D-03)', () => {
  // Unique stamp per test run to avoid collisions across test runs
  const stamp = Date.now().toString(36)
  const allIds: string[] = []

  afterAll(async () => {
    if (allIds.length === 0) return
    await db.execute(
      sql`DELETE FROM watches_catalog WHERE id = ANY(ARRAY[${sql.raw(allIds.map((id) => `'${id}'`).join(','))}]::uuid[])`
    )
  }, 60_000)

  it('casing collapse — two rows with different casing dedup to 1', async () => {
    const id1 = randomUUID()
    const id2 = randomUUID()
    allIds.push(id1, id2)

    // Insert Rolex / Submariner / 116610LN
    await db.execute(sql`
      INSERT INTO watches_catalog (id, brand, model, reference, source)
      VALUES (${id1}::uuid, ${'Rolex_' + stamp}, ${'Submariner_' + stamp}, '116610LN', 'user_promoted')
      ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO NOTHING
    `)
    // Insert ROLEX / submariner / 116610LN — same normalized trio
    await db.execute(sql`
      INSERT INTO watches_catalog (id, brand, model, reference, source)
      VALUES (${id2}::uuid, ${'ROLEX_' + stamp}, ${'submariner_' + stamp}, '116610LN', 'user_promoted')
      ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO NOTHING
    `)

    const countResult = await db.execute(sql`
      SELECT count(*) AS cnt
        FROM watches_catalog
       WHERE brand_normalized = ${'rolex_' + stamp}
    `)
    const rows = (countResult as unknown as Array<{ cnt: string | number }>) ?? []
    expect(Number(rows[0].cnt)).toBe(1)
  })

  it('reference normalization — 116610LN / 116610 LN / 116610-LN / 116610.LN all collapse to 1 row', async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()]
    allIds.push(...ids)
    const brand = 'RolexRef_' + stamp
    const model = 'SubRef_' + stamp

    // Note: reference normalization strips ALL non-alphanumeric chars via regexp_replace '[^a-z0-9]+'
    // '116610LN_ref' → lower → '116610ln_ref' → strip non-alphanum → '116610lnref'
    // '116610 LN_ref' → '116610lnref', '116610-LN_ref' → '116610lnref', '116610.LN_ref' → '116610lnref'
    const refs = ['116610LNref', '116610 LNref', '116610-LNref', '116610.LNref']
    for (let i = 0; i < refs.length; i++) {
      await db.execute(sql`
        INSERT INTO watches_catalog (id, brand, model, reference, source)
        VALUES (${ids[i]}::uuid, ${brand}, ${model}, ${refs[i]}, 'user_promoted')
        ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO NOTHING
      `)
    }

    const countResult = await db.execute(sql`
      SELECT count(*) AS cnt, reference_normalized
        FROM watches_catalog
       WHERE brand_normalized = ${brand.toLowerCase()}
         AND model_normalized = ${model.toLowerCase()}
      GROUP BY reference_normalized
    `)
    const rows = (countResult as unknown as Array<{ cnt: string | number; reference_normalized: string }>) ?? []
    // All four should collapse to a single row with reference_normalized = '116610lnref'
    // (spaces, dashes, dots all stripped by regexp_replace '[^a-z0-9]+')
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].cnt)).toBe(1)
    expect(rows[0].reference_normalized).toBe('116610lnref')
  })

  it('nulls collide (NULLS NOT DISTINCT) — two NULL-reference rows dedup to 1', async () => {
    const id1 = randomUUID()
    const id2 = randomUUID()
    allIds.push(id1, id2)
    const brand = 'RolexNull_' + stamp
    const model = 'SubNull_' + stamp

    // Insert first (no reference = NULL)
    await db.execute(sql`
      INSERT INTO watches_catalog (id, brand, model, reference, source)
      VALUES (${id1}::uuid, ${brand}, ${model}, NULL, 'user_promoted')
      ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO NOTHING
    `)
    // Insert second with same brand/model and NULL reference — should collide (NULLS NOT DISTINCT)
    await db.execute(sql`
      INSERT INTO watches_catalog (id, brand, model, reference, source)
      VALUES (${id2}::uuid, ${brand}, ${model}, NULL, 'user_promoted')
      ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO NOTHING
    `)

    const countResult = await db.execute(sql`
      SELECT count(*) AS cnt
        FROM watches_catalog
       WHERE brand_normalized = ${brand.toLowerCase()}
         AND model_normalized = ${model.toLowerCase()}
         AND reference_normalized IS NULL
    `)
    const rows = (countResult as unknown as Array<{ cnt: string | number }>) ?? []
    // D-01: NULLS NOT DISTINCT means both NULL refs collide → only 1 row
    expect(Number(rows[0].cnt)).toBe(1)
  })

  it('different references = different rows (D-07 dialColor sibling)', async () => {
    const id1 = randomUUID()
    const id2 = randomUUID()
    allIds.push(id1, id2)
    const brand = 'RolexDiff_' + stamp
    const model = 'SubDiff_' + stamp

    await db.execute(sql`
      INSERT INTO watches_catalog (id, brand, model, reference, source)
      VALUES (${id1}::uuid, ${brand}, ${model}, '116610LN_diff', 'user_promoted')
      ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO NOTHING
    `)
    await db.execute(sql`
      INSERT INTO watches_catalog (id, brand, model, reference, source)
      VALUES (${id2}::uuid, ${brand}, ${model}, '116610LB_diff', 'user_promoted')
      ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO NOTHING
    `)

    const countResult = await db.execute(sql`
      SELECT count(*) AS cnt
        FROM watches_catalog
       WHERE brand_normalized = ${brand.toLowerCase()}
         AND model_normalized = ${model.toLowerCase()}
    `)
    const rows = (countResult as unknown as Array<{ cnt: string | number }>) ?? []
    // Different references → 2 distinct rows
    expect(Number(rows[0].cnt)).toBe(2)
  })
})
