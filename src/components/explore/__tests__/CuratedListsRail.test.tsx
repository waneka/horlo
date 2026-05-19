// src/components/explore/__tests__/CuratedListsRail.test.tsx
// Phase 47 Plan 02 — live tests for CuratedListsRail component (EXPL-06).
//
// Test coverage:
//   1. CuratedListsRail returns null when no published lists exist (EXPL-02)
//   2. CuratedListsRail renders up to 12 rail cards (EXPL-06)
//   3. Each card shows title, curator name, watch count, freshness indicator (D-01)
//   4. "View all" link points to /explore/lists
//   5. RailListCard shows "New" badge within 7 days; omits it otherwise

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

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
const mockGetPublishedLists = vi.fn()
const mockGetListItemCount = vi.fn()
vi.mock('@/data/curatedLists', () => ({
  getPublishedLists: (...args: unknown[]) => mockGetPublishedLists(...args),
  getListItemCount: (...args: unknown[]) => mockGetListItemCount(...args),
}))

import { CuratedListsRail } from '@/components/explore/CuratedListsRail'

async function renderAsync(element: Promise<React.ReactElement | null>) {
  const resolved = await element
  return render(resolved ?? <></>)
}

function makeList(overrides: Partial<{
  id: string
  title: string
  curatorName: string
  coverUrl: string | null
  introMarkdown: string | null
  status: string
  sortOrder: number
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}> = {}) {
  const base = {
    id: 'list-1',
    title: 'Iconic Divers',
    curatorName: 'Tyler',
    coverUrl: null,
    introMarkdown: null,
    status: 'published',
    sortOrder: 0,
    publishedAt: new Date('2025-01-01'),
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  }
  return { ...base, ...overrides }
}

describe('CuratedListsRail', () => {
  beforeEach(() => {
    mockGetPublishedLists.mockReset()
    mockGetListItemCount.mockReset()
    mockGetListItemCount.mockResolvedValue(5)
  })

  it('returns null when no published lists exist (EXPL-02 absent-not-empty)', async () => {
    mockGetPublishedLists.mockResolvedValue([])
    const { container } = await renderAsync(CuratedListsRail())
    expect(container.firstChild).toBeNull()
  })

  it('renders rail cards for all published lists (up to 12) (EXPL-06)', async () => {
    const lists = Array.from({ length: 3 }, (_, i) =>
      makeList({ id: `list-${i}`, title: `List ${i}`, sortOrder: i })
    )
    mockGetPublishedLists.mockResolvedValue(lists)

    const { getAllByRole } = await renderAsync(CuratedListsRail())
    // Each card is a link to /explore/lists/[id]
    const cardLinks = getAllByRole('link').filter((el) =>
      (el as HTMLAnchorElement).href.includes('/explore/lists/')
    )
    expect(cardLinks.length).toBe(3)
  })

  it('each card shows title, curator name, watch count, and a relative timestamp (EXPL-06 / D-01)', async () => {
    const list = makeList({
      id: 'list-1',
      title: 'Iconic Divers',
      curatorName: 'Tyler',
      publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    })
    mockGetPublishedLists.mockResolvedValue([list])
    mockGetListItemCount.mockResolvedValue(7)

    await renderAsync(CuratedListsRail())

    expect(screen.getByText('Iconic Divers')).toBeTruthy()
    expect(screen.getByText('Tyler')).toBeTruthy()
    expect(screen.getByText('7 watches')).toBeTruthy()
    // relative timestamp present (e.g. "3 days ago")
    expect(screen.getByText(/days? ago|today|last week|weeks? ago/i)).toBeTruthy()
  })

  it('"View all" link points to /explore/lists', async () => {
    mockGetPublishedLists.mockResolvedValue([makeList()])

    await renderAsync(CuratedListsRail())

    const viewAll = screen.getByText('View all')
    expect((viewAll.closest('a') as HTMLAnchorElement | null)?.href).toContain('/explore/lists')
  })

  it('RailListCard shows "New" badge within 7 days; omits it for older lists', async () => {
    const recentList = makeList({
      id: 'recent',
      publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago — NEW
    })
    const oldList = makeList({
      id: 'old',
      title: 'Old List',
      publishedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago — not new
    })
    mockGetPublishedLists.mockResolvedValue([recentList, oldList])

    await renderAsync(CuratedListsRail())

    const badges = screen.queryAllByText('New')
    expect(badges.length).toBe(1) // only the recent list shows the badge
  })
})
