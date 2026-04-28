import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// next/link stub — render as plain <a>
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

// next/image stub — preserve src/alt
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
    width,
    height,
  }: {
    src: string
    alt: string
    className?: string
    width?: number
    height?: number
  }) => (
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
    />
  ),
}))

// Stub FollowButton — PeopleSearchRow renders one inline; same pattern as PeopleSearchRow.test.tsx.
vi.mock('@/components/profile/FollowButton', () => ({
  FollowButton: ({
    targetDisplayName,
  }: {
    targetDisplayName: string
  }) => <button data-testid="follow-button">{`Follow ${targetDisplayName}`}</button>,
}))

import type {
  SearchProfileResult,
  SearchCatalogWatchResult,
  SearchCollectionResult,
} from '@/lib/searchTypes'
import { AllTabResults } from '@/components/search/AllTabResults'

const baseProps = {
  q: 'rolex',
  viewerId: 'v1',
  peopleResults: [] as SearchProfileResult[],
  watchesResults: [] as SearchCatalogWatchResult[],
  collectionsResults: [] as SearchCollectionResult[],
  peopleIsLoading: false,
  watchesIsLoading: false,
  collectionsIsLoading: false,
  setTab: vi.fn(),
}

const mkPerson = (i: number): SearchProfileResult => ({
  userId: `p${i}`,
  username: `p${i}`,
  displayName: `P${i}`,
  avatarUrl: null,
  bio: null,
  bioSnippet: null,
  overlap: 0.5,
  sharedCount: 0,
  sharedWatches: [],
  isFollowing: false,
})

const mkWatch = (i: number): SearchCatalogWatchResult => ({
  catalogId: `c${i}`,
  brand: 'B',
  model: `M${i}`,
  reference: null,
  imageUrl: null,
  ownersCount: 1,
  wishlistCount: 0,
  viewerState: null,
})

const mkCollection = (i: number): SearchCollectionResult => ({
  userId: `cu${i}`,
  username: `cu${i}`,
  displayName: null,
  avatarUrl: null,
  matchCount: 1,
  tasteOverlap: 0.5,
  matchedWatches: [
    { watchId: `w${i}`, brand: 'O', model: 'S', imageUrl: null, matchPath: 'name' },
  ],
  matchedTags: [],
})

describe('AllTabResults (SRCH-13, D-13, D-14, I-2 defensive cap)', () => {
  it('Test 1 — renders sections in D-13 order: People → Watches → Collections', () => {
    const { container } = render(
      <AllTabResults
        {...baseProps}
        peopleResults={[mkPerson(0)]}
        watchesResults={[mkWatch(0)]}
        collectionsResults={[mkCollection(0)]}
      />,
    )
    const headings = Array.from(container.querySelectorAll('h2')).map(
      (h) => h.textContent ?? '',
    )
    const peopleIdx = headings.findIndex((t) => /people/i.test(t))
    const watchesIdx = headings.findIndex((t) => /watches/i.test(t))
    const collectionsIdx = headings.findIndex((t) => /collections/i.test(t))
    expect(peopleIdx).toBeGreaterThanOrEqual(0)
    expect(watchesIdx).toBeGreaterThan(peopleIdx)
    expect(collectionsIdx).toBeGreaterThan(watchesIdx)
  })

  it('Test 2 — per-section skeleton paints independently (D-15)', () => {
    const { container } = render(
      <AllTabResults
        {...baseProps}
        peopleIsLoading={true}
        watchesIsLoading={false}
        collectionsIsLoading={false}
      />,
    )
    // Watches skeleton testid should NOT be present (its section is not loading)
    expect(container.querySelector('[data-testid="watch-search-skeleton"]')).toBeNull()
    // Collections skeleton testid should NOT be present
    expect(
      container.querySelector('[data-testid="collection-search-skeleton"]'),
    ).toBeNull()
    // People skeleton SHOULD be present (uses SearchResultsSkeleton with data-testid="search-skeleton")
    expect(container.querySelector('[data-testid="search-skeleton"]')).not.toBeNull()
  })

  it('Test 3 — See-all renders only when section.length === 5 (cap)', () => {
    const five = Array.from({ length: 5 }, (_, i) => mkPerson(i))
    const four = Array.from({ length: 4 }, (_, i) => mkPerson(i))

    const { rerender, container } = render(
      <AllTabResults {...baseProps} peopleResults={five} />,
    )
    expect(container.textContent).toMatch(/See all/)

    rerender(<AllTabResults {...baseProps} peopleResults={four} />)
    const seeAllAfter = Array.from(container.querySelectorAll('button')).filter(
      (b) => /see all/i.test(b.textContent ?? ''),
    )
    // Only 4 people results + 0 watches + 0 collections — no See-all anywhere
    expect(seeAllAfter.length).toBe(0)
  })

  it('Test 4 — See-all click calls setTab, never router.push (D-14)', () => {
    const setTab = vi.fn()
    const five = Array.from({ length: 5 }, (_, i) => mkPerson(i))
    render(
      <AllTabResults {...baseProps} peopleResults={five} setTab={setTab} />,
    )
    const btn = screen.getByText(/see all/i)
    fireEvent.click(btn)
    expect(setTab).toHaveBeenCalledWith('people')
  })

  it('Test 5 — empty section renders "No matches" inline; section header still shows', () => {
    const { container } = render(<AllTabResults {...baseProps} />)
    const headings = Array.from(container.querySelectorAll('h2')).map(
      (h) => h.textContent ?? '',
    )
    expect(headings.some((t) => /people/i.test(t))).toBe(true)
    expect(headings.some((t) => /watches/i.test(t))).toBe(true)
    expect(headings.some((t) => /collections/i.test(t))).toBe(true)
    // Each empty section renders 'No matches' — should appear at least 3 times
    const noMatchEls = container.querySelectorAll('p')
    const noMatchCount = Array.from(noMatchEls).filter((p) =>
      /no matches/i.test(p.textContent ?? ''),
    ).length
    expect(noMatchCount).toBeGreaterThanOrEqual(3)
  })

  it('Test 6 — I-2 BLOCKER: defensive cap renders ≤5 rows even when caller passes 20', () => {
    const twenty = Array.from({ length: 20 }, (_, i) => mkPerson(i))
    const twentyW = Array.from({ length: 20 }, (_, i) => mkWatch(i))
    const twentyC = Array.from({ length: 20 }, (_, i) => mkCollection(i))
    const { container } = render(
      <AllTabResults
        {...baseProps}
        peopleResults={twenty}
        watchesResults={twentyW}
        collectionsResults={twentyC}
      />,
    )

    // Heuristic: count rendered PeopleSearchRow children by counting unique
    // "P{i}" name labels present in <p> elements (the primary label).
    const allParagraphs = Array.from(container.querySelectorAll('p'))
    const peopleNamesUnique = allParagraphs
      .map((p) => p.textContent ?? '')
      .filter((t) => /^P\d+$/.test(t.trim()))
    expect(peopleNamesUnique.length).toBeLessThanOrEqual(5)

    // Watch rows: WatchSearchRow renders 2 anchors per row (absolute-inset Link
    // + Evaluate Link) both pointing at /evaluate?catalogId=. Cap → ≤10.
    const watchesLinks = container.querySelectorAll('a[href^="/evaluate?catalogId="]')
    expect(watchesLinks.length).toBeLessThanOrEqual(10)

    // Collection rows render an anchor to /u/{username}/collection.
    // People rows ALSO render /u/{username}/collection. With 5 each capped,
    // we should see at most 10 such anchors total.
    const allUserCollectionLinks = container.querySelectorAll(
      'a[href^="/u/"][href$="/collection"]',
    )
    expect(allUserCollectionLinks.length).toBeLessThanOrEqual(10)
  })

  it('Test 7 — I-2 BLOCKER: See-all condition uses sliced length, not raw payload (over-cap still triggers See-all)', () => {
    const twenty = Array.from({ length: 20 }, (_, i) => mkPerson(i))
    const setTab = vi.fn()
    render(
      <AllTabResults {...baseProps} peopleResults={twenty} setTab={setTab} />,
    )
    // Even though caller passed 20, internal slice produces 5 → See-all SHOULD render
    expect(screen.getByText(/See all/i)).toBeInTheDocument()
  })
})
