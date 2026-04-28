import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

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

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/data/discovery', () => ({
  getTrendingCatalogWatches: vi.fn(),
  getGainingTractionCatalogWatches: vi.fn(),
}))

// Stub the card; assert presence + sublabel.
vi.mock('@/components/explore/DiscoveryWatchCard', () => ({
  DiscoveryWatchCard: ({
    watch,
    sublabel,
  }: {
    watch: { id: string; brand: string; model: string }
    sublabel: React.ReactNode
  }) => (
    <div data-testid={`card-${watch.id}`} data-sublabel={String(sublabel)}>
      {watch.brand} {watch.model}
      <span data-testid={`sublabel-${watch.id}`}>{sublabel}</span>
    </div>
  ),
}))

import WatchesSeeAllPage from '@/app/explore/watches/page'
import { getCurrentUser } from '@/lib/auth'
import {
  getTrendingCatalogWatches,
  getGainingTractionCatalogWatches,
} from '@/data/discovery'
import type { TrendingWatch, GainingTractionWatch } from '@/data/discovery'

const mockedGetCurrentUser = vi.mocked(getCurrentUser)
const mockedTrending = vi.mocked(getTrendingCatalogWatches)
const mockedGaining = vi.mocked(getGainingTractionCatalogWatches)

function makeTrending(i: number, owners = 10): TrendingWatch {
  return {
    id: `t-${i}`,
    brand: `Brand${i}`,
    model: `Model${i}`,
    reference: null,
    imageUrl: null,
    ownersCount: owners,
    wishlistCount: 0,
  }
}

function makeGaining(i: number, delta = 5): GainingTractionWatch {
  return {
    id: `g-${i}`,
    brand: `GBrand${i}`,
    model: `GModel${i}`,
    reference: null,
    imageUrl: null,
    delta,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetCurrentUser.mockResolvedValue({ id: 'v1', email: 'v1@example.com' })
})

describe('WatchesSeeAllPage', () => {
  it('Test 1 — renders both sections + h1 when both DALs return non-empty', async () => {
    mockedTrending.mockResolvedValueOnce([makeTrending(1, 50), makeTrending(2, 25)])
    mockedGaining.mockResolvedValueOnce({
      window: 7,
      watches: [makeGaining(1, 12)],
    })

    const tree = await WatchesSeeAllPage()
    render(tree as React.ReactElement)

    expect(screen.getByText('Trending & gaining traction')).toBeTruthy()
    expect(screen.getByText('Trending')).toBeTruthy()
    expect(screen.getByText('Gaining traction')).toBeTruthy()
  })

  it('Test 2 — Trending section uses limit 50', async () => {
    mockedTrending.mockResolvedValueOnce([])
    mockedGaining.mockResolvedValueOnce({ window: 0, watches: [] })

    await WatchesSeeAllPage()

    expect(mockedTrending).toHaveBeenCalledTimes(1)
    expect(mockedTrending).toHaveBeenCalledWith({ limit: 50 })
  })

  it('Test 3 — Gaining Traction section uses limit 50', async () => {
    mockedTrending.mockResolvedValueOnce([])
    mockedGaining.mockResolvedValueOnce({ window: 0, watches: [] })

    await WatchesSeeAllPage()

    expect(mockedGaining).toHaveBeenCalledTimes(1)
    expect(mockedGaining).toHaveBeenCalledWith({ limit: 50 })
  })

  it('Test 4 — Trending at cap shows footer "Showing top 50 watches."', async () => {
    const fifty = Array.from({ length: 50 }, (_, i) => makeTrending(i, 50 - i))
    mockedTrending.mockResolvedValueOnce(fifty)
    mockedGaining.mockResolvedValueOnce({
      window: 7,
      watches: [makeGaining(1, 12)],
    })

    const tree = await WatchesSeeAllPage()
    render(tree as React.ReactElement)

    expect(screen.getAllByText('Showing top 50 watches.').length).toBeGreaterThanOrEqual(1)
  })

  it('Test 5 — Gaining Traction window=0 empty-state with Trending populated', async () => {
    mockedTrending.mockResolvedValueOnce([makeTrending(1, 5), makeTrending(2, 3)])
    mockedGaining.mockResolvedValueOnce({ window: 0, watches: [] })

    const tree = await WatchesSeeAllPage()
    render(tree as React.ReactElement)

    // Trending section renders normally
    expect(screen.getByText('Trending')).toBeTruthy()
    expect(screen.getByTestId('card-t-1')).toBeTruthy()
    // Gaining Traction shows "Not enough data yet"
    expect(screen.getByText('Not enough data yet — check back in a few days.')).toBeTruthy()
  })

  it('Test 6 — full-page empty state when both empty + window=0', async () => {
    mockedTrending.mockResolvedValueOnce([])
    mockedGaining.mockResolvedValueOnce({ window: 0, watches: [] })

    const tree = await WatchesSeeAllPage()
    render(tree as React.ReactElement)

    expect(screen.getByText("Nothing's catching fire yet.")).toBeTruthy()
    expect(
      screen.getByText('As more collectors save watches, this list comes alive.'),
    ).toBeTruthy()
  })

  it('Test 7 — Gaining Traction window=7 sublabel "↑ +12 this week"', async () => {
    mockedTrending.mockResolvedValueOnce([])
    mockedGaining.mockResolvedValueOnce({
      window: 7,
      watches: [makeGaining(1, 12)],
    })

    const tree = await WatchesSeeAllPage()
    render(tree as React.ReactElement)

    expect(screen.getByText('↑ +12 this week')).toBeTruthy()
  })

  it('Test 8 — Gaining Traction window=3 sublabel "↑ +5 in 3 days"', async () => {
    mockedTrending.mockResolvedValueOnce([])
    mockedGaining.mockResolvedValueOnce({
      window: 3,
      watches: [makeGaining(1, 5)],
    })

    const tree = await WatchesSeeAllPage()
    render(tree as React.ReactElement)

    expect(screen.getByText('↑ +5 in 3 days')).toBeTruthy()
  })
})
