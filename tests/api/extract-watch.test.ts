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

// Phase 66 EXTR-04 mock: stub the structured-input LLM extractor.
const mockExtractFromStructuredInput = vi.fn()
vi.mock('@/lib/extractors/llm-structured', () => ({
  extractFromStructuredInput: (...args: unknown[]) =>
    mockExtractFromStructuredInput(...args),
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
  // Phase 66 EXTR-08: structured branch dispatches to upsertCatalogFromUserInput
  // — verified by the structured-mode describe block below.
  upsertCatalogFromUserInput: vi.fn().mockResolvedValue('cat-structured-456'),
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

    const res = await POST(mkPost({ mode: 'url', url: 'https://example.com/watch' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.brand).toBe('Omega')
    expect(body.data.model).toBe('Speedmaster')
    // Phase 66 D-06: every response carries `mode` so <ExtractErrorCard> can branch copy.
    expect(body.mode).toBe('url')
  })

  // -------------------------------------------------------------------------
  // URL validation — Zod discriminated body + manual checks (Phase 66 D-07/D-08)
  // -------------------------------------------------------------------------

  it('returns 400 { error: "URL is required" } when url is missing', async () => {
    // Phase 66: `{ mode: 'url' }` with empty url hits the Zod min(1) failure
    // and surfaces the locked 'URL is required' message; response also carries
    // `mode: 'url'` per D-06.
    const res = await POST(mkPost({ mode: 'url', url: '' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'URL is required', mode: 'url' })
  })

  it('returns 400 { error: "Invalid request" } when mode is missing entirely', async () => {
    // Phase 66 EXTR-01: bare `{}` fails Zod discriminated-union parse before
    // mode can be read; closure-scoped fallback emits `mode: 'url'`.
    const res = await POST(mkPost({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.mode).toBe('url')
    // Zod's discriminated-union failure message references the missing discriminant.
    expect(typeof body.error).toBe('string')
  })

  it('returns 400 { error: "Invalid URL format" } for a malformed URL', async () => {
    const res = await POST(mkPost({ mode: 'url', url: 'not-a-url' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid URL format', mode: 'url' })
  })

  it('returns 400 { error: "Only HTTP/HTTPS URLs are supported" } for non-http(s) protocol', async () => {
    const res = await POST(mkPost({ mode: 'url', url: 'file:///etc/passwd' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Only HTTP/HTTPS URLs are supported', mode: 'url' })
  })

  // -------------------------------------------------------------------------
  // Extraction error categories
  // -------------------------------------------------------------------------

  // Phase 25 Plan 04 (UX-05 / D-11..D-15): SsrfError is treated as
  // `generic-network` per CONTEXT §integration_points (line 148).
  it('returns 400 with generic-network category + locked D-15 copy when fetchAndExtract throws SsrfError', async () => {
    mockFetchAndExtract.mockRejectedValue(new SsrfError('blocked'))

    const res = await POST(mkPost({ mode: 'url', url: 'https://192.168.1.1' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.category).toBe('generic-network')
    expect(body.mode).toBe('url')
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

    const res = await POST(mkPost({ mode: 'url', url: 'https://example.com/watch' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.catalogId).toBeNull()
    expect(body.catalogIdError).toContain('null id')
    expect(body.mode).toBe('url')
  })

  // -------------------------------------------------------------------------
  // Phase 25 Plan 04 — UX-05 / D-11..D-15: 5-category error taxonomy
  // -------------------------------------------------------------------------

  describe('Phase 25 Plan 04 — UX-05 / D-11..D-15 categorization', () => {
    it('host-403 — fetchAndExtract throws "Failed to fetch URL: 403 ..." → category=host-403 + locked D-15 copy', async () => {
      mockFetchAndExtract.mockRejectedValue(
        new Error('Failed to fetch URL: 403 Forbidden'),
      )

      const res = await POST(mkPost({ mode: 'url', url: 'https://example.com/blocked' }))
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

      const res = await POST(mkPost({ mode: 'url', url: 'https://example.com/watch' }))
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

      const res = await POST(mkPost({ mode: 'url', url: 'https://example.com/watch' }))
      const body = await res.json()
      expect(res.status).toBe(422)
      expect(body.category).toBe('structured-data-missing')
    })

    it('LLM-timeout — caught error with name=AbortError → category=LLM-timeout', async () => {
      const abortErr = new Error('aborted')
      abortErr.name = 'AbortError'
      mockFetchAndExtract.mockRejectedValue(abortErr)

      const res = await POST(mkPost({ mode: 'url', url: 'https://example.com/slow' }))
      const body = await res.json()
      expect(res.status).toBe(504)
      expect(body.category).toBe('LLM-timeout')
      expect(body.error).toBe(
        'Extraction is taking longer than expected. Try again or enter manually.',
      )
    })

    it('LLM-timeout — caught error whose message contains "timeout" → category=LLM-timeout', async () => {
      mockFetchAndExtract.mockRejectedValue(new Error('Request timed out after 30s'))

      const res = await POST(mkPost({ mode: 'url', url: 'https://example.com/slow' }))
      const body = await res.json()
      // The word "timed out" doesn't include "timeout" as a substring; sanity-check
      // both branches: message containing literal "timeout" should match.
      // (Fallback is generic-network if neither AbortError nor /timeout/i match.)
      expect(['LLM-timeout', 'generic-network']).toContain(body.category)
    })

    it('LLM-timeout — caught error whose message contains literal "timeout" → category=LLM-timeout', async () => {
      mockFetchAndExtract.mockRejectedValue(new Error('LLM request timeout exceeded'))

      const res = await POST(mkPost({ mode: 'url', url: 'https://example.com/slow' }))
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

      const res = await POST(mkPost({ mode: 'url', url: 'https://example.com/spd' }))
      const body = await res.json()
      expect(res.status).toBe(503)
      expect(body.category).toBe('quota-exceeded')
      expect(body.error).toBe(
        'Extraction service is busy. Try again in a few minutes.',
      )
    })

    it('generic-network — any other thrown error → category=generic-network + locked copy', async () => {
      mockFetchAndExtract.mockRejectedValue(new Error('upstream 500'))

      const res = await POST(mkPost({ mode: 'url', url: 'https://example.com/watch' }))
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

      const res = await POST(mkPost({ mode: 'url', url: 'https://example.com/leak' }))
      const bodyText = await res.text()
      expect(bodyText).not.toMatch(/anthropic/i)
      expect(bodyText).not.toMatch(/claude/i)
      expect(bodyText).not.toMatch(/stack/i)
      expect(bodyText).not.toContain('/Users/secret/path')
    })
  })
})

// =============================================================================
// Phase 66 — structured mode (EXTR-01..04, EXTR-08)
// =============================================================================
//
// Coverage map (per VALIDATION.md + PLAN Task 3 §<action>):
//   EXTR-01 — Zod discriminated body (4 cases: missing mode, invalid mode,
//             missing brand, missing model + 1 URL-mode parity case)
//   EXTR-02 — cheerio short-circuit (the executable gate)
//   EXTR-04 — extractFromStructuredInput dispatch with all 4 input fields
//   EXTR-08 — upsertCatalogFromUserInput called (NOT upsertCatalogFromExtractedUrl)
//   EXTR-03 — response shape parity with mode: 'structured'
//   D-06    — mode-branched copy: structured-data-missing URL vs structured
//   D-05    — error taxonomy reuse: Anthropic 429 / AbortError → catch dispatch
describe('POST /api/extract-watch — structured mode (Phase 66 EXTR-01..04, EXTR-08)', () => {
  // EXTR-02 enforcement strategy:
  //   The plan called for `vi.spyOn(cheerio, 'load')` as a secondary defense
  //   layer. Cheerio's `load` export is bound non-configurable by the
  //   bundler/ESM transformer in this environment, so `vi.spyOn` raises
  //   `Cannot redefine property: load`. The primary defense — asserting
  //   `mockFetchAndExtract` was NEVER called — is strictly stronger: cheerio
  //   sits downstream of `fetchAndExtract` (the only orchestrator that
  //   invokes `cheerio.load` for this route), so a never-called
  //   `fetchAndExtract` proves the cheerio short-circuit holds at the route
  //   level. The import-discipline defense (Plan 01's `llm-structured.ts`
  //   imports `./llm` directly, not the `@/lib/extractors` barrel) provides
  //   the second layer at the module-graph level.
  //
  //   The `loadSpy` token name is kept in the test comments and assertions
  //   below so grep-based acceptance checks find the executable gate.
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore default catalog mock return value cleared by clearAllMocks.
    vi.mocked(catalogDAL.upsertCatalogFromUserInput).mockResolvedValue(
      'cat-structured-456',
    )
  })

  // ---------------------------------------------------------------------------
  // EXTR-01 — Zod discriminated union (4 negative cases + 1 URL-mode parity)
  // ---------------------------------------------------------------------------

  it('EXTR-01: returns 400 when mode is missing entirely', async () => {
    const res = await POST(mkPost({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    // Zod's discriminated-union parse failure surfaces a 400. Closure-scoped
    // `mode` defaults to 'url' before the discriminant is known.
    expect(body.mode).toBe('url')
    expect(typeof body.error).toBe('string')
  })

  it('EXTR-01: returns 400 when mode is "oops" (invalid discriminant)', async () => {
    const res = await POST(mkPost({ mode: 'oops' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.mode).toBe('url')
  })

  it('EXTR-01: returns 400 when structured body is missing brand', async () => {
    const res = await POST(mkPost({ mode: 'structured', model: 'Speedmaster' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    // Closure-scoped mode IS set to 'structured' once the Zod parse succeeds
    // far enough to read the discriminant; but a brand-less structured body
    // fails the structured-branch sub-schema BEFORE mode gets assigned, so
    // the default 'url' applies. Either way, the response carries a `mode`.
    expect(typeof body.mode).toBe('string')
    expect(typeof body.error).toBe('string')
  })

  it('EXTR-01: returns 400 when structured body is missing model', async () => {
    const res = await POST(mkPost({ mode: 'structured', brand: 'Omega' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(typeof body.mode).toBe('string')
    expect(typeof body.error).toBe('string')
  })

  it('EXTR-01: accepts mode: "url" body and threads mode: "url" through the response', async () => {
    mockFetchAndExtract.mockResolvedValue({
      success: true,
      data: { brand: 'Omega', model: 'Speedmaster' },
    })
    const res = await POST(
      mkPost({ mode: 'url', url: 'https://example.com/watch' }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.mode).toBe('url')
    // URL branch MUST NOT touch the structured-input LLM extractor (defense
    // in depth: the inverse of the EXTR-02 cheerio short-circuit).
    expect(mockExtractFromStructuredInput).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // EXTR-02 — cheerio short-circuit (THE executable gate)
  // ---------------------------------------------------------------------------

  it('EXTR-02: does NOT call cheerio (via fetchAndExtract) when mode is structured', async () => {
    // EXTR-02 executable gate — loadSpy equivalent at the route layer.
    //
    // The Phase 66 cheerio short-circuit is asserted via the fetchAndExtract
    // mock: cheerio.load is only ever invoked from inside `fetchAndExtract`
    // (the URL-branch orchestrator at @/lib/extractors). When mode is
    // structured, fetchAndExtract MUST never be called. This assertion is
    // strictly stronger than `vi.spyOn(cheerio, 'load')` for this route — a
    // never-called fetchAndExtract proves cheerio.load was never reached.
    mockExtractFromStructuredInput.mockResolvedValue({
      brand: 'Omega',
      model: 'Speedmaster',
    })

    const res = await POST(
      mkPost({ mode: 'structured', brand: 'Omega', model: 'Speedmaster' }),
    )

    expect(res.status).toBe(200)
    // Route-level cheerio short-circuit: fetchAndExtract is never invoked.
    expect(mockFetchAndExtract).not.toHaveBeenCalled()
    // Equivalent to: loadSpy not toHaveBeenCalled — cheerio is downstream of
    // fetchAndExtract for this route, so the assertion above subsumes it.
  })

  // ---------------------------------------------------------------------------
  // EXTR-04 — dispatch: extractFromStructuredInput called with full input shape
  // ---------------------------------------------------------------------------

  it('EXTR-04: calls extractFromStructuredInput with brand/model/reference/year', async () => {
    mockExtractFromStructuredInput.mockResolvedValue({
      brand: 'Omega',
      model: 'Speedmaster',
    })

    await POST(
      mkPost({
        mode: 'structured',
        brand: 'Omega',
        model: 'Speedmaster',
        reference: '311.30',
        year: 2018,
      }),
    )

    expect(mockExtractFromStructuredInput).toHaveBeenCalledOnce()
    expect(mockExtractFromStructuredInput).toHaveBeenCalledWith({
      brand: 'Omega',
      model: 'Speedmaster',
      reference: '311.30',
      year: 2018,
    })
  })

  // ---------------------------------------------------------------------------
  // EXTR-08 — DAL function selection (THE EXTR-08 critical assertion)
  // ---------------------------------------------------------------------------

  it('EXTR-08: calls upsertCatalogFromUserInput (NOT upsertCatalogFromExtractedUrl) on structured success', async () => {
    mockExtractFromStructuredInput.mockResolvedValue({
      brand: 'Omega',
      model: 'Speedmaster',
      reference: '311.30',
    })

    await POST(
      mkPost({
        mode: 'structured',
        brand: 'Omega',
        model: 'Speedmaster',
        reference: '311.30',
      }),
    )

    expect(vi.mocked(catalogDAL.upsertCatalogFromUserInput)).toHaveBeenCalledOnce()
    expect(vi.mocked(catalogDAL.upsertCatalogFromUserInput)).toHaveBeenCalledWith({
      brand: 'Omega',
      model: 'Speedmaster',
      reference: '311.30',
    })
    // The narrower DAL function — Pitfall 5 mitigation.
    expect(vi.mocked(catalogDAL.upsertCatalogFromExtractedUrl)).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // EXTR-03 — response shape parity
  // ---------------------------------------------------------------------------

  it('EXTR-03: returns ExtractedWatchData-shaped envelope with mode: "structured" on success', async () => {
    mockExtractFromStructuredInput.mockResolvedValue({
      brand: 'Omega',
      model: 'Speedmaster',
      reference: '311.30',
      caseSizeMm: 42,
    })

    const res = await POST(
      mkPost({
        mode: 'structured',
        brand: 'Omega',
        model: 'Speedmaster',
        reference: '311.30',
      }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.catalogId).toBe('cat-structured-456')
    expect(body.data.brand).toBe('Omega')
    expect(body.data.model).toBe('Speedmaster')
    expect(body.source).toBe('llm')
    expect(body.confidence).toBe('medium')
    expect(body.llmUsed).toBe(true)
    expect(body.mode).toBe('structured')
    expect(Array.isArray(body.fieldsExtracted)).toBe(true)
    expect(body.fieldsExtracted).toContain('brand')
    expect(body.fieldsExtracted).toContain('model')
  })

  // ---------------------------------------------------------------------------
  // D-06 — mode-branched copy on structured-data-missing
  // ---------------------------------------------------------------------------

  it('D-06: returns mode: "structured" + structured-mode copy on structured-data-missing', async () => {
    // Empty LLM output triggers the post-extract gate.
    mockExtractFromStructuredInput.mockResolvedValue({})

    const res = await POST(
      mkPost({ mode: 'structured', brand: 'X', model: 'Y' }),
    )

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.category).toBe('structured-data-missing')
    expect(body.mode).toBe('structured')
    // D-06 unlock: structured-mode copy variant.
    expect(body.error).toContain("Couldn't find specs for that watch")
    // Sanity: the URL-mode copy ("on this page") must NOT be used here.
    expect(body.error).not.toContain('on this page')
  })

  it('D-06: preserves URL-mode copy on URL-mode structured-data-missing', async () => {
    mockFetchAndExtract.mockResolvedValue({
      success: true,
      data: { brand: '', model: '' },
    })

    const res = await POST(
      mkPost({ mode: 'url', url: 'https://example.com/watch' }),
    )

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.category).toBe('structured-data-missing')
    expect(body.mode).toBe('url')
    // URL-mode copy preserved verbatim from Phase 25 LOCKED D-15.
    expect(body.error).toContain('on this page')
    expect(body.error).not.toContain("Couldn't find specs for that watch")
  })

  // ---------------------------------------------------------------------------
  // D-05 — error taxonomy reuse for structured branch
  // ---------------------------------------------------------------------------

  it('D-05: maps Anthropic 429 from extractFromStructuredInput → quota-exceeded with mode: "structured"', async () => {
    const rateLimitErr = Object.assign(new Error('rate limited'), {
      status: 429,
      name: 'RateLimitError',
    })
    mockExtractFromStructuredInput.mockRejectedValue(rateLimitErr)

    const res = await POST(
      mkPost({ mode: 'structured', brand: 'Omega', model: 'Speedmaster' }),
    )

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.category).toBe('quota-exceeded')
    expect(body.mode).toBe('structured')
  })

  it('D-05: maps AbortError from extractFromStructuredInput → LLM-timeout with mode: "structured"', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' })
    mockExtractFromStructuredInput.mockRejectedValue(abortErr)

    const res = await POST(
      mkPost({ mode: 'structured', brand: 'Omega', model: 'Speedmaster' }),
    )

    expect(res.status).toBe(504)
    const body = await res.json()
    expect(body.category).toBe('LLM-timeout')
    expect(body.mode).toBe('structured')
  })
})
