import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

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

import { RecommendationCard } from '@/components/home/RecommendationCard'
import type { Recommendation } from '@/lib/discoveryTypes'

function makeRec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    representativeWatchId: 'w-rec-1',
    representativeOwnerId: 'u-seed-1',
    brand: 'Omega',
    model: 'Speedmaster',
    imageUrl: 'https://example.com/speedy.jpg',
    ownershipCount: 3,
    rationale: 'Fans of Omega love this',
    score: 150,
    ...overrides,
  }
}

describe('RecommendationCard', () => {
  it('Test 1 — renders brand, model, rationale, and card href', () => {
    const { container } = render(<RecommendationCard rec={makeRec()} />)
    expect(screen.getByText('Omega')).toBeTruthy()
    expect(screen.getByText('Speedmaster')).toBeTruthy()
    expect(screen.getByText('Fans of Omega love this')).toBeTruthy()
    const link = container.querySelector('a[href="/watch/w-rec-1"]')
    expect(link).toBeTruthy()
  })

  it('Test 2 — imageUrl null renders WatchIcon fallback (no <img>)', () => {
    const { container } = render(
      <RecommendationCard rec={makeRec({ imageUrl: null })} />,
    )
    const imgs = container.querySelectorAll('img')
    expect(imgs.length).toBe(0)
    // Presence of the svg fallback
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
  })

  it('Test 3 — imageUrl present renders <img> with alt text', () => {
    const { container } = render(<RecommendationCard rec={makeRec()} />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('alt')).toBe('Omega Speedmaster')
  })

  it('Test 4 — card uses w-40 md:w-44 and aspect-[4/5]', () => {
    const { container } = render(<RecommendationCard rec={makeRec()} />)
    const link = container.querySelector('a[href="/watch/w-rec-1"]')
    expect(link?.className ?? '').toMatch(/w-40/)
    expect(link?.className ?? '').toMatch(/md:w-44/)
    const imgBox = container.querySelector('.aspect-\\[4\\/5\\]')
    expect(imgBox).toBeTruthy()
  })

  it('Test 5 — aria-label is "{brand} {model}"', () => {
    const { container } = render(<RecommendationCard rec={makeRec()} />)
    const link = container.querySelector('a[href="/watch/w-rec-1"]')
    expect(link?.getAttribute('aria-label')).toBe('Omega Speedmaster')
  })
})
