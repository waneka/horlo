import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock all seams BEFORE importing the route handler (vi.mock calls are hoisted).

vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error {
    constructor(m = 'Not authenticated') {
      super(m)
      this.name = 'UnauthorizedError'
    }
  },
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'u-1', email: 'a@b.co' }),
}))

const mockFetchAndExtract = vi.fn()
vi.mock('@/lib/extractors', () => ({
  fetchAndExtract: (...args: unknown[]) => mockFetchAndExtract(...args),
}))

vi.mock('@/lib/ssrf', () => ({
  SsrfError: class extends Error {
    constructor(m = 'blocked') {
      super(m)
      this.name = 'SsrfError'
    }
  },
}))

vi.mock('@/data/catalog', () => ({
  upsertCatalogFromExtractedUrl: vi.fn().mockResolvedValue('cat-123'),
  updateCatalogTaste: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/taste/enricher', () => ({
  enrichTasteAttributes: vi.fn().mockResolvedValue(null),
}))

import { POST } from '@/app/api/extract-watch/route'
import { SsrfError } from '@/lib/ssrf'
import * as catalogDAL from '@/data/catalog'

function mkPost(body: unknown) {
  return new NextRequest('http://localhost/api/extract-watch', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/extract-watch — beyond auth gate (TEST-05)', () => {
  beforeEach(() => vi.clearAllMocks())

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it('returns 200 with extracted data on success', async () => {
    mockFetchAndExtract.mockResolvedValue({
      success: true,
      data: { brand: 'Omega', model: 'Speedmaster' },
    })

    const res = await POST(mkPost({ url: 'https://example.com/watch' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.brand).toBe('Omega')
    expect(body.data.model).toBe('Speedmaster')
  })

  // -------------------------------------------------------------------------
  // URL validation — manual checks (no Zod; per CONTEXT.md D-02 + RESEARCH.md A5)
  // -------------------------------------------------------------------------

  it('returns 400 { error: "URL is required" } when url is missing', async () => {
    const res = await POST(mkPost({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'URL is required' })
  })

  it('returns 400 { error: "URL is required" } when url is null', async () => {
    const res = await POST(mkPost({ url: null }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'URL is required' })
  })

  it('returns 400 { error: "Invalid URL format" } for a malformed URL', async () => {
    const res = await POST(mkPost({ url: 'not-a-url' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid URL format' })
  })

  it('returns 400 { error: "Only HTTP/HTTPS URLs are supported" } for non-http(s) protocol', async () => {
    const res = await POST(mkPost({ url: 'file:///etc/passwd' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Only HTTP/HTTPS URLs are supported' })
  })

  // -------------------------------------------------------------------------
  // Extraction error categories
  // -------------------------------------------------------------------------

  it('returns 400 with private-address copy when fetchAndExtract throws SsrfError', async () => {
    mockFetchAndExtract.mockRejectedValue(new SsrfError('blocked'))

    const res = await POST(mkPost({ url: 'https://192.168.1.1' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('private address')
  })

  it('returns 500 with generic copy when fetchAndExtract throws a generic Error', async () => {
    mockFetchAndExtract.mockRejectedValue(new Error('upstream 403'))

    const res = await POST(mkPost({ url: 'https://example.com/watch' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Failed to extract')
  })

  // -------------------------------------------------------------------------
  // Catalog upsert failure paths
  // -------------------------------------------------------------------------

  it('returns 200 with catalogId=null and catalogIdError containing "null id" when upsert returns null', async () => {
    mockFetchAndExtract.mockResolvedValue({
      success: true,
      data: { brand: 'Rolex', model: 'Submariner' },
    })
    vi.mocked(catalogDAL.upsertCatalogFromExtractedUrl).mockResolvedValue(null)

    const res = await POST(mkPost({ url: 'https://example.com/watch' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.catalogId).toBeNull()
    expect(body.catalogIdError).toContain('null id')
  })

  it('returns 200 with catalogIdError containing "brand/model missing" when extraction yields no brand or model', async () => {
    mockFetchAndExtract.mockResolvedValue({
      success: true,
      data: {},
    })

    const res = await POST(mkPost({ url: 'https://example.com/watch' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.catalogIdError).toContain('brand/model missing')
  })
})
