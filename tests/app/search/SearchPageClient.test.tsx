import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Phase 16 carry-forward suite, updated for Phase 19 Plan 06.
//
// Plan 06 removed <ComingSoonCard> from Watches/Collections/All tabs and
// replaced them with real result blocks fed by per-tab DAL slices. The
// Phase 16 SRCH-02 tab-gate behavior (no fetch on Watches/Collections) is
// also retired — all 3 sub-effects fire on All + their own tab. The
// affected tests (4, 5, 8, 9, 11) were rewritten to assert Plan 06's
// contract; the rest of the Phase 16 D-02..D-12/D-29 contract carries
// forward unchanged (4-tab structure, default tab, URL sync, pre-query
// suggested children, autofocus, loading skeleton).
// ---------------------------------------------------------------------------

const mockReplace = vi.fn()
const mockSearchParams = { get: vi.fn().mockReturnValue(null) }

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
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

// Target import — RED until Plan 05 creates it.
import { SearchPageClient } from '@/components/search/SearchPageClient'

const SuggestedChildren = () => (
  <div data-testid="suggested-children">SUGGESTED</div>
)

describe('SearchPageClient (D-02 / D-05..D-12 / D-29)', () => {
  beforeEach(() => {
    mockReplace.mockClear()
    mockSearchPeopleAction.mockReset()
    mockSearchWatchesAction.mockReset()
    mockSearchCollectionsAction.mockReset()
    // Default no-op resolutions so All-tab fan-out doesn't blow up.
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })
    mockSearchWatchesAction.mockResolvedValue({ success: true, data: [] })
    mockSearchCollectionsAction.mockResolvedValue({ success: true, data: [] })
    mockSearchParams.get.mockReset()
    mockSearchParams.get.mockReturnValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('Test 1 (SRCH-01): renders 4 tabs labeled All / Watches / People / Collections', () => {
    render(
      <SearchPageClient viewerId="me" collectionRevision={0} viewerUsername={null}>
        <SuggestedChildren />
      </SearchPageClient>,
    )
    expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Watches' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'People' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Collections' })).toBeInTheDocument()
  })

  it('Test 2 (SRCH-01 / D-05): default mounted tab is "All" when no ?tab= in URL', () => {
    render(
      <SearchPageClient viewerId="me" collectionRevision={0} viewerUsername={null}>
        <SuggestedChildren />
      </SearchPageClient>,
    )
    const allTab = screen.getByRole('tab', { name: 'All' })
    expect(allTab.getAttribute('data-state') ?? allTab.getAttribute('aria-selected')).toMatch(
      /active|true/i,
    )
  })

  it('Test 3 (D-12 / SRCH-01): clicking People → URL ?tab=people; clicking All → ?tab= REMOVED', async () => {
    const user = userEvent.setup()
    render(
      <SearchPageClient viewerId="me" collectionRevision={0} viewerUsername={null}>
        <SuggestedChildren />
      </SearchPageClient>,
    )

    await user.click(screen.getByRole('tab', { name: 'People' }))
    await waitFor(() => {
      const replaced = mockReplace.mock.calls.map((c) => String(c[0]))
      expect(replaced.some((u) => u.includes('tab=people'))).toBe(true)
    })

    mockReplace.mockClear()

    await user.click(screen.getByRole('tab', { name: 'All' }))
    await waitFor(() => {
      const replaced = mockReplace.mock.calls.map((c) => String(c[0]))
      // No call should write tab=all
      expect(replaced.every((u) => !u.includes('tab=all'))).toBe(true)
    })
  })

  it('Test 4 (Plan 06 — Watches tab pre-query: heading "Watches" + sub-copy; no ComingSoonCard)', async () => {
    const user = userEvent.setup()
    render(
      <SearchPageClient viewerId="me" collectionRevision={0} viewerUsername={null}>
        <SuggestedChildren />
      </SearchPageClient>,
    )
    await user.click(screen.getByRole('tab', { name: 'Watches' }))
    // Plan 06: Watches tab renders pre-query copy from UI-SPEC, not ComingSoonCard
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('coming-soon-card-full')).toHaveLength(0)
    expect(
      screen.getByText(/Search by brand, model, or reference number/i),
    ).toBeInTheDocument()
  })

  it('Test 5 (Plan 06 — Collections tab pre-query: heading + sub-copy; no ComingSoonCard)', async () => {
    const user = userEvent.setup()
    render(
      <SearchPageClient viewerId="me" collectionRevision={0} viewerUsername={null}>
        <SuggestedChildren />
      </SearchPageClient>,
    )
    await user.click(screen.getByRole('tab', { name: 'Collections' }))
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('coming-soon-card-full')).toHaveLength(0)
    expect(
      screen.getByText(
        /Find collectors by the watches they own or their collection style/i,
      ),
    ).toBeInTheDocument()
  })

  it('Test 6 (SRCH-07 / D-11): pre-query (no ?q=) on All renders suggested-children + "Collectors you might like"', () => {
    render(
      <SearchPageClient viewerId="me" collectionRevision={0} viewerUsername={null}>
        <SuggestedChildren />
      </SearchPageClient>,
    )
    expect(screen.getByTestId('suggested-children')).toBeInTheDocument()
    expect(screen.getByText('Collectors you might like')).toBeInTheDocument()
  })

  it('Test 7 (SRCH-07): pre-query state — searchPeopleAction is NOT called (q.length < 2 short-circuit)', async () => {
    render(
      <SearchPageClient viewerId="me" collectionRevision={0} viewerUsername={null}>
        <SuggestedChildren />
      </SearchPageClient>,
    )
    // Wait a tick to let mounting effects flush
    await new Promise((r) => setTimeout(r, 50))
    expect(mockSearchPeopleAction).not.toHaveBeenCalled()
  })

  it('Test 8 (SRCH-06 / D-10 — People tab no-results): q="zzzznotfound" + 0 People results → "No collectors match" + suggested-children below', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })
    // Plan 06: per-tab copy lives on the People panel only. Mount the People
    // tab so the no-results copy renders the People panel branch.
    mockSearchParams.get.mockImplementation((k: string) => {
      if (k === 'q') return 'zzzznotfound'
      if (k === 'tab') return 'people'
      return null
    })

    render(
      <SearchPageClient viewerId="me" collectionRevision={0} viewerUsername={null}>
        <SuggestedChildren />
      </SearchPageClient>,
    )

    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    vi.useRealTimers()
    await waitFor(
      () => {
        expect(
          screen.getByText('No collectors match "zzzznotfound"'),
        ).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
    expect(screen.getByTestId('suggested-children')).toBeInTheDocument()
  })

  it('Test 9 (SRCH-06 / D-10 — People tab no-results): sub-header renders "Try someone you\'d like to follow"', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })
    mockSearchParams.get.mockImplementation((k: string) => {
      if (k === 'q') return 'zzzznotfound'
      if (k === 'tab') return 'people'
      return null
    })

    render(
      <SearchPageClient viewerId="me" collectionRevision={0} viewerUsername={null}>
        <SuggestedChildren />
      </SearchPageClient>,
    )
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    vi.useRealTimers()
    await waitFor(
      () => {
        expect(
          screen.getByText("Try someone you'd like to follow"),
        ).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  })

  it('Test 10 (D-09): while q-fetch is pending, renders SearchResultsSkeleton', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    // Pending fetch — never resolves
    mockSearchPeopleAction.mockImplementation(() => new Promise(() => {}))
    mockSearchParams.get.mockImplementation((k: string) =>
      k === 'q' ? 'pending' : null,
    )

    render(
      <SearchPageClient viewerId="me" collectionRevision={0} viewerUsername={null}>
        <SuggestedChildren />
      </SearchPageClient>,
    )

    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    vi.useRealTimers()
    await waitFor(
      () => {
        const skel = screen.queryByTestId('search-skeleton')
        const pulses = document.querySelectorAll('.animate-pulse')
        expect(Boolean(skel) || pulses.length >= 3).toBe(true)
      },
      { timeout: 2000 },
    )
  })

  it('Test 11 (Plan 06 — All tab renders ZERO ComingSoonCards; replaced by 3-section composer)', () => {
    render(
      <SearchPageClient viewerId="me" collectionRevision={0} viewerUsername={null}>
        <SuggestedChildren />
      </SearchPageClient>,
    )
    // Plan 06: 2 compact ComingSoonCards retired. The All tab now uses the
    // <AllTabResults> composer (People / Watches / Collections sections).
    expect(screen.queryAllByTestId('coming-soon-card-compact')).toHaveLength(0)
    expect(screen.queryAllByTestId('coming-soon-card-full')).toHaveLength(0)
  })

  it('Test 12 (Plan 06 — People tab also has zero ComingSoonCards)', async () => {
    const user = userEvent.setup()
    render(
      <SearchPageClient viewerId="me" collectionRevision={0} viewerUsername={null}>
        <SuggestedChildren />
      </SearchPageClient>,
    )
    await user.click(screen.getByRole('tab', { name: 'People' }))
    expect(screen.queryAllByTestId('coming-soon-card-compact')).toHaveLength(0)
    expect(screen.queryAllByTestId('coming-soon-card-full')).toHaveLength(0)
  })

  it('Test 13 (D-02 autofocus): page-level <input role="searchbox"> is the active element on mount with ?q=foo', async () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === 'q' ? 'foo' : null,
    )
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })

    render(
      <SearchPageClient viewerId="me" collectionRevision={0} viewerUsername={null}>
        <SuggestedChildren />
      </SearchPageClient>,
    )

    await waitFor(
      () => {
        expect(document.activeElement).toBe(screen.getByRole('searchbox'))
      },
      { timeout: 2000 },
    )
  })
})
