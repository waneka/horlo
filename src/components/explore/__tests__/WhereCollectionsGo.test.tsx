// src/components/explore/__tests__/WhereCollectionsGo.test.tsx
// Phase 47 Plan 01 — Wave 0 scaffold for WhereCollectionsGo component tests.
//
// Test coverage (Test Map from 47-RESEARCH.md):
//   EXPL-09: WhereCollectionsGo returns null when no published paths (null-hide)
//   EXPL-09: WhereCollectionsGo shows 3 paths at a time via weekly rotation
//
// Status: it.todo scaffolds — Plan 03 converts these to live it() tests
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
vi.mock('@/data/collectionPaths', () => ({
  getPublishedPaths: vi.fn().mockResolvedValue([]),
  getPathNodes: vi.fn().mockResolvedValue([]),
}))

describe('WhereCollectionsGo', () => {
  it.todo('returns null when no published paths exist (EXPL-02 absent-not-empty)')
  it.todo('renders exactly 3 paths when at least 3 published paths are available (D-13)')
  it.todo('uses weekly rotation to determine which 3 paths to display (D-13)')
  it.todo('"Explore all paths" link points to /explore/paths')
  it.todo('each path renders a path-type chip with the pathType label (D-14)')
})
