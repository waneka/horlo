/**
 * Phase 27 Wave 0 RED — CollectionTabContent grid breakpoint (VIS-07).
 *
 * D-11 changes the populated-state grid wrapper from
 *   `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`
 * to
 *   `grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4`.
 *
 * RED today: the existing class string starts with `grid-cols-1`. Plan 04
 * swaps it. Empty-state grids (separate `sm:grid-cols-2` wrapper at line 89)
 * are unrelated and stay as-is.
 *
 * Mocks every child of CollectionTabContent so the test stays focused on the
 * grid wrapper class string — children render as test-id stubs only.
 *
 * Phase 85 Plan 06 (LIFE-05) extends this file: the "Show previously owned"
 * toggle, the filtered append of `previouslyOwnedWatches`, and the
 * empty-state gate widening to `ownedWatches.length === 0 &&
 * previouslyOwnedWatches.length === 0`. The ProfileWatchCard mock below now
 * also exposes `data-status`/`data-id` so tests can assert render order.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    'aria-label': ariaLabel,
    className,
  }: {
    href: string
    children: React.ReactNode
    'aria-label'?: string
    className?: string
  }) => (
    <a href={href} aria-label={ariaLabel} className={className}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/profile/ProfileWatchCard', () => ({
  ProfileWatchCard: ({ watch }: { watch: { id: string; status: string } }) => (
    <div data-testid="pwc" data-status={watch.status} data-id={watch.id} />
  ),
}))
vi.mock('@/components/profile/AddWatchCard', () => ({
  AddWatchCard: () => <div data-testid="add-card" />,
}))
vi.mock('@/components/profile/FilterChips', () => ({
  FilterChips: () => <div data-testid="filter-chips" />,
}))

import { CollectionTabContent } from '@/components/profile/CollectionTabContent'
import type { Watch } from '@/lib/types'

function buildWatch(
  id: string,
  overrides: Partial<Watch> = {},
): Watch {
  return {
    id,
    brand: 'Brand',
    model: `Model-${id}`,
    status: 'owned',
    movement: 'auto',
    complications: [],
    styleTags: [],
    designTraits: [],
    roleTags: [],
    ...overrides,
  }
}

describe('Phase 27 — CollectionTabContent grid (VIS-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('grid uses grid-cols-2 (mobile 2-column per D-11 / VIS-07)', () => {
    const { container } = render(
      <CollectionTabContent
        watches={[buildWatch('w1'), buildWatch('w2')]}
        wearDates={{}}
        isOwner={true}
        hasUrlExtract={true}
      />,
    )
    // D-11: the populated-state grid wrapper.
    const grid = container.querySelector('.grid.grid-cols-2')
    expect(grid).not.toBeNull()
    // Existing breakpoint classes preserved per D-11.
    expect(grid?.className).toContain('sm:grid-cols-2')
    expect(grid?.className).toContain('lg:grid-cols-4')
  })
})

describe('Phase 85 Plan 06 — "Show previously owned" toggle (LIFE-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function getToggle() {
    return screen.getByRole('button', { name: /Show previously owned/ })
  }

  it('owner, 2 owned + 1 previously_owned: renders 2 pwc stubs; toggle reads "(1)" and is off', () => {
    const owned = [buildWatch('o1'), buildWatch('o2')]
    const disposed = [
      buildWatch('d1', { status: 'previously_owned', brand: 'Omega' }),
    ]
    render(
      <CollectionTabContent
        watches={owned}
        previouslyOwnedWatches={disposed}
        wearDates={{}}
        isOwner={true}
        hasUrlExtract={true}
      />,
    )
    expect(screen.getAllByTestId('pwc')).toHaveLength(2)
    const toggle = screen.getByRole('button', {
      name: /Show previously owned \(1\)/,
    })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicking the toggle reveals previously-owned cards; clicking again hides them', () => {
    const owned = [buildWatch('o1'), buildWatch('o2')]
    const disposed = [buildWatch('d1', { status: 'previously_owned' })]
    render(
      <CollectionTabContent
        watches={owned}
        previouslyOwnedWatches={disposed}
        wearDates={{}}
        isOwner={true}
        hasUrlExtract={true}
      />,
    )
    const toggle = getToggle()
    fireEvent.click(toggle)
    expect(screen.getAllByTestId('pwc')).toHaveLength(3)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(toggle)
    expect(screen.getAllByTestId('pwc')).toHaveLength(2)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('when on, owned cards render first, then previously-owned', () => {
    const owned = [buildWatch('o1'), buildWatch('o2')]
    const disposed = [
      buildWatch('d1', { status: 'previously_owned' }),
      buildWatch('d2', { status: 'previously_owned' }),
    ]
    render(
      <CollectionTabContent
        watches={owned}
        previouslyOwnedWatches={disposed}
        wearDates={{}}
        isOwner={true}
        hasUrlExtract={true}
      />,
    )
    fireEvent.click(getToggle())
    const cards = screen.getAllByTestId('pwc')
    expect(cards.map((c) => c.getAttribute('data-id'))).toEqual([
      'o1',
      'o2',
      'd1',
      'd2',
    ])
    expect(cards.map((c) => c.getAttribute('data-status'))).toEqual([
      'owned',
      'owned',
      'previously_owned',
      'previously_owned',
    ])
  })

  it('toggle on + search matching only the previously-owned brand shows exactly 1 card', () => {
    const owned = [buildWatch('o1', { brand: 'Rolex' })]
    const disposed = [
      buildWatch('d1', { status: 'previously_owned', brand: 'Omega' }),
    ]
    render(
      <CollectionTabContent
        watches={owned}
        previouslyOwnedWatches={disposed}
        wearDates={{}}
        isOwner={true}
        hasUrlExtract={true}
      />,
    )
    fireEvent.click(getToggle())
    expect(screen.getAllByTestId('pwc')).toHaveLength(2)

    const search = screen.getByLabelText('Search watches')
    fireEvent.change(search, { target: { value: 'Omega' } })
    const cards = screen.getAllByTestId('pwc')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveAttribute('data-id', 'd1')
  })

  it('owner with 0 owned + 1 previously_owned: toolbar renders, "Nothing here yet." absent', () => {
    const disposed = [buildWatch('d1', { status: 'previously_owned' })]
    render(
      <CollectionTabContent
        watches={[]}
        previouslyOwnedWatches={disposed}
        wearDates={{}}
        isOwner={true}
        hasUrlExtract={true}
      />,
    )
    expect(getToggle()).toBeInTheDocument()
    expect(screen.queryByText('Nothing here yet.')).not.toBeInTheDocument()
  })

  it('owner with 0 owned + 0 previously_owned: "Nothing here yet." renders (existing behavior)', () => {
    render(
      <CollectionTabContent
        watches={[]}
        previouslyOwnedWatches={[]}
        wearDates={{}}
        isOwner={true}
        hasUrlExtract={true}
      />,
    )
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
  })

  it('owner with previouslyOwnedWatches=[]: toggle label is exactly "Show previously owned"', () => {
    render(
      <CollectionTabContent
        watches={[buildWatch('o1')]}
        previouslyOwnedWatches={[]}
        wearDates={{}}
        isOwner={true}
        hasUrlExtract={true}
      />,
    )
    const toggle = getToggle()
    expect(toggle).toHaveTextContent('Show previously owned')
    expect(toggle).not.toHaveTextContent('(')
  })

  it('non-owner (defensive): no toggle renders even if previouslyOwnedWatches is non-empty; only owned stubs render', () => {
    const owned = [buildWatch('o1')]
    const disposed = [buildWatch('d1', { status: 'previously_owned' })]
    render(
      <CollectionTabContent
        watches={owned}
        previouslyOwnedWatches={disposed}
        wearDates={{}}
        isOwner={false}
        hasUrlExtract={true}
      />,
    )
    expect(
      screen.queryByRole('button', { name: /Show previously owned/ }),
    ).not.toBeInTheDocument()
    const cards = screen.getAllByTestId('pwc')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveAttribute('data-id', 'o1')
  })
})
