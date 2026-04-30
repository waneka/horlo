import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// next/link stub — render as plain <a> (kept but unused after FIT-04 Link removal)
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

// next/image stub — preserve src/alt + width/height on a plain <img>
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

import { WatchSearchRow } from '@/components/search/WatchSearchRow'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'

const baseResult: SearchCatalogWatchResult = {
  catalogId: 'cat-uuid-123',
  brand: 'Rolex',
  model: 'Submariner',
  reference: '116610',
  imageUrl: null,
  ownersCount: 5,
  wishlistCount: 2,
  viewerState: null,
}

describe('WatchSearchRow (FIT-04, SRCH-09, SRCH-15, D-05)', () => {
  it('Test 1 — wraps brand+model in HighlightedText for q="Sub"', () => {
    render(<WatchSearchRow result={baseResult} q="Sub" />)
    const strong = screen.getByText('Sub', { selector: 'strong' })
    expect(strong).toBeInTheDocument()
  })

  it('Test 2 — renders reference sub-label when non-null', () => {
    render(<WatchSearchRow result={baseResult} q="Sub" />)
    expect(screen.getByText(/116610/)).toBeInTheDocument()
  })

  it('Test 3 — no reference sub-label when reference is null', () => {
    render(
      <WatchSearchRow result={{ ...baseResult, reference: null }} q="Sub" />,
    )
    expect(screen.queryByText(/116610/)).not.toBeInTheDocument()
  })

  it('Test 4 — does not render a /evaluate link (FIT-04 — dangling href removed)', () => {
    const { container } = render(
      <WatchSearchRow result={baseResult} q="Sub" />,
    )
    const evaluateLinks = container.querySelectorAll(
      'a[href*="/evaluate"]',
    )
    expect(evaluateLinks.length).toBe(0)
  })

  it('Test 5 — wraps brand+model in <Link> to /catalog/[catalogId] (gap-5 follow-up — primary action is detail-page nav)', () => {
    const { container } = render(<WatchSearchRow result={baseResult} q="Sub" />)
    const p = screen.getByText(/Rolex/, { selector: 'p' })
    const anchor = p.closest('a')
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('href')).toBe('/catalog/cat-uuid-123')
    // No legacy /evaluate hrefs anywhere
    expect(container.querySelector('a[href*="/evaluate"]')).toBeNull()
  })

  it('Test 6 — does NOT render its own chevron / "Evaluate" / "Hide" text (chevron now owned by parent via trigger slot)', () => {
    const { container } = render(<WatchSearchRow result={baseResult} q="Sub" />)
    expect(screen.queryByText('Evaluate')).toBeNull()
    expect(screen.queryByText('Hide')).toBeNull()
    expect(screen.queryByText(/Tap to evaluate/i)).toBeNull()
    // No SVG when trigger slot is empty (image fallback only renders when imageUrl is null;
    // in this fixture imageUrl IS null so the fallback Watch icon is present — that's fine).
    // What we're asserting: there's no trigger button rendered inside the row by default.
    expect(container.querySelector('button')).toBeNull()
  })

  it('Test 7 — renders the trigger slot when provided', () => {
    render(
      <WatchSearchRow
        result={baseResult}
        q="Sub"
        trigger={<button type="button" aria-label="external trigger" />}
      />,
    )
    expect(screen.getByRole('button', { name: 'external trigger' })).toBeInTheDocument()
  })

  it('Test 9 — Owned pill renders with bg-primary classes (D-05)', () => {
    render(
      <WatchSearchRow
        result={{ ...baseResult, viewerState: 'owned' }}
        q="Sub"
      />,
    )
    const pill = screen.getByText('Owned')
    expect(pill.className).toMatch(/bg-primary/)
    expect(pill.className).toMatch(/text-primary-foreground/)
  })

  it('Test 10 — Wishlist pill renders with bg-muted text-muted-foreground (D-05)', () => {
    render(
      <WatchSearchRow
        result={{ ...baseResult, viewerState: 'wishlist' }}
        q="Sub"
      />,
    )
    const pill = screen.getByText('Wishlist')
    expect(pill.className).toMatch(/bg-muted/)
    expect(pill.className).toMatch(/text-muted-foreground/)
  })

  it('Test 11 — no pill when viewerState is null (D-05)', () => {
    render(<WatchSearchRow result={baseResult} q="Sub" />)
    expect(screen.queryByText('Owned')).not.toBeInTheDocument()
    expect(screen.queryByText('Wishlist')).not.toBeInTheDocument()
  })

  it('Test 12 — next/image renders when imageUrl is present', () => {
    const { container } = render(
      <WatchSearchRow
        result={{ ...baseResult, imageUrl: '/photo.jpg' }}
        q="Sub"
      />,
    )
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toContain('photo.jpg')
  })
})
