/**
 * Phase 20.1 Plan 01 (Wave 0) — RED test scaffold for WishlistTabContent.
 *
 * Covers D-16 — when `isOwner=true` AND wishlist has at least one watch, render
 * an end-of-grid "Add to Wishlist" CTA card. When `isOwner=false`, no CTA card.
 * Empty wishlist + owner: no end-of-grid card either (Phase 25 owns empty-state CTAs).
 *
 * RED until Plan 02 modifies `WishlistTabContent` to append the AddToWishlist
 * card when isOwner && watches.length > 0.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

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
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}))
vi.mock('@/components/profile/ProfileWatchCard', () => ({
  ProfileWatchCard: () => <div data-testid="pwc" />,
}))

// IMPORT UNDER TEST — current file exists; Plan 02 modifies it.
import { WishlistTabContent } from '@/components/profile/WishlistTabContent'
import type { Watch } from '@/lib/types'

const buildWatch = (id: string): Watch => ({
  id,
  brand: 'Brand',
  model: 'Model',
  status: 'wishlist',
  movement: 'automatic',
  complications: [],
  styleTags: [],
  designTraits: [],
  roleTags: [],
})

describe('Phase 20.1 Plan 02 — WishlistTabContent end-of-grid (D-16)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('isOwner=true with watches — renders ProfileWatchCard rows AND exactly one end-of-grid "Add to Wishlist" CTA card', () => {
    render(
      <WishlistTabContent
        watches={[buildWatch('w1'), buildWatch('w2')]}
        wearDates={{}}
        isOwner={true}
      />,
    )
    // The 2 fixture watches render via mocked ProfileWatchCard.
    expect(screen.getAllByTestId('pwc')).toHaveLength(2)
    // D-16 end-of-grid card text + aria-label.
    const ctas = screen.getAllByText('Add to Wishlist')
    expect(ctas).toHaveLength(1)
    expect(screen.getByLabelText('Add to Wishlist')).toBeInTheDocument()
  })

  it('isOwner=false — no AddToWishlist CTA card rendered', () => {
    render(
      <WishlistTabContent
        watches={[buildWatch('w1'), buildWatch('w2')]}
        wearDates={{}}
        isOwner={false}
      />,
    )
    expect(screen.queryByText('Add to Wishlist')).toBeNull()
  })

  it('empty wishlist + isOwner=true — empty-state still renders, NO end-of-grid CTA (Phase 25 owns empty-state CTAs)', () => {
    render(<WishlistTabContent watches={[]} wearDates={{}} isOwner={true} />)
    expect(screen.getByText(/Your wishlist is empty/)).toBeInTheDocument()
    expect(screen.queryByText('Add to Wishlist')).toBeNull()
  })
})
