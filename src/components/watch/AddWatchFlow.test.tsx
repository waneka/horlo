/**
 * Phase 20.1 Plan 01 (Wave 0) — RED test scaffold for AddWatchFlow.
 *
 * Covers ADD-01, ADD-03, ADD-04, ADD-07 + Pitfall 1 (deep-link prefill).
 *
 * RED state: imports `@/components/watch/AddWatchFlow` which does not yet exist
 * (Plan 04 ships it). Vitest will fail with "Cannot find module" until then.
 *
 * Wave 1 plans flip this file GREEN by implementing the component contract
 * documented in 20.1-01-PLAN.md `<interfaces>`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock auth/data Server Actions and next/navigation BEFORE component import.
vi.mock('@/app/actions/verdict', () => ({
  getVerdictForCatalogWatch: vi.fn(),
}))
vi.mock('@/app/actions/watches', () => ({
  addWatch: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}))
// Stub the heavy CollectionFitCard to keep tests focused on flow state.
vi.mock('@/components/insights/CollectionFitCard', () => ({
  CollectionFitCard: ({ verdict }: { verdict: { headlinePhrasing?: string } }) => (
    <div data-testid="cfc">{verdict.headlinePhrasing}</div>
  ),
}))

// IMPORT UNDER TEST — this module does not exist yet (Plan 04). RED until then.
import { AddWatchFlow } from '@/components/watch/AddWatchFlow'

import type { VerdictBundleFull } from '@/lib/verdict/types'
import type { ExtractedWatchData } from '@/lib/extractors/types'

const fixtureFullVerdict: VerdictBundleFull = {
  framing: 'cross-user',
  label: 'core-fit',
  headlinePhrasing: 'Core Fit',
  contextualPhrasings: ['Lines up cleanly with your established taste.'],
  rationalePhrasings: ['Lines up cleanly with the taste I have already built.'],
  mostSimilar: [],
  roleOverlap: false,
  candidateCatalogTaste: null,
}

const fixtureExtracted: ExtractedWatchData = {
  brand: 'Omega',
  model: 'Speedmaster',
  imageUrl: 'https://example.com/spd.jpg',
}

describe('Phase 20.1 Plan 04 — AddWatchFlow state machine', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset global fetch each test so per-test mockResolvedValue is isolated.
    global.fetch = vi.fn() as unknown as typeof fetch
    // FORM-04 Gap 3 — module-scoped URL extract cache leaks across tests
    // when the same URL is pasted in multiple tests. Reset between tests.
    const { __resetUrlExtractCacheForTests } = await import('./useUrlExtractCache')
    __resetUrlExtractCacheForTests()
  })

  it('ADD-01 happy path — paste URL → extracting → verdict-ready with 3 buttons', async () => {
    const { getVerdictForCatalogWatch } = await import('@/app/actions/verdict')
    // Defer the fetch resolution by a macrotask so the transient "extracting"
    // state is deterministically committed before the verdict-ready state —
    // mockResolvedValue resolves on the next microtask, which races the
    // intermediate "Working..." assertion under full-suite timing pressure.
    vi.mocked(global.fetch).mockImplementation(
      () =>
        new Promise<Response>((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => ({
                  success: true,
                  catalogId: 'cat-uuid',
                  data: fixtureExtracted,
                  source: 'merged',
                  confidence: 'high',
                  fieldsExtracted: ['brand', 'model'],
                  llmUsed: false,
                }),
              } as Response),
            0,
          ),
        ),
    )
    vi.mocked(getVerdictForCatalogWatch).mockResolvedValue({
      success: true,
      data: fixtureFullVerdict,
    } as never)

    render(
      <AddWatchFlow
        collectionRevision={3}
        initialCatalogId={null}
        initialIntent={null}
        initialCatalogPrefill={null}
        initialManual={false}
        initialStatus={null}
        initialReturnTo={null}
        viewerUsername={null}
        viewerUserId="user-a"
        catalogBrands={[]}
      />,
    )

    const input = screen.getByPlaceholderText(/Paste a product page URL/i)
    fireEvent.change(input, { target: { value: 'https://example.com/spd' } })
    fireEvent.click(screen.getByRole('button', { name: /Extract Watch/i }))

    // Working... copy renders during extracting state (D-07).
    expect(await screen.findByText(/Working/i)).toBeInTheDocument()

    // After extraction + verdict resolves, verdict-ready renders 3 buttons.
    expect(await screen.findByText('Add to Wishlist')).toBeInTheDocument()
    expect(screen.getByText('Add to Collection')).toBeInTheDocument()
    expect(screen.getByText('Skip')).toBeInTheDocument()
  })

  it('ADD-03 Collection path — clicking "Add to Collection" advances to form-prefill with status=owned locked', async () => {
    const { getVerdictForCatalogWatch } = await import('@/app/actions/verdict')
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        catalogId: 'cat-uuid',
        data: fixtureExtracted,
        source: 'merged',
        confidence: 'high',
        fieldsExtracted: ['brand', 'model'],
        llmUsed: false,
      }),
    } as Response)
    vi.mocked(getVerdictForCatalogWatch).mockResolvedValue({
      success: true,
      data: fixtureFullVerdict,
    } as never)

    render(
      <AddWatchFlow
        collectionRevision={3}
        initialCatalogId={null}
        initialIntent={null}
        initialCatalogPrefill={null}
        initialManual={false}
        initialStatus={null}
        initialReturnTo={null}
        viewerUsername={null}
        viewerUserId="user-a"
        catalogBrands={[]}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText(/Paste a product page URL/i), {
      target: { value: 'https://example.com/spd' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Extract Watch/i }))

    await waitFor(() => screen.getByText('Add to Collection'))
    fireEvent.click(screen.getByText('Add to Collection'))

    // form-prefill state: WatchForm renders with brand prefilled.
    await waitFor(() => {
      expect(screen.getByDisplayValue('Omega')).toBeInTheDocument()
    })
    // ADD-03 truth: status is locked to 'owned' — no <select> with status options visible.
    // We assert no element with role="combobox" and accessible name "Status" is offered.
    expect(screen.queryByRole('combobox', { name: /^Status$/i })).not.toBeInTheDocument()
  })

  it('ADD-04 Skip path — clicking Skip resets to idle and adds chip to recently-evaluated rail', async () => {
    const { getVerdictForCatalogWatch } = await import('@/app/actions/verdict')
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        catalogId: 'cat-uuid',
        data: fixtureExtracted,
        source: 'merged',
        confidence: 'high',
        fieldsExtracted: ['brand', 'model'],
        llmUsed: false,
      }),
    } as Response)
    vi.mocked(getVerdictForCatalogWatch).mockResolvedValue({
      success: true,
      data: fixtureFullVerdict,
    } as never)

    render(
      <AddWatchFlow
        collectionRevision={3}
        initialCatalogId={null}
        initialIntent={null}
        initialCatalogPrefill={null}
        initialManual={false}
        initialStatus={null}
        initialReturnTo={null}
        viewerUsername={null}
        viewerUserId="user-a"
        catalogBrands={[]}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText(/Paste a product page URL/i), {
      target: { value: 'https://example.com/spd' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Extract Watch/i }))

    await waitFor(() => screen.getByText('Skip'))
    fireEvent.click(screen.getByText('Skip'))

    // Reset to idle: paste input visible again with cleared value.
    await waitFor(() => {
      const reset = screen.getByPlaceholderText(/Paste a product page URL/i) as HTMLInputElement
      expect(reset.value).toBe('')
    })
    // D-14: "Recently evaluated" chip with brand+model copy appears under input.
    expect(screen.getByText(/Omega Speedmaster/)).toBeInTheDocument()
  })

  it('ADD-07 / UX-05 extraction-failed — renders <ExtractErrorCard> with locked D-15 copy + locked CTAs', async () => {
    // Phase 25 Plan 04: server now returns { success: false, error: <D-15>, category }
    // and AddWatchFlow renders <ExtractErrorCard> instead of the legacy
    // "Extraction didn't work" Card. Assert the new locked copy + locked CTAs.
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: "Couldn't reach that URL. Check the link and try again.",
        category: 'generic-network',
      }),
    } as Response)

    render(
      <AddWatchFlow
        collectionRevision={3}
        initialCatalogId={null}
        initialIntent={null}
        initialCatalogPrefill={null}
        initialManual={false}
        initialStatus={null}
        initialReturnTo={null}
        viewerUsername={null}
        viewerUserId="user-a"
        catalogBrands={[]}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText(/Paste a product page URL/i), {
      target: { value: 'https://example.com/broken' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Extract Watch/i }))

    // ExtractErrorCard renders inside an alert region with the locked
    // generic-network heading + body (D-15) + the locked dual CTAs (D-14).
    // The dev-only `message` prop may also render the same body string in a
    // tertiary <p>, so use getAllByText for the body assertion.
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByText("Couldn't reach that URL", { selector: 'p' }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(
        "Couldn't reach that URL. Check the link and try again.",
      ).length,
    ).toBeGreaterThanOrEqual(1)
    expect(
      screen.getByRole('button', { name: /Add manually/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Try a different URL/i }),
    ).toBeInTheDocument()
    // The legacy "Extraction didn't work" / "Continue manually" / "Try
    // another URL" surfaces are gone (replaced by ExtractErrorCard).
    expect(screen.queryByText("Extraction didn't work")).not.toBeInTheDocument()
    expect(screen.queryByText('Continue manually')).not.toBeInTheDocument()
    expect(screen.queryByText('Try another URL')).not.toBeInTheDocument()
  })

  it('UX-05 extraction-failed — defaults to generic-network category when server omits the field (defensive fallback)', async () => {
    // T-25-04-03 mitigation: defensive fallback for unexpected server shapes.
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: 'something' }),
    } as Response)

    render(
      <AddWatchFlow
        collectionRevision={3}
        initialCatalogId={null}
        initialIntent={null}
        initialCatalogPrefill={null}
        initialManual={false}
        initialStatus={null}
        initialReturnTo={null}
        viewerUsername={null}
        viewerUserId="user-a"
        catalogBrands={[]}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText(/Paste a product page URL/i), {
      target: { value: 'https://example.com/broken' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Extract Watch/i }))

    // Falls back to generic-network — the WifiOff/"Couldn't reach that URL"
    // branch — even when the server omits the category field.
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByText("Couldn't reach that URL", { selector: 'p' }),
    ).toBeInTheDocument()
  })

  it('UX-05 extraction-failed — server-emitted category drives the rendered branch (host-403)', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({
        success: false,
        error:
          "This site doesn't allow data extraction. Try entering manually.",
        category: 'host-403',
      }),
    } as Response)

    render(
      <AddWatchFlow
        collectionRevision={3}
        initialCatalogId={null}
        initialIntent={null}
        initialCatalogPrefill={null}
        initialManual={false}
        initialStatus={null}
        initialReturnTo={null}
        viewerUsername={null}
        viewerUserId="user-a"
        catalogBrands={[]}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText(/Paste a product page URL/i), {
      target: { value: 'https://blocking-site.example' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Extract Watch/i }))

    expect(
      await screen.findByText('This site blocks data extraction'),
    ).toBeInTheDocument()
    // dev-only `message` prop may render the same body string a second time;
    // assert at-least-one match instead of exactly-one.
    expect(
      screen.getAllByText(
        "This site doesn't allow data extraction. Try entering manually.",
      ).length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('Pitfall 1 deep-link prefill — initialCatalogId + initialIntent="owned" + initialCatalogPrefill goes straight to form-prefill', async () => {
    render(
      <AddWatchFlow
        collectionRevision={1}
        initialCatalogId="cat-deep"
        initialIntent="owned"
        initialCatalogPrefill={{ brand: 'Rolex', model: 'Submariner' }}
        initialManual={false}
        initialStatus={null}
        initialReturnTo={null}
        viewerUsername={null}
        viewerUserId="user-a"
        catalogBrands={[]}
      />,
    )

    // Mounts directly into form-prefill: paste section hidden, WatchForm shows brand prefilled.
    expect(screen.queryByPlaceholderText(/Paste a product page URL/i)).not.toBeInTheDocument()
    expect(await screen.findByDisplayValue('Rolex')).toBeInTheDocument()
  })
})

/**
 * Phase 20.1 Plan 06 — gap-closure RED tests.
 *
 * UAT gaps 1 + 3 share a single upstream cause: state.verdict===null and/or
 * state.catalogId==='' on verdict-ready when viewer has a non-empty collection.
 *
 * Test gap 3: Skip with empty catalogId still pushes a chip to the rail.
 * Test gap 1: non-empty collection + null catalogId surfaces "Couldn't compute fit"
 *   copy (NOT the empty-collection copy).
 */
describe('Phase 20.1 gap-closure — Plan 06', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  it("UAT gap 3 — Skip with null catalogId still pushes a chip to Recently evaluated rail", async () => {
    const { getVerdictForCatalogWatch } = await import('@/app/actions/verdict')
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        catalogId: null,  // <-- silent catalog upsert failure path
        data: { brand: 'Omega', model: 'Speedmaster', imageUrl: 'https://example.com/spd.jpg' },
        source: 'merged',
        confidence: 'high',
        fieldsExtracted: ['brand', 'model'],
        llmUsed: false,
      }),
    } as Response)
    // verdict action will not be reached since catalogId is null; safety mock
    vi.mocked(getVerdictForCatalogWatch).mockResolvedValue({
      success: false,
      error: 'should not be called',
    } as never)

    render(
      <AddWatchFlow
        collectionRevision={3}
        initialCatalogId={null}
        initialIntent={null}
        initialCatalogPrefill={null}
        initialManual={false}
        initialStatus={null}
        initialReturnTo={null}
        viewerUsername={null}
        viewerUserId="user-a"
        catalogBrands={[]}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText(/Paste a product page URL/i), {
      target: { value: 'https://example.com/spd' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Extract Watch/i }))

    // Wait until verdict-ready (Skip button visible)
    await waitFor(() => screen.getByText('Skip'))
    fireEvent.click(screen.getByText('Skip'))

    // Rail chip with brand+model is now visible — NOT silently no-op'd
    await waitFor(() => {
      expect(screen.getByText(/Omega Speedmaster/)).toBeInTheDocument()
    })
  })

  it("UAT gap 1 — non-empty collection + null catalogId surfaces 'Couldn't compute fit' copy (NOT empty-collection copy)", async () => {
    const { getVerdictForCatalogWatch } = await import('@/app/actions/verdict')
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        catalogId: null,
        data: { brand: 'Omega', model: 'Speedmaster' },
        source: 'merged',
        confidence: 'high',
        fieldsExtracted: ['brand', 'model'],
        llmUsed: false,
      }),
    } as Response)
    vi.mocked(getVerdictForCatalogWatch).mockResolvedValue({
      success: false,
      error: 'should not be called',
    } as never)

    render(
      <AddWatchFlow
        collectionRevision={3}  // non-empty
        initialCatalogId={null}
        initialIntent={null}
        initialCatalogPrefill={null}
        initialManual={false}
        initialStatus={null}
        initialReturnTo={null}
        viewerUsername={null}
        viewerUserId="user-a"
        catalogBrands={[]}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText(/Paste a product page URL/i), {
      target: { value: 'https://example.com/spd' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Extract Watch/i }))

    // Wait for verdict-ready (Skip button as anchor)
    await waitFor(() => screen.getByText('Skip'))

    // Correct copy — NOT the empty-collection copy
    expect(screen.getByText(/Couldn't compute fit/i)).toBeInTheDocument()
    expect(screen.queryByText(/collection is empty/i)).not.toBeInTheDocument()
  })

  it('UAT gap 1 observability — emits console.warn when verdict=null path fires', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getVerdictForCatalogWatch } = await import('@/app/actions/verdict')
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        catalogId: null,
        catalogIdError: 'brand/model missing from extraction',
        data: { brand: 'Omega', model: 'Speedmaster' },
        source: 'merged',
        confidence: 'high',
        fieldsExtracted: ['brand', 'model'],
        llmUsed: false,
      }),
    } as Response)
    vi.mocked(getVerdictForCatalogWatch).mockResolvedValue({
      success: false,
      error: 'should not be called',
    } as never)

    render(
      <AddWatchFlow
        collectionRevision={3}
        initialCatalogId={null}
        initialIntent={null}
        initialCatalogPrefill={null}
        initialManual={false}
        initialStatus={null}
        initialReturnTo={null}
        viewerUsername={null}
        viewerUserId="user-a"
        catalogBrands={[]}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText(/Paste a product page URL/i), {
      target: { value: 'https://example.com/spd' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Extract Watch/i }))

    await waitFor(() => screen.getByText('Skip'))
    expect(warnSpy).toHaveBeenCalledWith(
      '[AddWatchFlow] verdict=null path: catalogId-missing',
      expect.objectContaining({ catalogIdError: 'brand/model missing from extraction' }),
    )
    warnSpy.mockRestore()
  })
})

/**
 * Phase 20.1 Plan 08 — gap-closure RED tests.
 *
 * UAT gap 4 (minor severity): Once the user clicks "or enter manually" (or
 * "Continue manually" after extraction failure), there is no in-page exit
 * back to the URL extract flow — refresh required.
 *
 * Plan 08 adds a quiet "Cancel — paste a URL instead" back-link inside the
 * manual-entry render branch, wired to the existing handleStartOver.
 */
describe('Phase 20.1 gap-closure — Plan 08 (UAT gap 4 — manual-entry escape)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  it('UAT gap 4 — back-link from direct manual-entry returns to idle and clears URL', async () => {
    render(
      <AddWatchFlow
        collectionRevision={3}
        initialCatalogId={null}
        initialIntent={null}
        initialCatalogPrefill={null}
        initialManual={false}
        initialStatus={null}
        initialReturnTo={null}
        viewerUsername={null}
        viewerUserId="user-a"
        catalogBrands={[]}
      />,
    )

    // Enter some text, then bail to manual-entry
    const inputBefore = screen.getByPlaceholderText(/Paste a product page URL/i) as HTMLInputElement
    fireEvent.change(inputBefore, { target: { value: 'https://example.com/abandoned' } })
    fireEvent.click(screen.getByRole('button', { name: /or enter manually/i }))

    // We're in manual-entry — paste input is gone, WatchForm Brand input is visible
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/Paste a product page URL/i)).not.toBeInTheDocument()
    })

    // Find and click the new back affordance
    const backBtn = screen.getByRole('button', { name: /Cancel.*paste a URL/i })
    fireEvent.click(backBtn)

    // Back to idle — paste input visible AND value is empty (handleStartOver cleared it)
    await waitFor(() => {
      const inputAfter = screen.getByPlaceholderText(/Paste a product page URL/i) as HTMLInputElement
      expect(inputAfter).toBeInTheDocument()
      expect(inputAfter.value).toBe('')
    })
  })

  it('UAT gap 4 / UX-05 — "Try a different URL" CTA on ExtractErrorCard resets to idle and clears URL', async () => {
    // Phase 25 Plan 04: the post-failure surface is now ExtractErrorCard, which
    // exposes "Try a different URL" (resets to idle) and "Add manually"
    // (router.push to /watch/new?manual=1). The legacy "Continue manually"
    // in-flow transition no longer exists. This test exercises the secondary
    // CTA — semantically equivalent to the old "go back, paste a different URL"
    // recovery path.
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: "Couldn't reach that URL. Check the link and try again.",
        category: 'generic-network',
      }),
    } as Response)

    render(
      <AddWatchFlow
        collectionRevision={3}
        initialCatalogId={null}
        initialIntent={null}
        initialCatalogPrefill={null}
        initialManual={false}
        initialStatus={null}
        initialReturnTo={null}
        viewerUsername={null}
        viewerUserId="user-a"
        catalogBrands={[]}
      />,
    )

    const urlInput = screen.getByPlaceholderText(
      /Paste a product page URL/i,
    ) as HTMLInputElement
    fireEvent.change(urlInput, { target: { value: 'https://example.com/broken' } })
    fireEvent.click(screen.getByRole('button', { name: /Extract Watch/i }))

    // ExtractErrorCard appears
    await screen.findByRole('alert')

    // Click "Try a different URL" — resets state to idle + clears URL
    fireEvent.click(screen.getByRole('button', { name: /Try a different URL/i }))

    // ExtractErrorCard is gone; URL input value is cleared
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      const inputAfter = screen.getByPlaceholderText(
        /Paste a product page URL/i,
      ) as HTMLInputElement
      expect(inputAfter.value).toBe('')
    })
  })
})

/**
 * Phase 69 Plan 06 (CLNP-07): cross-cache hygiene integration.
 *
 * D-09 contract: a single user-switch must clear ALL FOUR module-scope caches
 * (useCatalogSearchCache, useStructuredExtractCache, useUrlExtractCache,
 * useWatchSearchVerdictCache) so that signing in as a different viewer does
 * NOT surface the previous user's cached typeahead/extract/verdict bytes.
 *
 * This test is the composition proof for the per-hook unit tests shipped in
 * Plans 02 + 03. Each hook owns its own user-switch reset (D-06: inline mutation
 * in render). This test asserts the contract holds when the four are exercised
 * back-to-back at the AddWatchFlow plumbing layer.
 *
 * NOTE on `useWatchSearchVerdictCache(collectionRevision, viewerUserId)`:
 * both args reset the cache when changed. We hold `collectionRevision=1` on
 * BOTH user-a and user-b reads so the OUTER user-switch is the sole invalidator
 * under test (the inner revision guard is unit-tested separately).
 *
 * NOTE on hook calls outside React render: all 4 cache hooks return plain
 * `{get, set}` over module-scope state with no React-tracked subscribers. The
 * in-render reset is a sync mutation, not setState, so calling the hooks
 * directly in the test body produces the same observable behavior as
 * rendering a component that calls them. No renderHook harness required.
 */
describe('Phase 69 — cache hygiene integration (CLNP-07)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { __resetUrlExtractCacheForTests } = await import('./useUrlExtractCache')
    const { __resetVerdictCacheForTests } = await import(
      '@/components/search/useWatchSearchVerdictCache'
    )
    const { __resetCatalogSearchCacheForTests } = await import('./useCatalogSearchCache')
    const { __resetStructuredExtractCacheForTests } = await import(
      './useStructuredExtractCache'
    )
    __resetUrlExtractCacheForTests()
    __resetVerdictCacheForTests()
    __resetCatalogSearchCacheForTests()
    __resetStructuredExtractCacheForTests()
  })

  it('switching viewerUserId clears all 4 module-scope caches in a single user-switch', async () => {
    const { useCatalogSearchCache } = await import('./useCatalogSearchCache')
    const { useStructuredExtractCache } = await import('./useStructuredExtractCache')
    const { useUrlExtractCache } = await import('./useUrlExtractCache')
    const { useWatchSearchVerdictCache } = await import(
      '@/components/search/useWatchSearchVerdictCache'
    )

    // --- Fixtures ---
    const catalogKey = 'omega speedmaster'
    const catalogValue: import('@/lib/searchTypes').SearchCatalogWatchResult[] = [
      {
        catalogId: 'cat-a',
        brand: 'Omega',
        model: 'Speedmaster',
        reference: '3135',
        imageUrl: null,
        ownersCount: 47,
        wishlistCount: 12,
        viewerState: null,
      },
    ]
    const structuredKey = JSON.stringify({
      brand: 'omega',
      model: 'speedmaster',
      reference: '3135',
      year: null,
    })
    const urlKey = 'https://example.com/spd'
    const extractFixture: import('./useUrlExtractCache').ExtractCacheEntry = {
      catalogId: 'cat-a',
      extracted: { brand: 'Omega', model: 'Speedmaster' },
      catalogIdError: null,
    }
    const verdictKey = 'cat-a'
    // Reuse the test-scoped fixtureFullVerdict declared above as the verdict
    // payload — it's already a valid VerdictBundle (post-ARCH-02 alias).

    // --- Seed user-a in all 4 caches ---
    const aCatalog = useCatalogSearchCache('user-a')
    aCatalog.set(catalogKey, catalogValue)
    expect(aCatalog.get(catalogKey)).toEqual(catalogValue)

    const aStructured = useStructuredExtractCache('user-a')
    aStructured.set(structuredKey, extractFixture)
    expect(aStructured.get(structuredKey)).toEqual(extractFixture)

    const aUrl = useUrlExtractCache('user-a')
    aUrl.set(urlKey, extractFixture)
    expect(aUrl.get(urlKey)).toEqual(extractFixture)

    const aVerdict = useWatchSearchVerdictCache(1, 'user-a')
    aVerdict.set(verdictKey, fixtureFullVerdict)
    expect(aVerdict.get(verdictKey)).toEqual(fixtureFullVerdict)

    // --- User-switch: same revision, different viewerUserId ---
    const bCatalog = useCatalogSearchCache('user-b')
    const bStructured = useStructuredExtractCache('user-b')
    const bUrl = useUrlExtractCache('user-b')
    const bVerdict = useWatchSearchVerdictCache(1, 'user-b')

    // --- Assertions: all 4 caches surface undefined for the user-a keys ---
    // The in-render `if (moduleUserId !== viewerUserId) moduleCache = new Map()`
    // guard fires once per hook call, so the same-render rebind to user-b
    // already returns an empty Map. CLNP-07 is closed if these 4 lines pass.
    expect(bCatalog.get(catalogKey)).toBeUndefined()
    expect(bStructured.get(structuredKey)).toBeUndefined()
    expect(bUrl.get(urlKey)).toBeUndefined()
    expect(bVerdict.get(verdictKey)).toBeUndefined()
  })
})
