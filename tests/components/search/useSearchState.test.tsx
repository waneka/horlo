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
const mockSearchParams = { get: vi.fn().mockReturnValue(null) }

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}))

const mockSearchPeopleAction = vi.fn()
vi.mock('@/app/actions/search', () => ({
  searchPeopleAction: (...args: unknown[]) => mockSearchPeopleAction(...args),
}))

// Import AFTER mocks. Target file does not exist until Plan 03 — RED state.
import { useSearchState } from '@/components/search/useSearchState'

describe('useSearchState (D-03 / D-04 / D-12 / D-20 / D-28)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    mockReplace.mockClear()
    mockSearchPeopleAction.mockReset()
    mockSearchParams.get.mockReset()
    mockSearchParams.get.mockReturnValue(null)
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
      expect(result.current.results.length).toBeGreaterThan(0)
      // Only the second (non-stale) fetch result lands
      expect(result.current.results[0].userId).toBe('u-bob')
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
    mockSearchParams.get.mockImplementation((k: string) =>
      k === 'q' ? 'foo' : null,
    )
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
})
