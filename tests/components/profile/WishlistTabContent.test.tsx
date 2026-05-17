import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/u/tyler/wishlist',
}))

// Mock @dnd-kit modules — dnd-kit uses pointer events and browser APIs
// that are unavailable in jsdom. For these tests we only care about the
// add-button header row behaviour, not drag-reorder internals.
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: () => null,
  MouseSensor: class {},
  TouchSensor: class {},
  KeyboardSensor: class {},
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSensor: () => ({}),
  useSensors: (...args: unknown[]) => args,
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  arrayMove: (arr: unknown[], from: number, to: number) => {
    const next = [...arr]
    next.splice(to, 0, next.splice(from, 1)[0])
    return next
  },
  rectSortingStrategy: {},
  sortableKeyboardCoordinates: () => ({ x: 0, y: 0 }),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
    isDragging: false,
  }),
}))

// Mock the wishlist reorder server action
vi.mock('@/app/actions/wishlist', () => ({
  reorderWishlist: vi.fn().mockResolvedValue({ success: true }),
}))

import { WishlistTabContent } from '@/components/profile/WishlistTabContent'
import type { Watch } from '@/lib/types'

function makeWatch(over: Partial<Watch> = {}): Watch {
  return {
    id: over.id ?? 'w1',
    brand: 'Omega',
    model: 'Speedmaster',
    status: 'wishlist',
    dateAdded: '2024-01-01',
    ...over,
  } as Watch
}

const defaultWearDates: Record<string, string> = {}

describe('WishlistTabContent — Add to Wishlist button (PLSH-05)', () => {
  it('renders "Add to Wishlist" button above the grid when isOwner=true and watches are present', () => {
    const watches = [makeWatch({ id: 'w1' }), makeWatch({ id: 'w2' })]
    const { getByRole } = render(
      <WishlistTabContent
        watches={watches}
        wearDates={defaultWearDates}
        isOwner={true}
        username="tyler"
      />,
    )
    // Base UI renders Button as <a role="button"> when using render={<Link>}
    const btn = getByRole('button', { name: 'Add to Wishlist' })
    expect(btn).toBeTruthy()
  })

  it('the "Add to Wishlist" button href contains status=wishlist', () => {
    const watches = [makeWatch({ id: 'w1' })]
    const { getByRole } = render(
      <WishlistTabContent
        watches={watches}
        wearDates={defaultWearDates}
        isOwner={true}
        username="tyler"
      />,
    )
    const btn = getByRole('button', { name: 'Add to Wishlist' })
    const href = btn.getAttribute('href') ?? ''
    expect(href).toContain('status=wishlist')
  })

  it('does not render the "Add to Wishlist" button when isOwner=false', () => {
    const watches = [makeWatch({ id: 'w1' })]
    const { queryByRole } = render(
      <WishlistTabContent
        watches={watches}
        wearDates={defaultWearDates}
        isOwner={false}
        username="tyler"
      />,
    )
    expect(queryByRole('button', { name: 'Add to Wishlist' })).toBeNull()
  })

  it('does not render an AddWatchCard tile at the end of the populated grid', () => {
    const watches = [makeWatch({ id: 'w1' }), makeWatch({ id: 'w2' })]
    const { container } = render(
      <WishlistTabContent
        watches={watches}
        wearDates={defaultWearDates}
        isOwner={true}
        username="tyler"
      />,
    )
    // AddWatchCard renders a plain <a> with href=/watch/new and a dashed-border style.
    // After PLSH-05, no such card should appear inside the grid.
    const grid = container.querySelector('.grid')
    // All <a> inside the grid should point to /watch/{id} watch detail paths
    const watchNewLinksInGrid = Array.from(
      grid?.querySelectorAll('a[href*="/watch/new"]') ?? [],
    )
    expect(watchNewLinksInGrid).toHaveLength(0)
  })
})
