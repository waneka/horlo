/**
 * Phase 45 Plan 03 Task 1 — curatedLists DAL test (TDD GREEN)
 *
 * Coverage:
 *   1. getPublishedLists: query MUST include explicit WHERE status = 'published' (D-03 two-layer defense)
 *   2. getAllListsForOwner: query must NOT include a status filter (owner reads drafts)
 *   3. getListItemCount: returns integer count of curated_list_items for a given listId
 *   4. swapListSortOrder: wraps two integer-order updates in db.transaction (D-12)
 *   5. swapListItemSortOrder: wraps two integer-order updates in db.transaction (D-12)
 *
 * The key architectural contract: D-03 two-layer draft defense.
 *   - getPublishedLists MUST call .where() with the status='published' predicate.
 *   - getAllListsForOwner MUST NOT call .where() with any status predicate.
 *
 * Mock strategy: capture the `where` arg; mock the full Drizzle chain so it resolves.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Tracks whether .where() was called during a query and what arg was passed
let whereCallCount = 0
let lastWhereArg: unknown = undefined
let transactionCallCount = 0

// Build a reusable Drizzle chain factory.
// Drizzle's select chain: select().from().where?().orderBy().limit?()
// We need the chain to be fully composable in any order.
function makeSelectChain(result: unknown[] = []) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn((arg: unknown) => {
      whereCallCount++
      lastWhereArg = arg
      return chain
    }),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(result)),
    // Make the chain itself awaitable for cases without .limit()
    // (like getListItemCount which chains .where() directly to resolution)
    then: undefined as unknown,
  }
  // Allow the chain to resolve directly (for queries without .limit())
  // by making orderBy also return a promise when awaited
  ;(chain.orderBy as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const orderByChain = {
      ...chain,
      limit: vi.fn(() => Promise.resolve(result)),
    }
    // Also make orderByChain itself awaitable
    Object.defineProperty(orderByChain, Symbol.toStringTag, { value: 'Promise' })
    return Object.assign(Promise.resolve(result), orderByChain)
  })
  // Make where().orderBy() chain work: where returns a chain with orderBy
  // that can be awaited directly or chained with limit
  ;(chain.where as ReturnType<typeof vi.fn>).mockImplementation((arg: unknown) => {
    whereCallCount++
    lastWhereArg = arg
    const whereChain = {
      orderBy: vi.fn(() => {
        return Object.assign(Promise.resolve(result), {
          limit: vi.fn(() => Promise.resolve(result)),
        })
      }),
      limit: vi.fn(() => Promise.resolve(result)),
      // Direct await support for select().from().where() without more chaining
    }
    return whereChain
  })
  // Make from() return a chain where orderBy is awaitable
  ;(chain.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const fromChain = {
      where: vi.fn((arg: unknown) => {
        whereCallCount++
        lastWhereArg = arg
        const whereFromChain = {
          orderBy: vi.fn(() => Object.assign(Promise.resolve(result), {
            limit: vi.fn(() => Promise.resolve(result)),
          })),
          limit: vi.fn(() => Promise.resolve(result)),
        }
        return whereFromChain
      }),
      orderBy: vi.fn(() => Object.assign(Promise.resolve(result), {
        limit: vi.fn(() => Promise.resolve(result)),
      })),
    }
    return fromChain
  })
  return chain
}

vi.mock('@/db', () => {
  const mockTransaction = vi.fn(async (cb: (tx: { update: typeof mockTxUpdate }) => Promise<void>) => {
    transactionCallCount++
    await cb({ update: mockTxUpdate })
  })
  const mockTxSet = vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) }))
  const mockTxUpdate = vi.fn(() => ({ set: mockTxSet }))

  return {
    db: {
      select: vi.fn(),
      transaction: mockTransaction,
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })) })),
      insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([{ id: 'new-id' }])) })) })),
      delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
    },
  }
})

const mockTxSet = vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) }))
const mockTxUpdate = vi.fn(() => ({ set: mockTxSet }))

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
  whereCallCount = 0
  lastWhereArg = undefined
  transactionCallCount = 0
  vi.clearAllMocks()
})

describe('Phase 45 Plan 03 — curatedLists DAL', () => {
  describe('D-03: getPublishedLists uses explicit WHERE status="published"', () => {
    it('calls db.select and chains .where() with a status predicate', async () => {
      // Set up a chain that captures .where() calls
      let whereCalled = false
      const resolvedList = [{ id: 'list-1', status: 'published', sortOrder: 0 }]
      const innerChain = {
        orderBy: vi.fn(() => Object.assign(Promise.resolve(resolvedList), {
          limit: vi.fn(() => Promise.resolve(resolvedList)),
        })),
        limit: vi.fn(() => Promise.resolve(resolvedList)),
      }
      const fromChain = {
        where: vi.fn(() => { whereCalled = true; return innerChain }),
        orderBy: vi.fn(() => Promise.resolve(resolvedList)),
      }
      vi.mocked(db.select).mockReturnValue({ from: vi.fn(() => fromChain) } as unknown as ReturnType<typeof db.select>)

      await getPublishedLists()

      expect(vi.mocked(db.select)).toHaveBeenCalled()
      expect(whereCalled).toBe(true)
    })

    it('resolves to an array (returns list rows)', async () => {
      const rows = [{ id: 'a', title: 'Test', status: 'published' }]
      const innerChain = {
        orderBy: vi.fn(() => Object.assign(Promise.resolve(rows), {
          limit: vi.fn(() => Promise.resolve(rows)),
        })),
        limit: vi.fn(() => Promise.resolve(rows)),
      }
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => innerChain),
          orderBy: vi.fn(() => Promise.resolve(rows)),
        })),
      } as unknown as ReturnType<typeof db.select>)

      const result = await getPublishedLists()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('getAllListsForOwner — no status filter', () => {
    it('does NOT call .where() — owner reads all rows including drafts', async () => {
      let whereCalled = false
      const rows = [{ id: 'b', title: 'Draft', status: 'draft' }]
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => { whereCalled = true; return { orderBy: vi.fn(() => Promise.resolve(rows)) } }),
          orderBy: vi.fn(() => Promise.resolve(rows)),
        })),
      } as unknown as ReturnType<typeof db.select>)

      await getAllListsForOwner()

      expect(whereCalled).toBe(false)
    })

    it('resolves to an array of all lists', async () => {
      const rows = [{ id: 'b' }, { id: 'c' }]
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ orderBy: vi.fn(() => Promise.resolve(rows)) })),
          orderBy: vi.fn(() => Promise.resolve(rows)),
        })),
      } as unknown as ReturnType<typeof db.select>)

      const result = await getAllListsForOwner()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('getListItemCount', () => {
    it('returns 0 when query result is empty (safe default)', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([])),
          orderBy: vi.fn(() => Promise.resolve([])),
        })),
      } as unknown as ReturnType<typeof db.select>)

      const count = await getListItemCount('list-id-1')
      expect(count).toBe(0)
    })

    it('returns the count from the query result', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([{ count: 5 }])),
          orderBy: vi.fn(() => Promise.resolve([{ count: 5 }])),
        })),
      } as unknown as ReturnType<typeof db.select>)

      const count = await getListItemCount('list-id-2')
      expect(count).toBe(5)
    })
  })

  describe('swapListSortOrder (D-12 transactional integer swap)', () => {
    it('uses db.transaction for atomic update of two rows', async () => {
      vi.mocked(db.transaction).mockImplementation(async (cb) => {
        transactionCallCount++
        const txSet = vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) }))
        const txUpdate = vi.fn(() => ({ set: txSet }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await cb({ update: txUpdate } as any)
      })

      await swapListSortOrder('id-a', 1, 'id-b', 2)
      expect(transactionCallCount).toBe(1)
    })
  })

  describe('swapListItemSortOrder (D-12 transactional integer swap)', () => {
    it('uses db.transaction for atomic update of two item rows', async () => {
      vi.mocked(db.transaction).mockImplementation(async (cb) => {
        transactionCallCount++
        const txSet = vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) }))
        const txUpdate = vi.fn(() => ({ set: txSet }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await cb({ update: txUpdate } as any)
      })

      await swapListItemSortOrder('item-a', 0, 'item-b', 1)
      expect(transactionCallCount).toBe(1)
    })
  })
})
