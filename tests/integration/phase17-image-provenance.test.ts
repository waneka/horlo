import { describe, it, expect, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { upsertCatalogFromExtractedUrl } from '@/data/catalog'

const maybe = process.env.DATABASE_URL ? describe : describe.skip
const STAMP = `ip${Date.now().toString(36)}`

maybe('Phase 17 image provenance -- D-06 / CAT-12 sibling', () => {
  afterAll(async () => {
    await db.execute(sql`DELETE FROM watches_catalog WHERE brand LIKE ${`Ip-${STAMP}-%`}`)
  })

  it('image columns round-trip via upsertCatalogFromExtractedUrl', async () => {
    const id = await upsertCatalogFromExtractedUrl({
      brand: `Ip-${STAMP}-A`,
      model: 'Sub',
      reference: 'r1',
      imageUrl: 'https://cdn.brand.com/sub.jpg',
      imageSourceUrl: 'https://chrono24.com/listing/123',
      imageSourceQuality: 'official',
    })
    expect(id).toBeTruthy()
    const result = await db.execute<{ image_url: string | null; image_source_url: string | null; image_source_quality: string | null }>(sql`
      SELECT image_url, image_source_url, image_source_quality FROM watches_catalog WHERE id = ${id}
    `)
    const row = (result as unknown as Array<{ image_url: string | null; image_source_url: string | null; image_source_quality: string | null }>)[0]
    expect(row.image_url).toBe('https://cdn.brand.com/sub.jpg')
    expect(row.image_source_url).toBe('https://chrono24.com/listing/123')
    expect(row.image_source_quality).toBe('official')
  })

  it('COALESCE preserves first non-null image_url (D-13)', async () => {
    const brand = `Ip-${STAMP}-B`
    const id1 = await upsertCatalogFromExtractedUrl({
      brand, model: 'Sub', reference: 'r2',
      imageUrl: 'https://a.com/x.jpg',
    })
    const id2 = await upsertCatalogFromExtractedUrl({
      brand, model: 'Sub', reference: 'r2',
      imageUrl: 'https://b.com/y.jpg',
    })
    expect(id1).toBe(id2)
    const result = await db.execute<{ image_url: string | null }>(sql`
      SELECT image_url FROM watches_catalog WHERE id = ${id1}
    `)
    const row = (result as unknown as Array<{ image_url: string | null }>)[0]
    expect(row.image_url).toBe('https://a.com/x.jpg')
  })

  it('image_source_quality CHECK rejects invalid values', async () => {
    const brand = `Ip-${STAMP}-C`
    await expect(db.execute(sql`
      INSERT INTO watches_catalog (brand, model, reference, source, image_source_quality)
      VALUES (${brand}, 'Sub', 'r3', 'user_promoted', 'banana')
    `)).rejects.toThrow()
  })

  it('image_source_quality CHECK accepts all three valid values + NULL', async () => {
    for (const quality of ['official', 'retailer', 'unknown', null] as const) {
      const brand = `Ip-${STAMP}-D-${quality ?? 'null'}`
      await db.execute(sql`
        INSERT INTO watches_catalog (brand, model, reference, source, image_source_quality)
        VALUES (${brand}, 'Sub', 'rd', 'user_promoted', ${quality})
      `)
    }
    const result = await db.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM watches_catalog WHERE brand LIKE ${`Ip-${STAMP}-D-%`}
    `)
    const row = (result as unknown as Array<{ count: number }>)[0]
    expect(row.count).toBe(4)
  })
})
