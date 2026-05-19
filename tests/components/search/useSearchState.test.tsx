import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Wave 0 RED — useSearchState hook contract per CONTEXT.md D-03, D-04, D-12,
// D-20, D-28.
//
// The hook owns: q, debouncedQ (250ms), tab, URL sync via router.replace
// (scroll: false), AbortController-cancelled fetch via searchPeopleAction,
// 2-char client minimum, tab-gated fetch (only 'all' and 'people' fire).
// ---------------------------------------------------------------------------

const mockReplace = vi.fn()

// Mutable backing store for search params — allows tests to simulate soft nav
// by mutating currentParams and swapping the returned object reference (which
// is what App Router's useSearchParams does: a new ReadonlyURLSearchParams
// instance per navigation).
let currentParams: Record<string, string> = {}
let mockSearchParamsObject = { get: (k: string) => currentParams[k] ?? null }

const mockUseSearchParams = vi.fn(() => mockSearchParamsObject)

// Helper: simulate a soft nav by updating params and returning a NEW object
// identity (matches App Router's per-navigation ReadonlyURLSearchParams).
function setSearchParams(params: Record<string, string>) {
  currentParams = { ...params }
  mockSearchParamsObject = { get: (k: string) => currentParams[k] ?? null }
  mockUseSearchParams.mockReturnValue(mockSearchParamsObject)
}

// Keep backward-compat alias for tests that use mockSearchParams.get directly.
const mockSearchParams = {
  get: vi.fn().mockImplementation((k: string) => currentParams[k] ?? null),
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockUseSearchParams(),
}))

const mockSearchPeopleAction = vi.fn()
const mockSearchWatchesAction = vi.fn()
const mockSearchCollectionsAction = vi.fn()
vi.mock('@/app/actions/search', () => ({
  searchPeopleAction: (...args: unknown[]) => mockSearchPeopleAction(...args),
  searchWatchesAction: (...args: unknown[]) => mockSearchWatchesAction(...args),
  searchCollectionsAction: (...args: unknown[]) =>
    mockSearchCollectionsAction(...args),
}))

// Import AFTER mocks. Target file does not exist until Plan 03 — RED state.
import { useSearchState } from '@/components/search/useSearchState'

describe('useSearchState (D-03 / D-04 / D-12 / D-20 / D-28)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    mockReplace.mockClear()
    mockSearchPeopleAction.mockReset()
    mockSearchWatchesAction.mockReset()
    mockSearchCollectionsAction.mockReset()
    // Reset the mutable params backing store and mock objects.
    currentParams = {}
    mockSearchParamsObject = { get: (k: string) => currentParams[k] ?? null }
    mockUseSearchParams.mockReturnValue(mockSearchParamsObject)
    // Keep backward-compat alias in sync.
    mockSearchParams.get.mockReset()
    mockSearchParams.get.mockImplementation((k: string) => currentParams[k] ?? null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('Test 1: 250ms debounce — typing fires debouncedQ once after 250ms (D-03)', async () => {
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useSearchState())

    act(() => result.current.setQ('b'))
    act(() => result.current.setQ('bo'))

    // Before debounce window: action should NOT have fired
    expect(mockSearchPeopleAction).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    // debouncedQ should now be 'bo' (length 2 — fires)
    await waitFor(() => {
      expect(mockSearchPeopleAction).toHaveBeenCalledTimes(1)
    })
  })

  it('Test 2: 2-char client minimum — q="b" does NOT fire searchPeopleAction; q="bo" DOES (D-20)', async () => {
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useSearchState())

    act(() => result.current.setQ('b'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    expect(mockSearchPeopleAction).not.toHaveBeenCalled()

    act(() => result.current.setQ('bo'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    await waitFor(() => {
      expect(mockSearchPeopleAction).toHaveBeenCalledTimes(1)
    })
  })

  it('Test 3: AbortController stale-cancel — only the latest fetch result lands in state (D-03)', async () => {
    let resolveFirst!: (v: unknown) => void
    const firstPromise = new Promise((res) => {
      resolveFirst = res
    })
    mockSearchPeopleAction
      .mockImplementationOnce(() => firstPromise) // q='bo' — never resolves until later
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            userId: 'u-bob',
            username: 'bob',
            displayName: 'Bob',
            avatarUrl: null,
            bio: null,
            bioSnippet: null,
            overlap: 0.55,
            sharedCount: 0,
            sharedWatches: [],
            isFollowing: false,
          },
        ],
      })

    const { result } = renderHook(() => useSearchState())

    act(() => result.current.setQ('bo'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    // Trigger a second debounced fetch — should abort the first.
    act(() => result.current.setQ('bob'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    // Now resolve the first (stale) fetch — its result should be dropped.
    resolveFirst({
      success: true,
      data: [
        {
          userId: 'u-stale',
          username: 'stale',
          displayName: 'Stale',
          avatarUrl: null,
          bio: null,
          bioSnippet: null,
          overlap: 0.85,
          sharedCount: 0,
          sharedWatches: [],
          isFollowing: false,
        },
      ],
    })

    await waitFor(() => {
      expect(result.current.peopleResults.length).toBeGreaterThan(0)
      // Only the second (non-stale) fetch result lands
      expect(result.current.peopleResults[0].userId).toBe('u-bob')
    })
  })

  it('Test 4: URL sync — router.replace called with /search?q=bob and { scroll: false } (D-04)', async () => {
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useSearchState())

    act(() => result.current.setQ('bob'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/search?q=bob', { scroll: false })
    })
  })

  it('Test 5: tab="all" — ?tab= OMITTED from URL when active (D-12)', async () => {
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useSearchState())

    act(() => result.current.setQ('bob'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/search?q=bob', { scroll: false })
    })
    // Assert NO call wrote ?tab=all
    const calls = mockReplace.mock.calls
    expect(calls.every((c) => !String(c[0]).includes('tab=all'))).toBe(true)
  })

  it('Test 6: tab="people" — ?tab=people present in URL', async () => {
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useSearchState())

    act(() => result.current.setTab('people'))
    act(() => result.current.setQ('bob'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    await waitFor(() => {
      const replaced = mockReplace.mock.calls.map((c) => String(c[0]))
      expect(replaced.some((u) => u.includes('tab=people'))).toBe(true)
    })
  })

  it('Test 7: tab="watches" — fetch effect does NOT call searchPeopleAction', async () => {
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useSearchState())

    act(() => result.current.setTab('watches'))
    act(() => result.current.setQ('bob'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    expect(mockSearchPeopleAction).not.toHaveBeenCalled()
  })

  it('Test 8: tab="collections" — fetch effect does NOT call searchPeopleAction', async () => {
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useSearchState())

    act(() => result.current.setTab('collections'))
    act(() => result.current.setQ('bob'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    expect(mockSearchPeopleAction).not.toHaveBeenCalled()
  })

  it('Test 9: initial mount with ?q=foo pre-populates q AND fires fetch immediately (D-02)', async () => {
    setSearchParams({ q: 'foo' })
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useSearchState())

    expect(result.current.q).toBe('foo')

    // Initial debounce settles to 'foo' immediately on first effect tick
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    await waitFor(() => {
      expect(mockSearchPeopleAction).toHaveBeenCalled()
    })
  })

  it('Test 10: cleanup — unmount during in-flight fetch fires controller.abort()', async () => {
    // Capture AbortController instances created during the test
    const created: AbortController[] = []
    const OriginalAbortController = global.AbortController
    const SpyAbortController = vi.fn().mockImplementation(() => {
      const ctrl = new OriginalAbortController()
      created.push(ctrl)
      return ctrl
    })
    // @ts-expect-error overriding for spy
    global.AbortController = SpyAbortController

    try {
      mockSearchPeopleAction.mockImplementation(() => new Promise(() => {}))

      const { result, unmount } = renderHook(() => useSearchState())

      act(() => result.current.setQ('bob'))
      await act(async () => {
        vi.advanceTimersByTime(250)
      })

      expect(created.length).toBeGreaterThan(0)
      const last = created[created.length - 1]
      expect(last.signal.aborted).toBe(false)

      unmount()

      expect(last.signal.aborted).toBe(true)
    } finally {
      global.AbortController = OriginalAbortController
    }
  })

  it('Test 11 (D-04 / D-20 inverse): typing q="ab" then deleting to "b" replaces URL with bare /search', async () => {
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useSearchState())

    act(() => result.current.setQ('ab'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/search?q=ab', { scroll: false })
    })

    mockReplace.mockClear()

    // Now shrink to sub-2-char — URL must clear, NOT stale-stick on '?q=ab'.
    act(() => result.current.setQ('b'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/search', { scroll: false })
    })
  })

  it('Test 11b (46-05 CR-01 regression): clearing the search box on /search?q=ab replaces URL with bare /search — the Fault 2 guard must not strip-block q', async () => {
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })
    // Arrive at /search?q=ab — q seeds into state from the URL on mount.
    setSearchParams({ q: 'ab' })

    const { result } = renderHook(() => useSearchState())

    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    mockReplace.mockClear()

    // Clear the box. searchParams still carries q=ab (no soft nav happened),
    // so the built URL omits q. The Fault 2 guard is scoped to facet params
    // only — it must NOT treat q as "incoming" and skip the replace, or the
    // stale ?q=ab sticks in the URL forever (CR-01).
    act(() => result.current.setQ(''))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/search', { scroll: false })
    })
  })

  it('Test 11c (46-05 CR-01 regression): returning to the All tab from /search?tab=watches replaces URL with bare /search — the Fault 2 guard must not strip-block tab', async () => {
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })
    mockSearchWatchesAction.mockResolvedValue({ success: true, data: [] })
    // Arrive at /search?tab=watches — tab seeds into state from the URL on mount.
    setSearchParams({ tab: 'watches' })

    const { result } = renderHook(() => useSearchState())

    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    mockReplace.mockClear()

    // Switch back to the All tab. searchParams still carries tab=watches, so
    // the built URL omits tab (tab='all' is the omitted default). The guard
    // must not treat tab as "incoming" — otherwise ?tab=watches stale-sticks.
    act(() => result.current.setTab('all'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/search', { scroll: false })
    })
  })

  // -------------------------------------------------------------------------
  // Phase 19 Plan 05 — Pitfall 9 fix + per-tab dispatch + per-section abort.
  // Three independent sub-effects each own their own AbortController per
  // RESEARCH.md Q4 path A recommendation.
  // -------------------------------------------------------------------------

  it('Test 12 — tab="watches" fires searchWatchesAction only (Pitfall 9 fix + sub-effect dispatch)', async () => {
    mockSearchWatchesAction.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useSearchState())

    act(() => result.current.setTab('watches'))
    act(() => result.current.setQ('rolex'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    await waitFor(() => {
      expect(mockSearchWatchesAction).toHaveBeenCalledWith({ q: 'rolex' })
    })
    expect(mockSearchPeopleAction).not.toHaveBeenCalled()
    expect(mockSearchCollectionsAction).not.toHaveBeenCalled()
  })

  it('Test 13 — tab="collections" fires searchCollectionsAction only', async () => {
    mockSearchCollectionsAction.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useSearchState())

    act(() => result.current.setTab('collections'))
    act(() => result.current.setQ('rolex'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    await waitFor(() => {
      expect(mockSearchCollectionsAction).toHaveBeenCalledWith({ q: 'rolex' })
    })
    expect(mockSearchPeopleAction).not.toHaveBeenCalled()
    expect(mockSearchWatchesAction).not.toHaveBeenCalled()
  })

  it('Test 14 — tab="all" fires all 3 actions in parallel via 3 sub-effects', async () => {
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })
    mockSearchWatchesAction.mockResolvedValue({ success: true, data: [] })
    mockSearchCollectionsAction.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useSearchState())

    act(() => result.current.setQ('rolex'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    await waitFor(() => {
      expect(mockSearchPeopleAction).toHaveBeenCalledTimes(1)
      expect(mockSearchWatchesAction).toHaveBeenCalledTimes(1)
      expect(mockSearchCollectionsAction).toHaveBeenCalledTimes(1)
    })
  })

  it('Test 15 — All tab caps each section at 5 (SRCH-13 / D-13)', async () => {
    const peopleData = Array.from({ length: 20 }, (_, i) => ({
      userId: `p${i}`,
      username: `p${i}`,
      displayName: null,
      avatarUrl: null,
      bio: null,
      bioSnippet: null,
      overlap: 0.5,
      sharedCount: 0,
      sharedWatches: [],
      isFollowing: false,
    }))
    const watchesData = Array.from({ length: 20 }, (_, i) => ({
      catalogId: `c${i}`,
      brand: 'B',
      model: `M${i}`,
      reference: null,
      imageUrl: null,
      ownersCount: 1,
      wishlistCount: 0,
      viewerState: null,
    }))
    const collectionsData = Array.from({ length: 20 }, (_, i) => ({
      userId: `cu${i}`,
      username: `cu${i}`,
      displayName: null,
      avatarUrl: null,
      matchCount: 1,
      tasteOverlap: 0.5,
      matchedWatches: [],
      matchedTags: [],
    }))
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: peopleData })
    mockSearchWatchesAction.mockResolvedValue({ success: true, data: watchesData })
    mockSearchCollectionsAction.mockResolvedValue({
      success: true,
      data: collectionsData,
    })

    const { result } = renderHook(() => useSearchState())

    act(() => result.current.setQ('rolex'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    await waitFor(() => {
      expect(result.current.peopleResults.length).toBe(5)
      expect(result.current.watchesResults.length).toBe(5)
      expect(result.current.collectionsResults.length).toBe(5)
    })
  })

  it('Test 16 — per-section abort granularity (SRCH-14 path A): rapid tab switch aborts prior in-flight per-section', async () => {
    let watchesResolver: ((v: { success: true; data: [] }) => void) | undefined
    mockSearchWatchesAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          watchesResolver = resolve as never
        }),
    )
    mockSearchCollectionsAction.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useSearchState())

    act(() => result.current.setTab('watches'))
    act(() => result.current.setQ('rolex'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    // Switch tab BEFORE Watches resolves — watches sub-effect's controller aborts.
    act(() => result.current.setTab('collections'))

    // Now resolve Watches — its data MUST NOT leak into watchesResults
    // (signal.aborted on watches sub-effect's controller).
    act(() => {
      watchesResolver?.({ success: true, data: [] as never })
    })

    await waitFor(() => {
      expect(mockSearchCollectionsAction).toHaveBeenCalled()
    })
    expect(result.current.watchesResults).toEqual([])
  })

  it('Test 17 — q change rapidly aborts prior watches fetch', async () => {
    mockSearchWatchesAction.mockImplementation((args: { q: string }) => {
      return Promise.resolve({
        success: true,
        data: [
          {
            catalogId: `c-${args.q}`,
            brand: 'B',
            model: args.q,
            reference: null,
            imageUrl: null,
            ownersCount: 1,
            wishlistCount: 0,
            viewerState: null,
          },
        ],
      })
    })

    const { result } = renderHook(() => useSearchState())

    act(() => result.current.setTab('watches'))
    act(() => result.current.setQ('a'))
    act(() => result.current.setQ('ab'))
    act(() => result.current.setQ('abc'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    await waitFor(() => {
      // Latest q wins — only one fetch's data lands.
      expect(result.current.watchesResults[0]?.model).toBe('abc')
    })
  })

  it('Test 18 — error path per tab is isolated', async () => {
    mockSearchWatchesAction.mockResolvedValue({
      success: false,
      error: "Couldn't run search.",
    })
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })
    mockSearchCollectionsAction.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useSearchState())

    act(() => result.current.setQ('rolex'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    await waitFor(() => {
      expect(result.current.watchesHasError).toBe(true)
    })
    expect(result.current.peopleHasError).toBe(false)
    expect(result.current.collectionsHasError).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Phase 46 Plan 05 — G5 soft-nav regression tests.
  // App Router soft nav does NOT remount /search, so useSearchParams returns a
  // new object reference per navigation. The hook must detect the new reference
  // and re-seed facet state from the incoming URL params.
  // -------------------------------------------------------------------------

  it('Test 20 — soft nav re-seeds archetype facet from URL (G5)', async () => {
    // Initial render: archetype=A
    setSearchParams({ archetype: 'A', tab: 'watches' })
    mockSearchWatchesAction.mockResolvedValue({ success: true, data: [] })

    const { result, rerender } = renderHook(() => useSearchState())

    // Confirm initial seed
    expect(result.current.archetype).toBe('A')

    // Simulate soft nav: App Router pushes a new ReadonlyURLSearchParams with archetype=B.
    // setSearchParams creates a NEW object identity — the reconciliation effect
    // must detect this and copy 'B' into state.
    act(() => {
      setSearchParams({ archetype: 'B', tab: 'watches' })
    })
    // Force re-render (soft nav causes the component to re-render with new searchParams).
    rerender()

    // The hook MUST re-seed archetype to 'B' after the soft nav.
    await waitFor(() => {
      expect(result.current.archetype).toBe('B')
    })
  })

  it('Test 21 — soft-nav-arrived param is not stripped by the URL-sync effect (G5)', async () => {
    // Start with no archetype — simulates the user is on /explore before clicking.
    setSearchParams({ tab: 'watches' })
    mockSearchWatchesAction.mockResolvedValue({ success: true, data: [] })

    const { rerender } = renderHook(() => useSearchState())

    // Advance timers so initial URL-sync fires with stale state (no archetype).
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    mockReplace.mockClear()

    // Simulate soft nav: App Router pushes /search?tab=watches&archetype=B —
    // a new searchParams object with archetype=B now returned by useSearchParams.
    act(() => {
      setSearchParams({ archetype: 'B', tab: 'watches' })
    })
    rerender()

    // Advance timers so any URL-sync effects fire.
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled()
    })

    // Every router.replace call after the soft nav MUST contain archetype=B —
    // the URL-sync effect must not strip the freshly-arrived param by writing
    // stale in-memory state (which didn't have archetype) back to the URL.
    const calls = mockReplace.mock.calls
    const strippedCall = calls.find((c) => !String(c[0]).includes('archetype=B'))
    expect(strippedCall).toBeUndefined()
  })

  it('Test 22 (46-05 regression): landing on /search?q=omega does NOT loop router.replace forever', async () => {
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })
    mockSearchWatchesAction.mockResolvedValue({ success: true, data: [] })
    mockSearchCollectionsAction.mockResolvedValue({ success: true, data: [] })

    // Real App Router behaviour: a router.replace(url) swaps useSearchParams()
    // for a NEW object identity carrying url's params. A plain vi.fn() never
    // does this — which is exactly why the original infinite loop slipped past
    // the suite. Wiring the feedback here reproduces production.
    mockReplace.mockImplementation((url: string) => {
      const qs = String(url).split('?')[1] ?? ''
      const next: Record<string, string> = {}
      new URLSearchParams(qs).forEach((v, k) => {
        next[k] = v
      })
      setSearchParams(next)
    })

    // Land on /search?q=omega — q seeds from the URL on mount.
    setSearchParams({ q: 'omega' })

    const { rerender } = renderHook(() => useSearchState())
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    // Drive App-Router-style re-renders: every router.replace above swapped in a
    // fresh searchParams identity, so the component re-renders. The URL-sync
    // effect must converge — it must NOT emit a fresh replace on every render
    // just because searchParams got a new object reference.
    for (let i = 0; i < 8; i++) {
      rerender()
      await act(async () => {
        vi.advanceTimersByTime(50)
      })
    }

    // With the idempotence guard the URL is already correct on arrival, so the
    // effect is a pure no-op. Without it, every render emitted another replace.
    expect(mockReplace.mock.calls.length).toBeLessThanOrEqual(1)
  })

  it('Test 19 — per-section paint independence (RESEARCH path A win): people paints before watches resolves', async () => {
    let watchesResolver: ((v: { success: true; data: [] }) => void) | undefined
    mockSearchPeopleAction.mockResolvedValue({
      success: true,
      data: [
        {
          userId: 'p1',
          username: 'p1',
          displayName: null,
          avatarUrl: null,
          bio: null,
          bioSnippet: null,
          overlap: 0.5,
          sharedCount: 0,
          sharedWatches: [],
          isFollowing: false,
        },
      ],
    })
    mockSearchWatchesAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          watchesResolver = resolve as never
        }),
    )
    mockSearchCollectionsAction.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useSearchState())

    act(() => result.current.setQ('rolex'))
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    await waitFor(() => {
      expect(result.current.peopleResults.length).toBe(1)
      expect(result.current.peopleIsLoading).toBe(false)
    })

    // Watches sub-effect is still in flight — its loading flag MUST still be true.
    expect(result.current.watchesIsLoading).toBe(true)

    // Cleanup: resolve watches so the test doesn't leak a pending promise.
    act(() => {
      watchesResolver?.({ success: true, data: [] as never })
    })
  })
})
