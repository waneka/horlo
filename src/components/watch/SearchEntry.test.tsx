/**
 * Phase 69 Plan 05 — RED test scaffold for SearchEntry.
 *
 * Pure-presenter typeahead over watches_catalog via base-ui Combobox 1.3.0
 * primitive, debounced fetch through the searchCatalogForAddFlow Server Action,
 * cache short-circuit via useCatalogSearchCache, inline no-match expand of
 * StructuredEntryPanel, SRCH-24 footer expand, and viewerState pill rendering.
 *
 * 15 cases covering SRCH-17..25 + D-01..D-05 + D-10..D-12 + D-14:
 *   1. Sub-2-char query → no fetch fires even after debounce
 *   2. ≥2 chars after 250ms debounce → single fetch fires with the trimmed query
 *   3. Multiple keystrokes within debounce window → ONE fetch (coalescing)
 *   4. Cache hit on identical key short-circuits the fetch entirely
 *   5. Result row renders font-semibold brand/model + reference subtitle + owners count + viewerState pill
 *   6. HighlightedText wraps matched substring inside result rows
 *   7. ArrowDown then Enter on a highlighted item fires onPick(result)
 *   8. role="combobox" on input + role="listbox" / role="option" on popup once results land
 *   9. query.length ≥ 3 && results === [] → popup closes + StructuredEntryPanel mounts inline below
 *   10. Pre-seed flows through: parseSearchQuery(query, catalogBrands) → panel.initialBrand/Model/Reference
 *   11. With results > 0, SRCH-24 footer "Not finding it? Add manually" renders
 *   12. SRCH-24 footer click mounts the SAME inline panel (D-14 one mechanism, two entry points)
 *   13. viewerState='owned' → "In collection" pill; viewerState='wishlist' → "On wishlist" pill; null → no pill
 *   14. Presenter discipline counter-assert: no useRouter, no router.push surface (assertion checks DOM not source)
 *   15. AbortController stale-result: two queries firing back-to-back; only second's results commit
 *
 * Mocks per Phase 68 ConfirmStep.test.tsx + Plan 04 StructuredEntryPanel.test.tsx
 * precedent: next/image, searchCatalogForAddFlow Server Action,
 * useCatalogSearchCache hook, and StructuredEntryPanel rendered as a transparent
 * test-double so this file stays focused on the SearchEntry contract.
 *
 * RED until Plan 05 ships `@/components/watch/SearchEntry`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}))

vi.mock('@/app/actions/search', () => ({
  searchCatalogForAddFlow: vi.fn(),
}))

// Cache hook is mocked at module-scope so each test can wire its own get/set
// pair. The default returns `undefined` from get() (cache miss) which exercises
// the network path. Tests that need a cache hit override the mock implementation.
vi.mock('@/components/watch/useCatalogSearchCache', () => ({
  useCatalogSearchCache: vi.fn(() => ({
    get: vi.fn(() => undefined),
    set: vi.fn(),
  })),
}))

// StructuredEntryPanel is mocked as a transparent test-double. The mock exposes
// the props it received via data-* attributes so tests can assert pre-seed
// values (Test 10) and the onSwitchToUrl pass-through (D-11 / EXTR-07).
vi.mock('@/components/watch/StructuredEntryPanel', () => ({
  StructuredEntryPanel: (props: {
    viewerUserId: string
    initialBrand?: string
    initialModel?: string
    initialReference?: string
    onSubmitStructured: (...args: unknown[]) => void
    onSwitchToUrl: () => void
  }) => (
    <div
      data-testid="structured-panel-mock"
      data-brand={props.initialBrand ?? ''}
      data-model={props.initialModel ?? ''}
      data-reference={props.initialReference ?? ''}
      data-viewer={props.viewerUserId}
    >
      <button
        type="button"
        data-testid="structured-panel-mock-switch-url"
        onClick={() => props.onSwitchToUrl()}
      >
        switch
      </button>
    </div>
  ),
}))

// IMPORT UNDER TEST — Plan 05 ships this.
import { SearchEntry } from '@/components/watch/SearchEntry'
import { searchCatalogForAddFlow } from '@/app/actions/search'
import { useCatalogSearchCache } from '@/components/watch/useCatalogSearchCache'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'

const BRANDS = ['Omega', 'Tag Heuer', 'Rolex']

const BASE_PROPS = {
  viewerUserId: 'viewer-1',
  catalogBrands: BRANDS,
  onPick: vi.fn(),
  onSubmitStructured: vi.fn(),
  onSwitchToUrl: vi.fn(),
}

function makeResult(
  partial: Partial<SearchCatalogWatchResult> &
    Pick<SearchCatalogWatchResult, 'catalogId' | 'brand' | 'model'>,
): SearchCatalogWatchResult {
  return {
    reference: '311.30.42.30.01.005',
    imageUrl: null,
    ownersCount: 47,
    wishlistCount: 12,
    viewerState: null,
    ...partial,
  }
}

const OMEGA: SearchCatalogWatchResult = makeResult({
  catalogId: 'cat-omega-speedmaster',
  brand: 'Omega',
  model: 'Speedmaster',
})

const ROLEX: SearchCatalogWatchResult = makeResult({
  catalogId: 'cat-rolex-submariner',
  brand: 'Rolex',
  model: 'Submariner',
  reference: '126610LN',
  ownersCount: 0,
})

describe('SearchEntry — debounce gating (SRCH-18)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(searchCatalogForAddFlow).mockReset()
    vi.mocked(useCatalogSearchCache).mockReturnValue({
      get: vi.fn(() => undefined),
      set: vi.fn(),
    })
    BASE_PROPS.onPick.mockReset()
    BASE_PROPS.onSubmitStructured.mockReset()
    BASE_PROPS.onSwitchToUrl.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('(1) single-char query never fires searchCatalogForAddFlow even after debounce settles', async () => {
    vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
      success: true,
      data: [],
    })

    render(<SearchEntry {...BASE_PROPS} />)

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'o' } })

    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    expect(searchCatalogForAddFlow).not.toHaveBeenCalled()
  })

  it('(2) ≥2-char query after 250ms debounce fires fetch exactly once with trimmed q', async () => {
    vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
      success: true,
      data: [OMEGA],
    })

    render(<SearchEntry {...BASE_PROPS} />)

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'speedmaster' } })

    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    // Let the resolved promise microtask flush.
    await act(async () => {
      await Promise.resolve()
    })

    expect(searchCatalogForAddFlow).toHaveBeenCalledTimes(1)
    expect(searchCatalogForAddFlow).toHaveBeenCalledWith({ q: 'speedmaster' })
  })

  it('(3) multiple keystrokes within 250ms coalesce into a single fetch', async () => {
    vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
      success: true,
      data: [],
    })

    render(<SearchEntry {...BASE_PROPS} />)
    const input = screen.getByRole('combobox')

    fireEvent.change(input, { target: { value: 'sp' } })
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    fireEvent.change(input, { target: { value: 'spee' } })
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    fireEvent.change(input, { target: { value: 'speedy' } })
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(searchCatalogForAddFlow).toHaveBeenCalledTimes(1)
    expect(searchCatalogForAddFlow).toHaveBeenCalledWith({ q: 'speedy' })
  })
})

describe('SearchEntry — cache short-circuit (D-04 + D-18 axis 2)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(searchCatalogForAddFlow).mockReset()
    BASE_PROPS.onPick.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('(4) cache hit on identical key short-circuits the network call', async () => {
    const cachedResults = [OMEGA]
    vi.mocked(useCatalogSearchCache).mockReturnValue({
      get: vi.fn((key: string) =>
        key === 'speedmaster' ? cachedResults : undefined,
      ),
      set: vi.fn(),
    })

    vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
      success: true,
      data: [],
    })

    render(<SearchEntry {...BASE_PROPS} />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'speedmaster' } })

    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(searchCatalogForAddFlow).not.toHaveBeenCalled()
    // Cached result must surface as an option in the listbox. HighlightedText
    // splits the rendered text across <strong>+<Fragment> nodes, so query by
    // role=option + textContent rather than an exact getByText.
    const options = screen.getAllByRole('option')
    expect(options.length).toBe(1)
    expect(options[0].textContent).toContain('Omega Speedmaster')
  })
})

describe('SearchEntry — result row composition (SRCH-19 + SRCH-22 + SRCH-23)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(searchCatalogForAddFlow).mockReset()
    vi.mocked(useCatalogSearchCache).mockReturnValue({
      get: vi.fn(() => undefined),
      set: vi.fn(),
    })
    BASE_PROPS.onPick.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('(5) result row renders font-semibold primary text + reference + owners count', async () => {
    vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
      success: true,
      data: [OMEGA],
    })

    render(<SearchEntry {...BASE_PROPS} />)
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'speedmaster' },
    })
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    await act(async () => {
      await Promise.resolve()
    })

    // Primary line uses font-semibold per WatchSearchRow precedent. The
    // HighlightedText wrap splits the text across nodes, so target the <p>
    // wrapper by content + class assertion via textContent.
    const option = screen.getAllByRole('option')[0]
    const primary = option.querySelector('p.font-semibold')
    expect(primary).not.toBeNull()
    expect(primary!.textContent).toContain('Omega Speedmaster')
    expect(primary!.className).toContain('font-semibold')
    expect(primary!.className).not.toContain('font-medium')
    // Reference + " · " + collectors count are present in the subtitle.
    expect(option.textContent).toContain('311.30.42.30.01.005')
    expect(option.textContent).toContain('47 collectors')
  })

  it('(6) HighlightedText wraps matched substring inside the result row', async () => {
    vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
      success: true,
      data: [OMEGA],
    })

    render(<SearchEntry {...BASE_PROPS} />)
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'speed' },
    })
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    await act(async () => {
      await Promise.resolve()
    })

    // HighlightedText emits <strong> for matched substrings.
    const strongs = document.querySelectorAll('strong')
    const matched = Array.from(strongs).find(
      (el) => el.textContent?.toLowerCase() === 'speed',
    )
    expect(matched).toBeTruthy()
  })

  it(
    '(13a) viewerState="owned" renders "In collection" pill (NOT "Owned")',
    async () => {
      vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
        success: true,
        data: [{ ...OMEGA, viewerState: 'owned' }],
      })

      render(<SearchEntry {...BASE_PROPS} />)
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'speed' },
      })
      await act(async () => {
        vi.advanceTimersByTime(250)
      })
      await act(async () => {
        await Promise.resolve()
      })

      expect(screen.getByText('In collection')).toBeInTheDocument()
      expect(screen.queryByText('Owned')).not.toBeInTheDocument()
    },
  )

  it(
    '(13b) viewerState="wishlist" renders "On wishlist" pill (NOT "Wishlist")',
    async () => {
      vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
        success: true,
        data: [{ ...OMEGA, viewerState: 'wishlist' }],
      })

      render(<SearchEntry {...BASE_PROPS} />)
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'speed' },
      })
      await act(async () => {
        vi.advanceTimersByTime(250)
      })
      await act(async () => {
        await Promise.resolve()
      })

      expect(screen.getByText('On wishlist')).toBeInTheDocument()
      expect(screen.queryByText('Wishlist')).not.toBeInTheDocument()
    },
  )

  it(
    '(13c) viewerState=null renders NEITHER pill copy',
    async () => {
      vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
        success: true,
        data: [{ ...OMEGA, viewerState: null }],
      })

      render(<SearchEntry {...BASE_PROPS} />)
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'speed' },
      })
      await act(async () => {
        vi.advanceTimersByTime(250)
      })
      await act(async () => {
        await Promise.resolve()
      })

      expect(screen.queryByText('In collection')).not.toBeInTheDocument()
      expect(screen.queryByText('On wishlist')).not.toBeInTheDocument()
    },
  )

  it(
    '(SRCH-23 zero) ownersCount=0 renders "0 collectors" literal — no special "be the first" copy',
    async () => {
      vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
        success: true,
        data: [ROLEX], // ownersCount=0
      })

      render(<SearchEntry {...BASE_PROPS} />)
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'submariner' },
      })
      await act(async () => {
        vi.advanceTimersByTime(250)
      })
      await act(async () => {
        await Promise.resolve()
      })

      expect(screen.getByText(/0 collectors/)).toBeInTheDocument()
      expect(screen.queryByText(/be the first/i)).not.toBeInTheDocument()
    },
  )
})

describe('SearchEntry — keyboard navigation + ARIA (SRCH-20)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(searchCatalogForAddFlow).mockReset()
    vi.mocked(useCatalogSearchCache).mockReturnValue({
      get: vi.fn(() => undefined),
      set: vi.fn(),
    })
    BASE_PROPS.onPick.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('(8) role="combobox" on input + role="listbox" + role="option" after results land', async () => {
    vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
      success: true,
      data: [OMEGA],
    })

    render(<SearchEntry {...BASE_PROPS} />)
    const input = screen.getByRole('combobox')
    expect(input).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'speed' } })
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    await act(async () => {
      await Promise.resolve()
    })

    // base-ui Combobox.List/Item auto-supply listbox/option roles.
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThanOrEqual(1)
  })

  it('(7) clicking a result row fires onPick(result) with the full row payload (D-03 + SRCH-21)', async () => {
    vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
      success: true,
      data: [OMEGA],
    })

    render(<SearchEntry {...BASE_PROPS} />)
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'speed' },
    })
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    await act(async () => {
      await Promise.resolve()
    })

    const option = screen.getAllByRole('option')[0]
    fireEvent.click(option)

    expect(BASE_PROPS.onPick).toHaveBeenCalledTimes(1)
    expect(BASE_PROPS.onPick).toHaveBeenCalledWith(OMEGA)
  })
})

describe('SearchEntry — inline no-match expand (D-05 + D-10 + D-11 + D-14)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(searchCatalogForAddFlow).mockReset()
    vi.mocked(useCatalogSearchCache).mockReturnValue({
      get: vi.fn(() => undefined),
      set: vi.fn(),
    })
    BASE_PROPS.onPick.mockReset()
    BASE_PROPS.onSwitchToUrl.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('(9) query.length ≥ 3 && results === [] → popup closes + StructuredEntryPanel mounts inline below', async () => {
    vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
      success: true,
      data: [],
    })

    render(<SearchEntry {...BASE_PROPS} />)
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'zzz' },
    })
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    await act(async () => {
      await Promise.resolve()
    })

    // listbox is hidden (popup force-closed via open={false}).
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    // StructuredEntryPanel rendered inline (data-testid from the mock).
    expect(screen.getByTestId('structured-panel-mock')).toBeInTheDocument()
  })

  it(
    '(10) D-12 pre-seed: parseSearchQuery output flows into panel.initialBrand/Model/Reference',
    async () => {
      vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
        success: true,
        data: [],
      })

      render(<SearchEntry {...BASE_PROPS} />)
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'omega speedmaster 3135' },
      })
      await act(async () => {
        vi.advanceTimersByTime(250)
      })
      await act(async () => {
        await Promise.resolve()
      })

      const panel = screen.getByTestId('structured-panel-mock')
      expect(panel.getAttribute('data-brand')).toBe('Omega')
      expect(panel.getAttribute('data-model')).toBe('Speedmaster')
      expect(panel.getAttribute('data-reference')).toBe('3135')
    },
  )

  it('(11) SRCH-24 footer "Not finding it? Add manually" renders with results > 0', async () => {
    vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
      success: true,
      data: [OMEGA],
    })

    render(<SearchEntry {...BASE_PROPS} />)
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'speed' },
    })
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(
      screen.getByRole('button', { name: /Not finding it\? Add manually/i }),
    ).toBeInTheDocument()
  })

  it('(12) SRCH-24 footer click expands the SAME inline panel (D-14 one mechanism, two entry points)', async () => {
    vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
      success: true,
      data: [OMEGA],
    })

    render(<SearchEntry {...BASE_PROPS} />)
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'omega speedmaster 3135' },
    })
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.queryByTestId('structured-panel-mock')).not.toBeInTheDocument()

    const footer = screen.getByRole('button', {
      name: /Not finding it\? Add manually/i,
    })
    fireEvent.click(footer)

    const panel = screen.getByTestId('structured-panel-mock')
    expect(panel).toBeInTheDocument()
    // SAME pre-seed pipeline (parseSearchQuery) — brand=Omega.
    expect(panel.getAttribute('data-brand')).toBe('Omega')
  })

  it('(EXTR-07 bubble) panel onSwitchToUrl bubbles up through SearchEntry to caller', async () => {
    vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
      success: true,
      data: [],
    })

    render(<SearchEntry {...BASE_PROPS} />)
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'zzz' },
    })
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.click(screen.getByTestId('structured-panel-mock-switch-url'))

    expect(BASE_PROPS.onSwitchToUrl).toHaveBeenCalledTimes(1)
  })
})

describe('SearchEntry — AbortController stale-result guard (D-04)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(searchCatalogForAddFlow).mockReset()
    vi.mocked(useCatalogSearchCache).mockReturnValue({
      get: vi.fn(() => undefined),
      set: vi.fn(),
    })
    BASE_PROPS.onPick.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('(15) two consecutive queries: only the second query result lands in the listbox', async () => {
    // First call resolves SLOWLY (we never resolve it explicitly — it will be
    // aborted by the second effect's cleanup); second call resolves fast.
    const calls: Array<{
      q: string
      resolve: (v: unknown) => void
    }> = []
    vi.mocked(searchCatalogForAddFlow).mockImplementation(
      ((args: { q: string }) =>
        new Promise((resolve) => {
          calls.push({ q: args.q, resolve })
        })) as typeof searchCatalogForAddFlow,
    )

    render(<SearchEntry {...BASE_PROPS} />)
    const input = screen.getByRole('combobox')

    fireEvent.change(input, { target: { value: 'speedmaster' } })
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    fireEvent.change(input, { target: { value: 'submariner' } })
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    // Resolve the SECOND request first, then the (now-stale) first.
    expect(calls.length).toBe(2)
    await act(async () => {
      calls[1].resolve({ success: true, data: [ROLEX] })
      await Promise.resolve()
    })
    await act(async () => {
      calls[0].resolve({ success: true, data: [OMEGA] })
      await Promise.resolve()
    })

    // Only Submariner (the second query) is in the listbox; Speedmaster is NOT
    // because its in-flight controller was aborted on debouncedQuery change.
    const options = screen.getAllByRole('option')
    expect(options.length).toBe(1)
    expect(options[0].textContent).toContain('Rolex Submariner')
    expect(options[0].textContent).not.toContain('Omega Speedmaster')
  })
})

describe('SearchEntry — pure-presenter discipline (counter-assert)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(searchCatalogForAddFlow).mockReset()
    vi.mocked(useCatalogSearchCache).mockReturnValue({
      get: vi.fn(() => undefined),
      set: vi.fn(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('(14) renders without any next/navigation hook surface (smoke render — no useRouter)', () => {
    // If SearchEntry pulled in useRouter from next/navigation under a jsdom
    // test environment without a Next router context wrapper, render() would
    // throw "invariant expected app router to be mounted". A clean render
    // demonstrates the absence of that import.
    expect(() => {
      render(<SearchEntry {...BASE_PROPS} />)
    }).not.toThrow()
  })
})
