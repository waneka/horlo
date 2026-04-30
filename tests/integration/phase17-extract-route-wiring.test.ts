/**
 * Phase 17 Plan 03 — Integration: POST /api/extract-watch → watches_catalog enriched (CAT-08)
 *
 * Gated on DATABASE_URL so the suite skips cleanly in CI without local Supabase.
 * Mocks fetchAndExtract to return controlled data; calls the POST handler directly.
 *
 * Requirement: CAT-08
 * Truth: "/api/extract-watch route handler calls upsertCatalogFromExtractedUrl after successful extraction"
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import { NextRequest } from 'next/server'

import { db } from '@/db'

const maybe = process.env.DATABASE_URL ? describe : describe.skip
const STAMP = Date.now().toString(36)

// Mock auth and extractors at module level — before any imports that use them
vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error {
    constructor(m = 'Not authenticated') {
      super(m)
      this.name = 'UnauthorizedError'
    }
  },
  getCurrentUser: vi.fn(() => Promise.resolve({ id: 'mock-user-id', email: 'test@horlo.test' })),
}))

vi.mock('@/lib/extractors', () => ({
  fetchAndExtract: vi.fn(),
}))

maybe('Phase 17 Plan 03 — /api/extract-watch wiring → catalog row created (CAT-08)', () => {
  const mockedBrand = `mocked-brand-${STAMP}`

  afterAll(async () => {
    await db.execute(
      sql`DELETE FROM watches_catalog WHERE brand_normalized = lower(trim(${mockedBrand}))`
    )
    vi.restoreAllMocks()
  }, 30_000)

  it('POST /api/extract-watch inserts a catalog row with source=url_extracted', async () => {
    const { fetchAndExtract } = await import('@/lib/extractors')
    vi.mocked(fetchAndExtract).mockResolvedValue({
      data: {
        brand: mockedBrand,
        model: 'M',
        reference: null,
        movement: 'automatic' as const,
        caseSizeMm: 40,
        lugToLugMm: 47,
        waterResistanceM: 300,
        crystalType: 'sapphire' as const,
        dialColor: 'black',
        isChronometer: false,
        styleTags: ['sport'],
        designTraits: ['bold'],
        complications: [],
        imageUrl: 'https://example.com/watch.jpg',
      },
      source: 'merged' as const,
      confidence: 'high' as const,
      fieldsExtracted: ['brand', 'model', 'caseSizeMm'],
      llmUsed: false,
    })

    const { POST } = await import('@/app/api/extract-watch/route')

    const request = new NextRequest('http://localhost/api/extract-watch', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/watch/1' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)

    // Assert: catalog row was created with source='url_extracted' and spec data
    const catalogRows = await db.execute<{
      source: string
      case_size_mm: number | null
    }>(
      sql`SELECT source, case_size_mm FROM watches_catalog WHERE brand_normalized = lower(trim(${mockedBrand})) LIMIT 1`
    ) as unknown as Array<{ source: string; case_size_mm: number | null }>

    expect(catalogRows).toHaveLength(1)
    expect(catalogRows[0]!.source).toBe('url_extracted')
    expect(catalogRows[0]!.case_size_mm).toBe(40)
  })

  // -------------------------------------------------------------------------
  // Phase 20.1 Plan 02 D-08 — extract-watch response shape includes catalogId.
  // RED until Plan 02 modifies route.ts to add `catalogId` to the JSON response.
  // -------------------------------------------------------------------------
  it('D-08 — response shape includes catalogId field (Phase 20.1)', async () => {
    const { fetchAndExtract } = await import('@/lib/extractors')
    const stamp = `d08-${Date.now().toString(36)}`
    vi.mocked(fetchAndExtract).mockResolvedValue({
      data: {
        brand: `${stamp}-brand`,
        model: 'M',
        reference: null,
        movement: 'automatic' as const,
        caseSizeMm: 40,
        lugToLugMm: 47,
        waterResistanceM: 300,
        crystalType: 'sapphire' as const,
        dialColor: 'black',
        isChronometer: false,
        styleTags: ['sport'],
        designTraits: ['bold'],
        complications: [],
        imageUrl: 'https://example.com/watch.jpg',
      },
      source: 'merged' as const,
      confidence: 'high' as const,
      fieldsExtracted: ['brand', 'model'],
      llmUsed: false,
    })
    const { POST } = await import('@/app/api/extract-watch/route')
    const request = new NextRequest('http://localhost/api/extract-watch', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/watch/d08' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    // D-08 contract — `catalogId` must appear in the response shape as a string
    // (UUID-like) when extraction returned a brand+model pair that produced a
    // catalog row. RED today because route.ts spreads `result` only.
    expect(body.catalogId).toBeTypeOf('string')
    expect(body.catalogId).toMatch(/^[0-9a-f-]{36}$/i)

    // Cleanup the row created by this test.
    await db.execute(
      sql`DELETE FROM watches_catalog WHERE brand_normalized = lower(trim(${stamp + '-brand'}))`
    )
  })

  it('D-08 — response.catalogId is null when extraction has no brand or model', async () => {
    const { fetchAndExtract } = await import('@/lib/extractors')
    vi.mocked(fetchAndExtract).mockResolvedValue({
      data: {
        // No brand, no model — catalog upsert is skipped.
        reference: null,
        movement: undefined,
        caseSizeMm: undefined,
        lugToLugMm: undefined,
        waterResistanceM: undefined,
        crystalType: undefined,
        dialColor: undefined,
        isChronometer: undefined,
        styleTags: [],
        designTraits: [],
        complications: [],
        imageUrl: undefined,
      },
      source: 'merged' as const,
      confidence: 'low' as const,
      fieldsExtracted: [],
      llmUsed: false,
    })
    const { POST } = await import('@/app/api/extract-watch/route')
    const request = new NextRequest('http://localhost/api/extract-watch', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/watch/d08-nobrand' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.catalogId).toBeNull()
  })
})
