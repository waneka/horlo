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

vi.mock('@/data/suggestions', () => ({
  getSuggestedCollectors: vi.fn(),
}))

import { loadMoreSuggestions } from '@/app/actions/suggestions'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getSuggestedCollectors } from '@/data/suggestions'

const viewerId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const validCursor = {
  overlap: 0.85,
  userId: '11111111-2222-4333-8444-555555555555',
}

describe('loadMoreSuggestions Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("Test 1: unauthenticated caller → { success: false, error: 'Not authenticated' }", async () => {
    ;(getCurrentUser as Mock).mockRejectedValueOnce(new UnauthorizedError())
    const result = await loadMoreSuggestions({ cursor: validCursor })
    expect(result).toEqual({ success: false, error: 'Not authenticated' })
    expect(getSuggestedCollectors).not.toHaveBeenCalled()
  })

  it("Test 2: payload missing cursor → 'Invalid request'", async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerId,
      email: 'v@example.com',
    })
    const result = await loadMoreSuggestions({})
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(getSuggestedCollectors).not.toHaveBeenCalled()
  })

  it("Test 3: payload with extra unknown key → 'Invalid request' (strict)", async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerId,
      email: 'v@example.com',
    })
    const result = await loadMoreSuggestions({
      cursor: validCursor,
      evil: 'admin',
    })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(getSuggestedCollectors).not.toHaveBeenCalled()
  })

  it("Test 4: cursor.userId not a UUID → 'Invalid request'", async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerId,
      email: 'v@example.com',
    })
    const result = await loadMoreSuggestions({
      cursor: { overlap: 0.5, userId: 'not-a-uuid' },
    })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(getSuggestedCollectors).not.toHaveBeenCalled()
  })

  it("Test 5: cursor.overlap not a number → 'Invalid request'", async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerId,
      email: 'v@example.com',
    })
    const result = await loadMoreSuggestions({
      cursor: { overlap: 'high', userId: validCursor.userId },
    })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(getSuggestedCollectors).not.toHaveBeenCalled()
  })

  it("Test 5a: cursor.overlap = NaN → 'Invalid request' (finite guard, WR-01)", async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerId,
      email: 'v@example.com',
    })
    const result = await loadMoreSuggestions({
      cursor: { overlap: Number.NaN, userId: validCursor.userId },
    })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(getSuggestedCollectors).not.toHaveBeenCalled()
  })

  it("Test 5b: cursor.overlap = Infinity → 'Invalid request' (finite guard, WR-01)", async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerId,
      email: 'v@example.com',
    })
    const result = await loadMoreSuggestions({
      cursor: { overlap: Number.POSITIVE_INFINITY, userId: validCursor.userId },
    })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(getSuggestedCollectors).not.toHaveBeenCalled()
  })

  it("Test 5c: cursor.overlap = -Infinity → 'Invalid request' (finite guard, WR-01)", async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerId,
      email: 'v@example.com',
    })
    const result = await loadMoreSuggestions({
      cursor: { overlap: Number.NEGATIVE_INFINITY, userId: validCursor.userId },
    })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(getSuggestedCollectors).not.toHaveBeenCalled()
  })

  it('Test 6: valid payload → calls getSuggestedCollectors(user.id, { limit: 5, cursor }) and returns { collectors, nextCursor }', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerId,
      email: 'v@example.com',
    })
    const mockCollectors = [
      {
        userId: '22222222-3333-4444-8555-666666666666',
        username: 'bob',
        displayName: null,
        avatarUrl: null,
        overlap: 0.55,
        sharedCount: 1,
        sharedWatches: [],
      },
    ]
    ;(getSuggestedCollectors as Mock).mockResolvedValueOnce({
      collectors: mockCollectors,
      nextCursor: null,
    })
    const result = await loadMoreSuggestions({ cursor: validCursor })
    expect(result.success).toBe(true)
    expect(getSuggestedCollectors).toHaveBeenCalledTimes(1)
    expect(getSuggestedCollectors).toHaveBeenCalledWith(viewerId, {
      limit: 5,
      cursor: validCursor,
    })
    if (result.success) {
      expect(result.data.collectors).toEqual(mockCollectors)
      expect(result.data.nextCursor).toBeNull()
    }
  })

  it("Test 7: DAL throws → { success: false, error: \"Couldn't load more collectors.\" } and console.error with [loadMoreSuggestions] prefix", async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerId,
      email: 'v@example.com',
    })
    ;(getSuggestedCollectors as Mock).mockRejectedValueOnce(new Error('boom'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const result = await loadMoreSuggestions({ cursor: validCursor })
      expect(result.success).toBe(false)
      if (result.success === false) {
        expect(result.error).toMatch(/couldn.?t load more collectors/i)
      }
      expect(errSpy).toHaveBeenCalled()
      const firstCallArgs = errSpy.mock.calls[0]
      expect(String(firstCallArgs[0])).toMatch(/\[loadMoreSuggestions\]/)
    } finally {
      errSpy.mockRestore()
    }
  })
})
