import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock all DAL + child components so the test is unit-scoped.
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))
vi.mock('@/data/profiles', () => ({
  getFollowerCounts: vi.fn(),
}))
vi.mock('@/data/wearEvents', () => ({
  getWearEventsCountByUser: vi.fn(),
}))
vi.mock('@/components/explore/ExploreHero', () => ({
  ExploreHero: () => <div data-testid="hero">hero</div>,
}))
vi.mock('@/components/explore/PopularCollectors', () => ({
  PopularCollectors: ({ viewerId }: { viewerId: string }) => (
    <div data-testid="popular" data-viewer={viewerId}>
      popular
    </div>
  ),
}))
vi.mock('@/components/explore/TrendingWatches', () => ({
  TrendingWatches: () => <div data-testid="trending">trending</div>,
}))
vi.mock('@/components/explore/GainingTractionWatches', () => ({
  GainingTractionWatches: () => <div data-testid="gaining">gaining</div>,
}))

import ExplorePage from '@/app/explore/page'
import { getCurrentUser } from '@/lib/auth'
import { getFollowerCounts } from '@/data/profiles'
import { getWearEventsCountByUser } from '@/data/wearEvents'

const mockedGetCurrentUser = vi.mocked(getCurrentUser)
const mockedGetFollowerCounts = vi.mocked(getFollowerCounts)
const mockedGetWearEventsCountByUser = vi.mocked(getWearEventsCountByUser)

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'u1@example.com' })
})

describe('ExplorePage', () => {
  it('Test 1 — sparse network (following<3 && wears<1) renders hero', async () => {
    mockedGetFollowerCounts.mockResolvedValueOnce({ followers: 0, following: 2 })
    mockedGetWearEventsCountByUser.mockResolvedValueOnce(0)

    const tree = await ExplorePage()
    render(tree as React.ReactElement)

    expect(screen.getByTestId('hero')).toBeTruthy()
    expect(screen.getByTestId('popular')).toBeTruthy()
    expect(screen.getByTestId('trending')).toBeTruthy()
    expect(screen.getByTestId('gaining')).toBeTruthy()
  })

  it('Test 2 — followingCount === 3 hides hero (rails still render)', async () => {
    mockedGetFollowerCounts.mockResolvedValueOnce({ followers: 0, following: 3 })
    mockedGetWearEventsCountByUser.mockResolvedValueOnce(0)

    const tree = await ExplorePage()
    render(tree as React.ReactElement)

    expect(screen.queryByTestId('hero')).toBeNull()
    expect(screen.getByTestId('popular')).toBeTruthy()
    expect(screen.getByTestId('trending')).toBeTruthy()
    expect(screen.getByTestId('gaining')).toBeTruthy()
  })

  it('Test 3 — wearEventsCount === 1 hides hero (rails still render)', async () => {
    mockedGetFollowerCounts.mockResolvedValueOnce({ followers: 0, following: 0 })
    mockedGetWearEventsCountByUser.mockResolvedValueOnce(1)

    const tree = await ExplorePage()
    render(tree as React.ReactElement)

    expect(screen.queryByTestId('hero')).toBeNull()
    expect(screen.getByTestId('popular')).toBeTruthy()
    expect(screen.getByTestId('trending')).toBeTruthy()
    expect(screen.getByTestId('gaining')).toBeTruthy()
  })

  it('Test 4 — rails render in fixed order Popular → Trending → Gaining (D-09)', async () => {
    mockedGetFollowerCounts.mockResolvedValueOnce({ followers: 0, following: 5 })
    mockedGetWearEventsCountByUser.mockResolvedValueOnce(2)

    const tree = await ExplorePage()
    const { container } = render(tree as React.ReactElement)

    const railNodes = container.querySelectorAll('[data-testid]')
    const ids = Array.from(railNodes).map((n) => n.getAttribute('data-testid'))
    // Filter to only the 3 rail testids (hero may or may not be present).
    const railOrder = ids.filter((id) => id === 'popular' || id === 'trending' || id === 'gaining')
    expect(railOrder).toEqual(['popular', 'trending', 'gaining'])
  })

  it('Test 5 — PopularCollectors receives viewerId prop = user.id', async () => {
    mockedGetFollowerCounts.mockResolvedValueOnce({ followers: 0, following: 5 })
    mockedGetWearEventsCountByUser.mockResolvedValueOnce(2)

    const tree = await ExplorePage()
    render(tree as React.ReactElement)

    expect(screen.getByTestId('popular').getAttribute('data-viewer')).toBe('u1')
  })

  it('Test 6 — Promise.all parallelism: both count fetches called once with user.id', async () => {
    mockedGetFollowerCounts.mockResolvedValueOnce({ followers: 0, following: 0 })
    mockedGetWearEventsCountByUser.mockResolvedValueOnce(0)

    await ExplorePage()

    expect(mockedGetFollowerCounts).toHaveBeenCalledTimes(1)
    expect(mockedGetFollowerCounts).toHaveBeenCalledWith('u1')
    expect(mockedGetWearEventsCountByUser).toHaveBeenCalledTimes(1)
    expect(mockedGetWearEventsCountByUser).toHaveBeenCalledWith('u1')
  })
})
