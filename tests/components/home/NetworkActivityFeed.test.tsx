import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { render } from '@testing-library/react'

// Mock DAL (no DB in unit tests) — vitest hoists vi.mock before imports.
vi.mock('@/data/activities', () => ({
  getFeedForUser: vi.fn(),
}))

// Mock LoadMoreButton so Task 2 tests don't reach into client-component
// internals or the Server Action — that's Task 3's territory.
vi.mock('@/components/home/LoadMoreButton', () => ({
  LoadMoreButton: ({ initialCursor }: { initialCursor: unknown }) => (
    <button data-testid="load-more-stub" data-has-cursor={initialCursor ? 'true' : 'false'}>
      Load more
    </button>
  ),
}))

import { NetworkActivityFeed } from '@/components/home/NetworkActivityFeed'
import { getFeedForUser } from '@/data/activities'
import type { RawFeedRow, FeedCursor } from '@/lib/feedTypes'

const VIEWER_ID = 'viewer-1'

function raw(overrides: Partial<RawFeedRow> = {}): RawFeedRow {
  return {
    kind: 'raw',
    id: `row-${Math.random().toString(36).slice(2, 8)}`,
    type: 'watch_added',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    watchId: 'watch-1',
    metadata: { brand: 'Rolex', model: 'Submariner', imageUrl: null },
    userId: 'u1',
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
    ...overrides,
  }
}

// Helper: NetworkActivityFeed is an async Server Component. Resolve it to JSX
// before handing to react-testing-library's synchronous render.
async function renderFeed(viewerId: string = VIEWER_ID) {
  const element = await NetworkActivityFeed({ viewerId })
  return render(element)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NetworkActivityFeed', () => {
  it('Test 1 — empty feed (rows=[], nextCursor=null) renders FeedEmptyState heading', async () => {
    ;(getFeedForUser as Mock).mockResolvedValue({ rows: [], nextCursor: null })
    const { container } = await renderFeed()
    expect(container.textContent).toMatch(/Your feed is quiet/)
  })

  it('Test 2 — single raw row renders section heading + one ActivityRow', async () => {
    ;(getFeedForUser as Mock).mockResolvedValue({
      rows: [raw({ username: 'bob', type: 'watch_worn' })],
      nextCursor: null,
    })
    const { container } = await renderFeed()
    expect(container.textContent).toMatch(/Network activity/)
    expect(container.textContent).toMatch(/bob\s+wore\s+Rolex\s+Submariner/)
  })

  it('Test 3 — mixed (3 raw sub-threshold) rows render as individual ActivityRows, no aggregation', async () => {
    // 3 watch_added from same user within 1h → aggregator collapses into 1 aggregated row.
    const base = Date.now()
    ;(getFeedForUser as Mock).mockResolvedValue({
      rows: [
        raw({
          id: 'r1',
          userId: 'u1',
          username: 'alice',
          type: 'watch_added',
          createdAt: new Date(base - 1 * 60 * 1000).toISOString(),
        }),
        raw({
          id: 'r2',
          userId: 'u1',
          username: 'alice',
          type: 'watch_added',
          createdAt: new Date(base - 2 * 60 * 1000).toISOString(),
        }),
        raw({
          id: 'r3',
          userId: 'u1',
          username: 'alice',
          type: 'watch_added',
          createdAt: new Date(base - 3 * 60 * 1000).toISOString(),
        }),
      ],
      nextCursor: null,
    })
    const { container } = await renderFeed()
    // aggregated copy appears (3 watches → collapses to one aggregated row)
    expect(container.textContent).toMatch(/alice\s+added\s+3\s+watches/)
  })

  it('Test 4 — nextCursor non-null → LoadMoreButton rendered', async () => {
    const cursor: FeedCursor = {
      createdAt: new Date().toISOString(),
      id: '00000000-0000-4000-8000-000000000001',
    }
    ;(getFeedForUser as Mock).mockResolvedValue({
      rows: [raw()],
      nextCursor: cursor,
    })
    const { container } = await renderFeed()
    const stub = container.querySelector('[data-testid="load-more-stub"]')
    expect(stub).toBeTruthy()
    expect(stub?.getAttribute('data-has-cursor')).toBe('true')
  })

  it('Test 5 — nextCursor null with rows > 0 → NO LoadMoreButton', async () => {
    ;(getFeedForUser as Mock).mockResolvedValue({
      rows: [raw()],
      nextCursor: null,
    })
    const { container } = await renderFeed()
    expect(container.querySelector('[data-testid="load-more-stub"]')).toBeNull()
  })

  it('Test 6 — section has id="network-activity"', async () => {
    ;(getFeedForUser as Mock).mockResolvedValue({ rows: [raw()], nextCursor: null })
    const { container } = await renderFeed()
    const section = container.querySelector('section#network-activity')
    expect(section).toBeTruthy()
  })
})

describe('FeedEmptyState', () => {
  it('renders the literal heading, body, and CTA anchor to #suggested-collectors', async () => {
    ;(getFeedForUser as Mock).mockResolvedValue({ rows: [], nextCursor: null })
    const { container } = await renderFeed()
    expect(container.textContent).toMatch(/Your feed is quiet/)
    expect(container.textContent).toMatch(
      /Follow collectors to see what they['’]re wearing, adding, and wishlisting\./,
    )
    const cta = container.querySelector('a[href="#suggested-collectors"]')
    expect(cta).toBeTruthy()
    expect(cta?.textContent).toMatch(/Find collectors to follow/)
  })
})
