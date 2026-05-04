/**
 * Phase 27 Wave 0 RED — ProfileWatchCard price line + image sizes (VIS-08, D-13).
 *
 * Covers status x price-presence matrix from D-15..D-21:
 *   - owned + pricePaid → "Paid: $X"
 *   - owned + pricePaid null + marketPrice → "Market: $X"
 *   - owned + both null → no price line rendered
 *   - wishlist + targetPrice → "Target: $X"
 *   - wishlist + targetPrice null + marketPrice → "Market: $X"
 *   - wishlist + both null → no price line rendered
 *   - grail + targetPrice → "Target: $X"  (D-16: grail uses target bucket)
 *   - sold + pricePaid → "Paid: $X"        (D-16: sold uses paid bucket)
 *
 * Plus 1 sizes-attr assertion (D-13):
 *   - Image sizes equals "(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
 *
 * RED today: ProfileWatchCard renders the legacy wishlist-only `Target: $X` block
 * gated on `showWishlistMeta && watch.targetPrice != null`. Plan 04 swaps this
 * for the unified status-driven price line and updates the sizes attr.
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

// Preserve `sizes` attribute so the D-13 assertion can read it back.
vi.mock('next/image', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (p: any) => <img src={p.src} alt={p.alt} sizes={p.sizes} />,
}))

import { ProfileWatchCard } from '@/components/profile/ProfileWatchCard'
import type { Watch } from '@/lib/types'

function buildWatch(overrides: Partial<Watch>): Watch {
  return {
    id: 'w1',
    brand: 'Brand',
    model: 'Model',
    status: 'owned',
    movement: 'automatic',
    complications: [],
    styleTags: [],
    designTraits: [],
    roleTags: [],
    ...overrides,
  }
}

describe('Phase 27 — ProfileWatchCard price line (VIS-08) + sizes (D-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('owned + pricePaid=4200 → renders "Paid: $4,200"', () => {
    render(
      <ProfileWatchCard
        watch={buildWatch({ status: 'owned', pricePaid: 4200 })}
        lastWornDate={null}
      />,
    )
    expect(screen.getByText('Paid: $4,200')).toBeInTheDocument()
  })

  it('owned + pricePaid undefined + marketPrice=8500 → renders "Market: $8,500"', () => {
    render(
      <ProfileWatchCard
        watch={buildWatch({ status: 'owned', pricePaid: undefined, marketPrice: 8500 })}
        lastWornDate={null}
      />,
    )
    expect(screen.getByText('Market: $8,500')).toBeInTheDocument()
  })

  it('owned + pricePaid undefined + marketPrice undefined → no price line rendered', () => {
    render(
      <ProfileWatchCard
        watch={buildWatch({ status: 'owned', pricePaid: undefined, marketPrice: undefined })}
        lastWornDate={null}
      />,
    )
    expect(screen.queryByText(/^(Paid|Target|Market):/)).toBeNull()
  })

  it('wishlist + targetPrice=15000 → renders "Target: $15,000" with showWishlistMeta', () => {
    render(
      <ProfileWatchCard
        watch={buildWatch({ status: 'wishlist', targetPrice: 15000 })}
        lastWornDate={null}
        showWishlistMeta
      />,
    )
    expect(screen.getByText('Target: $15,000')).toBeInTheDocument()
  })

  it('wishlist + targetPrice undefined + marketPrice=8500 → renders "Market: $8,500"', () => {
    render(
      <ProfileWatchCard
        watch={buildWatch({ status: 'wishlist', targetPrice: undefined, marketPrice: 8500 })}
        lastWornDate={null}
        showWishlistMeta
      />,
    )
    expect(screen.getByText('Market: $8,500')).toBeInTheDocument()
  })

  it('wishlist + targetPrice undefined + marketPrice undefined → no price line rendered', () => {
    render(
      <ProfileWatchCard
        watch={buildWatch({ status: 'wishlist', targetPrice: undefined, marketPrice: undefined })}
        lastWornDate={null}
        showWishlistMeta
      />,
    )
    expect(screen.queryByText(/^(Paid|Target|Market):/)).toBeNull()
  })

  it('grail + targetPrice=50000 → renders "Target: $50,000" (D-16: grail uses target bucket)', () => {
    render(
      <ProfileWatchCard
        watch={buildWatch({ status: 'grail', targetPrice: 50000 })}
        lastWornDate={null}
        showWishlistMeta
      />,
    )
    expect(screen.getByText('Target: $50,000')).toBeInTheDocument()
  })

  it('sold + pricePaid=3000 → renders "Paid: $3,000" (D-16: sold uses paid bucket)', () => {
    render(
      <ProfileWatchCard
        watch={buildWatch({ status: 'sold', pricePaid: 3000 })}
        lastWornDate={null}
      />,
    )
    expect(screen.getByText('Paid: $3,000')).toBeInTheDocument()
  })

  it('Image sizes attr equals "(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw" (D-13)', () => {
    const { container } = render(
      <ProfileWatchCard
        watch={buildWatch({ imageUrl: 'https://example.com/x.jpg' })}
        lastWornDate={null}
      />,
    )
    const img = container.querySelector('img')
    expect(img?.getAttribute('sizes')).toBe(
      '(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw',
    )
  })
})
