import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Phase 19 Plan 06 — page integration tests for the rewritten SearchPageClient.
//
// 6 tests covering: Watches/Collections tabs render real result rows (no
// ComingSoonCard remains), All-tab fan-out preserves D-13 section order,
// See-all setTab wiring (D-14), Showing top 20 footer (D-04), and per-tab
// Input placeholder swaps (UI-SPEC lines 220-221).
// ---------------------------------------------------------------------------

const mockSetTab = vi.fn()
const mockSearchState: {
  q: string
  setQ: (next: string) => void
  debouncedQ: string
  tab: 'all' | 'people' | 'watches' | 'collections'
  setTab: (next: 'all' | 'people' | 'watches' | 'collections') => void
  peopleResults: unknown[]
  watchesResults: unknown[]
  collectionsResults: unknown[]
  peopleIsLoading: boolean
  watchesIsLoading: boolean
  collectionsIsLoading: boolean
  peopleHasError: boolean
  watchesHasError: boolean
  collectionsHasError: boolean
} = {
  q: 'rolex',
  setQ: vi.fn(),
  debouncedQ: 'rolex',
  tab: 'all',
  setTab: mockSetTab,
  peopleResults: [],
  watchesResults: [],
  collectionsResults: [],
  peopleIsLoading: false,
  watchesIsLoading: false,
  collectionsIsLoading: false,
  peopleHasError: false,
  watchesHasError: false,
  collectionsHasError: false,
}

vi.mock('@/components/search/useSearchState', () => ({
  useSearchState: () => mockSearchState,
}))

// next/link stub
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    'aria-label': ariaLabel,
  }: {
    href: string
    children: React.ReactNode
    className?: string
    'aria-label'?: string
  }) => (
    <a href={href} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}))

// next/image stub
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
  }: {
    src: string
    alt: string
    className?: string
  }) => <img src={src} alt={alt} className={className} />,
}))

// FollowButton stub — PeopleSearchRow renders one inline; we don't exercise Phase 9 here.
vi.mock('@/components/profile/FollowButton', () => ({
  FollowButton: ({
    targetDisplayName,
  }: {
    targetDisplayName: string
  }) => <button data-testid="follow-button">{`Follow ${targetDisplayName}`}</button>,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

import { SearchPageClient } from '@/components/search/SearchPageClient'

function resetMockState() {
  mockSetTab.mockReset()
  mockSearchState.q = 'rolex'
  mockSearchState.debouncedQ = 'rolex'
  mockSearchState.tab = 'all'
  mockSearchState.peopleResults = []
  mockSearchState.watchesResults = []
  mockSearchState.collectionsResults = []
  mockSearchState.peopleIsLoading = false
  mockSearchState.watchesIsLoading = false
  mockSearchState.collectionsIsLoading = false
  mockSearchState.peopleHasError = false
  mockSearchState.watchesHasError = false
  mockSearchState.collectionsHasError = false
}

describe('SearchPageClient (Plan 06: SRCH-13, D-04, D-14)', () => {
  beforeEach(() => {
    resetMockState()
  })

  it('Test 1 — Watches tab renders WatchSearchRow, no ComingSoonCard', () => {
    mockSearchState.tab = 'watches'
    mockSearchState.watchesResults = [
      {
        catalogId: 'c1',
        brand: 'Rolex',
        model: 'Sub',
        reference: null,
        imageUrl: null,
        ownersCount: 1,
        wishlistCount: 0,
        viewerState: null,
      },
    ]
    render(<SearchPageClient viewerId="v1" collectionRevision={0}>{null}</SearchPageClient>)
    expect(screen.getByText(/Sub/)).toBeInTheDocument()
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
    // No coming-soon test ids
    expect(screen.queryByTestId('coming-soon-card-compact')).not.toBeInTheDocument()
    expect(screen.queryByTestId('coming-soon-card-full')).not.toBeInTheDocument()
  })

  it('Test 2 — Collections tab renders CollectionSearchRow', () => {
    mockSearchState.tab = 'collections'
    mockSearchState.collectionsResults = [
      {
        userId: 'u1',
        username: 'tyler',
        displayName: 'Tyler',
        avatarUrl: null,
        matchCount: 1,
        tasteOverlap: 0.5,
        matchedWatches: [
          {
            watchId: 'w1',
            brand: 'Omega',
            model: 'Speedmaster',
            imageUrl: null,
            matchPath: 'name',
          },
        ],
        matchedTags: [],
      },
    ]
    render(<SearchPageClient viewerId="v1" collectionRevision={0}>{null}</SearchPageClient>)
    expect(screen.getByText(/Tyler/)).toBeInTheDocument()
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
  })

  it('Test 3 — All tab renders 3 sections in D-13 order People → Watches → Collections', () => {
    mockSearchState.tab = 'all'
    mockSearchState.peopleResults = [
      {
        userId: 'p1',
        username: 'p1',
        displayName: 'P1',
        avatarUrl: null,
        bio: null,
        bioSnippet: null,
        overlap: 0.5,
        sharedCount: 0,
        sharedWatches: [],
        isFollowing: false,
      },
    ]
    mockSearchState.watchesResults = [
      {
        catalogId: 'c1',
        brand: 'Rolex',
        model: 'Sub',
        reference: null,
        imageUrl: null,
        ownersCount: 1,
        wishlistCount: 0,
        viewerState: null,
      },
    ]
    mockSearchState.collectionsResults = [
      {
        userId: 'u1',
        username: 'tyler',
        displayName: 'Tyler',
        avatarUrl: null,
        matchCount: 1,
        tasteOverlap: 0.5,
        matchedWatches: [
          {
            watchId: 'w1',
            brand: 'O',
            model: 'S',
            imageUrl: null,
            matchPath: 'name',
          },
        ],
        matchedTags: [],
      },
    ]
    const { container } = render(
      <SearchPageClient viewerId="v1" collectionRevision={0}>{null}</SearchPageClient>,
    )
    const headings = Array.from(container.querySelectorAll('h2'))
    const labels = headings.map((h) => h.textContent ?? '')
    const peopleIdx = labels.findIndex((l) => /people/i.test(l))
    const watchesIdx = labels.findIndex((l) => /watches/i.test(l))
    const collectionsIdx = labels.findIndex((l) => /collections/i.test(l))
    expect(peopleIdx).toBeGreaterThanOrEqual(0)
    expect(watchesIdx).toBeGreaterThan(peopleIdx)
    expect(collectionsIdx).toBeGreaterThan(watchesIdx)
  })

  it('Test 4 — See-all on All tab calls setTab to switch tabs (D-14)', () => {
    mockSearchState.tab = 'all'
    mockSearchState.watchesResults = Array.from({ length: 5 }, (_, i) => ({
      catalogId: `c${i}`,
      brand: 'B',
      model: `M${i}`,
      reference: null,
      imageUrl: null,
      ownersCount: 1,
      wishlistCount: 0,
      viewerState: null,
    }))
    render(<SearchPageClient viewerId="v1" collectionRevision={0}>{null}</SearchPageClient>)
    const seeAllButtons = screen.getAllByText(/see all/i)
    expect(seeAllButtons.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(seeAllButtons[0])
    expect(mockSetTab).toHaveBeenCalled()
  })

  it('Test 5 — Showing top 20 footer appears when watchesResults.length === 20 (D-04)', () => {
    mockSearchState.tab = 'watches'
    mockSearchState.watchesResults = Array.from({ length: 20 }, (_, i) => ({
      catalogId: `c${i}`,
      brand: 'B',
      model: `M${i}`,
      reference: null,
      imageUrl: null,
      ownersCount: 1,
      wishlistCount: 0,
      viewerState: null,
    }))
    render(<SearchPageClient viewerId="v1" collectionRevision={0}>{null}</SearchPageClient>)
    expect(screen.getByText(/Showing top 20/i)).toBeInTheDocument()
  })

  it('Test 6 — per-tab Input placeholder swaps based on active tab (UI-SPEC lines 220-221)', () => {
    mockSearchState.tab = 'watches'
    const { rerender } = render(
      <SearchPageClient viewerId="v1" collectionRevision={0}>{null}</SearchPageClient>,
    )
    expect(screen.getByPlaceholderText(/search watches/i)).toBeInTheDocument()

    mockSearchState.tab = 'collections'
    rerender(<SearchPageClient viewerId="v1" collectionRevision={0}>{null}</SearchPageClient>)
    expect(screen.getByPlaceholderText(/search collections/i)).toBeInTheDocument()

    mockSearchState.tab = 'all'
    rerender(<SearchPageClient viewerId="v1" collectionRevision={0}>{null}</SearchPageClient>)
    expect(screen.getByPlaceholderText(/search everything/i)).toBeInTheDocument()

    mockSearchState.tab = 'people'
    rerender(<SearchPageClient viewerId="v1" collectionRevision={0}>{null}</SearchPageClient>)
    expect(screen.getByPlaceholderText(/search collectors/i)).toBeInTheDocument()
  })
})
