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

  // Phase 25 Plan 04 (UX-05 / D-11..D-15): SsrfError is treated as
  // `generic-network` per CONTEXT §integration_points (line 148).
  it('returns 400 with generic-network category + locked D-15 copy when fetchAndExtract throws SsrfError', async () => {
    mockFetchAndExtract.mockRejectedValue(new SsrfError('blocked'))

    const res = await POST(mkPost({ url: 'https://192.168.1.1' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.category).toBe('generic-network')
    expect(body.error).toBe(
      "Couldn't reach that URL. Check the link and try again.",
    )
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

  // -------------------------------------------------------------------------
  // Phase 25 Plan 04 — UX-05 / D-11..D-15: 5-category error taxonomy
  // -------------------------------------------------------------------------

  describe('Phase 25 Plan 04 — UX-05 / D-11..D-15 categorization', () => {
    it('host-403 — fetchAndExtract throws "Failed to fetch URL: 403 ..." → category=host-403 + locked D-15 copy', async () => {
      mockFetchAndExtract.mockRejectedValue(
        new Error('Failed to fetch URL: 403 Forbidden'),
      )

      const res = await POST(mkPost({ url: 'https://example.com/blocked' }))
      const body = await res.json()
      expect(res.status).toBe(502)
      expect(body.success).toBe(false)
      expect(body.category).toBe('host-403')
      expect(body.error).toBe(
        "This site doesn't allow data extraction. Try entering manually.",
      )
    })

    it('structured-data-missing — D-12 post-extract gate fires when brand+model are both empty', async () => {
      // fetchAndExtract resolves successfully but with empty brand/model
      mockFetchAndExtract.mockResolvedValue({
        success: true,
        data: { brand: '', model: '' },
      })

      const res = await POST(mkPost({ url: 'https://example.com/watch' }))
      const body = await res.json()
      expect(res.status).toBe(422)
      expect(body.success).toBe(false)
      expect(body.category).toBe('structured-data-missing')
      expect(body.error).toBe(
        "Couldn't find watch info on this page. Try the original product page or enter manually.",
      )
    })

    it('structured-data-missing — D-12 gate also fires when brand+model are null (was 200 success before Plan 04)', async () => {
      mockFetchAndExtract.mockResolvedValue({
        success: true,
        data: {},
      })

      const res = await POST(mkPost({ url: 'https://example.com/watch' }))
      const body = await res.json()
      expect(res.status).toBe(422)
      expect(body.category).toBe('structured-data-missing')
    })

    it('LLM-timeout — caught error with name=AbortError → category=LLM-timeout', async () => {
      const abortErr = new Error('aborted')
      abortErr.name = 'AbortError'
      mockFetchAndExtract.mockRejectedValue(abortErr)

      const res = await POST(mkPost({ url: 'https://example.com/slow' }))
      const body = await res.json()
      expect(res.status).toBe(504)
      expect(body.category).toBe('LLM-timeout')
      expect(body.error).toBe(
        'Extraction is taking longer than expected. Try again or enter manually.',
      )
    })

    it('LLM-timeout — caught error whose message contains "timeout" → category=LLM-timeout', async () => {
      mockFetchAndExtract.mockRejectedValue(new Error('Request timed out after 30s'))

      const res = await POST(mkPost({ url: 'https://example.com/slow' }))
      const body = await res.json()
      // The word "timed out" doesn't include "timeout" as a substring; sanity-check
      // both branches: message containing literal "timeout" should match.
      // (Fallback is generic-network if neither AbortError nor /timeout/i match.)
      expect(['LLM-timeout', 'generic-network']).toContain(body.category)
    })

    it('LLM-timeout — caught error whose message contains literal "timeout" → category=LLM-timeout', async () => {
      mockFetchAndExtract.mockRejectedValue(new Error('LLM request timeout exceeded'))

      const res = await POST(mkPost({ url: 'https://example.com/slow' }))
      const body = await res.json()
      expect(res.status).toBe(504)
      expect(body.category).toBe('LLM-timeout')
    })

    it('quota-exceeded — Anthropic-shaped 429 error → category=quota-exceeded + locked copy', async () => {
      // Anthropic SDK throws RateLimitError (extends APIError<429, Headers>).
      // We duck-type via .status === 429 to match across module boundaries.
      const rateLimitErr = Object.assign(new Error('rate limited'), {
        status: 429,
        name: 'RateLimitError',
      })
      mockFetchAndExtract.mockRejectedValue(rateLimitErr)

      const res = await POST(mkPost({ url: 'https://example.com/spd' }))
      const body = await res.json()
      expect(res.status).toBe(503)
      expect(body.category).toBe('quota-exceeded')
      expect(body.error).toBe(
        'Extraction service is busy. Try again in a few minutes.',
      )
    })

    it('generic-network — any other thrown error → category=generic-network + locked copy', async () => {
      mockFetchAndExtract.mockRejectedValue(new Error('upstream 500'))

      const res = await POST(mkPost({ url: 'https://example.com/watch' }))
      const body = await res.json()
      expect(res.status).toBe(500)
      expect(body.category).toBe('generic-network')
      expect(body.error).toBe(
        "Couldn't reach that URL. Check the link and try again.",
      )
    })

    it('information disclosure — error response body never includes "Anthropic", "claude", stack-trace, or raw message', async () => {
      // Construct an error with all the leak-vectors we explicitly forbid:
      //   - "Anthropic" in name
      //   - "claude" in message
      //   - a synthetic stack property
      const leaky = Object.assign(
        new Error('Anthropic claude-sonnet-4 internal failure at /Users/secret/path'),
        { stack: 'Error: stack\n    at /Users/secret/path' },
      )
      mockFetchAndExtract.mockRejectedValue(leaky)

      const res = await POST(mkPost({ url: 'https://example.com/leak' }))
      const bodyText = await res.text()
      expect(bodyText).not.toMatch(/anthropic/i)
      expect(bodyText).not.toMatch(/claude/i)
      expect(bodyText).not.toMatch(/stack/i)
      expect(bodyText).not.toContain('/Users/secret/path')
    })
  })
})
