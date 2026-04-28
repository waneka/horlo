import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

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

describe('WatchSearchRow (SRCH-09, SRCH-15, D-05, D-07, D-08)', () => {
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

  it('Test 4 — whole-row Link targets /evaluate?catalogId={uuid}', () => {
    const { container } = render(
      <WatchSearchRow result={baseResult} q="Sub" />,
    )
    const links = container.querySelectorAll(
      'a[href="/evaluate?catalogId=cat-uuid-123"]',
    )
    // Two links expected: absolute-inset overlay + raised Evaluate CTA
    expect(links.length).toBeGreaterThanOrEqual(2)
  })

  it('Test 5 — Evaluate inline CTA renders with label "Evaluate"', () => {
    render(<WatchSearchRow result={baseResult} q="Sub" />)
    expect(screen.getByText('Evaluate')).toBeInTheDocument()
  })

  it('Test 6 — Evaluate CTA wrapper has relative z-10 (raised)', () => {
    const { container } = render(
      <WatchSearchRow result={baseResult} q="Sub" />,
    )
    const raised = container.querySelector('.relative.z-10')
    expect(raised).toBeTruthy()
    expect(raised?.textContent).toContain('Evaluate')
  })

  it('Test 7 — Owned pill renders with bg-primary classes (D-05)', () => {
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

  it('Test 8 — Wishlist pill renders with bg-muted text-muted-foreground (D-05 / UI-SPEC line 110)', () => {
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

  it('Test 9 — no pill when viewerState is null (D-05)', () => {
    render(<WatchSearchRow result={baseResult} q="Sub" />)
    expect(screen.queryByText('Owned')).not.toBeInTheDocument()
    expect(screen.queryByText('Wishlist')).not.toBeInTheDocument()
  })

  it('Test 10 — WatchIcon fallback when imageUrl is null', () => {
    const { container } = render(
      <WatchSearchRow result={baseResult} q="Sub" />,
    )
    // lucide icon mounts as svg; presence of svg with watch-related class is the proxy
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('Test 11 — next/image renders when imageUrl is present', () => {
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
