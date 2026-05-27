import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// ---------------------------------------------------------------------------
// Wave 0 scaffold — DISP-01 / D-10 leak guard (HIGH priority)
// Tests import getBatchedWatchCounts from @/data/reactions (Plan 03 creates it).
// ALL tests here are EXPECTED TO FAIL (RED) on current main because
// getBatchedWatchCounts does NOT exist yet in src/data/reactions.ts.
// ---------------------------------------------------------------------------

let callCount = 0
let calls: Array<{ op: string; args: unknown[] }> = []

// Multi-result mock: each db.select() call returns a different result
// based on a queue we set up per-test.
const mockResultQueue: unknown[][] = []

function makeSelectChain(result: unknown[]) {
  const chain: Record<string, (...args: unknown[]) => unknown> & {
    then: (resolve: (v: unknown[]) => void) => void
  } = {
    from: (...args: unknown[]) => {
      calls.push({ op: 'from', args })
      return chain
    },
    where: (...args: unknown[]) => {
      calls.push({ op: 'where', args })
      return chain
    },
    groupBy: (...args: unknown[]) => {
      calls.push({ op: 'groupBy', args })
      return Promise.resolve(result)
    },
    orderBy: (...args: unknown[]) => {
      calls.push({ op: 'orderBy', args })
      return Promise.resolve(result)
    },
    limit: (...args: unknown[]) => {
      calls.push({ op: 'limit', args })
      return Promise.resolve(result)
    },
    then: (resolve: (v: unknown[]) => void) => {
      resolve(result)
    },
  } as never
  return chain
}

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => {
      calls.push({ op: 'select', args })
      callCount++
      const result = mockResultQueue.shift() ?? []
      return makeSelectChain(result)
    },
  },
}))

vi.mock('@/db/schema', () => ({
  watches: {
    id: 'id',
    userId: 'userId',
    status: 'status',
  },
  watchLikes: {
    watchId: 'watchId',
    userId: 'userId',
  },
  comments: {
    watchId: 'watchId',
    authorId: 'authorId',
    id: 'id',
  },
  follows: {
    followerId: 'followerId',
    followingId: 'followingId',
  },
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  or: vi.fn((...args: unknown[]) => ({ type: 'or', args })),
  eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ type: 'inArray', col, vals })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({
      type: 'sql',
      queryChunks: strings.raw ?? [],
      params: vals,
    })),
    { raw: vi.fn((s: string) => ({ type: 'sql-raw', value: s })) }
  ),
  desc: vi.fn((col: unknown) => ({ isDescending: true, column: col })),
  asc: vi.fn((col: unknown) => ({ isDescending: false, column: col })),
}))

// Valid v4 UUIDs
const viewerId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const ownerId = '11111111-2222-4333-8444-555555555555'
const otherOwnerId = '99999999-8888-4777-8666-555555555555'
const watchId1 = '22222222-3333-4444-8555-666666666666'
const watchId2 = '33333333-4444-4555-8666-777777777777'
const wishlistWatchId = '44444444-5555-4666-8777-888888888888'

// Import the function that Plan 03 will create.
// This import FAILS on current main (RED).
import { getBatchedWatchCounts } from '@/data/reactions'

describe('getBatchedWatchCounts — DISP-01 / D-10 leak guard (Wave 0 RED)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callCount = 0
    calls = []
    mockResultQueue.length = 0
  })

  // DISP-01: commentCount:0 for gated wishlist watch (viewer X, owner Y, NOT mutual)
  // Scenario: viewer is NOT mutual-follow with owner of a wishlist watch
  // Expected: commentCount === 0 (gate enforced in the query), likeCount reflects real value
  it('DISP-01: returns commentCount:0 for a gated wishlist watch (non-mutual viewer)', async () => {
    const watchIds = [wishlistWatchId]

    // Mock queue (per RESEARCH Pattern 5: ≤6 queries after Q6 addition):
    // 1. Watch rows query: returns [{ id: wishlistWatchId, userId: ownerId, status: 'wishlist' }]
    mockResultQueue.push([{ id: wishlistWatchId, userId: ownerId, status: 'wishlist' }])
    // 2. viewer→owners follows: returns [] (viewer does NOT follow owner)
    mockResultQueue.push([])
    // 3. owners→viewer follows: returns [] (owner does NOT follow viewer)
    mockResultQueue.push([])
    // 4. like counts batch: returns [{ watchId: wishlistWatchId, count: 3 }]
    mockResultQueue.push([{ watchId: wishlistWatchId, count: 3 }])
    // 5. comment counts batch: returns [{ watchId: wishlistWatchId, count: 5 }]
    //    but the gate logic must zero it out for non-mutual
    mockResultQueue.push([{ watchId: wishlistWatchId, count: 5 }])
    // 6. Q6 NEW — viewer's watch_likes (empty = viewer has not liked)
    mockResultQueue.push([])

    const result = await getBatchedWatchCounts(viewerId, watchIds)

    const counts = result.get(wishlistWatchId)
    expect(counts).toBeDefined()
    // D-10: comment count is 0 for gated wishlist (not leaked)
    expect(counts!.commentCount).toBe(0)
    // Likes are open regardless of wishlist gate (GATE-02)
    expect(counts!.likeCount).toBe(3)
  })

  // DISP-01: true comment count for a non-wishlist watch (open to all)
  it('DISP-01: returns true comment count for a non-wishlist (owned) watch', async () => {
    const watchIds = [watchId1]

    // 1. Watch rows: non-wishlist
    mockResultQueue.push([{ id: watchId1, userId: ownerId, status: 'owned' }])
    // 2. viewer→owners follows (only wishlist owners queried — but impl may query all)
    mockResultQueue.push([])
    // 3. owners→viewer follows
    mockResultQueue.push([])
    // 4. Like counts
    mockResultQueue.push([{ watchId: watchId1, count: 2 }])
    // 5. Comment counts
    mockResultQueue.push([{ watchId: watchId1, count: 4 }])
    // 6. Q6 NEW — viewer's watch_likes (empty = viewer has not liked)
    mockResultQueue.push([])

    const result = await getBatchedWatchCounts(viewerId, watchIds)

    const counts = result.get(watchId1)
    expect(counts).toBeDefined()
    expect(counts!.commentCount).toBe(4)
    expect(counts!.likeCount).toBe(2)
  })

  // DISP-01: owner's own wishlist watch → commentCount reflects real count (viewer===owner)
  it('DISP-01: owner viewing their own wishlist watch gets true comment count', async () => {
    const watchIds = [wishlistWatchId]

    // 1. Watch rows: wishlist owned by viewerId (viewer IS the owner)
    mockResultQueue.push([{ id: wishlistWatchId, userId: viewerId, status: 'wishlist' }])
    // 2-5: follows + counts (no gating since viewer===owner)
    mockResultQueue.push([])
    mockResultQueue.push([])
    mockResultQueue.push([{ watchId: wishlistWatchId, count: 1 }])
    mockResultQueue.push([{ watchId: wishlistWatchId, count: 7 }])
    // 6. Q6 NEW — viewer's watch_likes (empty)
    mockResultQueue.push([])

    const result = await getBatchedWatchCounts(viewerId, watchIds)

    const counts = result.get(wishlistWatchId)
    expect(counts).toBeDefined()
    expect(counts!.commentCount).toBe(7)
  })

  // DISP-01 N+1: issues a constant number of DB queries regardless of watchIds.length
  // Per RESEARCH Pattern 5: ≤5 queries total (watches, viewer→owners, owners→viewer,
  // like counts, comment counts). NOT one query per watch.
  it('DISP-01: NO N+1 — issues ≤6 queries for a 50-watch batch (not proportional to length)', async () => {
    const fiftyWatchIds = Array.from({ length: 50 }, (_, i) =>
      `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`
    )

    // Queue enough results for ≤6 db.select() calls (Q1–Q5 existing + Q6 viewer liked set).
    // Each returns an empty array for simplicity (we only count calls, not result shape).
    for (let i = 0; i < 10; i++) {
      mockResultQueue.push([])
    }

    await getBatchedWatchCounts(viewerId, fiftyWatchIds)

    // Count db.select() invocations
    const selectCalls = calls.filter((c) => c.op === 'select')
    // ASSERT: constant query count — NOT 50 (one per watch)
    expect(selectCalls.length).toBeLessThanOrEqual(6)
    // Sanity: it must have issued at least 1 query
    expect(selectCalls.length).toBeGreaterThanOrEqual(1)
  })

  // Returns a Map (not an array or plain object)
  it('DISP-01: returns a Map<string, WatchCounts>', async () => {
    const watchIds = [watchId1, watchId2]

    // 10 slots covers Q1–Q6 for 2 watches plus extras
    for (let i = 0; i < 10; i++) {
      mockResultQueue.push([])
    }

    const result = await getBatchedWatchCounts(viewerId, watchIds)

    expect(result).toBeInstanceOf(Map)
  })

  // Empty watchIds → returns empty Map without DB errors
  it('DISP-01: empty watchIds returns an empty Map', async () => {
    const result = await getBatchedWatchCounts(viewerId, [])

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  // Multiple watches with mixed wishlist/owned status
  it('DISP-01: mixed batch — gated wishlist gets 0, non-wishlist gets true count', async () => {
    const watchIds = [watchId1, wishlistWatchId]

    // 1. Watch rows for both
    mockResultQueue.push([
      { id: watchId1, userId: ownerId, status: 'owned' },
      { id: wishlistWatchId, userId: otherOwnerId, status: 'wishlist' },
    ])
    // 2. viewer→owners follows (wishlist owners): viewer does NOT follow otherOwnerId
    mockResultQueue.push([])
    // 3. owners→viewer follows: otherOwnerId does NOT follow viewer
    mockResultQueue.push([])
    // 4. Like counts for all
    mockResultQueue.push([
      { watchId: watchId1, count: 2 },
      { watchId: wishlistWatchId, count: 5 },
    ])
    // 5. Comment counts for all (gating applied in result assembly)
    mockResultQueue.push([
      { watchId: watchId1, count: 3 },
      { watchId: wishlistWatchId, count: 8 },
    ])
    // 6. Q6 NEW — viewer's watch_likes (empty = viewer has not liked any)
    mockResultQueue.push([])

    const result = await getBatchedWatchCounts(viewerId, watchIds)

    // Non-wishlist: full comment count
    const ownedCounts = result.get(watchId1)
    expect(ownedCounts?.commentCount).toBe(3)

    // Wishlist (non-mutual): comment count zeroed out
    const wishlistCounts = result.get(wishlistWatchId)
    expect(wishlistCounts?.commentCount).toBe(0)
    expect(wishlistCounts?.likeCount).toBe(5) // likes still open
  })

  // D-11: liked:true when Q6 returns viewer liked row
  it('D-11: returns liked:true when Q6 returns viewer liked row', async () => {
    const watchIds = [watchId1]

    mockResultQueue.push([{ id: watchId1, userId: ownerId, status: 'owned' }]) // Q1
    mockResultQueue.push([])                                                     // Q2
    mockResultQueue.push([])                                                     // Q3
    mockResultQueue.push([{ watchId: watchId1, count: 2 }])                    // Q4
    mockResultQueue.push([{ watchId: watchId1, count: 0 }])                    // Q5
    mockResultQueue.push([{ watchId: watchId1 }])                               // Q6 — viewer liked this watch

    const result = await getBatchedWatchCounts(viewerId, watchIds)
    expect(result.get(watchId1)?.liked).toBe(true)
    expect(result.get(watchId1)?.canComment).toBe(true)  // non-wishlist = allowed
  })

  // D-11: liked:false when viewer has not liked the watch
  it('D-11: returns liked:false when viewer has not liked the watch', async () => {
    const watchIds = [watchId1]

    mockResultQueue.push([{ id: watchId1, userId: ownerId, status: 'owned' }]) // Q1
    mockResultQueue.push([])                                                     // Q2
    mockResultQueue.push([])                                                     // Q3
    mockResultQueue.push([])                                                     // Q4 no likes
    mockResultQueue.push([])                                                     // Q5 no comments
    mockResultQueue.push([])                                                     // Q6 viewer not liked

    const result = await getBatchedWatchCounts(viewerId, watchIds)
    expect(result.get(watchId1)?.liked).toBe(false)
  })

  // D-11/GRID-05: canComment:false for gated wishlist watch (non-mutual viewer)
  it('D-11/GRID-05: returns canComment:false for gated wishlist watch (non-mutual viewer)', async () => {
    const watchIds = [wishlistWatchId]

    mockResultQueue.push([{ id: wishlistWatchId, userId: otherOwnerId, status: 'wishlist' }]) // Q1
    mockResultQueue.push([])                                                                    // Q2 viewer does not follow owner
    mockResultQueue.push([])                                                                    // Q3 owner does not follow viewer
    mockResultQueue.push([])                                                                    // Q4
    mockResultQueue.push([])                                                                    // Q5
    mockResultQueue.push([])                                                                    // Q6

    const result = await getBatchedWatchCounts(viewerId, watchIds)
    expect(result.get(wishlistWatchId)?.canComment).toBe(false)
  })
})
