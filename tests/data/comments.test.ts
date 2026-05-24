import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// ---------------------------------------------------------------------------
// Wave 0 scaffold — GATE-03: canViewerCommentOnTarget gate assertions
// This is the DATA-layer test file (tests/data/comments.test.ts).
// The ACTION-layer file is tests/actions/comments.test.ts.
//
// These tests assert the canViewerCommentOnTarget gate logic in src/data/comments.ts.
// Most cases PASS today (gate logic exists); they serve as regression guards.
// ---------------------------------------------------------------------------

// Mock isMutualFollow — the wishlist gate delegates to this
vi.mock('@/data/follows', () => ({
  isMutualFollow: vi.fn(),
}))

// Mock db with a spyable chain
let mockWatchRows: unknown[] = []

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
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

import { canViewerCommentOnTarget } from '@/data/comments'
import { isMutualFollow } from '@/data/follows'
import { db } from '@/db'

// Valid v4 UUIDs
const viewerId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const ownerId = '11111111-2222-4333-8444-555555555555'
const watchId = '22222222-3333-4444-8555-666666666666'
const wearId = '33333333-4444-4555-8666-777777777777'

function setupWatchSelect(rows: unknown[]) {
  const limitMock = vi.fn().mockResolvedValue(rows)
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock })
  const fromMock = vi.fn().mockReturnValue({ where: whereMock })
  ;(db.select as Mock).mockReturnValue({ from: fromMock })
}

describe('canViewerCommentOnTarget — GATE-03 gate assertions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWatchRows = []
  })

  // Wear target always returns true — short-circuit before any DB call
  it('GATE-03: wear target always returns true without any DB call', async () => {
    const result = await canViewerCommentOnTarget(viewerId, { type: 'wear', id: wearId })

    expect(result).toBe(true)
    // CRITICAL: no DB call for wear target (short-circuit)
    expect(db.select).not.toHaveBeenCalled()
    expect(isMutualFollow).not.toHaveBeenCalled()
  })

  // Watch owner always returns true regardless of watch status
  it('GATE-03: watch owner always returns true regardless of status (owned)', async () => {
    setupWatchSelect([{ userId: viewerId, status: 'owned' }])

    const result = await canViewerCommentOnTarget(viewerId, { type: 'watch', id: watchId })

    expect(result).toBe(true)
    expect(isMutualFollow).not.toHaveBeenCalled()
  })

  it('GATE-03: watch owner always returns true regardless of status (wishlist)', async () => {
    setupWatchSelect([{ userId: viewerId, status: 'wishlist' }])

    const result = await canViewerCommentOnTarget(viewerId, { type: 'watch', id: watchId })

    expect(result).toBe(true)
    // Owner short-circuits before the isMutualFollow call
    expect(isMutualFollow).not.toHaveBeenCalled()
  })

  // Non-wishlist watch returns true for any viewer
  it('GATE-03: non-wishlist watch (owned) returns true for any viewer', async () => {
    setupWatchSelect([{ userId: ownerId, status: 'owned' }])

    const result = await canViewerCommentOnTarget(viewerId, { type: 'watch', id: watchId })

    expect(result).toBe(true)
    expect(isMutualFollow).not.toHaveBeenCalled()
  })

  it('GATE-03: non-wishlist watch (sold) returns true for any viewer', async () => {
    setupWatchSelect([{ userId: ownerId, status: 'sold' }])

    const result = await canViewerCommentOnTarget(viewerId, { type: 'watch', id: watchId })

    expect(result).toBe(true)
  })

  it('GATE-03: non-wishlist watch (grail) returns true for any viewer', async () => {
    setupWatchSelect([{ userId: ownerId, status: 'grail' }])

    const result = await canViewerCommentOnTarget(viewerId, { type: 'watch', id: watchId })

    expect(result).toBe(true)
    expect(isMutualFollow).not.toHaveBeenCalled()
  })

  // Wishlist watch returns isMutualFollow(viewerId, ownerId) result
  it('GATE-03: wishlist watch + non-mutual → returns false', async () => {
    setupWatchSelect([{ userId: ownerId, status: 'wishlist' }])
    ;(isMutualFollow as Mock).mockResolvedValue(false)

    const result = await canViewerCommentOnTarget(viewerId, { type: 'watch', id: watchId })

    expect(result).toBe(false)
    expect(isMutualFollow).toHaveBeenCalledWith(viewerId, ownerId)
  })

  it('GATE-03: wishlist watch + mutual follow → returns true', async () => {
    setupWatchSelect([{ userId: ownerId, status: 'wishlist' }])
    ;(isMutualFollow as Mock).mockResolvedValue(true)

    const result = await canViewerCommentOnTarget(viewerId, { type: 'watch', id: watchId })

    expect(result).toBe(true)
    expect(isMutualFollow).toHaveBeenCalledWith(viewerId, ownerId)
  })

  // Watch not found — fails closed
  it('GATE-03: watch not found returns false (fail-closed)', async () => {
    setupWatchSelect([]) // empty rows — watch not found

    const result = await canViewerCommentOnTarget(viewerId, { type: 'watch', id: watchId })

    expect(result).toBe(false)
    expect(isMutualFollow).not.toHaveBeenCalled()
  })

  // isMutualFollow direction: must pass (viewerId, ownerId) NOT (ownerId, viewerId)
  it('GATE-03: isMutualFollow called with (viewerId, ownerId) — correct direction', async () => {
    setupWatchSelect([{ userId: ownerId, status: 'wishlist' }])
    ;(isMutualFollow as Mock).mockResolvedValue(false)

    await canViewerCommentOnTarget(viewerId, { type: 'watch', id: watchId })

    // Verify direction: first arg is viewerId, second is ownerId
    expect(isMutualFollow).toHaveBeenCalledWith(viewerId, ownerId)
    // Ensure it was NOT called with reversed args
    expect(isMutualFollow).not.toHaveBeenCalledWith(ownerId, viewerId)
  })
})
