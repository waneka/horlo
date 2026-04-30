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

import { AddWatchCard } from '@/components/profile/AddWatchCard'

describe('Phase 20.1 Plan 02 — AddWatchCard variant prop (D-15 + D-16)', () => {
  it('D-15 — default Collection variant renders "Add to Collection" text + aria-label, href="/watch/new"', () => {
    const { container } = render(<AddWatchCard />)
    expect(screen.getByText('Add to Collection')).toBeInTheDocument()
    const link = container.querySelector('a')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('aria-label')).toBe('Add to Collection')
    expect(link!.getAttribute('href')).toBe('/watch/new')
  })

  it('D-16 — variant="wishlist" renders "Add to Wishlist" text + aria-label, href="/watch/new"', () => {
    const { container } = render(<AddWatchCard variant="wishlist" />)
    expect(screen.getByText('Add to Wishlist')).toBeInTheDocument()
    const link = container.querySelector('a')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('aria-label')).toBe('Add to Wishlist')
    expect(link!.getAttribute('href')).toBe('/watch/new')
  })

  it('default variant when prop omitted falls back to "Add to Collection" (D-15)', () => {
    render(<AddWatchCard />)
    expect(screen.getByText('Add to Collection')).toBeInTheDocument()
    expect(screen.queryByText('Add to Wishlist')).not.toBeInTheDocument()
    expect(screen.queryByText('Add Watch')).not.toBeInTheDocument()
  })

  it('explicit variant="collection" renders "Add to Collection"', () => {
    render(<AddWatchCard variant="collection" />)
    expect(screen.getByText('Add to Collection')).toBeInTheDocument()
  })
})
