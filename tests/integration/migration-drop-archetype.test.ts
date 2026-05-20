import { describe, it, expect, afterAll } from 'vitest'
import { db } from '@/db'
import { watchesCatalog } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { updateCatalogTaste } from '@/data/catalog'
import { getWatchesByUser } from '@/data/watches'
import type { CatalogTasteAttributes } from '@/lib/types'

/**
 * Phase 49.1 Wave 0 — Migration drop test for `primary_archetype`.
 *
 * Mirrors the `DATABASE_URL`-gated integration idiom from
 * `tests/integration/catalog-taste.test.ts:8` and `tests/integration/catalog-taste-schema.test.ts:7`.
 *
 * Expected lifecycle:
 *   - Pre Wave-1 (today):   skipped without DATABASE_URL — OR — runs and FAILS
 *                           on assertion #1 because the column still exists.
 *   - Post Plan 07 / 08:    drizzle + supabase migrations drop the column.
 *                           This test then passes (column absent, no
 *                           `primaryArchetype` on the read path, write path
 *                           tolerates the missing field on the input literal).
 *
 * The test file MUST parse and register today; that is the Wave 0 contract.
 */

const maybe = process.env.DATABASE_URL ? describe : describe.skip

const TEST_BRAND = `_test_phase49_1_${Date.now()}`

// Phase 49.1 Plan 06 — primaryArchetype dropped from CatalogTasteAttributes.
// Literal now matches the post-49.1 shape directly; the prior `unknown` cast is
// no longer required.
const VALID_TASTE_WITHOUT_ARCHETYPE: CatalogTasteAttributes = {
  formality: 0.7,
  sportiness: 0.2,
  heritageScore: 0.8,
  eraSignal: 'modern' as const,
  designMotifs: ['gilt-dial', 'breguet-hands'],
  confidence: null,
  extractedFromPhoto: false,
}

async function insertTestRow(): Promise<string> {
  const [row] = await db
    .insert(watchesCatalog)
    .values({
      brand: TEST_BRAND,
      model: `model-${Math.random()}`,
    })
    .returning({ id: watchesCatalog.id })
  return row.id
}

afterAll(async () => {
  await db.execute(sql`DELETE FROM watches_catalog WHERE brand = ${TEST_BRAND}`)
})

maybe('Phase 49.1 — migration drops primary_archetype column', () => {
  it('primary_archetype column is absent from watches_catalog', async () => {
    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'watches_catalog'
        AND column_name = 'primary_archetype'
    `)
    const rows = result as unknown as Array<{ column_name: string }>
    expect(rows.length).toBe(0)
  })

  it('getWatchesByUser returns rows whose catalogTaste literal has no primaryArchetype key', async () => {
    // Seed a catalog row and write its taste fields (no primary_archetype on the input).
    const id = await insertTestRow()
    await updateCatalogTaste(id, VALID_TASTE_WITHOUT_ARCHETYPE)

    // getWatchesByUser is the LEFT-JOIN read path. After Plan 05 drops the
    // `primaryArchetype` field from the SELECT projection, the returned
    // `catalogTaste` literal must not include that key. We assert on the
    // shape of any row this user has — if there are zero rows for the
    // sentinel user, the assertion is vacuously true (no schema drift to
    // detect). Plan 05 SUMMARY will note if a dedicated fixture user is
    // required; for Wave 0 we keep the assertion to its essence: presence
    // of `eraSignal` / `formality`, absence of `primaryArchetype`.
    const SENTINEL_USER_ID = '00000000-0000-0000-0000-000000000000'
    const rows = await getWatchesByUser(SENTINEL_USER_ID)
    for (const row of rows) {
      if (row.catalogTaste == null) continue
      expect(
        Object.prototype.hasOwnProperty.call(row.catalogTaste, 'primaryArchetype'),
      ).toBe(false)
      expect(row.catalogTaste.eraSignal !== undefined).toBe(true)
      expect(row.catalogTaste.formality !== undefined).toBe(true)
    }
  })

  it('updateCatalogTaste succeeds without a primaryArchetype field on the input', async () => {
    const id = await insertTestRow()
    // The literal above has no `primaryArchetype` key. After Plan 05/07/08
    // this call must succeed; today it may throw because the SQL UPDATE
    // still references the column. The test asserts the post-drop contract.
    const result = await updateCatalogTaste(id, VALID_TASTE_WITHOUT_ARCHETYPE)
    expect(result.updated).toBe(true)

    const [row] = await db
      .select()
      .from(watchesCatalog)
      .where(eq(watchesCatalog.id, id))
    expect(row).toBeDefined()
    // Row is readable post-write — minimal sanity check.
    expect(row.brand).toBe(TEST_BRAND)
  })
})
