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
  getGainingTractionCatalogWatches: vi.fn(),
}))

import { GainingTractionWatches } from '@/components/explore/GainingTractionWatches'
import { getGainingTractionCatalogWatches } from '@/data/discovery'
import type { GainingTractionWatch } from '@/data/discovery'

const mockedDal = vi.mocked(getGainingTractionCatalogWatches)

function makeWatch(overrides: Partial<GainingTractionWatch> = {}): GainingTractionWatch {
  return {
    id: 'w-abc',
    brand: 'Omega',
    model: 'Speedmaster',
    reference: null,
    imageUrl: null,
    delta: 5,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GainingTractionWatches', () => {
  it('Test 1 — window=0 renders empty-state copy + heading; no See all link', async () => {
    mockedDal.mockResolvedValueOnce({ window: 0, watches: [] })
    const tree = await GainingTractionWatches()
    render(tree as React.ReactElement)
    expect(screen.getByText('Gaining traction')).toBeTruthy()
    expect(screen.getByText('Not enough data yet — check back in a few days.')).toBeTruthy()
    expect(screen.queryByText('See all')).toBeNull()
  })

  it('Test 2 — window=7 sublabel uses "↑ +{delta} this week"', async () => {
    mockedDal.mockResolvedValueOnce({
      window: 7,
      watches: [makeWatch({ id: 'w-1', delta: 12 })],
    })
    const tree = await GainingTractionWatches()
    render(tree as React.ReactElement)
    expect(screen.getByText('↑ +12 this week')).toBeTruthy()
  })

  it('Test 3 — window=3 sublabel uses "↑ +{delta} in 3 days"', async () => {
    mockedDal.mockResolvedValueOnce({
      window: 3,
      watches: [makeWatch({ id: 'w-1', delta: 5 })],
    })
    const tree = await GainingTractionWatches()
    render(tree as React.ReactElement)
    expect(screen.getByText('↑ +5 in 3 days')).toBeTruthy()
  })

  it('Test 4 — window=1 sublabel uses singular "↑ +{delta} in 1 day"', async () => {
    mockedDal.mockResolvedValueOnce({
      window: 1,
      watches: [makeWatch({ id: 'w-1', delta: 1 })],
    })
    const tree = await GainingTractionWatches()
    render(tree as React.ReactElement)
    expect(screen.getByText('↑ +1 in 1 day')).toBeTruthy()
  })

  it('Test 5 — TrendingUp icon present alongside "Gaining traction" heading', async () => {
    mockedDal.mockResolvedValueOnce({
      window: 7,
      watches: [makeWatch({ id: 'w-1', delta: 9 })],
    })
    const tree = await GainingTractionWatches()
    const { container } = render(tree as React.ReactElement)
    expect(screen.getByText('Gaining traction')).toBeTruthy()
    // lucide-react renders an <svg> for each icon; the heading <h2> contains
    // a TrendingUp svg child.
    const heading = screen.getByText('Gaining traction').closest('h2')
    expect(heading).toBeTruthy()
    expect(heading?.querySelector('svg')).toBeTruthy()
    // Sanity: the See all link IS rendered when window >= 1 with watches.
    expect(container.querySelector('a[href="/explore/watches"]')).toBeTruthy()
  })
})
