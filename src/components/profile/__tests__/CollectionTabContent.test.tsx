/**
 * Phase 27 Wave 0 RED — CollectionTabContent grid breakpoint (VIS-07).
 *
 * D-11 changes the populated-state grid wrapper from
 *   `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`
 * to
 *   `grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4`.
 *
 * RED today: the existing class string starts with `grid-cols-1`. Plan 04
 * swaps it. Empty-state grids (separate `sm:grid-cols-2` wrapper at line 89)
 * are unrelated and stay as-is.
 *
 * Mocks every child of CollectionTabContent so the test stays focused on the
 * grid wrapper class string — children render as test-id stubs only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

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

vi.mock('@/components/profile/ProfileWatchCard', () => ({
  ProfileWatchCard: () => <div data-testid="pwc" />,
}))
vi.mock('@/components/profile/AddWatchCard', () => ({
  AddWatchCard: () => <div data-testid="add-card" />,
}))
vi.mock('@/components/profile/FilterChips', () => ({
  FilterChips: () => <div data-testid="filter-chips" />,
}))

import { CollectionTabContent } from '@/components/profile/CollectionTabContent'
import type { Watch } from '@/lib/types'

function buildWatch(id: string): Watch {
  return {
    id,
    brand: 'Brand',
    model: `Model-${id}`,
    status: 'owned',
    movement: 'automatic',
    complications: [],
    styleTags: [],
    designTraits: [],
    roleTags: [],
  }
}

describe('Phase 27 — CollectionTabContent grid (VIS-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('grid uses grid-cols-2 (mobile 2-column per D-11 / VIS-07)', () => {
    const { container } = render(
      <CollectionTabContent
        watches={[buildWatch('w1'), buildWatch('w2')]}
        wearDates={{}}
        isOwner={true}
        hasUrlExtract={true}
      />,
    )
    // D-11: the populated-state grid wrapper.
    const grid = container.querySelector('.grid.grid-cols-2')
    expect(grid).not.toBeNull()
    // Existing breakpoint classes preserved per D-11.
    expect(grid?.className).toContain('sm:grid-cols-2')
    expect(grid?.className).toContain('lg:grid-cols-4')
  })
})
