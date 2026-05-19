// src/components/explore/__tests__/HeroModule.test.tsx
// Phase 47 Plan 01 — Wave 0 scaffold for HeroModule component tests.
//
// Test coverage (Test Map from 47-RESEARCH.md):
//   EXPL-08: HeroModule returns null when eligible pool is empty (null-hide)
//   EXPL-08: HeroModule uses manual pin when active and eligible
//   EXPL-08: HeroModule falls back to weekly rotation when no valid pin
//
// Status: it.todo scaffolds — Plan 02 converts these to live it() tests
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

// Mock DAL functions so the component doesn't need a DB connection
vi.mock('@/data/curatedLists', () => ({
  getPublishedLists: vi.fn().mockResolvedValue([]),
  getListItemCount: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/data/cmsSettings', () => ({
  getCmsSettings: vi.fn().mockResolvedValue({
    id: 1,
    pinnedListId: null,
    pinExpiresAt: null,
    heroFormat: 'featured_list',
    updatedAt: new Date(),
  }),
}))

describe('HeroModule', () => {
  it.todo('returns null when the eligible pool is empty (EXPL-02 absent-not-empty / D-10)')
  it.todo('renders the pinned list when a valid manual pin is active (D-09)')
  it.todo('falls back to weekly rotation when no valid pin exists (D-07)')
  it.todo('falls back to weekly rotation when pinned list is not eligible (D-09 fallback)')
  it.todo('uses cacheTag("explore:hero") scope (D-09)')
})
