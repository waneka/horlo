// tests/components/watch/WatchCard.test.tsx (TEST-06)
//
// Render-variant coverage for <WatchCard>:
//   - brand + model render
//   - status pill
//   - image fallback (WatchIcon when imageUrl is empty)
//   - marketPrice display for non-owned vs owned
//   - deal badge for flagged-deal wishlist watches
//   - gap-fill badge for wishlist watches with an empty collection

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WatchCard } from '@/components/watch/WatchCard'
import type { Watch, UserPreferences } from '@/lib/types'

// Mock next/link — avoid Next.js router context in unit tests.
vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock next/image — avoid Next.js Image optimization in unit tests.
vi.mock('next/image', () => ({
  default: ({ alt, ...rest }: { alt: string } & Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />
  ),
}))

const baseWatch: Watch = {
  id: 'w1',
  brand: 'Omega',
  model: 'Speedmaster',
  status: 'owned',
  movement: 'automatic',
  complications: [],
  styleTags: [],
  designTraits: [],
  roleTags: [],
  notes: '',
  imageUrl: '',
}

const baseCollection: Watch[] = []
const basePrefs: UserPreferences = {} as UserPreferences

describe('<WatchCard>', () => {
  it('renders brand and model', () => {
    render(
      <WatchCard
        watch={baseWatch}
        collection={baseCollection}
        preferences={basePrefs}
      />,
    )
    expect(screen.getByText('Omega')).toBeInTheDocument()
    expect(screen.getByText('Speedmaster')).toBeInTheDocument()
  })

  it('renders status pill', () => {
    render(
      <WatchCard
        watch={baseWatch}
        collection={baseCollection}
        preferences={basePrefs}
      />,
    )
    expect(screen.getByText('owned')).toBeInTheDocument()
  })

  it('falls back to WatchIcon when imageUrl is empty', () => {
    render(
      <WatchCard
        watch={baseWatch}
        collection={baseCollection}
        preferences={basePrefs}
      />,
    )
    // No <img> with the watch alt text is rendered when imageUrl is empty
    // (getSafeImageUrl('') → null → WatchIcon path renders instead).
    expect(
      screen.queryByAltText('Omega Speedmaster'),
    ).not.toBeInTheDocument()
  })

  it('shows marketPrice for non-owned (wishlist) watches', () => {
    const wishlistWatch: Watch = {
      ...baseWatch,
      status: 'wishlist',
      marketPrice: 7500,
    }
    render(
      <WatchCard
        watch={wishlistWatch}
        collection={baseCollection}
        preferences={basePrefs}
      />,
    )
    expect(screen.getByText('$7,500')).toBeInTheDocument()
  })

  it('hides marketPrice for owned watches', () => {
    const ownedWatch: Watch = { ...baseWatch, marketPrice: 7500 }
    render(
      <WatchCard
        watch={ownedWatch}
        collection={baseCollection}
        preferences={basePrefs}
      />,
    )
    expect(screen.queryByText('$7,500')).not.toBeInTheDocument()
  })

  it('shows Deal badge for a flagged-deal wishlist watch', () => {
    const dealWatch: Watch = {
      ...baseWatch,
      status: 'wishlist',
      isFlaggedDeal: true,
    }
    render(
      <WatchCard
        watch={dealWatch}
        collection={baseCollection}
        preferences={basePrefs}
      />,
    )
    expect(screen.getByText('Deal')).toBeInTheDocument()
  })

  it('shows gap-fill badge for wishlist watch in an empty collection', () => {
    // With an empty collection, computeGapFill returns kind='first-watch'.
    // WatchCard renders a gap-fill badge labelled "First watch".
    const wishlistWatch: Watch = {
      ...baseWatch,
      status: 'wishlist',
    }
    render(
      <WatchCard
        watch={wishlistWatch}
        collection={[]}
        preferences={basePrefs}
      />,
    )
    expect(screen.getByLabelText(/Gap-fill/i)).toBeInTheDocument()
  })
})
