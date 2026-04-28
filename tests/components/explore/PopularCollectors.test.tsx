import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// next/link stub (top-level for hoist safety)
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

// next/image stub for AvatarDisplay
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
  }: {
    src: string
    alt: string
    className?: string
  }) => <img src={src} alt={alt} className={className} />,
}))

// next/cache directives are runtime hints — no-op them in jsdom
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

// Stub the DAL so the cached component resolves synchronously
vi.mock('@/data/discovery', () => ({
  getMostFollowedCollectors: vi.fn(),
}))

// Stub FollowButton — only assert presence + variant
vi.mock('@/components/profile/FollowButton', () => ({
  FollowButton: ({
    viewerId,
    targetUserId,
    targetDisplayName,
    initialIsFollowing,
    variant,
  }: {
    viewerId: string | null
    targetUserId: string
    targetDisplayName: string
    initialIsFollowing: boolean
    variant?: string
  }) => (
    <button
      data-testid={`follow-button-${targetUserId}`}
      data-viewer-id={viewerId ?? 'null'}
      data-target-user-id={targetUserId}
      data-target-display-name={targetDisplayName}
      data-initial-is-following={String(initialIsFollowing)}
      data-variant={variant ?? 'primary'}
    >
      Follow
    </button>
  ),
}))

import { PopularCollectors } from '@/components/explore/PopularCollectors'
import { getMostFollowedCollectors } from '@/data/discovery'
import type { PopularCollector } from '@/data/discovery'

const mockedDal = vi.mocked(getMostFollowedCollectors)

function makeCollector(overrides: Partial<PopularCollector> = {}): PopularCollector {
  return {
    userId: 'u-abc',
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
    followersCount: 42,
    watchCount: 0,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PopularCollectors', () => {
  it('Test 1 — renders 5 rows with heading + See all link to /explore/collectors', async () => {
    mockedDal.mockResolvedValueOnce([
      makeCollector({ userId: 'u-1', username: 'a' }),
      makeCollector({ userId: 'u-2', username: 'b' }),
      makeCollector({ userId: 'u-3', username: 'c' }),
      makeCollector({ userId: 'u-4', username: 'd' }),
      makeCollector({ userId: 'u-5', username: 'e' }),
    ])
    const tree = await PopularCollectors({ viewerId: 'v1' })
    render(tree as React.ReactElement)
    expect(screen.getByText('Popular collectors')).toBeTruthy()
    const seeAll = screen.getByText('See all')
    expect(seeAll.closest('a')?.getAttribute('href')).toBe('/explore/collectors')
    // 5 follow buttons mean 5 rows rendered
    expect(screen.getAllByTestId(/follow-button-/).length).toBe(5)
  })

  it('Test 2 — returns null when DAL returns empty array', async () => {
    mockedDal.mockResolvedValueOnce([])
    const tree = await PopularCollectors({ viewerId: 'v1' })
    expect(tree).toBeNull()
  })

  it('Test 3 — sublabel uses singular "1 follower" when followersCount === 1', async () => {
    mockedDal.mockResolvedValueOnce([
      makeCollector({ userId: 'u-1', followersCount: 1, watchCount: 0 }),
    ])
    const tree = await PopularCollectors({ viewerId: 'v1' })
    render(tree as React.ReactElement)
    expect(screen.getByText('1 follower')).toBeTruthy()
  })

  it('Test 4 — sublabel uses plural "{N} followers" for N !== 1', async () => {
    mockedDal.mockResolvedValueOnce([
      makeCollector({ userId: 'u-1', followersCount: 42, watchCount: 0 }),
    ])
    const tree = await PopularCollectors({ viewerId: 'v1' })
    render(tree as React.ReactElement)
    expect(screen.getByText('42 followers')).toBeTruthy()
  })

  it('Test 5 — appends "· {N} watches" tertiary stat when watchCount > 0', async () => {
    mockedDal.mockResolvedValueOnce([
      makeCollector({ userId: 'u-1', followersCount: 5, watchCount: 3 }),
    ])
    const tree = await PopularCollectors({ viewerId: 'v1' })
    render(tree as React.ReactElement)
    // Combined sublabel: "5 followers · 3 watches"
    expect(screen.getByText(/5 followers/)).toBeTruthy()
    expect(screen.getByText(/3 watches/)).toBeTruthy()
  })
})
