import { describe, it, expect, vi, beforeEach } from 'vitest'
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

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/data/discovery', () => ({
  getMostFollowedCollectors: vi.fn(),
}))

// Stub the row to keep the test unit-scoped.
vi.mock('@/components/explore/PopularCollectorRow', () => ({
  PopularCollectorRow: ({
    collector,
    viewerId,
  }: {
    collector: { userId: string; username: string }
    viewerId: string
  }) => (
    <div
      data-testid={`row-${collector.userId}`}
      data-viewer={viewerId}
      data-username={collector.username}
    >
      row
    </div>
  ),
}))

import CollectorsSeeAllPage from '@/app/explore/collectors/page'
import { getCurrentUser } from '@/lib/auth'
import { getMostFollowedCollectors } from '@/data/discovery'
import type { PopularCollector } from '@/data/discovery'

const mockedGetCurrentUser = vi.mocked(getCurrentUser)
const mockedDal = vi.mocked(getMostFollowedCollectors)

function makeCollector(i: number): PopularCollector {
  return {
    userId: `u-${i}`,
    username: `user${i}`,
    displayName: `User ${i}`,
    avatarUrl: null,
    followersCount: 100 - i,
    watchCount: 0,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetCurrentUser.mockResolvedValue({ id: 'v1', email: 'v1@example.com' })
})

describe('CollectorsSeeAllPage', () => {
  it('Test 1 — renders 50 rows + cap footer when DAL returns 50', async () => {
    const fifty = Array.from({ length: 50 }, (_, i) => makeCollector(i))
    mockedDal.mockResolvedValueOnce(fifty)

    const tree = await CollectorsSeeAllPage()
    render(tree as React.ReactElement)

    expect(screen.getAllByTestId(/^row-/).length).toBe(50)
    expect(screen.getByText('Showing top 50 collectors.')).toBeTruthy()
  })

  it('Test 2 — no footer below cap (25 collectors)', async () => {
    const twentyFive = Array.from({ length: 25 }, (_, i) => makeCollector(i))
    mockedDal.mockResolvedValueOnce(twentyFive)

    const tree = await CollectorsSeeAllPage()
    render(tree as React.ReactElement)

    expect(screen.getAllByTestId(/^row-/).length).toBe(25)
    expect(screen.queryByText('Showing top 50 collectors.')).toBeNull()
  })

  it('Test 3 — empty-state copy when DAL returns []', async () => {
    mockedDal.mockResolvedValueOnce([])

    const tree = await CollectorsSeeAllPage()
    render(tree as React.ReactElement)

    expect(screen.getByText('No collectors to suggest right now.')).toBeTruthy()
    expect(screen.getByText('Check back as more collectors join Horlo.')).toBeTruthy()
    expect(screen.queryByText('Showing top 50 collectors.')).toBeNull()
  })

  it('Test 4 — calls DAL with (userId, { limit: 50 })', async () => {
    mockedDal.mockResolvedValueOnce([])

    await CollectorsSeeAllPage()

    expect(mockedDal).toHaveBeenCalledTimes(1)
    expect(mockedDal).toHaveBeenCalledWith('v1', { limit: 50 })
  })

  it('Test 5 — h1 "Popular collectors" exists', async () => {
    mockedDal.mockResolvedValueOnce([])

    const tree = await CollectorsSeeAllPage()
    const { container } = render(tree as React.ReactElement)

    const h1 = container.querySelector('h1')
    expect(h1).toBeTruthy()
    expect(h1?.textContent).toBe('Popular collectors')
  })
})
