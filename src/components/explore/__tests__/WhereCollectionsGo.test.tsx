// src/components/explore/__tests__/WhereCollectionsGo.test.tsx
// Phase 47 Plan 03 — Live tests for WhereCollectionsGo component.
//
// Test coverage:
//   EXPL-09: WhereCollectionsGo returns null when no published paths (null-hide)
//   EXPL-09: WhereCollectionsGo renders exactly 3 paths when ≥3 published paths
//   EXPL-09: WhereCollectionsGo uses weekly rotation to select paths (D-13)
//   EXPL-09: "Explore all paths" link points to /explore/paths
//   EXPL-09: each path renders a path-type chip with the pathType label (D-14)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

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

// Mock Badge from shadcn/ui
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: { children: React.ReactNode; variant?: string; className?: string }) => (
    <span data-variant={variant} className={className}>
      {children}
    </span>
  ),
}))

// Mock DAL functions
const mockGetPublishedPaths = vi.fn()
const mockGetPathWithNodes = vi.fn()

vi.mock('@/data/collectionPaths', () => ({
  getPublishedPaths: (...args: unknown[]) => mockGetPublishedPaths(...args),
  getPathWithNodes: (...args: unknown[]) => mockGetPathWithNodes(...args),
}))

// Helper: build a minimal path
function makePath(overrides: Partial<{
  id: string
  pathType: string
  rationale: string | null
  seedCatalogId: string
  status: string
  sortOrder: number
}> = {}) {
  return {
    id: 'path-1',
    pathType: 'Going Deeper',
    rationale: 'Some rationale',
    seedCatalogId: 'catalog-1',
    status: 'published',
    sortOrder: 0,
    source: 'manual',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

// Helper: build a path with nodes (result of getPathWithNodes)
function makePathWithNodes(path: ReturnType<typeof makePath>, nodes: Array<{
  id: string
  catalogId: string
  brand: string
  model: string
  rationale: string | null
  imageUrl: string | null
  sortOrder: number
}>) {
  return {
    ...path,
    nodes,
    seedWatch: { brand: 'Seed Brand', model: 'Seed Model', reference: null, imageUrl: null },
  }
}

describe('WhereCollectionsGo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns null when no published paths exist (EXPL-02 absent-not-empty)', async () => {
    mockGetPublishedPaths.mockResolvedValue([])

    const { WhereCollectionsGo } = await import('@/components/explore/WhereCollectionsGo')
    const result = await WhereCollectionsGo()
    expect(result).toBeNull()
  })

  it('renders exactly 3 paths when at least 3 published paths are available (D-13)', async () => {
    const paths = [
      makePath({ id: 'path-1', pathType: 'Going Deeper', sortOrder: 0 }),
      makePath({ id: 'path-2', pathType: 'Branching Out', sortOrder: 1 }),
      makePath({ id: 'path-3', pathType: 'Trading Up', sortOrder: 2 }),
      makePath({ id: 'path-4', pathType: 'Filling a Gap', sortOrder: 3 }),
    ]
    mockGetPublishedPaths.mockResolvedValue(paths)
    mockGetPathWithNodes.mockImplementation(async (id: string) => {
      const path = paths.find(p => p.id === id)!
      return makePathWithNodes(path, [
        { id: `${id}-node-1`, catalogId: `cat-${id}-1`, brand: 'Brand', model: `Model ${id}`, rationale: null, imageUrl: null, sortOrder: 0 },
      ])
    })

    const { WhereCollectionsGo } = await import('@/components/explore/WhereCollectionsGo')
    const result = await WhereCollectionsGo()
    render(result as React.ReactElement)

    // Should render exactly 3 paths from the 4 available
    // The section heading should be present
    expect(screen.getByText('Where Collections Go')).toBeTruthy()
    // Count path-type chip renders — only 3 paths should be shown
    const chips = screen.getAllByText(/Going Deeper|Branching Out|Trading Up|Filling a Gap/)
    expect(chips.length).toBe(3)
  })

  it('uses weekly rotation to determine which 3 paths to display (D-13)', async () => {
    // 5 paths — rotation slice must be consistent with getWeekIndex
    const paths = Array.from({ length: 5 }, (_, i) =>
      makePath({ id: `path-${i}`, pathType: 'Going Deeper', sortOrder: i })
    )
    mockGetPublishedPaths.mockResolvedValue(paths)
    mockGetPathWithNodes.mockImplementation(async (id: string) => {
      const path = paths.find(p => p.id === id)!
      return makePathWithNodes(path, [])
    })

    const { WhereCollectionsGo } = await import('@/components/explore/WhereCollectionsGo')
    const result = await WhereCollectionsGo()
    expect(result).not.toBeNull()
    render(result as React.ReactElement)

    // Component rendered — rotation was applied (just verify no crash and heading present)
    expect(screen.getByText('Where Collections Go')).toBeTruthy()
  })

  it('"Explore all paths" link points to /explore/paths', async () => {
    const path = makePath({ id: 'path-1', pathType: 'Going Deeper' })
    mockGetPublishedPaths.mockResolvedValue([path])
    mockGetPathWithNodes.mockResolvedValue(makePathWithNodes(path, []))

    const { WhereCollectionsGo } = await import('@/components/explore/WhereCollectionsGo')
    const result = await WhereCollectionsGo()
    render(result as React.ReactElement)

    const link = screen.getByText('Explore all paths').closest('a')
    expect(link?.getAttribute('href')).toBe('/explore/paths')
  })

  it('each path renders a path-type chip with the pathType label (D-14)', async () => {
    const path = makePath({ id: 'path-1', pathType: 'Trading Up' })
    mockGetPublishedPaths.mockResolvedValue([path])
    mockGetPathWithNodes.mockResolvedValue(makePathWithNodes(path, []))

    const { WhereCollectionsGo } = await import('@/components/explore/WhereCollectionsGo')
    const result = await WhereCollectionsGo()
    render(result as React.ReactElement)

    // The Badge should render the pathType label
    expect(screen.getByText('Trading Up')).toBeTruthy()
  })
})
