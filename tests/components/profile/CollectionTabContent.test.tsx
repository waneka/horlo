import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/u/tyler/collection',
}))

import { CollectionTabContent } from '@/components/profile/CollectionTabContent'
import type { Watch } from '@/lib/types'

function makeWatch(over: Partial<Watch> = {}): Watch {
  return {
    id: over.id ?? 'w1',
    brand: 'Rolex',
    model: 'Submariner',
    status: 'owned',
    dateAdded: '2024-01-01',
    ...over,
  } as Watch
}

const defaultWearDates: Record<string, string> = {}

describe('CollectionTabContent — Add to Collection button (PLSH-05)', () => {
  it('renders "Add to Collection" button in the filter row when isOwner=true and watches are present', () => {
    const watches = [makeWatch({ id: 'w1' }), makeWatch({ id: 'w2' })]
    const { getByRole } = render(
      <CollectionTabContent
        watches={watches}
        wearDates={defaultWearDates}
        isOwner={true}
        hasUrlExtract={true}
      />,
    )
    // Base UI renders a Button as <a role="button"> when using render={<Link>}
    const btn = getByRole('button', { name: 'Add to Collection' })
    expect(btn).toBeTruthy()
  })

  it('the "Add to Collection" button href targets /watch/new', () => {
    const watches = [makeWatch({ id: 'w1' })]
    const { getByRole } = render(
      <CollectionTabContent
        watches={watches}
        wearDates={defaultWearDates}
        isOwner={true}
        hasUrlExtract={true}
      />,
    )
    // Base UI renders a Button as <a role="button"> when using render={<Link>}
    const btn = getByRole('button', { name: 'Add to Collection' })
    const href = btn.getAttribute('href') ?? ''
    expect(href).toContain('/watch/new')
  })

  it('does not render the "Add to Collection" button when isOwner=false', () => {
    const watches = [makeWatch({ id: 'w1' })]
    const { queryByRole } = render(
      <CollectionTabContent
        watches={watches}
        wearDates={defaultWearDates}
        isOwner={false}
        hasUrlExtract={true}
      />,
    )
    expect(queryByRole('button', { name: 'Add to Collection' })).toBeNull()
  })

  it('does not render an AddWatchCard tile at the end of the populated grid', () => {
    const watches = [makeWatch({ id: 'w1' }), makeWatch({ id: 'w2' })]
    const { container } = render(
      <CollectionTabContent
        watches={watches}
        wearDates={defaultWearDates}
        isOwner={true}
        hasUrlExtract={true}
      />,
    )
    // AddWatchCard renders a plain <a> (not a base-ui button element) with href=/watch/new
    // and a dashed-border class. After PLSH-05, no such card should appear inside the grid.
    // The grid contains only ProfileWatchCard children (links to /watch/{id}).
    const grid = container.querySelector('.grid')
    // All <a> inside the grid should point to /watch/{id} paths, not /watch/new
    const watchNewLinksInGrid = Array.from(
      grid?.querySelectorAll('a[href*="/watch/new"]') ?? [],
    )
    expect(watchNewLinksInGrid).toHaveLength(0)
  })
})
