import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Phase 19 Plan 04 RED — CollectionSearchRow contract per UI-SPEC lines 114-127,
// 202-205 (match-summary copy matrix), and CONTEXT.md D-11 (matched-watch
// cluster + matched-tag pills as the match signal).
//
// Covers: whole-row link, HighlightedText on displayName + username fallback,
// match-summary matrix (4 cases), matched-watch cluster cap (3), aria-label
// announcement (SRCH-15), responsive hidden sm:flex, conditional matched-tag
// pills, no inline CTA (Collections row has no Evaluate / Follow button).
// ---------------------------------------------------------------------------

// next/link stub — render as plain <a>
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

import { CollectionSearchRow } from '@/components/search/CollectionSearchRow'
import type { SearchCollectionResult } from '@/lib/searchTypes'

const baseResult: SearchCollectionResult = {
  userId: 'u-tyler',
  username: 'tyler',
  displayName: 'Tyler',
  avatarUrl: null,
  matchCount: 1,
  tasteOverlap: 0.5,
  matchedWatches: [
    { watchId: 'w1', brand: 'Omega', model: 'Speedmaster', imageUrl: null, matchPath: 'name' },
  ],
  matchedTags: [],
}

describe('CollectionSearchRow (SRCH-11, SRCH-15, D-11)', () => {
  it('Test 1 — whole-row Link targets /u/{username}/collection', () => {
    const { container } = render(<CollectionSearchRow result={baseResult} q="ty" />)
    const link = container.querySelector('a[href="/u/tyler/collection"]')
    expect(link).toBeTruthy()
  })

  it('Test 2 — HighlightedText wraps displayName for q', () => {
    render(<CollectionSearchRow result={baseResult} q="ty" />)
    const strong = screen.getByText('Ty', { selector: 'strong' })
    expect(strong).toBeInTheDocument()
  })

  it('Test 3 — falls back to username when displayName is null', () => {
    render(<CollectionSearchRow result={{ ...baseResult, displayName: null }} q="ty" />)
    expect(screen.getByText(/tyler/, { selector: 'strong, p' })).toBeInTheDocument()
  })

  it('Test 4a — match-summary "owns {brand} {model}" for 1 name-match', () => {
    render(<CollectionSearchRow result={baseResult} q="speed" />)
    expect(screen.getByText(/owns Omega Speedmaster$/)).toBeInTheDocument()
  })

  it('Test 4b — match-summary "owns {brand} {model} + {N-1} more" for N name-matches', () => {
    const r: SearchCollectionResult = {
      ...baseResult,
      matchCount: 3,
      matchedWatches: [
        { watchId: 'w1', brand: 'Omega', model: 'Speedmaster', imageUrl: null, matchPath: 'name' },
        { watchId: 'w2', brand: 'Omega', model: 'Seamaster', imageUrl: null, matchPath: 'name' },
        { watchId: 'w3', brand: 'Omega', model: 'Constellation', imageUrl: null, matchPath: 'name' },
      ],
    }
    render(<CollectionSearchRow result={r} q="omega" />)
    expect(screen.getByText(/owns Omega Speedmaster \+ 2 more/)).toBeInTheDocument()
  })

  it('Test 4c — match-summary "{matchCount} matching watches" for tag-only', () => {
    const r: SearchCollectionResult = {
      ...baseResult,
      matchCount: 4,
      matchedWatches: [
        { watchId: 'w1', brand: 'Seiko', model: 'X', imageUrl: null, matchPath: 'tag' },
        { watchId: 'w2', brand: 'Seiko', model: 'Y', imageUrl: null, matchPath: 'tag' },
      ],
      matchedTags: ['tool'],
    }
    render(<CollectionSearchRow result={r} q="tool" />)
    expect(screen.getByText(/4 matching watches/)).toBeInTheDocument()
  })

  it('Test 4d — match-summary "{matchCount} matches" for mixed name+tag', () => {
    const r: SearchCollectionResult = {
      ...baseResult,
      matchCount: 5,
      matchedWatches: [
        { watchId: 'w1', brand: 'Omega', model: 'Speedmaster', imageUrl: null, matchPath: 'name' },
        { watchId: 'w2', brand: 'Seiko', model: 'X', imageUrl: null, matchPath: 'tag' },
      ],
      matchedTags: ['tool'],
    }
    render(<CollectionSearchRow result={r} q="speed" />)
    expect(screen.getByText(/5 matches/)).toBeInTheDocument()
  })

  it('Test 5 — matched-watch cluster caps at 3 thumbs even with N>3', () => {
    const r: SearchCollectionResult = {
      ...baseResult,
      matchedWatches: Array.from({ length: 5 }, (_, i) => ({
        watchId: `w${i}`,
        brand: 'B',
        model: `M${i}`,
        imageUrl: null,
        matchPath: 'name' as const,
      })),
      matchCount: 5,
    }
    const { container } = render(<CollectionSearchRow result={r} q="b" />)
    // Each thumb is a fixed-class div containing an svg (icon fallback) or img
    const thumbs = container.querySelectorAll('.size-10.md\\:size-12.rounded-full')
    expect(thumbs.length).toBeLessThanOrEqual(3)
  })

  it('Test 6 — matched-tag pills shown when matchedTags is non-empty', () => {
    const r = { ...baseResult, matchedTags: ['tool', 'sport'] }
    render(<CollectionSearchRow result={r} q="tool" />)
    expect(screen.getByText('tool')).toBeInTheDocument()
    expect(screen.getByText('sport')).toBeInTheDocument()
  })

  it('Test 7 — no matched-tag pills when matchedTags is empty', () => {
    render(<CollectionSearchRow result={baseResult} q="ty" />)
    expect(screen.queryByText('tool')).not.toBeInTheDocument()
  })

  it('Test 8 — matched-watch thumb has aria-label with brand and model (SRCH-15 / UI-SPEC line 124)', () => {
    const r: SearchCollectionResult = {
      ...baseResult,
      matchedWatches: [
        { watchId: 'w1', brand: 'Omega', model: 'Speedmaster', imageUrl: null, matchPath: 'name' },
      ],
      matchCount: 1,
    }
    const { container } = render(<CollectionSearchRow result={r} q="speed" />)
    const labelled = container.querySelector('[aria-label="Omega Speedmaster"]')
    expect(labelled).toBeTruthy()
  })

  it('Test 9 — cluster has hidden sm:flex responsive classes', () => {
    const r = {
      ...baseResult,
      matchCount: 2,
      matchedWatches: [
        { watchId: 'w1', brand: 'O', model: 'S', imageUrl: null, matchPath: 'name' as const },
      ],
    }
    const { container } = render(<CollectionSearchRow result={r} q="o" />)
    const cluster = container.querySelector('.hidden.sm\\:flex')
    expect(cluster).toBeTruthy()
  })

  it('Test 10 — no Evaluate or Follow CTA on Collections row', () => {
    render(<CollectionSearchRow result={baseResult} q="ty" />)
    expect(screen.queryByText('Evaluate')).not.toBeInTheDocument()
    expect(screen.queryByText('Follow')).not.toBeInTheDocument()
    expect(screen.queryByText('Following')).not.toBeInTheDocument()
  })
})
