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

// Capture arguments passed to .where() so we can assert predicate contents
let capturedWhereArgs: unknown[] = []

const mockSelect = vi.fn()
const mockUpdate = vi.fn()
const mockInsert = vi.fn()
const mockTransaction = vi.fn()

// Build a chainable mock for select queries
function makeSelectChain(rows: unknown[] = []) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn((arg) => {
      capturedWhereArgs.push(arg)
      return chain
    }),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
    then: undefined as unknown,
  }
  // Make it thenable so awaiting it returns rows
  Object.defineProperty(chain, 'then', {
    get() {
      return (resolve: (v: unknown[]) => void) => resolve(rows)
    },
  })
  return chain
}

// Build a chainable mock for update queries
function makeUpdateChain() {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    then: undefined as unknown,
  }
  Object.defineProperty(chain, 'then', {
    get() {
      return (resolve: () => void) => resolve()
    },
  })
  return chain
}

vi.mock('@/db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
    transaction: mockTransaction,
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

beforeEach(() => {
  capturedWhereArgs = []
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// getPublishedPaths — D-03: must carry status='published' predicate
// ---------------------------------------------------------------------------
describe('getPublishedPaths — D-03 two-layer draft-leak defense', () => {
  it('calls where() with eq(collectionPaths.status, "published") predicate', async () => {
    const chain = makeSelectChain([])
    mockSelect.mockReturnValue(chain)

    await getPublishedPaths()

    // where() must have been called
    expect(chain.where).toHaveBeenCalled()

    // The predicate passed to where() must be the Drizzle eq() expression
    // comparing collectionPaths.status against 'published'.
    // We assert structural equality by checking it matches the expression
    // produced by eq(collectionPaths.status, 'published').
    const expectedPredicate = eq(collectionPaths.status, 'published')
    expect(capturedWhereArgs[0]).toEqual(expectedPredicate)
  })

  it('returns empty array when no published paths exist', async () => {
    const chain = makeSelectChain([])
    mockSelect.mockReturnValue(chain)

    const result = await getPublishedPaths()
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getAllPathsForOwner — must NOT carry any status filter
// ---------------------------------------------------------------------------
describe('getAllPathsForOwner — no status filter for owner reads', () => {
  it('does NOT call where() with a status predicate', async () => {
    const chain = makeSelectChain([])
    mockSelect.mockReturnValue(chain)

    await getAllPathsForOwner()

    // where() may or may not have been called, but if it was,
    // it should NOT carry a status predicate
    for (const arg of capturedWhereArgs) {
      const expectedPublishedPredicate = eq(collectionPaths.status, 'published')
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
    mockSelect.mockReturnValue(chain)

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
    mockSelect.mockReturnValue(chain)

    const result = await getCmsSettings()

    expect(result.pinnedListId).toBe('some-uuid')
    expect(result.heroFormat).toBe('featured_list')
  })
})

// ---------------------------------------------------------------------------
// setPinnedHero / clearPinnedHero — write the id=1 row
// ---------------------------------------------------------------------------
describe('setPinnedHero — updates id=1 row', () => {
  it('calls db.update(cmsSettings).set(...).where(...) for setPinnedHero', async () => {
    const chain = makeUpdateChain()
    mockUpdate.mockReturnValue(chain)

    await setPinnedHero('test-list-uuid', null)

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(chain.set).toHaveBeenCalledTimes(1)
    expect(chain.where).toHaveBeenCalledTimes(1)
    const setArg = chain.set.mock.calls[0][0] as Record<string, unknown>
    expect(setArg.pinnedListId).toBe('test-list-uuid')
    expect(setArg.pinExpiresAt).toBeNull()
  })
})

describe('clearPinnedHero — nulls pin fields', () => {
  it('calls db.update(cmsSettings).set({pinnedListId:null,...}).where(...)', async () => {
    const chain = makeUpdateChain()
    mockUpdate.mockReturnValue(chain)

    await clearPinnedHero()

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(chain.set).toHaveBeenCalledTimes(1)
    const setArg = chain.set.mock.calls[0][0] as Record<string, unknown>
    expect(setArg.pinnedListId).toBeNull()
    expect(setArg.pinExpiresAt).toBeNull()
  })
})
