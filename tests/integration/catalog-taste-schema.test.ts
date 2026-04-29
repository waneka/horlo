import { describe, it, expect, afterAll } from 'vitest'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { watchesCatalog } from '@/db/schema'
import { PRIMARY_ARCHETYPES, ERA_SIGNALS } from '@/lib/taste/vocab'

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
  it('rejects bad primary_archetype', async () => {
    await expect(
      db.execute(sql`
        INSERT INTO watches_catalog (brand, model, primary_archetype)
        VALUES (${TEST_BRAND}, 'reject-test', 'BOGUS_ARCH')
      `),
    ).rejects.toSatisfy(isCheckConstraintError)
  })

  it.each([...PRIMARY_ARCHETYPES])(
    'accepts valid primary_archetype: %s',
    async (archetype) => {
      const result = await db.execute<{ id: string }>(sql`
        INSERT INTO watches_catalog (brand, model, primary_archetype)
        VALUES (${TEST_BRAND}, ${`accept-${archetype}`}, ${archetype})
        RETURNING id
      `)
      expect((result as unknown as Array<{ id: string }>).length).toBe(1)
    },
  )

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
