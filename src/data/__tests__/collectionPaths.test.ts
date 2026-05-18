// src/data/__tests__/collectionPaths.test.ts
// Phase 45 Plan 04 — DAL test for collectionPaths (D-03 two-layer draft-leak defense).
//
// Mocks the db query builder at the import boundary BEFORE importing DAL modules.
// Key assertions:
//   1. getPublishedPaths carries an explicit WHERE status='published' predicate
//   2. getAllPathsForOwner does NOT carry a status filter
//   3. getCmsSettings returns safe default when row absent
//   4. setPinnedHero / clearPinnedHero write the id=1 row

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'

// Use vi.hoisted so these variables are available inside the vi.mock factory
// (vi.mock is hoisted to the top of the file by vitest; variables defined at
// module scope are NOT yet initialized at that point — vi.hoisted runs first).
const mocks = vi.hoisted(() => {
  const capturedWhereArgs: unknown[] = []
  const mockSelect = vi.fn()
  const mockUpdate = vi.fn()
  const mockInsert = vi.fn()
  const mockTransaction = vi.fn()
  return { capturedWhereArgs, mockSelect, mockUpdate, mockInsert, mockTransaction }
})

vi.mock('@/db', () => ({
  db: {
    select: mocks.mockSelect,
    update: mocks.mockUpdate,
    insert: mocks.mockInsert,
    transaction: mocks.mockTransaction,
  },
}))

// Import AFTER mocking
import {
  getPublishedPaths,
  getAllPathsForOwner,
} from '@/data/collectionPaths'
import {
  getCmsSettings,
  setPinnedHero,
  clearPinnedHero,
} from '@/data/cmsSettings'

import { collectionPaths } from '@/db/schema'

// ---------------------------------------------------------------------------
// Helpers — fresh chains per test to avoid cross-test pollution
// ---------------------------------------------------------------------------

/**
 * Build a fully-chainable select mock. Every method returns the chain itself.
 * The chain is also a thenable (Promise-like) that resolves to `rows`.
 * This handles both: await chain (cmsSettings — terminates at .limit())
 * and: await chain.orderBy().limit() (collectionPaths — more hops).
 */
function makeSelectChain(rows: unknown[] = []) {
  const chain: Record<string, unknown> = {}

  // All chainable methods
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn((arg: unknown) => {
    mocks.capturedWhereArgs.push(arg)
    return chain
  })
  chain.orderBy = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)

  // Make the chain itself a thenable so `await chain` resolves to rows
  chain.then = (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) => {
    return Promise.resolve(rows).then(resolve, reject)
  }
  chain.catch = (reject: (e: unknown) => void) => Promise.resolve(rows).catch(reject)
  chain.finally = (cb: () => void) => Promise.resolve(rows).finally(cb)

  return chain
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {}
  chain.set = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(Promise.resolve())
  return chain
}

beforeEach(() => {
  mocks.capturedWhereArgs.length = 0
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// getPublishedPaths — D-03: must carry status='published' predicate
// ---------------------------------------------------------------------------
describe('getPublishedPaths — D-03 two-layer draft-leak defense', () => {
  it('calls where() with eq(collectionPaths.status, "published") predicate', async () => {
    const chain = makeSelectChain([])
    mocks.mockSelect.mockReturnValue(chain)

    await getPublishedPaths()

    // where() must have been called
    expect(chain.where).toHaveBeenCalled()

    // The predicate passed to where() must match eq(collectionPaths.status, 'published').
    // Drizzle eq() returns a structured SQL expression object — assert deep equality.
    const expectedPredicate = eq(collectionPaths.status, 'published')
    expect(mocks.capturedWhereArgs[0]).toEqual(expectedPredicate)
  })

  it('returns empty array when no published paths exist', async () => {
    const chain = makeSelectChain([])
    mocks.mockSelect.mockReturnValue(chain)

    const result = await getPublishedPaths()
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getAllPathsForOwner — must NOT carry any status filter
// ---------------------------------------------------------------------------
describe('getAllPathsForOwner — no status filter for owner reads', () => {
  it('does NOT pass a status="published" predicate to where()', async () => {
    const chain = makeSelectChain([])
    mocks.mockSelect.mockReturnValue(chain)

    await getAllPathsForOwner()

    const expectedPublishedPredicate = eq(collectionPaths.status, 'published')
    for (const arg of mocks.capturedWhereArgs) {
      expect(arg).not.toEqual(expectedPublishedPredicate)
    }
  })
})

// ---------------------------------------------------------------------------
// getCmsSettings — safe default when row is absent
// ---------------------------------------------------------------------------
describe('getCmsSettings — safe default when row absent', () => {
  it('returns safe default object when no row exists (no throw)', async () => {
    const chain = makeSelectChain([]) // empty → no row
    mocks.mockSelect.mockReturnValue(chain)

    const result = await getCmsSettings()

    expect(result).toEqual({
      id: 1,
      pinnedListId: null,
      pinExpiresAt: null,
      heroFormat: 'featured_list',
      updatedAt: expect.any(Date),
    })
  })

  it('returns the database row when it exists', async () => {
    const fakeRow = {
      id: 1,
      pinnedListId: 'some-uuid',
      pinExpiresAt: new Date('2026-12-31'),
      heroFormat: 'featured_list' as const,
      updatedAt: new Date('2026-05-01'),
    }
    const chain = makeSelectChain([fakeRow])
    mocks.mockSelect.mockReturnValue(chain)

    const result = await getCmsSettings()

    expect(result.pinnedListId).toBe('some-uuid')
    expect(result.heroFormat).toBe('featured_list')
  })
})

// ---------------------------------------------------------------------------
// setPinnedHero / clearPinnedHero — write the id=1 row
// ---------------------------------------------------------------------------
describe('setPinnedHero — updates id=1 row', () => {
  it('calls db.update(cmsSettings).set({pinnedListId,...}).where(...)', async () => {
    const chain = makeUpdateChain()
    mocks.mockUpdate.mockReturnValue(chain)

    await setPinnedHero('test-list-uuid', null)

    expect(mocks.mockUpdate).toHaveBeenCalledTimes(1)
    expect(chain.set).toHaveBeenCalledTimes(1)
    expect(chain.where).toHaveBeenCalledTimes(1)
    const setArg = (chain.set as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(setArg.pinnedListId).toBe('test-list-uuid')
    expect(setArg.pinExpiresAt).toBeNull()
  })
})

describe('clearPinnedHero — nulls pin fields', () => {
  it('calls db.update(cmsSettings).set({pinnedListId:null,...}).where(...)', async () => {
    const chain = makeUpdateChain()
    mocks.mockUpdate.mockReturnValue(chain)

    await clearPinnedHero()

    expect(mocks.mockUpdate).toHaveBeenCalledTimes(1)
    expect(chain.set).toHaveBeenCalledTimes(1)
    const setArg = (chain.set as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(setArg.pinnedListId).toBeNull()
    expect(setArg.pinExpiresAt).toBeNull()
  })
})
