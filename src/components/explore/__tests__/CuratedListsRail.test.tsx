// src/components/explore/__tests__/CuratedListsRail.test.tsx
// Phase 47 Plan 01 — Wave 0 scaffold for CuratedListsRail component tests.
//
// Test coverage (Test Map from 47-RESEARCH.md):
//   EXPL-06: CuratedListsRail returns null when no published lists (null-hide)
//   EXPL-06: CuratedListsRail renders up to 12 cards with freshness indicator
//
// Status: it.todo scaffolds — Plans 02 converts these to live it() tests
// when the component is implemented. These scaffolds must NOT fail the suite.

import { describe, it, vi } from 'vitest'

// Mock next/cache — cacheLife and cacheTag are no-ops under vitest
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

// Mock next/link to a plain anchor
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

// Mock the DAL so the component doesn't need a DB connection
vi.mock('@/data/curatedLists', () => ({
  getPublishedLists: vi.fn().mockResolvedValue([]),
  getListItemCount: vi.fn().mockResolvedValue(0),
}))

describe('CuratedListsRail', () => {
  it.todo('returns null when no published lists exist (EXPL-02 absent-not-empty)')
  it.todo('renders up to 12 rail cards when published lists are available (EXPL-06)')
  it.todo('each card shows title, curator name, watch count, and freshness indicator (EXPL-06 / D-01)')
  it.todo('"View all" link points to /explore/lists')
})
