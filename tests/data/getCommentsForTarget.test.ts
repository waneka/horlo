import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// ---------------------------------------------------------------------------
// Wave 0 scaffold — CMNT-03 / CMNT-04 / CMNT-09
// These tests are EXPECTED TO FAIL (RED) on current main because:
//   - getCommentsForTarget uses asc(comments.createdAt) at lines 150 & 156
//     of src/data/comments.ts; Plan 02 changes it to desc()
// ---------------------------------------------------------------------------

// Mock isMutualFollow (used inside canViewerCommentOnTarget for wishlist watches)
vi.mock('@/data/follows', () => ({
  isMutualFollow: vi.fn(),
}))

// Use vi.fn() for db.select so tests can call .mockImplementation per-test.
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}))

vi.mock('@/db/schema', () => ({
  watches: { id: 'id', userId: 'userId', status: 'status' },
  comments: {
    id: 'id',
    authorId: 'authorId',
    watchId: 'watchId',
    wearEventId: 'wearEventId',
    body: 'body',
    createdAt: 'createdAt',
    editedAt: 'editedAt',
    updatedAt: 'updatedAt',
  },
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  asc: vi.fn((col: unknown) => ({ isDescending: false, column: col })),
  desc: vi.fn((col: unknown) => ({ isDescending: true, column: col })),
  eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
}))

import { getCommentsForTarget } from '@/data/comments'
import { isMutualFollow } from '@/data/follows'
import { db } from '@/db'

// Valid v4 UUIDs
const viewerId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const watchId = '22222222-3333-4444-8555-666666666666'
const wearEventId = '33333333-4444-4555-8666-777777777777'
const watchOwnerId = '11111111-2222-4333-8444-555555555555'

function makeCommentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa',
    authorId: viewerId,
    watchId,
    wearEventId: null,
    body: 'Nice watch!',
    editedAt: null,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  }
}

// Helper: set up db.select to return a non-wishlist watch row on gate call,
// then capture the orderBy args on the comments query call.
// The two calls are: 1) canViewerCommentOnTarget (limit terminal), 2) comments query (orderBy terminal).
function setupTwoCallMock(
  watchRow: unknown[],
  commentsResult: unknown[],
  orderByCapture: Array<unknown[]>,
) {
  let callCount = 0
  ;(db.select as Mock).mockImplementation(() => {
    callCount++
    if (callCount === 1) {
      // First call: canViewerCommentOnTarget fetches watch row
      const limitMock = vi.fn().mockResolvedValue(watchRow)
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock })
      const fromMock = vi.fn().mockReturnValue({ where: whereMock })
      return { from: fromMock }
    } else {
      // Second call: getCommentsForTarget comments query (orderBy terminal)
      const orderByMock = vi.fn().mockImplementation((...args: unknown[]) => {
        orderByCapture.push(args)
        return Promise.resolve(commentsResult)
      })
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock })
      const fromMock = vi.fn().mockReturnValue({ where: whereMock })
      return { from: fromMock }
    }
  })
}

describe('getCommentsForTarget — CMNT-03 DESC order (Wave 0 RED)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // CMNT-03: getCommentsForTarget MUST order by createdAt DESC (newest-first)
  // FAILS TODAY because source uses asc(comments.createdAt) at lines 150/156
  it('CMNT-03: getCommentsForTarget orderBy call receives a DESC ordering on createdAt', async () => {
    const capturedOrderByArgs: Array<unknown[]> = []
    setupTwoCallMock(
      [{ userId: watchOwnerId, status: 'owned' }],
      [],
      capturedOrderByArgs,
    )

    await getCommentsForTarget(viewerId, { type: 'watch', id: watchId })

    // Verify the comments query was called
    expect(capturedOrderByArgs).toHaveLength(1)

    const orderByArg = capturedOrderByArgs[0][0]

    // Helper: recursively search for a DESC marker in the Drizzle AST
    const seen = new WeakSet()
    function containsDesc(val: unknown): boolean {
      if (!val || typeof val !== 'object') return false
      if (seen.has(val as object)) return false
      seen.add(val as object)
      const obj = val as Record<string, unknown>
      // Drizzle OrderByColumn: isDescending === true
      if (obj.isDescending === true) return true
      for (const v of Object.values(obj)) {
        if (containsDesc(v)) return true
      }
      return false
    }

    // ASSERT: orderBy arg must represent DESC ordering (fails today — asc is used)
    expect(containsDesc(orderByArg)).toBe(true)
  })

  // CMNT-09: result.length equals the number of comment rows returned by the query
  it('CMNT-09: returns a list whose length equals the comment count from the query', async () => {
    const threeComments = [
      makeCommentRow({ id: 'id-1', createdAt: new Date('2026-01-03T10:00:00Z') }),
      makeCommentRow({ id: 'id-2', createdAt: new Date('2026-01-02T10:00:00Z') }),
      makeCommentRow({ id: 'id-3', createdAt: new Date('2026-01-01T10:00:00Z') }),
    ]
    const capturedOrderByArgs: Array<unknown[]> = []
    setupTwoCallMock(
      [{ userId: watchOwnerId, status: 'owned' }],
      threeComments,
      capturedOrderByArgs,
    )

    const result = await getCommentsForTarget(viewerId, { type: 'watch', id: watchId })

    expect(result).toHaveLength(3)
  })

  // D-04 / GATE-01: gated viewer (non-mutual on wishlist watch) gets []
  // This test PASSES today (gate returns [] correctly) — preserved as regression guard
  it('gated viewer (non-mutual on wishlist watch) gets [] — no count leak (D-04)', async () => {
    ;(isMutualFollow as Mock).mockResolvedValue(false)

    let callCount = 0
    ;(db.select as Mock).mockImplementation(() => {
      callCount++
      // canViewerCommentOnTarget: wishlist watch owned by someone else
      const limitMock = vi.fn().mockResolvedValue([{ userId: watchOwnerId, status: 'wishlist' }])
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock })
      const fromMock = vi.fn().mockReturnValue({ where: whereMock })
      return { from: fromMock }
    })

    const result = await getCommentsForTarget(viewerId, { type: 'watch', id: watchId })

    expect(result).toEqual([])
    // The comments query should never have been called (gate returns early)
    expect(callCount).toBe(1)
  })

  // Wear target: orderBy DESC applies to wearEventId branch as well
  it('CMNT-03: wear target orderBy call also receives a DESC ordering on createdAt', async () => {
    const capturedOrderByArgs: Array<unknown[]> = []

    // Wear target: canViewerCommentOnTarget short-circuits to true (no DB call for wear)
    // So the only db.select call is the comments query
    ;(db.select as Mock).mockImplementation(() => {
      const orderByMock = vi.fn().mockImplementation((...args: unknown[]) => {
        capturedOrderByArgs.push(args)
        return Promise.resolve([])
      })
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock })
      const fromMock = vi.fn().mockReturnValue({ where: whereMock })
      return { from: fromMock }
    })

    await getCommentsForTarget(viewerId, { type: 'wear', id: wearEventId })

    expect(capturedOrderByArgs).toHaveLength(1)

    const arg = capturedOrderByArgs[0][0]
    const seen2 = new WeakSet()
    function containsDescArg(val: unknown): boolean {
      if (!val || typeof val !== 'object') return false
      if (seen2.has(val as object)) return false
      seen2.add(val as object)
      const obj = val as Record<string, unknown>
      if (obj.isDescending === true) return true
      for (const v of Object.values(obj)) {
        if (containsDescArg(v)) return true
      }
      return false
    }

    // ASSERT: fails today because wear branch also uses asc()
    expect(containsDescArg(arg)).toBe(true)
  })
})
