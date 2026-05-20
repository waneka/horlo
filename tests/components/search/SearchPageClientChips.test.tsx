import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Phase 48 Plan 03 Task 2 — SearchPageClient removable chip migration tests (BUG-02)
//
// Asserts that both the zero-results branch AND the results branch render
// removable facet chips via <Chip variant="removable">, not inline buttons
// with text-accent-foreground class strings.
//
// Phase 49.1 Plan 04 (D-SCOPE-01d): archetype/genre chips removed from this
// surface. Tests 1 (zero-results archetype), 4 (zero-results genre),
// 5 (results archetype), 8 (results genre) deleted in lockstep with the
// chip-block removal in SearchPageClient.tsx. Surviving tests (2, 3, 6, 7)
// cover the brand/era removable chips that remain.
//
// Tests:
//   2. Zero-results branch: brand chip renders as <Chip variant="removable">
//   3. Zero-results branch: era chip renders as <Chip variant="removable">
//   6. Results branch: brand chip renders as <Chip variant="removable">
//   7. Results branch: era chip renders as <Chip variant="removable">
// ---------------------------------------------------------------------------

// Mock Chip to expose the variant prop for assertions
vi.mock('@/components/ui/chip', () => ({
  Chip: ({
    variant,
    onClick,
    children,
    removeLabel,
  }: {
    variant?: string
    onClick?: () => void
    children: React.ReactNode
    removeLabel?: string
  }) => (
    <button
      data-testid="chip"
      data-variant={variant}
      data-remove-label={removeLabel}
      onClick={onClick}
    >
      {children}
    </button>
  ),
}))

// Mock all dependencies so we can exercise the WatchesPanel branches
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
  movement: string | null
  setMovement: (next: string | null) => void
  size: string | null
  setSize: (next: string | null) => void
  styleArr: string[]
  setStyleArr: (next: string[]) => void
  brand: string | null
  setBrand: (next: string | null) => void
  era: string | null
  setEra: (next: string | null) => void
  genre: string | null
  setGenre: (next: string | null) => void
  archetype: string | null
  setArchetype: (next: string | null) => void
} = {
  q: '',
  setQ: vi.fn(),
  debouncedQ: '',
  tab: 'watches',
  setTab: vi.fn(),
  peopleResults: [],
  watchesResults: [],
  collectionsResults: [],
  peopleIsLoading: false,
  watchesIsLoading: false,
  collectionsIsLoading: false,
  peopleHasError: false,
  watchesHasError: false,
  collectionsHasError: false,
  movement: null,
  setMovement: vi.fn(),
  size: null,
  setSize: vi.fn(),
  styleArr: [],
  setStyleArr: vi.fn(),
  brand: null,
  setBrand: vi.fn(),
  era: null,
  setEra: vi.fn(),
  genre: null,
  setGenre: vi.fn(),
  archetype: null,
  setArchetype: vi.fn(),
}

vi.mock('@/components/search/useSearchState', () => ({
  useSearchState: () => mockSearchState,
}))

vi.mock('@/components/search/FilterDrawer', () => ({
  FilterDrawer: () => null,
}))

vi.mock('@/components/search/WatchSearchRowsAccordion', () => ({
  WatchSearchRowsAccordion: () => <div data-testid="accordion" />,
}))

vi.mock('@/components/search/SearchResultsSkeleton', () => ({
  SearchResultsSkeleton: () => <div />,
}))
vi.mock('@/components/search/WatchSearchResultsSkeleton', () => ({
  WatchSearchResultsSkeleton: () => <div />,
}))
vi.mock('@/components/search/CollectionSearchResultsSkeleton', () => ({
  CollectionSearchResultsSkeleton: () => <div />,
}))
vi.mock('@/components/search/AllTabResults', () => ({
  AllTabResults: () => <div />,
}))
vi.mock('@/components/search/PeopleSearchRow', () => ({
  PeopleSearchRow: () => <div />,
}))
vi.mock('@/components/search/CollectionSearchRow', () => ({
  CollectionSearchRow: () => <div />,
}))
vi.mock('@/lib/archetype-config', () => ({
  ARCHETYPE_CONFIG: {
    dive: { displayName: 'Dive Watches', description: 'Water-resistant tools' },
    dress: { displayName: 'Dress Watches', description: 'Elegant and thin' },
  },
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

const { SearchPageClient } = await import('@/components/search/SearchPageClient')

function renderWatchesWithFacets(facets: { archetype?: string; brand?: string; era?: string; genre?: string }, results: unknown[] = []) {
  mockSearchState.tab = 'watches'
  mockSearchState.debouncedQ = ''
  mockSearchState.q = ''
  mockSearchState.watchesResults = results
  mockSearchState.archetype = facets.archetype ?? null
  mockSearchState.brand = facets.brand ?? null
  mockSearchState.era = facets.era ?? null
  mockSearchState.genre = facets.genre ?? null
  // Ensure activeCount > 0 so filter button shows correct count
  return render(
    <SearchPageClient viewerId="v1" collectionRevision={0} viewerUsername={null} styleVocab={[]} brandVocab={[{ slug: 'rolex', name: 'Rolex' }]}>
      {null}
    </SearchPageClient>
  )
}

describe('SearchPageClient removable chips — zero-results branch (Plan 48-03 Task 2 BUG-02)', () => {
  beforeEach(() => {
    mockSearchState.watchesResults = []
    mockSearchState.archetype = null
    mockSearchState.brand = null
    mockSearchState.era = null
    mockSearchState.genre = null
  })

  // Test 1 (zero-results archetype) deleted — Phase 49.1 Plan 04 D-SCOPE-01d.

  it('Test 2: zero-results brand chip renders as <Chip variant="removable">', () => {
    renderWatchesWithFacets({ brand: 'rolex' }, [])
    const chips = screen.getAllByTestId('chip')
    const brandChip = chips.find((c) => c.textContent?.includes('Rolex'))
    expect(brandChip).toBeDefined()
    expect(brandChip).toHaveAttribute('data-variant', 'removable')
  })

  it('Test 3: zero-results era chip renders as <Chip variant="removable">', () => {
    renderWatchesWithFacets({ era: 'modern' }, [])
    const chips = screen.getAllByTestId('chip')
    const eraChip = chips.find((c) => c.textContent?.includes('Modern'))
    expect(eraChip).toBeDefined()
    expect(eraChip).toHaveAttribute('data-variant', 'removable')
  })

  // Test 4 (zero-results genre) deleted — Phase 49.1 Plan 04 D-SCOPE-01d.
})

describe('SearchPageClient removable chips — results branch (Plan 48-03 Task 2 BUG-02)', () => {
  const mockResult = {
    catalogId: 'c1',
    brand: 'Rolex',
    model: 'Submariner',
    reference: null,
    imageUrl: null,
    ownersCount: 1,
    wishlistCount: 0,
    viewerState: null,
  }

  beforeEach(() => {
    mockSearchState.archetype = null
    mockSearchState.brand = null
    mockSearchState.era = null
    mockSearchState.genre = null
  })

  // Test 5 (results-branch archetype) deleted — Phase 49.1 Plan 04 D-SCOPE-01d.

  it('Test 6: results-branch brand chip renders as <Chip variant="removable">', () => {
    renderWatchesWithFacets({ brand: 'rolex' }, [mockResult])
    const chips = screen.getAllByTestId('chip')
    const brandChip = chips.find((c) => c.textContent?.includes('Rolex'))
    expect(brandChip).toBeDefined()
    expect(brandChip).toHaveAttribute('data-variant', 'removable')
  })

  it('Test 7: results-branch era chip renders as <Chip variant="removable">', () => {
    renderWatchesWithFacets({ era: 'modern' }, [mockResult])
    const chips = screen.getAllByTestId('chip')
    const eraChip = chips.find((c) => c.textContent?.includes('Modern'))
    expect(eraChip).toBeDefined()
    expect(eraChip).toHaveAttribute('data-variant', 'removable')
  })

  // Test 8 (results-branch genre) deleted — Phase 49.1 Plan 04 D-SCOPE-01d.
})
