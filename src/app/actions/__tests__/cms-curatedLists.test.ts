/**
 * Phase 45 Plan 03 Task 2 — curatedLists Server Action test (TDD RED → GREEN)
 *
 * Coverage (from plan behaviors):
 *   1. Every action returns { success:false, error:'Not authorized' } when assertOwner() throws
 *   2. createCuratedList with unknown key is rejected by zod .strict()
 *   3. publishCuratedList on a list with zero items returns { success:false } and never sets status
 *   4. publishCuratedList and unpublishCuratedList both call revalidateTag('explore:hero','max')
 *   5. moveListItemUp/Down produce the expected reordered sequence
 *
 * NOTE: Per AGENTS.md — verified revalidateTag two-arg form from
 *   node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md
 *   Confirmed: revalidateTag(tag, 'max') is the recommended two-argument form.
 *   Single-argument form is deprecated in Next.js 16.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'

// Mock @/lib/auth — must export assertOwner, getCurrentUser, UnauthorizedError
vi.mock('@/lib/auth', () => {
  class UnauthorizedError extends Error {
    constructor(message = 'Not authenticated') {
      super(message)
      this.name = 'UnauthorizedError'
    }
  }
  return {
    UnauthorizedError,
    getCurrentUser: vi.fn(),
    assertOwner: vi.fn(),
  }
})

// Mock next/cache — revalidateTag is the only primitive used in CMS actions
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))

// Mock @/data/curatedLists DAL
vi.mock('@/data/curatedLists', () => ({
  createList: vi.fn(),
  updateList: vi.fn(),
  deleteList: vi.fn(),
  setListStatus: vi.fn(),
  getListItemCount: vi.fn(),
  addListItem: vi.fn(),
  updateListItemCommentary: vi.fn(),
  removeListItem: vi.fn(),
  getListItems: vi.fn(),
  getAllListsForOwner: vi.fn(),
  getListById: vi.fn(),
  getListWithItems: vi.fn(),
  swapListSortOrder: vi.fn(),
  swapListItemSortOrder: vi.fn(),
}))

// Import AFTER mocking
import { assertOwner, UnauthorizedError } from '@/lib/auth'
import { revalidateTag } from 'next/cache'
import * as curatedListsDAL from '@/data/curatedLists'
import {
  createCuratedList,
  updateCuratedList,
  deleteCuratedList,
  addWatchToList,
  updateListItemCommentary,
  removeWatchFromList,
  moveListUp,
  moveListDown,
  moveListItemUp,
  moveListItemDown,
  publishCuratedList,
  unpublishCuratedList,
} from '@/app/actions/cms/curatedLists'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'
const VALID_UUID_2 = '22222222-2222-4222-8222-222222222222'
const VALID_UUID_3 = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  vi.clearAllMocks()
  // Default: assertOwner succeeds (authenticated admin)
  vi.mocked(assertOwner).mockResolvedValue({ id: 'user-1', email: 'admin@example.com' })
})

// ─── Behavior 1: Every action rejects when assertOwner() throws ───

describe('Behavior 1: D-06 — every action returns Not authorized when assertOwner throws', () => {
  beforeEach(() => {
    vi.mocked(assertOwner).mockRejectedValue(new UnauthorizedError('Not an admin'))
  })

  it('createCuratedList: returns { success:false, error:"Not authorized" }', async () => {
    const result = await createCuratedList({ title: 'Test', curatorName: 'Editor' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })

  it('updateCuratedList: returns { success:false, error:"Not authorized" }', async () => {
    const result = await updateCuratedList({ id: VALID_UUID, title: 'Updated' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })

  it('deleteCuratedList: returns { success:false, error:"Not authorized" }', async () => {
    const result = await deleteCuratedList(VALID_UUID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })

  it('addWatchToList: returns { success:false, error:"Not authorized" }', async () => {
    const result = await addWatchToList({ listId: VALID_UUID, catalogId: VALID_UUID_2 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })

  it('publishCuratedList: returns { success:false, error:"Not authorized" }', async () => {
    const result = await publishCuratedList(VALID_UUID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })

  it('unpublishCuratedList: returns { success:false, error:"Not authorized" }', async () => {
    const result = await unpublishCuratedList(VALID_UUID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })

  it('moveListUp: returns { success:false, error:"Not authorized" }', async () => {
    const result = await moveListUp(VALID_UUID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })

  it('moveListItemUp: returns { success:false, error:"Not authorized" }', async () => {
    const result = await moveListItemUp(VALID_UUID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })
})

// ─── Behavior 2: Zod .strict() rejects unknown keys ───

describe('Behavior 2: Zod .strict() — createCuratedList rejects unknown keys', () => {
  it('returns { success:false } when payload has an extra unknown key', async () => {
    const result = await createCuratedList({
      title: 'My List',
      curatorName: 'Editor',
      // Unknown key — .strict() must reject
      userId: 'injected-user-id',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeTruthy()
  })

  it('succeeds with a valid payload (no extra keys)', async () => {
    vi.mocked(curatedListsDAL.createList).mockResolvedValue(VALID_UUID)
    const result = await createCuratedList({ title: 'Valid List', curatorName: 'Editor' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual({ id: VALID_UUID })
  })
})

// ─── Behavior 3: publishCuratedList zero-watch guard (CMS-06) ───

describe('Behavior 3: CMS-06 zero-watch publish guard', () => {
  it('returns { success:false } when item count is 0 — does NOT set status', async () => {
    vi.mocked(curatedListsDAL.getListItemCount).mockResolvedValue(0)

    const result = await publishCuratedList(VALID_UUID)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/no watches/i)
    }
    // MUST NOT call setListStatus when zero watches
    expect(vi.mocked(curatedListsDAL.setListStatus)).not.toHaveBeenCalled()
  })

  it('succeeds when item count is > 0 and calls setListStatus("published")', async () => {
    vi.mocked(curatedListsDAL.getListItemCount).mockResolvedValue(3)
    vi.mocked(curatedListsDAL.setListStatus).mockResolvedValue(undefined)

    const result = await publishCuratedList(VALID_UUID)

    expect(result.success).toBe(true)
    expect(vi.mocked(curatedListsDAL.setListStatus)).toHaveBeenCalledWith(VALID_UUID, 'published')
  })
})

// ─── Behavior 4: publish/unpublish revalidate explore:hero ───

describe('Behavior 4: revalidateTag("explore:hero","max") on publish and unpublish', () => {
  it('publishCuratedList calls revalidateTag("explore:hero", "max")', async () => {
    vi.mocked(curatedListsDAL.getListItemCount).mockResolvedValue(2)
    vi.mocked(curatedListsDAL.setListStatus).mockResolvedValue(undefined)

    await publishCuratedList(VALID_UUID)

    expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith('explore:hero', 'max')
  })

  it('unpublishCuratedList calls revalidateTag("explore:hero", "max")', async () => {
    vi.mocked(curatedListsDAL.setListStatus).mockResolvedValue(undefined)

    await unpublishCuratedList(VALID_UUID)

    expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith('explore:hero', 'max')
  })

  it('does NOT call updateTag (must use revalidateTag not updateTag per RESEARCH.md)', async () => {
    vi.mocked(curatedListsDAL.getListItemCount).mockResolvedValue(1)
    vi.mocked(curatedListsDAL.setListStatus).mockResolvedValue(undefined)

    await publishCuratedList(VALID_UUID)

    // updateTag is for read-your-own-writes; hero is global — must use revalidateTag
    const { updateTag } = await import('next/cache')
    expect(vi.mocked(updateTag)).not.toHaveBeenCalled()
  })
})

// ─── Behavior 5: moveListItemUp/Down correct reordering ───

describe('Behavior 5: moveListItemUp/Down correct reordering sequence', () => {
  const item1 = { id: VALID_UUID, listId: VALID_UUID_3, catalogId: VALID_UUID_2, sortOrder: 0, createdAt: new Date(), commentary: null }
  const item2 = { id: VALID_UUID_2, listId: VALID_UUID_3, catalogId: VALID_UUID, sortOrder: 1, createdAt: new Date(), commentary: null }
  const item3 = { id: VALID_UUID_3, listId: VALID_UUID_3, catalogId: '33333333-3333-4333-8333-333333333334', sortOrder: 2, createdAt: new Date(), commentary: null }

  it('moveListItemUp swaps the item with the item above it (item at index 1 → index 0)', async () => {
    vi.mocked(curatedListsDAL.getListItems).mockResolvedValue([item1, item2, item3])
    vi.mocked(curatedListsDAL.swapListItemSortOrder).mockResolvedValue(undefined)

    const result = await moveListItemUp(VALID_UUID_2)

    expect(result.success).toBe(true)
    // Swap: item2 (sortOrder 1) with item1 (sortOrder 0)
    expect(vi.mocked(curatedListsDAL.swapListItemSortOrder)).toHaveBeenCalledWith(
      VALID_UUID_2, 1, VALID_UUID, 0
    )
  })

  it('moveListItemUp is a no-op when item is already first (sortOrder 0)', async () => {
    vi.mocked(curatedListsDAL.getListItems).mockResolvedValue([item1, item2, item3])

    const result = await moveListItemUp(VALID_UUID)

    // Already first — no swap needed, no error
    expect(result.success).toBe(true)
    expect(vi.mocked(curatedListsDAL.swapListItemSortOrder)).not.toHaveBeenCalled()
  })

  it('moveListItemDown swaps the item with the item below it', async () => {
    vi.mocked(curatedListsDAL.getListItems).mockResolvedValue([item1, item2, item3])
    vi.mocked(curatedListsDAL.swapListItemSortOrder).mockResolvedValue(undefined)

    const result = await moveListItemDown(VALID_UUID_2)

    expect(result.success).toBe(true)
    // Swap: item2 (sortOrder 1) with item3 (sortOrder 2)
    expect(vi.mocked(curatedListsDAL.swapListItemSortOrder)).toHaveBeenCalledWith(
      VALID_UUID_2, 1, VALID_UUID_3, 2
    )
  })

  it('moveListItemDown is a no-op when item is already last', async () => {
    vi.mocked(curatedListsDAL.getListItems).mockResolvedValue([item1, item2, item3])

    const result = await moveListItemDown(VALID_UUID_3)

    // Already last — no swap needed, no error
    expect(result.success).toBe(true)
    expect(vi.mocked(curatedListsDAL.swapListItemSortOrder)).not.toHaveBeenCalled()
  })
})
