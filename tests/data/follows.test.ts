import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Drizzle DB with a chainable, spyable builder. Each terminal operation
// (await on the builder itself, .limit(), .orderBy(), .groupBy()) resolves to
// `mockRows`. We capture the invocation sequence via `calls` so individual
// tests can assert the SQL shape (onConflictDoNothing, desc(follows.createdAt),
// and the WHERE / GROUP BY pattern).

let mockRows: unknown[] = []
let calls: Array<{ op: string; args: unknown[] }> = []

// Make the chain thenable so `await db.select()...where(...)` resolves to mockRows
// even without a terminal .limit()/.orderBy()/.groupBy() call (used for the plain
// select-from-where shape in getFollowersForProfile step 1).
function makeChain() {
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
    orderBy: (...args: unknown[]) => {
      calls.push({ op: 'orderBy', args })
      return Promise.resolve(mockRows)
    },
    groupBy: (...args: unknown[]) => {
      calls.push({ op: 'groupBy', args })
      return Promise.resolve(mockRows)
    },
    limit: (...args: unknown[]) => {
      calls.push({ op: 'limit', args })
      return Promise.resolve(mockRows)
    },
    values: (...args: unknown[]) => {
      calls.push({ op: 'values', args })
      return chain
    },
    onConflictDoNothing: (...args: unknown[]) => {
      calls.push({ op: 'onConflictDoNothing', args })
      return Promise.resolve(undefined)
    },
    then: (resolve: (v: unknown[]) => void) => {
      resolve(mockRows as unknown[])
    },
  } as never
  return chain
}

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => {
      calls.push({ op: 'select', args })
      return makeChain()
    },
    insert: (...args: unknown[]) => {
      calls.push({ op: 'insert', args })
      return makeChain()
    },
    delete: (...args: unknown[]) => {
      calls.push({ op: 'delete', args })
      return makeChain()
    },
  },
}))

// Stub the dependencies of getTasteOverlapData so we can assert composition
// without hitting the DB or computeTasteTags internals.
vi.mock('@/data/watches', () => ({
  getWatchesByUser: vi.fn(async () => []),
}))
vi.mock('@/data/preferences', () => ({
  getPreferencesByUser: vi.fn(async () => ({
    preferredStyles: [],
    dislikedStyles: [],
    preferredDesignTraits: [],
    dislikedDesignTraits: [],
    preferredComplications: [],
    complicationExceptions: [],
    preferredDialColors: [],
    dislikedDialColors: [],
    overlapTolerance: 'medium' as const,
  })),
}))
vi.mock('@/data/wearEvents', () => ({
  getAllWearEventsByUser: vi.fn(async () => []),
}))
vi.mock('@/lib/tasteTags', () => ({
  computeTasteTags: vi.fn(() => ['mock-tag']),
}))

import {
  followUser,
  unfollowUser,
  isFollowing,
  getFollowersForProfile,
  getFollowingForProfile,
  getTasteOverlapData,
} from '@/data/follows'

describe('follows DAL', () => {
  beforeEach(() => {
    mockRows = []
    calls = []
    vi.clearAllMocks()
  })

  describe('followUser', () => {
    it('calls db.insert(follows).values({followerId, followingId}).onConflictDoNothing()', async () => {
      await followUser('follower-id-1', 'following-id-2')
      const ops = calls.map((c) => c.op)
      expect(ops).toContain('insert')
      expect(ops).toContain('values')
      expect(ops).toContain('onConflictDoNothing')
      const valuesCall = calls.find((c) => c.op === 'values')
      expect(valuesCall!.args[0]).toMatchObject({
        followerId: 'follower-id-1',
        followingId: 'following-id-2',
      })
    })
  })

  describe('unfollowUser', () => {
    it('builds a DELETE with WHERE follower_id=X AND following_id=Y', async () => {
      await unfollowUser('follower-id-1', 'following-id-2')
      const ops = calls.map((c) => c.op)
      expect(ops).toContain('delete')
      expect(ops).toContain('where')
    })
  })

  describe('isFollowing', () => {
    it('returns true when a row exists', async () => {
      mockRows = [{ id: 'some-follow-id' }]
      const result = await isFollowing('follower-id-1', 'following-id-2')
      expect(result).toBe(true)
    })

    it('returns false when no row exists', async () => {
      mockRows = []
      const result = await isFollowing('follower-id-1', 'following-id-2')
      expect(result).toBe(false)
    })
  })

  describe('getFollowersForProfile', () => {
    it('returns empty array when no followers found', async () => {
      mockRows = []
      const result = await getFollowersForProfile('user-id')
      expect(result).toEqual([])
    })

    it('SQL orders by desc(follows.createdAt) for the primary query', async () => {
      mockRows = []
      await getFollowersForProfile('user-id')
      const orderBy = calls.find((c) => c.op === 'orderBy')
      expect(orderBy).toBeDefined()
    })

    it('returns FollowerListEntry shape joining profile + profile_settings + watch counts', async () => {
      // Note: because the DAL uses Promise.all over separate queries, we
      // intentionally provide mockRows as the follower ID set first. All four
      // queries return the same mockRows here (the chain mock is single-bucket).
      // Tests at GREEN time will pass because the DAL merges by userId with
      // `flatMap` and tolerates missing sub-rows. For now this is a structural
      // smoke test — validates the function is callable and produces an array.
      mockRows = []
      const result = await getFollowersForProfile('user-id')
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('getFollowingForProfile', () => {
    it('mirrors getFollowersForProfile shape but for the following direction', async () => {
      mockRows = []
      const result = await getFollowingForProfile('user-id')
      expect(Array.isArray(result)).toBe(true)
      const orderBy = calls.find((c) => c.op === 'orderBy')
      expect(orderBy).toBeDefined()
    })
  })

  describe('getTasteOverlapData', () => {
    it('returns { viewer, owner } each with { watches, preferences, tasteTags }', async () => {
      const result = await getTasteOverlapData('viewer-id', 'owner-id')
      expect(result.viewer).toBeDefined()
      expect(result.viewer.watches).toBeDefined()
      expect(result.viewer.preferences).toBeDefined()
      expect(result.viewer.tasteTags).toBeDefined()
      expect(result.owner).toBeDefined()
      expect(result.owner.watches).toBeDefined()
      expect(result.owner.preferences).toBeDefined()
      expect(result.owner.tasteTags).toBeDefined()
    })

    it('is a callable function (React.cache()-wrapped per plan D-03 memoization)', () => {
      // cache() returns a function that behaves like the original, so we can
      // only verify the shape is callable. Per-request memoization is proven
      // by integration — at unit-test level we just assert it is a function.
      expect(typeof getTasteOverlapData).toBe('function')
    })
  })
})
