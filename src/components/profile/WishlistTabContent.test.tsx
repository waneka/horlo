import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

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

vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}))

vi.mock('@/components/profile/ProfileWatchCard', () => ({
  ProfileWatchCard: ({ watch }: { watch: { id: string } }) => (
    <div data-testid="pwc" data-watch-id={watch.id} />
  ),
}))

import { WishlistTabContent } from '@/components/profile/WishlistTabContent'
import type { Watch } from '@/lib/types'

const buildWishlistWatch = (id: string, brand: string, model: string): Watch => ({
  id,
  brand,
  model,
  status: 'wishlist',
  movement: 'automatic',
  complications: [],
  styleTags: [],
  designTraits: [],
  roleTags: [],
})

describe('Phase 20.1 Plan 02 — WishlistTabContent end-of-grid AddWatchCard (D-16)', () => {
  it('isOwner=true with watches → end-of-grid AddToWishlist card renders exactly once', () => {
    const watches = [
      buildWishlistWatch('w1', 'Omega', 'Speedmaster'),
      buildWishlistWatch('w2', 'Rolex', 'Submariner'),
    ]
    render(<WishlistTabContent watches={watches} wearDates={{}} isOwner={true} />)

    const pwcs = screen.getAllByTestId('pwc')
    expect(pwcs).toHaveLength(2)

    // D-16: end-of-grid card with text "Add to Wishlist"
    const addCards = screen.getAllByText('Add to Wishlist')
    expect(addCards).toHaveLength(1)
  })

  it('isOwner=false → no AddToWishlist card rendered', () => {
    const watches = [buildWishlistWatch('w1', 'Omega', 'Speedmaster')]
    render(<WishlistTabContent watches={watches} wearDates={{}} isOwner={false} />)

    expect(screen.getAllByTestId('pwc')).toHaveLength(1)
    expect(screen.queryByText('Add to Wishlist')).not.toBeInTheDocument()
  })

  it('isOwner undefined (omitted) → no AddToWishlist card (backwards-compat)', () => {
    const watches = [buildWishlistWatch('w1', 'Omega', 'Speedmaster')]
    render(<WishlistTabContent watches={watches} wearDates={{}} />)

    expect(screen.queryByText('Add to Wishlist')).not.toBeInTheDocument()
  })

  it('empty wishlist + isOwner=true → empty state still renders, NO end-of-grid card (D-16 spec — Phase 25 owns empty-state CTAs)', () => {
    render(<WishlistTabContent watches={[]} wearDates={{}} isOwner={true} />)

    expect(screen.getByText('Your wishlist is empty.')).toBeInTheDocument()
    expect(screen.queryByText('Add to Wishlist')).not.toBeInTheDocument()
  })

  it('empty wishlist + isOwner=false → empty state renders without CTA', () => {
    render(<WishlistTabContent watches={[]} wearDates={{}} isOwner={false} />)

    expect(screen.getByText('Your wishlist is empty.')).toBeInTheDocument()
    expect(screen.queryByText('Add to Wishlist')).not.toBeInTheDocument()
  })
})
