// src/data/__tests__/reactions-comments-gate.test.ts
// Phase 54 Wave 0 — mocked-db unit tests for isMutualFollow + canViewerCommentOnTarget
// gate branches + getLikesForTarget null-coalesce handling.
//
// Mirror the vi.mock('@/db') scaffold from watches-leftjoin.test.ts.
// The DAL functions imported here do NOT exist yet (Wave 1/2 create them)
// → suite is RED until implementation lands. That is the expected initial state.
//
// Pitfall 7: vitest.config.ts aliases 'server-only' to a no-op shim — no action needed.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock state — varied per test via `mockResolvedValue` in each `it` block.
// The mock chain shapes must match what the implementations will call:
//   isMutualFollow      → db.select().from().where()  (FILTER aggregate, no .limit())
//   canViewerCommentOnTarget → db.select().from().where().limit(1) for watch row,
//                              then calls isMutualFollow internally
//   getLikesForTarget   → db.select().from().where()  (aggregate, no .limit())
// ---------------------------------------------------------------------------

// We track calls so canViewerCommentOnTarget wear-short-circuit tests can assert
// the db mock was NOT called.
let selectCallCount = 0

// Terminal mock — resolves with whatever `mockRows` is at call time.
let mockRows: unknown[] = []

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => {
      selectCallCount++
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            // .limit(1) path — used by canViewerCommentOnTarget watch row fetch
            limit: vi.fn().mockImplementation(() => Promise.resolve(mockRows)),
            // also resolves directly for isMutualFollow / getLikesForTarget (no limit())
            then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(mockRows).then(resolve),
          })),
        })),
      }
    }),
  },
}))

// Import AFTER mocking (Vitest hoists vi.mock to top automatically,
// but ESM ordering requires the import to be after the mock call in source).
import { isMutualFollow } from '@/data/follows'
import { canViewerCommentOnTarget } from '@/data/comments'
import { getLikesForTarget } from '@/data/reactions'

beforeEach(() => {
  mockRows = []
  selectCallCount = 0
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// isMutualFollow — GATE-05
//
// The implementation queries follows with two FILTER aggregates:
//   aToB: count(*) FILTER (WHERE followerId = userA AND followingId = userB)
//   bToA: count(*) FILTER (WHERE followerId = userB AND followingId = userA)
// Returns true only when both >= 1.
// ---------------------------------------------------------------------------
describe('isMutualFollow (GATE-05)', () => {
  it('returns false when only A→B follow exists (bToA = 0) — one-way follow', async () => {
    // Aggregate row: aToB >= 1, bToA = 0
    mockRows = [{ aToB: 1, bToA: 0 }]
    const result = await isMutualFollow('userA', 'userB')
    expect(result).toBe(false)
  })

  it('returns true when both A→B and B→A exist — mutual follow', async () => {
    // Aggregate row: both directions present
    mockRows = [{ aToB: 1, bToA: 1 }]
    const result = await isMutualFollow('userA', 'userB')
    expect(result).toBe(true)
  })

  it('returns false when mockRows is empty (no follow rows at all)', async () => {
    mockRows = []
    const result = await isMutualFollow('userA', 'userB')
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// canViewerCommentOnTarget — GATE-01 + GATE-04 + GATE-05 + Pitfall 2
// ---------------------------------------------------------------------------
describe('canViewerCommentOnTarget', () => {
  it('wear target: returns true immediately WITHOUT touching the db mock (Pitfall 2)', async () => {
    const countBefore = selectCallCount
    const result = await canViewerCommentOnTarget('viewer-id', { type: 'wear', id: 'wear-event-id' })
    expect(result).toBe(true)
    // The implementation must short-circuit before any DB call for wear targets.
    expect(selectCallCount).toBe(countBefore) // no select call made
  })

  it('watch-not-found: returns false when the watch row does not exist (fail closed)', async () => {
    mockRows = [] // no watch row returned
    const result = await canViewerCommentOnTarget('viewer-id', { type: 'watch', id: 'missing-watch-id' })
    expect(result).toBe(false)
  })

  it('owner bypass: returns true when viewerId === watch.userId (GATE-04)', async () => {
    const ownerId = 'owner-user-id'
    // First mock call (watch row) returns this row. No isMutualFollow call needed.
    mockRows = [{ userId: ownerId, status: 'wishlist' }]
    const result = await canViewerCommentOnTarget(ownerId, { type: 'watch', id: 'watch-id' })
    expect(result).toBe(true)
  })

  it('non-wishlist (owned): returns true for any authenticated viewer (GATE-01 open)', async () => {
    mockRows = [{ userId: 'owner-user-id', status: 'owned' }]
    const result = await canViewerCommentOnTarget('other-viewer', { type: 'watch', id: 'watch-id' })
    expect(result).toBe(true)
  })

  it('non-wishlist (sold): returns true for any authenticated viewer', async () => {
    mockRows = [{ userId: 'owner-user-id', status: 'sold' }]
    const result = await canViewerCommentOnTarget('other-viewer', { type: 'watch', id: 'watch-id' })
    expect(result).toBe(true)
  })

  it('non-wishlist (grail): returns true for any authenticated viewer', async () => {
    mockRows = [{ userId: 'owner-user-id', status: 'grail' }]
    const result = await canViewerCommentOnTarget('other-viewer', { type: 'watch', id: 'watch-id' })
    expect(result).toBe(true)
  })

  it('wishlist + mutual follow: returns true (GATE-05)', async () => {
    // Watch row fetch: wishlist watch belonging to owner
    // isMutualFollow aggregate: both directions present
    // The mock resolves mockRows on every call, so we need to chain two calls.
    // First call (watch row) returns the wishlist watch; second call (follows aggregate)
    // returns the mutual follow rows. We use a call counter to alternate.
    let callIndex = 0
    const watchRow = [{ userId: 'owner-user-id', status: 'wishlist' }]
    const mutualRow = [{ aToB: 1, bToA: 1 }]

    // Override mockRows to return different values per call
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { db } = await import('@/db')
    ;(db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callIndex++
      const rows = callIndex === 1 ? watchRow : mutualRow
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(rows)),
            then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
          })),
        })),
      }
    })

    const result = await canViewerCommentOnTarget('viewer-id', { type: 'watch', id: 'watch-id' })
    expect(result).toBe(true)
  })

  it('wishlist + non-mutual: returns false (GATE-01 gate blocks)', async () => {
    let callIndex = 0
    const watchRow = [{ userId: 'owner-user-id', status: 'wishlist' }]
    const oneWayRow = [{ aToB: 1, bToA: 0 }] // only A→B

    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { db } = await import('@/db')
    ;(db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callIndex++
      const rows = callIndex === 1 ? watchRow : oneWayRow
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(rows)),
            then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
          })),
        })),
      }
    })

    const result = await canViewerCommentOnTarget('viewer-id', { type: 'watch', id: 'watch-id' })
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getLikesForTarget — Pitfall 1 (bool_or + count null-coalesce)
// ---------------------------------------------------------------------------
describe('getLikesForTarget (Pitfall 1 null-coalesce)', () => {
  it('viewerHasLiked defaults to false when aggregate row is empty (no likes)', async () => {
    // Aggregate query over empty set — Postgres returns null for bool_or / count
    mockRows = [{ count: null, viewerHasLiked: null }]
    const result = await getLikesForTarget('viewer-id', { type: 'watch', id: 'watch-id' })
    expect(result.viewerHasLiked).toBe(false)
    expect(result.count).toBe(0)
  })

  it('viewerHasLiked defaults to false when mockRows is completely empty (no row returned)', async () => {
    mockRows = []
    const result = await getLikesForTarget('viewer-id', { type: 'watch', id: 'watch-id' })
    expect(result.viewerHasLiked).toBe(false)
    expect(result.count).toBe(0)
  })

  it('returns count and viewerHasLiked: true when viewer has liked', async () => {
    mockRows = [{ count: 3, viewerHasLiked: true }]
    const result = await getLikesForTarget('viewer-id', { type: 'watch', id: 'watch-id' })
    expect(result.count).toBe(3)
    expect(result.viewerHasLiked).toBe(true)
  })

  it('wear target: returns count and viewerHasLiked from wearLikes table', async () => {
    mockRows = [{ count: 1, viewerHasLiked: false }]
    const result = await getLikesForTarget('viewer-id', { type: 'wear', id: 'wear-event-id' })
    expect(result.count).toBe(1)
    expect(result.viewerHasLiked).toBe(false)
  })
})
