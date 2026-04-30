/**
 * Phase 20.1 Plan 01 (Wave 0) — RED test scaffold for AddWatchCard.
 *
 * Covers D-15 (text "Add Watch" → "Add to Collection") + D-16 (`variant="wishlist"`
 * shows "Add to Wishlist" copy).
 *
 * RED until Plan 02 modifies `src/components/profile/AddWatchCard.tsx` to accept
 * a `variant` prop and updates the default copy + aria-label.
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

// IMPORT UNDER TEST — current file exists; Plan 02 modifies it.
// Test will FAIL today because AddWatchCard renders "Add Watch" not "Add to Collection".
import { AddWatchCard } from '@/components/profile/AddWatchCard'

describe('Phase 20.1 Plan 02 — AddWatchCard (D-15 + D-16)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('D-15 default Collection variant — text "Add to Collection" + aria-label + href="/watch/new"', () => {
    render(<AddWatchCard />)
    expect(screen.getByText('Add to Collection')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Add to Collection' })
    expect(link).toHaveAttribute('aria-label', 'Add to Collection')
    expect(link).toHaveAttribute('href', '/watch/new')
  })

  it('D-16 wishlist variant — text "Add to Wishlist" + aria-label, href stays /watch/new', () => {
    render(<AddWatchCard variant="wishlist" />)
    expect(screen.getByText('Add to Wishlist')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Add to Wishlist' })
    expect(link).toHaveAttribute('aria-label', 'Add to Wishlist')
    expect(link).toHaveAttribute('href', '/watch/new')
  })

  it('default variant equals "collection" — omitting prop yields "Add to Collection"', () => {
    render(<AddWatchCard />)
    expect(screen.getByText('Add to Collection')).toBeInTheDocument()
    expect(screen.queryByText('Add to Wishlist')).toBeNull()
  })
})
