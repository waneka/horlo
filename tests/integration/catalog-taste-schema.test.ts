import { describe, it, expect, afterAll } from 'vitest'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { watchesCatalog } from '@/db/schema'
// Phase 49.1 Plan 06 — PRIMARY_ARCHETYPES no longer asserted here; the
// primary_archetype CHECK constraint tests are removed alongside the column
// drop (Plans 07/08 ship the migration). PRIMARY_ARCHETYPES const itself is
// retained in vocab.ts for /explore CollectorArchetypes (D-EXPLORE-02).
import { ERA_SIGNALS } from '@/lib/taste/vocab'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

const TEST_BRAND = `_test_schema_${Date.now()}`

// Drizzle wraps postgres.js errors — the constraint message lives in
// err.message OR err.cause.message. Mirrors the pattern from phase17-schema.test.ts.
function isCheckConstraintError(e: unknown): boolean {
  const err = e as { message?: string; cause?: { message?: string } }
  const text = `${err.message ?? ''} ${err.cause?.message ?? ''}`
  return /check constraint|violates|watches_catalog/i.test(text)
}

afterAll(async () => {
  await db.execute(sql`DELETE FROM watches_catalog WHERE brand = ${TEST_BRAND}`)
})

maybe('watches_catalog CHECK constraints', () => {
  // Phase 49.1 Plan 06 — primary_archetype CHECK-constraint tests removed
  // alongside the column drop (Plans 07/08). Era / image_source_quality
  // CHECK-constraint tests remain as the surviving sibling pattern.

  it.each([...ERA_SIGNALS])('accepts valid era_signal: %s', async (era) => {
    const result = await db.execute<{ id: string }>(sql`
      INSERT INTO watches_catalog (brand, model, era_signal)
      VALUES (${TEST_BRAND}, ${`era-${era}`}, ${era})
      RETURNING id
    `)
    expect((result as unknown as Array<{ id: string }>).length).toBe(1)
  })

  it('rejects bad era_signal', async () => {
    await expect(
      db.execute(sql`
        INSERT INTO watches_catalog (brand, model, era_signal)
        VALUES (${TEST_BRAND}, 'bad-era', 'PRE_HISTORIC')
      `),
    ).rejects.toSatisfy(isCheckConstraintError)
  })

  it('accepts user_uploaded image_source_quality', async () => {
    const result = await db.execute<{ id: string }>(sql`
      INSERT INTO watches_catalog (brand, model, image_source_quality)
      VALUES (${TEST_BRAND}, 'image-uu', 'user_uploaded')
      RETURNING id
    `)
    expect((result as unknown as Array<{ id: string }>).length).toBe(1)
  })

  it('rejects bogus image_source_quality', async () => {
    await expect(
      db.execute(sql`
        INSERT INTO watches_catalog (brand, model, image_source_quality)
        VALUES (${TEST_BRAND}, 'image-bogus', 'BOGUS_QUALITY')
      `),
    ).rejects.toSatisfy(isCheckConstraintError)
  })

  it('accepts NULL era_signal (optional field)', async () => {
    const result = await db.execute<{ id: string }>(sql`
      INSERT INTO watches_catalog (brand, model, era_signal)
      VALUES (${TEST_BRAND}, 'era-null-ok', NULL)
      RETURNING id
    `)
    expect((result as unknown as Array<{ id: string }>).length).toBe(1)
  })
})
