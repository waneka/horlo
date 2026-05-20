import { describe, it, expect, afterAll } from 'vitest'
import { db } from '@/db'
import { watchesCatalog } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { updateCatalogTaste, applyUserUploadedPhoto } from '@/data/catalog'
import type { CatalogTasteAttributes } from '@/lib/types'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

const TEST_BRAND = `_test_taste_${Date.now()}`

// Phase 49.1 Plan 06 — primaryArchetype dropped from CatalogTasteAttributes
// and from the updateCatalogTaste UPSERT SQL. Fixture matches the post-49.1
// shape.
const VALID_TASTE: CatalogTasteAttributes = {
  formality: 0.7,
  sportiness: 0.2,
  heritageScore: 0.8,
  eraSignal: 'modern',
  designMotifs: ['gilt-dial', 'breguet-hands'],
  confidence: 0.85,
  extractedFromPhoto: false,
}

async function insertTestRow(
  seed: Partial<typeof watchesCatalog.$inferInsert> = {},
): Promise<string> {
  const [row] = await db
    .insert(watchesCatalog)
    .values({
      brand: TEST_BRAND,
      model: `model-${Math.random()}`,
      ...seed,
    })
    .returning({ id: watchesCatalog.id })
  return row.id
}

afterAll(async () => {
  await db.execute(sql`DELETE FROM watches_catalog WHERE brand = ${TEST_BRAND}`)
})

maybe('updateCatalogTaste', () => {
  it('writes all 7 taste fields when confidence is NULL', async () => {
    // Phase 49.1 Plan 06 — taste field count dropped from 8 to 7
    // (primary_archetype removed). The DB column still exists until Plans 07/08
    // drop it; the SQL UPDATE no longer writes it.
    const id = await insertTestRow()
    const result = await updateCatalogTaste(id, VALID_TASTE)
    expect(result.updated).toBe(true)
    const [row] = await db
      .select()
      .from(watchesCatalog)
      .where(eq(watchesCatalog.id, id))
    expect(Number(row.formality)).toBeCloseTo(0.7, 5)
    expect(Number(row.sportiness)).toBeCloseTo(0.2, 5)
    expect(Number(row.heritageScore)).toBeCloseTo(0.8, 5)
    expect(row.eraSignal).toBe('modern')
    expect(row.designMotifs).toEqual(['gilt-dial', 'breguet-hands'])
    expect(Number(row.confidence)).toBeCloseTo(0.85, 5)
    expect(row.extractedFromPhoto).toBe(false)
  })

  it('persists extractedFromPhoto=true when taste is from vision mode (D-22)', async () => {
    const id = await insertTestRow()
    const result = await updateCatalogTaste(id, { ...VALID_TASTE, extractedFromPhoto: true })
    expect(result.updated).toBe(true)
    const [row] = await db
      .select()
      .from(watchesCatalog)
      .where(eq(watchesCatalog.id, id))
    expect(row.extractedFromPhoto).toBe(true)
  })

  it('skip when has confidence', async () => {
    const id = await insertTestRow()
    // First write — sets confidence to 0.5
    await updateCatalogTaste(id, { ...VALID_TASTE, confidence: 0.5 })
    // Second call should NOT update (confidence IS NOT NULL now)
    const result = await updateCatalogTaste(id, {
      ...VALID_TASTE,
      formality: 0.99,
      confidence: 0.95,
    })
    expect(result.updated).toBe(false)
    const [row] = await db
      .select()
      .from(watchesCatalog)
      .where(eq(watchesCatalog.id, id))
    // formality unchanged at original value
    expect(Number(row.formality)).toBeCloseTo(0.7, 5)
  })

  it('force overwrites', async () => {
    const id = await insertTestRow()
    await updateCatalogTaste(id, { ...VALID_TASTE, confidence: 0.5 })
    const result = await updateCatalogTaste(
      id,
      { ...VALID_TASTE, formality: 0.99 },
      { force: true },
    )
    expect(result.updated).toBe(true)
    const [row] = await db
      .select()
      .from(watchesCatalog)
      .where(eq(watchesCatalog.id, id))
    expect(Number(row.formality)).toBeCloseTo(0.99, 5)
  })

  it('writes empty designMotifs as empty array (not NULL)', async () => {
    const id = await insertTestRow()
    const result = await updateCatalogTaste(id, { ...VALID_TASTE, designMotifs: [] })
    expect(result.updated).toBe(true)
    const [row] = await db
      .select()
      .from(watchesCatalog)
      .where(eq(watchesCatalog.id, id))
    expect(row.designMotifs).toEqual([])
  })

  // D-08 downgrade guard: block text-mode force write on vision+high-confidence row
  it('guard blocks text-mode force write on vision row with confidence >= 0.7 (D-08)', async () => {
    const id = await insertTestRow()
    // Establish: vision-derived, high-confidence
    await updateCatalogTaste(id, { ...VALID_TASTE, extractedFromPhoto: true, confidence: 0.9 }, { force: true })
    // Attempt: text-mode force write — should be blocked
    const result = await updateCatalogTaste(id, { ...VALID_TASTE, extractedFromPhoto: false, formality: 0.01 }, { force: true })
    expect(result.updated).toBe(false)
    // Original formality value remains unchanged
    const [row] = await db.select().from(watchesCatalog).where(eq(watchesCatalog.id, id))
    expect(Number(row.formality)).toBeCloseTo(VALID_TASTE.formality, 5)
  })

  // D-08 downgrade guard: vision-mode force write on vision+high-confidence row is allowed
  it('guard allows vision-mode force write on vision row (D-08 — legit refresh)', async () => {
    const id = await insertTestRow()
    await updateCatalogTaste(id, { ...VALID_TASTE, extractedFromPhoto: true, confidence: 0.9 }, { force: true })
    const result = await updateCatalogTaste(id, { ...VALID_TASTE, extractedFromPhoto: true, formality: 0.01 }, { force: true })
    expect(result.updated).toBe(true)
  })

  // D-08 downgrade guard: text-mode force write is allowed when existing confidence < 0.7
  it('guard allows text-mode force write when existing confidence < 0.7', async () => {
    const id = await insertTestRow()
    await updateCatalogTaste(id, { ...VALID_TASTE, extractedFromPhoto: true, confidence: 0.5 }, { force: true })
    const result = await updateCatalogTaste(id, { ...VALID_TASTE, extractedFromPhoto: false, formality: 0.01 }, { force: true })
    expect(result.updated).toBe(true)
  })
})

maybe('applyUserUploadedPhoto', () => {
  it('sets image_source_quality=user_uploaded when NULL', async () => {
    const id = await insertTestRow()
    const result = await applyUserUploadedPhoto(id, {
      imageUrl: 'https://example.com/test.jpg',
      imageSourceUrl: 'user-uuid/pending/abc.jpg',
    })
    expect(result.applied).toBe(true)
    const [row] = await db
      .select()
      .from(watchesCatalog)
      .where(eq(watchesCatalog.id, id))
    expect(row.imageSourceQuality).toBe('user_uploaded')
    expect(row.imageUrl).toBe('https://example.com/test.jpg')
    expect(row.imageSourceUrl).toBe('user-uuid/pending/abc.jpg')
  })

  it('does NOT overwrite existing official image_source_quality (COALESCE)', async () => {
    const id = await insertTestRow({
      imageUrl: 'https://existing.com/x.jpg',
      imageSourceUrl: 'https://existing.com/source',
      imageSourceQuality: 'official',
    })
    const result = await applyUserUploadedPhoto(id, {
      imageUrl: 'https://new.com/test.jpg',
      imageSourceUrl: 'user-uuid/pending/abc.jpg',
    })
    expect(result.applied).toBe(false)
    const [row] = await db
      .select()
      .from(watchesCatalog)
      .where(eq(watchesCatalog.id, id))
    expect(row.imageSourceQuality).toBe('official')
    expect(row.imageUrl).toBe('https://existing.com/x.jpg')
  })

  it('rejects non-http imageUrl (T-19.1-04-04)', async () => {
    const id = await insertTestRow()
    const result = await applyUserUploadedPhoto(id, {
      imageUrl: 'javascript:alert(1)',
      imageSourceUrl: 'user-uuid/pending/abc.jpg',
    })
    expect(result.applied).toBe(false)
    const [row] = await db
      .select()
      .from(watchesCatalog)
      .where(eq(watchesCatalog.id, id))
    expect(row.imageUrl).toBeNull()
  })
})
