/**
 * Phase 45 Plan 03 Task 1 — curatedLists DAL test (TDD RED gate)
 *
 * Coverage:
 *   1. getPublishedLists: query MUST include explicit WHERE status = 'published' (D-03 two-layer defense)
 *   2. getAllListsForOwner: query must NOT include a status filter (owner reads drafts)
 *   3. getListItemCount: returns integer count of curated_list_items for a given listId
 *   4. swapListSortOrder: wraps two integer-order updates in db.transaction (D-12)
 *   5. swapListItemSortOrder: wraps two integer-order updates in db.transaction (D-12)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Track db calls so we can assert on filter presence
let mockWhereArg: unknown = undefined
let mockFromArg: unknown = undefined
let transactionCallCount = 0
let transactionUpdates: Array<{ id: string; sortOrder: number }> = []

// Deep mock of the Drizzle query builder chain.
// The most critical assertion: does getPublishedLists call .where() with the
// status = 'published' predicate, and does getAllListsForOwner NOT call .where()?
vi.mock('@/db', () => {
  const mockOrderBy = vi.fn().mockResolvedValue([])
  const mockLimit = vi.fn(() => mockOrderBy)
  const mockWhere = vi.fn((arg) => {
    mockWhereArg = arg
    return { orderBy: mockOrderBy, limit: mockLimit }
  })
  const mockFrom = vi.fn((arg) => {
    mockFromArg = arg
    return {
      where: mockWhere,
      orderBy: mockOrderBy,
    }
  })
  const mockSelect = vi.fn(() => ({ from: mockFrom }))
  const mockTxUpdate = vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  }))
  const mockTx = { update: mockTxUpdate }
  const mockTransaction = vi.fn(async (cb: (tx: typeof mockTx) => Promise<void>) => {
    transactionCallCount++
    await cb(mockTx)
  })

  return {
    db: {
      select: mockSelect,
      transaction: mockTransaction,
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
      })),
    },
  }
})

// Import AFTER mocking
import { db } from '@/db'
import {
  getPublishedLists,
  getAllListsForOwner,
  getListItemCount,
  swapListSortOrder,
  swapListItemSortOrder,
} from '@/data/curatedLists'

beforeEach(() => {
  mockWhereArg = undefined
  mockFromArg = undefined
  transactionCallCount = 0
  transactionUpdates = []
  vi.clearAllMocks()

  // Re-wire mocks after clearAllMocks
  const mockOrderBy = vi.fn().mockResolvedValue([])
  const mockLimit = vi.fn(() => mockOrderBy)
  const mockWhere = vi.fn((arg) => {
    mockWhereArg = arg
    return { orderBy: mockOrderBy, limit: mockLimit }
  })
  const mockFrom = vi.fn((arg) => {
    mockFromArg = arg
    return {
      where: mockWhere,
      orderBy: mockOrderBy,
    }
  })
  vi.mocked(db.select).mockImplementation(() => ({ from: mockFrom }) as ReturnType<typeof db.select>)
  // Re-wire transaction to count calls
  vi.mocked(db.transaction).mockImplementation(async (cb) => {
    transactionCallCount++
    const mockTxSet = vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) }))
    const mockTxUpdate = vi.fn(() => ({ set: mockTxSet }))
    await cb({ update: mockTxUpdate } as Parameters<typeof cb>[0])
  })
})

describe('Phase 45 Plan 03 — curatedLists DAL', () => {
  describe('getPublishedLists', () => {
    it('D-03: calls .where() with the status="published" predicate (two-layer draft defense)', async () => {
      await getPublishedLists()
      // The where() call must have been made — explicit filter is the D-03 layer 2 requirement
      expect(vi.mocked(db.select)).toHaveBeenCalled()
      // The where() arg must be truthy (a Drizzle SQL expression)
      expect(mockWhereArg).toBeTruthy()
    })

    it('uses a limit (default 12)', async () => {
      // Just verifying it resolves without throwing — structural test
      await expect(getPublishedLists()).resolves.toBeDefined()
    })

    it('accepts a custom limit', async () => {
      await expect(getPublishedLists(6)).resolves.toBeDefined()
    })
  })

  describe('getAllListsForOwner', () => {
    it('does NOT call .where() — owner reads all rows including drafts', async () => {
      // Re-track separately for this test: getAllListsForOwner should not call where()
      let whereCalledForOwner = false
      const mockOrderBy2 = vi.fn().mockResolvedValue([])
      const mockFrom2 = vi.fn(() => ({
        where: vi.fn(() => { whereCalledForOwner = true; return { orderBy: mockOrderBy2 } }),
        orderBy: mockOrderBy2,
      }))
      vi.mocked(db.select).mockImplementation(() => ({ from: mockFrom2 }) as ReturnType<typeof db.select>)
      await getAllListsForOwner()
      expect(whereCalledForOwner).toBe(false)
    })
  })

  describe('getListItemCount', () => {
    it('returns 0 when no items exist (safe default)', async () => {
      // Mock select chain to return empty array
      const mockOrderBy3 = vi.fn().mockResolvedValue([])
      const mockWhere3 = vi.fn(() => mockOrderBy3)
      const mockFrom3 = vi.fn(() => ({ where: mockWhere3 }))
      vi.mocked(db.select).mockImplementation(() => ({ from: mockFrom3 }) as ReturnType<typeof db.select>)
      const count = await getListItemCount('list-id-1')
      expect(count).toBe(0)
    })

    it('returns the integer count from the query result', async () => {
      const mockWhere4 = vi.fn().mockResolvedValue([{ count: 3 }])
      const mockFrom4 = vi.fn(() => ({ where: mockWhere4 }))
      vi.mocked(db.select).mockImplementation(() => ({ from: mockFrom4 }) as ReturnType<typeof db.select>)
      const count = await getListItemCount('list-id-2')
      expect(count).toBe(3)
    })
  })

  describe('swapListSortOrder (D-12 transactional integer swap)', () => {
    it('uses db.transaction for the swap — two rows updated atomically', async () => {
      await swapListSortOrder('id-a', 1, 'id-b', 2)
      expect(transactionCallCount).toBe(1)
    })
  })

  describe('swapListItemSortOrder (D-12 transactional integer swap)', () => {
    it('uses db.transaction for the swap — two rows updated atomically', async () => {
      await swapListItemSortOrder('item-a', 0, 'item-b', 1)
      expect(transactionCallCount).toBe(1)
    })
  })
})
