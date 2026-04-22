import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'

// Mock the DAL before importing the component.
vi.mock('@/data/recommendations', () => ({
  getRecommendationsForViewer: vi.fn(),
}))

// next/cache: cacheLife is a no-op shim under vitest (no 'use cache' runtime).
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
}))

// next/link stub
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

// next/image stub
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

import { CollectorsLikeYou } from '@/components/home/CollectorsLikeYou'
import { getRecommendationsForViewer } from '@/data/recommendations'
import type { Recommendation } from '@/lib/discoveryTypes'

function rec(n: number): Recommendation {
  return {
    representativeWatchId: `w-${n}`,
    representativeOwnerId: `u-${n}`,
    brand: `Brand${n}`,
    model: `Model${n}`,
    imageUrl: null,
    ownershipCount: n,
    rationale: `Rationale ${n}`,
    score: 100 - n,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

async function renderAsync(element: Promise<React.ReactElement | null>) {
  const resolved = await element
  return render(resolved ?? <></>)
}

describe('CollectorsLikeYou', () => {
  it('Test 1 — empty recs: returns null (section hides)', async () => {
    vi.mocked(getRecommendationsForViewer).mockResolvedValueOnce([])
    const { container } = await renderAsync(
      CollectorsLikeYou({ viewerId: 'viewer-1' }),
    )
    // Nothing rendered — neither heading nor cards.
    expect(container.textContent ?? '').not.toMatch(/From collectors like you/)
  })

  it('Test 2 — 3 recs: renders 3 RecommendationCards', async () => {
    vi.mocked(getRecommendationsForViewer).mockResolvedValueOnce([
      rec(1),
      rec(2),
      rec(3),
    ])
    const { container } = await renderAsync(
      CollectorsLikeYou({ viewerId: 'viewer-1' }),
    )
    expect(container.querySelectorAll('a[href^="/watch/w-"]').length).toBe(3)
  })

  it('Test 3 — section heading exactly "From collectors like you"', async () => {
    vi.mocked(getRecommendationsForViewer).mockResolvedValueOnce([rec(1)])
    await renderAsync(CollectorsLikeYou({ viewerId: 'viewer-1' }))
    expect(screen.getByText('From collectors like you')).toBeTruthy()
  })

  it('Test 4 — passes viewerId through to DAL', async () => {
    vi.mocked(getRecommendationsForViewer).mockResolvedValueOnce([])
    await renderAsync(CollectorsLikeYou({ viewerId: 'viewer-abc-123' }))
    expect(getRecommendationsForViewer).toHaveBeenCalledWith('viewer-abc-123')
  })
})

// Static source-file checks — Pitfall 7 mitigation (viewerId as arg, not closure).
describe('CollectorsLikeYou — source integrity', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/components/home/CollectorsLikeYou.tsx'),
    'utf8',
  )

  it("Test 5 — contains literal 'use cache' directive", () => {
    expect(source).toMatch(/'use cache'/)
  })

  it("Test 6 — contains literal cacheLife('minutes')", () => {
    expect(source).toMatch(/cacheLife\('minutes'\)/)
  })

  it('Test 7 — accepts { viewerId }: { viewerId: string } prop', () => {
    expect(source).toMatch(/viewerId \}: \{ viewerId: string \}/)
  })

  it('Test 8 — does NOT call getCurrentUser (Pitfall 7 — viewerId must flow as a prop)', () => {
    expect(source).not.toMatch(/getCurrentUser/)
  })
})
