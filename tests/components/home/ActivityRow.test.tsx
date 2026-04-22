import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ActivityRow } from '@/components/home/ActivityRow'
import type { RawFeedRow } from '@/lib/feedTypes'

// Fixture base — each test overrides the fields it exercises.
function makeRow(overrides: Partial<RawFeedRow> = {}): RawFeedRow {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  return {
    kind: 'raw',
    id: 'row-1',
    type: 'watch_added',
    createdAt: fiveMinAgo,
    watchId: 'watch-123',
    metadata: {
      brand: 'Rolex',
      model: 'Submariner',
      imageUrl: 'https://example.com/sub.jpg',
    },
    userId: 'user-alice',
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
    ...overrides,
  }
}

describe('ActivityRow — verbs (F-02)', () => {
  it('Test 1 — watch_added renders "added" verb: "alice added Rolex Submariner"', () => {
    render(<ActivityRow row={makeRow({ type: 'watch_added' })} />)
    // username, verb, brand+model all present
    expect(screen.getByText('alice')).toBeTruthy()
    // Verb is rendered inline — use regex to match across spans.
    expect(document.body.textContent).toMatch(/alice\s+added\s+Rolex\s+Submariner/)
  })

  it('Test 2 — wishlist_added renders "wishlisted" verb', () => {
    render(<ActivityRow row={makeRow({ type: 'wishlist_added' })} />)
    expect(document.body.textContent).toMatch(/alice\s+wishlisted\s+Rolex\s+Submariner/)
  })

  it('Test 3 — watch_worn renders "wore" verb', () => {
    render(<ActivityRow row={makeRow({ type: 'watch_worn' })} />)
    expect(document.body.textContent).toMatch(/alice\s+wore\s+Rolex\s+Submariner/)
  })
})

describe('ActivityRow — time-ago', () => {
  it('Test 4 — createdAt ~5 minutes ago renders "5m"', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    render(<ActivityRow row={makeRow({ createdAt: fiveMinAgo })} />)
    expect(screen.getByText('5m')).toBeTruthy()
  })
})

describe('ActivityRow — links (F-03)', () => {
  it('Test 5 — avatar/row link routes to /u/{username}/collection', () => {
    const { container } = render(<ActivityRow row={makeRow({ username: 'alice' })} />)
    const profileLinks = container.querySelectorAll('a[href="/u/alice/collection"]')
    expect(profileLinks.length).toBeGreaterThanOrEqual(1)
  })

  it('Test 6 — watch name is wrapped in a separate <Link> to /watch/{watchId}', () => {
    const { container } = render(
      <ActivityRow row={makeRow({ watchId: 'watch-123' })} />,
    )
    const watchLink = container.querySelector('a[href="/watch/watch-123"]')
    expect(watchLink).toBeTruthy()
    expect(watchLink?.textContent).toMatch(/Rolex\s+Submariner/)
  })

  it('Test 7 — watchId null (post-delete fallback): watch-name text renders but is NOT wrapped in a <Link>', () => {
    const { container } = render(<ActivityRow row={makeRow({ watchId: null })} />)
    // No `/watch/...` href in the DOM.
    const watchLinks = container.querySelectorAll('a[href^="/watch/"]')
    expect(watchLinks.length).toBe(0)
    // But the watch name text is still present.
    expect(document.body.textContent).toMatch(/Rolex\s+Submariner/)
  })
})

describe('ActivityRow — thumbnail fallback (F-06 image)', () => {
  it('Test 8 — imageUrl null renders the lucide Watch icon fallback inside the thumbnail slot', () => {
    const { container } = render(
      <ActivityRow
        row={makeRow({
          metadata: { brand: 'Rolex', model: 'Submariner', imageUrl: null },
        })}
      />,
    )
    // Lucide icon → <svg> inside the size-12 thumb container.
    const thumbSlot = container.querySelector('.size-12, [class*="size-12"]')
    expect(thumbSlot).toBeTruthy()
    const svg = thumbSlot?.querySelector('svg')
    expect(svg).toBeTruthy()
    // No <img> should be rendered when imageUrl is null.
    expect(thumbSlot?.querySelector('img')).toBeNull()
  })
})

describe('ActivityRow — accessibility copy', () => {
  it('Test 9 — avatar/row link has aria-label "{username}\'s profile"', () => {
    const { container } = render(<ActivityRow row={makeRow({ username: 'alice' })} />)
    const profileLink = container.querySelector('a[aria-label="alice\'s profile"]')
    expect(profileLink).toBeTruthy()
  })

  it('Test 10 — watch-name link has aria-label "{brand} {model} detail"', () => {
    const { container } = render(<ActivityRow row={makeRow()} />)
    const watchLink = container.querySelector('a[aria-label="Rolex Submariner detail"]')
    expect(watchLink).toBeTruthy()
  })
})
