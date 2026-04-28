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

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

vi.mock('@/data/discovery', () => ({
  getTrendingCatalogWatches: vi.fn(),
}))

import { TrendingWatches } from '@/components/explore/TrendingWatches'
import { getTrendingCatalogWatches } from '@/data/discovery'
import type { TrendingWatch } from '@/data/discovery'

const mockedDal = vi.mocked(getTrendingCatalogWatches)

function makeWatch(overrides: Partial<TrendingWatch> = {}): TrendingWatch {
  return {
    id: 'w-abc',
    brand: 'Rolex',
    model: 'Submariner',
    reference: null,
    imageUrl: null,
    ownersCount: 10,
    wishlistCount: 0,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TrendingWatches', () => {
  it('Test 1 — renders Trending heading + See all link to /explore/watches', async () => {
    mockedDal.mockResolvedValueOnce([
      makeWatch({ id: 'w-1', ownersCount: 50 }),
      makeWatch({ id: 'w-2', ownersCount: 25 }),
      makeWatch({ id: 'w-3', ownersCount: 12 }),
    ])
    const tree = await TrendingWatches()
    render(tree as React.ReactElement)
    expect(screen.getByText('Trending')).toBeTruthy()
    const seeAll = screen.getByText('See all')
    expect(seeAll.closest('a')?.getAttribute('href')).toBe('/explore/watches')
  })

  it('Test 2 — sublabel uses singular "1 collector" and plural "{N} collectors"', async () => {
    mockedDal.mockResolvedValueOnce([
      makeWatch({ id: 'w-1', ownersCount: 1 }),
      makeWatch({ id: 'w-2', ownersCount: 42 }),
    ])
    const tree = await TrendingWatches()
    render(tree as React.ReactElement)
    expect(screen.getByText('· 1 collector')).toBeTruthy()
    expect(screen.getByText('· 42 collectors')).toBeTruthy()
  })

  it('Test 3 — returns null when DAL returns empty array', async () => {
    mockedDal.mockResolvedValueOnce([])
    const tree = await TrendingWatches()
    expect(tree).toBeNull()
  })

  it('Test 4 — renders snap-start cards for each watch', async () => {
    mockedDal.mockResolvedValueOnce([
      makeWatch({ id: 'w-1' }),
      makeWatch({ id: 'w-2' }),
    ])
    const tree = await TrendingWatches()
    const { container } = render(tree as React.ReactElement)
    expect(container.querySelectorAll('.snap-start').length).toBe(2)
  })
})
