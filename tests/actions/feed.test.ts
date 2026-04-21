import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  UnauthorizedError: class extends Error {
    constructor(m = 'Not authenticated') {
      super(m)
      this.name = 'UnauthorizedError'
    }
  },
}))

vi.mock('@/data/activities', () => ({
  getFeedForUser: vi.fn(),
  logActivity: vi.fn(),
}))

import { loadMoreFeed } from '@/app/actions/feed'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getFeedForUser } from '@/data/activities'

const viewerId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const validCursor = {
  createdAt: '2026-04-21T14:00:00.000Z',
  id: '11111111-2222-4333-8444-555555555555',
}

describe('loadMoreFeed Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("Test 1: returns { success: false, error: 'Not authenticated' } when getCurrentUser throws", async () => {
    ;(getCurrentUser as Mock).mockRejectedValueOnce(new UnauthorizedError())
    const result = await loadMoreFeed({ cursor: validCursor })
    expect(result).toEqual({ success: false, error: 'Not authenticated' })
    expect(getFeedForUser).not.toHaveBeenCalled()
  })

  it("Test 2: missing cursor key → { success: false, error: 'Invalid request' }", async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerId, email: 'v@example.com' })
    const result = await loadMoreFeed({})
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(getFeedForUser).not.toHaveBeenCalled()
  })

  it("Test 3: extra unknown key at top level → 'Invalid request' via .strict()", async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerId, email: 'v@example.com' })
    const result = await loadMoreFeed({ cursor: validCursor, role: 'admin' })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(getFeedForUser).not.toHaveBeenCalled()
  })

  it("Test 4: cursor.id not a UUID → 'Invalid request'", async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerId, email: 'v@example.com' })
    const result = await loadMoreFeed({
      cursor: { createdAt: validCursor.createdAt, id: 'not-a-uuid' },
    })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(getFeedForUser).not.toHaveBeenCalled()
  })

  it("Test 5: cursor.createdAt not a datetime → 'Invalid request'", async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerId, email: 'v@example.com' })
    const result = await loadMoreFeed({
      cursor: { createdAt: 'yesterday', id: validCursor.id },
    })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(getFeedForUser).not.toHaveBeenCalled()
  })

  it("Test 6: null cursor rejected — loadMoreFeed is only for page 2+", async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerId, email: 'v@example.com' })
    const result = await loadMoreFeed({ cursor: null })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(getFeedForUser).not.toHaveBeenCalled()
  })

  it('Test 7: valid cursor → calls getFeedForUser(user.id, cursor, 20), aggregates, returns rows + nextCursor', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerId, email: 'v@example.com' })
    const mockRawRows = [
      {
        kind: 'raw' as const,
        id: 'r-1',
        type: 'watch_added' as const,
        createdAt: '2026-04-21T13:00:00.000Z',
        watchId: null,
        metadata: { brand: 'Rolex', model: 'GMT', imageUrl: null },
        userId: 'other-user',
        username: 'other',
        displayName: null,
        avatarUrl: null,
      },
    ]
    ;(getFeedForUser as Mock).mockResolvedValueOnce({
      rows: mockRawRows,
      nextCursor: { createdAt: '2026-04-21T12:00:00.000Z', id: 'next-id' },
    })
    const result = await loadMoreFeed({ cursor: validCursor })
    expect(result.success).toBe(true)
    expect(getFeedForUser).toHaveBeenCalledTimes(1)
    expect(getFeedForUser).toHaveBeenCalledWith(viewerId, validCursor, 20)
    if (result.success) {
      // aggregateFeed passes a single raw row through unchanged (length < 3).
      expect(result.data.rows).toHaveLength(1)
      expect(result.data.rows[0].kind).toBe('raw')
      expect(result.data.nextCursor).toEqual({
        createdAt: '2026-04-21T12:00:00.000Z',
        id: 'next-id',
      })
    }
  })

  it("Test 8: DAL throws → { success: false, error: \"Couldn't load more.\" } and console.error called with [loadMoreFeed] prefix", async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerId, email: 'v@example.com' })
    ;(getFeedForUser as Mock).mockRejectedValueOnce(new Error('boom'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const result = await loadMoreFeed({ cursor: validCursor })
      expect(result.success).toBe(false)
      if (result.success === false) {
        expect(result.error).toMatch(/couldn.?t load more/i)
      }
      expect(errSpy).toHaveBeenCalled()
      const firstCallArgs = errSpy.mock.calls[0]
      expect(String(firstCallArgs[0])).toMatch(/\[loadMoreFeed\]/)
    } finally {
      errSpy.mockRestore()
    }
  })
})
