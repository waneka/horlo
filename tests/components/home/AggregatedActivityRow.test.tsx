import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { AggregatedActivityRow } from '@/components/home/AggregatedActivityRow'
import type { AggregatedRow } from '@/lib/feedTypes'

function makeAgg(overrides: Partial<AggregatedRow> = {}): AggregatedRow {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString()
  return {
    kind: 'aggregated',
    userId: 'user-alice',
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
    type: 'watch_added',
    count: 5,
    firstCreatedAt: fiveMinAgo,
    lastCreatedAt: twentyMinAgo,
    representativeMetadata: {
      brand: 'Rolex',
      model: 'Submariner',
      imageUrl: 'https://example.com/sub.jpg',
    },
    collapsedIds: ['r1', 'r2', 'r3', 'r4', 'r5'],
    ...overrides,
  }
}

describe('AggregatedActivityRow — copy (F-08)', () => {
  it('Test 11 — count=5 type=watch_added renders "alice added 5 watches"', () => {
    render(<AggregatedActivityRow row={makeAgg({ type: 'watch_added', count: 5 })} />)
    expect(document.body.textContent).toMatch(/alice\s+added\s+5\s+watches/)
  })

  it('Test 12 — count=3 type=wishlist_added renders "alice wishlisted 3 watches" (PLANNER DECISION)', () => {
    render(
      <AggregatedActivityRow row={makeAgg({ type: 'wishlist_added', count: 3 })} />,
    )
    expect(document.body.textContent).toMatch(/alice\s+wishlisted\s+3\s+watches/)
  })
})

describe('AggregatedActivityRow — time-ago', () => {
  it('Test 13 — displays timeAgo(firstCreatedAt) (most-recent row in the group)', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    render(
      <AggregatedActivityRow
        row={makeAgg({
          firstCreatedAt: fiveMinAgo,
          lastCreatedAt: oneHourAgo,
        })}
      />,
    )
    // timeAgo(firstCreatedAt) = "5m", NOT "1h" (which would be lastCreatedAt).
    expect(screen.getByText('5m')).toBeTruthy()
    expect(screen.queryByText('1h')).toBeNull()
  })
})

describe('AggregatedActivityRow — representative thumbnail', () => {
  it('Test 14 — renders representativeMetadata.imageUrl in the thumbnail slot', () => {
    const { container } = render(
      <AggregatedActivityRow
        row={makeAgg({
          representativeMetadata: {
            brand: 'Omega',
            model: 'Speedmaster',
            imageUrl: 'https://example.com/speedy.jpg',
          },
        })}
      />,
    )
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('src')).toContain('speedy.jpg')
  })
})

describe('AggregatedActivityRow — accessibility', () => {
  it('Test 15 — aria-label is "{username} {verb} {N} watches. {timeAgo}. View profile."', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { container } = render(
      <AggregatedActivityRow
        row={makeAgg({
          username: 'alice',
          type: 'watch_added',
          count: 5,
          firstCreatedAt: fiveMinAgo,
        })}
      />,
    )
    const link = container.querySelector(
      'a[aria-label="alice added 5 watches. 5m. View profile."]',
    )
    expect(link).toBeTruthy()
  })
})

describe('AggregatedActivityRow — typographic emphasis', () => {
  it('Test 16 — username and numeric count are rendered with font-semibold', () => {
    const { container } = render(
      <AggregatedActivityRow row={makeAgg({ username: 'alice', count: 5 })} />,
    )
    // username span
    const usernameSpan = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === 'alice' && s.className.includes('font-semibold'),
    )
    expect(usernameSpan).toBeTruthy()
    // count span
    const countSpan = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === '5' && s.className.includes('font-semibold'),
    )
    expect(countSpan).toBeTruthy()
  })
})
