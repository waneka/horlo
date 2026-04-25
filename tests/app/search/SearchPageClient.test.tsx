import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Wave 0 RED — SearchPageClient contract per CONTEXT.md D-02 / D-05 / D-06 /
// D-07 / D-08 / D-09 / D-10 / D-11 / D-12 / D-29.
//
// 13 tests covering: 4-tab structure, tab gate (Watches/Collections),
// pre-query suggested-collectors children, no-results state, loading
// skeleton, All-tab vs People-tab compact-coming-soon footer differential,
// and D-02 page-level autoFocus on the searchbox.
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

// Target import — RED until Plan 05 creates it.
import { SearchPageClient } from '@/components/search/SearchPageClient'

const SuggestedChildren = () => (
  <div data-testid="suggested-children">SUGGESTED</div>
)

describe('SearchPageClient (D-02 / D-05..D-12 / D-29)', () => {
  beforeEach(() => {
    mockReplace.mockClear()
    mockSearchPeopleAction.mockReset()
    mockSearchParams.get.mockReset()
    mockSearchParams.get.mockReturnValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('Test 1 (SRCH-01): renders 4 tabs labeled All / Watches / People / Collections', () => {
    render(
      <SearchPageClient viewerId="me">
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
      <SearchPageClient viewerId="me">
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
      <SearchPageClient viewerId="me">
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

  it('Test 4 (SRCH-02): clicking Watches does NOT call searchPeopleAction; renders coming-soon copy', async () => {
    const user = userEvent.setup()
    render(
      <SearchPageClient viewerId="me">
        <SuggestedChildren />
      </SearchPageClient>,
    )
    await user.click(screen.getByRole('tab', { name: 'Watches' }))
    expect(mockSearchPeopleAction).not.toHaveBeenCalled()
    // Coming-soon copy should mention "coming" / "soon" — assert via case-insensitive regex
    expect(screen.getByText(/coming/i)).toBeInTheDocument()
  })

  it('Test 5 (SRCH-02): clicking Collections does NOT call searchPeopleAction; renders coming-soon copy', async () => {
    const user = userEvent.setup()
    render(
      <SearchPageClient viewerId="me">
        <SuggestedChildren />
      </SearchPageClient>,
    )
    await user.click(screen.getByRole('tab', { name: 'Collections' }))
    expect(mockSearchPeopleAction).not.toHaveBeenCalled()
    expect(screen.getByText(/coming/i)).toBeInTheDocument()
  })

  it('Test 6 (SRCH-07 / D-11): pre-query (no ?q=) on All renders suggested-children + "Collectors you might like"', () => {
    render(
      <SearchPageClient viewerId="me">
        <SuggestedChildren />
      </SearchPageClient>,
    )
    expect(screen.getByTestId('suggested-children')).toBeInTheDocument()
    expect(screen.getByText('Collectors you might like')).toBeInTheDocument()
  })

  it('Test 7 (SRCH-07): pre-query state — searchPeopleAction is NOT called (q.length < 2 short-circuit)', async () => {
    render(
      <SearchPageClient viewerId="me">
        <SuggestedChildren />
      </SearchPageClient>,
    )
    // Wait a tick to let mounting effects flush
    await new Promise((r) => setTimeout(r, 50))
    expect(mockSearchPeopleAction).not.toHaveBeenCalled()
  })

  it('Test 8 (SRCH-06 / D-10): q="zzzznotfound" + 0 results → "No collectors match \\"zzzznotfound\\"" + suggested-children below', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })
    mockSearchParams.get.mockImplementation((k: string) =>
      k === 'q' ? 'zzzznotfound' : null,
    )

    render(
      <SearchPageClient viewerId="me">
        <SuggestedChildren />
      </SearchPageClient>,
    )

    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    // The hook must have fired the search and resolved with [] before assertions.
    // Use real timers + waitFor with a generous timeout.
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

  it('Test 9 (SRCH-06 / D-10): no-results sub-header renders "Try someone you\'d like to follow"', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })
    mockSearchParams.get.mockImplementation((k: string) =>
      k === 'q' ? 'zzzznotfound' : null,
    )

    render(
      <SearchPageClient viewerId="me">
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
      <SearchPageClient viewerId="me">
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

  it('Test 11 (D-06): All tab renders 2 compact coming-soon footer cards', () => {
    render(
      <SearchPageClient viewerId="me">
        <SuggestedChildren />
      </SearchPageClient>,
    )
    expect(
      screen.getAllByTestId('coming-soon-card-compact'),
    ).toHaveLength(2)
  })

  it('Test 12 (D-07): People tab renders 0 compact coming-soon footer cards', async () => {
    const user = userEvent.setup()
    render(
      <SearchPageClient viewerId="me">
        <SuggestedChildren />
      </SearchPageClient>,
    )
    await user.click(screen.getByRole('tab', { name: 'People' }))
    expect(screen.queryAllByTestId('coming-soon-card-compact')).toHaveLength(0)
  })

  it('Test 13 (D-02 autofocus): page-level <input role="searchbox"> is the active element on mount with ?q=foo', async () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === 'q' ? 'foo' : null,
    )
    mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })

    render(
      <SearchPageClient viewerId="me">
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
