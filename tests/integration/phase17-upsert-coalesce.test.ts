import { describe, it, expect, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  upsertCatalogFromUserInput,
  upsertCatalogFromExtractedUrl,
} from '@/data/catalog'

const maybe = process.env.DATABASE_URL ? describe : describe.skip
const STAMP = Date.now().toString(36)

maybe('Phase 17 upsert helpers — CAT-06 + CAT-07', () => {
  const stampedBrand = (suffix: string) => `TestBrand-${STAMP}-${suffix}`

  afterAll(async () => {
    // Clean up every row this suite created
    await db.execute(sql`DELETE FROM watches_catalog WHERE brand LIKE ${'TestBrand-' + STAMP + '-%'}`)
  })

  it('user input writes natural key only', async () => {
    // Phase 81 D-81-01 — upsert helpers now return { catalogId, brandName, familyName } | null.
    const upsertResult = await upsertCatalogFromUserInput({
      brand: stampedBrand('A'),
      model: 'Submariner',
      reference: '116610LN',
    })
    expect(upsertResult).toBeTruthy()
    const id = upsertResult!.catalogId
    const result = await db.execute<{ source: string; case_size_mm: number | null; movement_type: string | null; style_tags: string[] }>(
      sql`SELECT source, case_size_mm, movement_type, style_tags FROM watches_catalog WHERE id = ${id}`
    )
    const row = (result as unknown as Array<{ source: string; case_size_mm: number | null; movement_type: string | null; style_tags: string[] }>)[0]
    expect(row.source).toBe('user_promoted')
    expect(row.case_size_mm).toBeNull()
    expect(row.movement_type).toBeNull()
    expect(row.style_tags).toEqual([])
  })

  it('user input does nothing on conflict', async () => {
    // Phase 81 D-81-01 — unwrap catalogId from { catalogId, brandName, familyName }.
    const r1 = await upsertCatalogFromUserInput({ brand: stampedBrand('B'), model: 'Sub', reference: 'ref1' })
    const r2 = await upsertCatalogFromUserInput({ brand: stampedBrand('B'), model: 'Sub', reference: 'ref1' })
    expect(r1?.catalogId).toBe(r2?.catalogId)
  })

  it('user input does nothing on conflict — does NOT downgrade source', async () => {
    const r1 = await upsertCatalogFromExtractedUrl({
      brand: stampedBrand('C'), model: 'Sub', reference: 'ref-c',
      caseSizeMm: 40, movementType: 'auto',
    })
    const id1 = r1!.catalogId
    const r2 = await upsertCatalogFromUserInput({ brand: stampedBrand('C'), model: 'Sub', reference: 'ref-c' })
    expect(id1).toBe(r2?.catalogId)
    const result = await db.execute<{ source: string; case_size_mm: number | null }>(
      sql`SELECT source, case_size_mm FROM watches_catalog WHERE id = ${id1}`
    )
    const row = (result as unknown as Array<{ source: string; case_size_mm: number | null }>)[0]
    expect(row.source).toBe('url_extracted')   // not downgraded
    expect(row.case_size_mm).toBe(40)           // not cleared
  })

  it('url extract enriches NULL columns via COALESCE', async () => {
    const r1 = await upsertCatalogFromUserInput({ brand: stampedBrand('D'), model: 'Sub', reference: 'ref-d' })
    const r2 = await upsertCatalogFromExtractedUrl({
      brand: stampedBrand('D'), model: 'Sub', reference: 'ref-d',
      caseSizeMm: 40, movementType: 'auto',
    })
    const id1 = r1!.catalogId
    expect(id1).toBe(r2?.catalogId)
    const result = await db.execute<{ source: string; case_size_mm: number | null; movement_type: string | null }>(
      sql`SELECT source, case_size_mm, movement_type FROM watches_catalog WHERE id = ${id1}`
    )
    const row = (result as unknown as Array<{ source: string; case_size_mm: number | null; movement_type: string | null }>)[0]
    expect(row.case_size_mm).toBe(40)
    expect(row.movement_type).toBe('auto')
    expect(row.source).toBe('url_extracted')   // D-10 upgrade
  })

  it('url extract does not overwrite non-null (D-13 first-non-null wins)', async () => {
    await upsertCatalogFromExtractedUrl({
      brand: stampedBrand('E'), model: 'Sub', reference: 'ref-e',
      caseSizeMm: 40,
    })
    await upsertCatalogFromExtractedUrl({
      brand: stampedBrand('E'), model: 'Sub', reference: 'ref-e',
      caseSizeMm: 41,   // ignored — D-13
    })
    const result = await db.execute<{ case_size_mm: number | null }>(
      sql`SELECT case_size_mm FROM watches_catalog WHERE brand = ${stampedBrand('E')}`
    )
    const row = (result as unknown as Array<{ case_size_mm: number | null }>)[0]
    expect(row.case_size_mm).toBe(40)
  })

  it('source upgrade user_promoted → url_extracted', async () => {
    const r1 = await upsertCatalogFromUserInput({ brand: stampedBrand('F'), model: 'Sub', reference: 'ref-f' })
    const r2 = await upsertCatalogFromExtractedUrl({ brand: stampedBrand('F'), model: 'Sub', reference: 'ref-f' })
    const id1 = r1!.catalogId
    expect(id1).toBe(r2?.catalogId)
    const result = await db.execute<{ source: string }>(
      sql`SELECT source FROM watches_catalog WHERE id = ${id1}`
    )
    const row = (result as unknown as Array<{ source: string }>)[0]
    expect(row.source).toBe('url_extracted')
  })

  it('admin_curated locked — source never overwritten', async () => {
    // Simulate a future admin write: direct SQL INSERT bypassing the helpers
    const adminBrand = stampedBrand('G')
    const insertResult = await db.execute<{ id: string }>(sql`
      INSERT INTO watches_catalog (brand, model, reference, source, case_size_mm)
      VALUES (${adminBrand}, 'AdminModel', 'ref-g', 'admin_curated', 38)
      RETURNING id
    `)
    const adminId = (insertResult as unknown as Array<{ id: string }>)[0].id

    // Now URL-extract attempts enrichment
    await upsertCatalogFromExtractedUrl({
      brand: adminBrand, model: 'AdminModel', reference: 'ref-g',
      caseSizeMm: 99, movementType: 'quartz',
    })

    const result = await db.execute<{ source: string; case_size_mm: number | null; movement_type: string | null }>(
      sql`SELECT source, case_size_mm, movement_type FROM watches_catalog WHERE id = ${adminId}`
    )
    const row = (result as unknown as Array<{ source: string; case_size_mm: number | null; movement_type: string | null }>)[0]
    expect(row.source).toBe('admin_curated')   // locked — D-11
    expect(row.case_size_mm).toBe(38)           // not overwritten — D-13 (was already non-null)
    expect(row.movement_type).toBe('quartz')    // enriched (was NULL — COALESCE applied)
  })

  it('image_source_url rejects non-http (T-17-02-01)', async () => {
    const upsertResult = await upsertCatalogFromExtractedUrl({
      brand: stampedBrand('H'), model: 'Sub', reference: 'ref-h',
      imageSourceUrl: 'javascript:alert(1)',
    })
    const id = upsertResult!.catalogId
    const result = await db.execute<{ image_source_url: string | null }>(
      sql`SELECT image_source_url FROM watches_catalog WHERE id = ${id}`
    )
    const row = (result as unknown as Array<{ image_source_url: string | null }>)[0]
    expect(row.image_source_url).toBeNull()
  })

  it('casing collapse via helper', async () => {
    const r1 = await upsertCatalogFromUserInput({ brand: stampedBrand('i'), model: 'Sub', reference: 'ref-i' })
    const r2 = await upsertCatalogFromUserInput({ brand: stampedBrand('I').toUpperCase(), model: 'SUB', reference: 'REF-I' })
    expect(r1?.catalogId).toBe(r2?.catalogId)
  })
})
