// tests/actions/watchPhotos.test.ts
//
// Phase 61 Plan 01 — Server action ownership + cap + set-mismatch + delete coverage
// Requirements: PHOTO-02, PHOTO-05, PHOTO-06
//
// Mock structure mirrors tests/actions/wishlist.test.ts for getCurrentUser + DAL.
// Error classes use vi.hoisted so they are available when vi.mock factory runs
// (vitest hoists vi.mock calls to top of file — top-level let/const not yet init).
// The hoisted classes mirror the real exported classes from @/data/watches so
// instanceof checks in the actions work correctly.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted error class stubs — must be defined with vi.hoisted so they are
// available when vi.mock() factories run (factories are hoisted to top of file).
// These mirror the real class shapes from src/data/watches.ts.
// ---------------------------------------------------------------------------
const {
  MockPhotoCapExceededError,
  MockOwnerMismatchError,
  MockSetMismatchError,
} = vi.hoisted(() => {
  class MockPhotoCapExceededError extends Error {
    constructor(public cap: number) {
      super(`Photo cap reached: a watch may have at most ${cap} photos`)
      this.name = 'PhotoCapExceededError'
    }
  }
  class MockOwnerMismatchError extends Error {
    constructor(public expected: number, public got: number) {
      super(`Owner mismatch: expected ${expected} rows, updated ${got}`)
      this.name = 'OwnerMismatchError'
    }
  }
  class MockSetMismatchError extends Error {
    constructor(public expected: number, public got: number) {
      super(`Set mismatch: user has ${expected} watchlist, received ${got}`)
      this.name = 'SetMismatchError'
    }
  }
  return { MockPhotoCapExceededError, MockOwnerMismatchError, MockSetMismatchError }
})

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/data/watches', () => ({
  addWatchPhoto: vi.fn(),
  bulkReorderPhotos: vi.fn(),
  deleteWatchPhoto: vi.fn(),
  PhotoCapExceededError: MockPhotoCapExceededError,
  OwnerMismatchError: MockOwnerMismatchError,
  SetMismatchError: MockSetMismatchError,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  addWatchPhotoAction,
  deleteWatchPhotoAction,
  reorderWatchPhotosAction,
} from '@/app/actions/watchPhotos'
import { getCurrentUser } from '@/lib/auth'
import * as watchDAL from '@/data/watches'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// Test fixtures — valid v4 UUIDs
// ---------------------------------------------------------------------------
const userId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const watchId = '11111111-2222-4333-8444-555555555555'
const photoId = '22222222-3333-4444-8555-666666666666'
const photo2Id = '33333333-4444-4555-8666-777777777777'
// storagePath MUST start with userId to pass the CR-02 folder-scope check.
// Format: `{userId}/{photoId}.jpg` — produced by buildWatchPhotoPath in
// src/lib/storage/watchPhotos.ts and enforced by addWatchPhotoAction.
const storagePath = `${userId}/${photoId}.jpg`
const victimUserId = 'ffffffff-eeee-4ddd-8ccc-bbbbbbbbbbbb'

const mockUser = { id: userId, email: 'test@horlo.app' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function authAs(user = mockUser) {
  ;(getCurrentUser as Mock).mockResolvedValueOnce(user)
}
function authFail() {
  ;(getCurrentUser as Mock).mockRejectedValueOnce(new Error('Not authenticated'))
}

// ---------------------------------------------------------------------------
// reorderWatchPhotosAction — PHOTO-05
// ---------------------------------------------------------------------------
describe('reorderWatchPhotosAction (PHOTO-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('(a) happy path — calls bulkReorderPhotos with session userId then revalidatePath', async () => {
    authAs()
    ;(watchDAL.bulkReorderPhotos as Mock).mockResolvedValueOnce(undefined)

    const orderedIds = [photoId, photo2Id]
    const result = await reorderWatchPhotosAction({ watchId, orderedIds })

    expect(result).toEqual({ success: true, data: undefined })
    expect(watchDAL.bulkReorderPhotos).toHaveBeenCalledWith(userId, watchId, orderedIds)
    expect(revalidatePath).toHaveBeenCalledWith('/w/[ref]', 'page')
  })

  it('(b1) OwnerMismatchError → locked user-facing copy', async () => {
    authAs()
    ;(watchDAL.bulkReorderPhotos as Mock).mockRejectedValueOnce(
      new MockOwnerMismatchError(2, 1),
    )

    const result = await reorderWatchPhotosAction({ watchId, orderedIds: [photoId, photo2Id] })

    expect(result).toEqual({ success: false, error: 'Some photos do not belong to you.' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('(b2) SetMismatchError → locked user-facing copy', async () => {
    authAs()
    ;(watchDAL.bulkReorderPhotos as Mock).mockRejectedValueOnce(
      new MockSetMismatchError(3, 2),
    )

    const result = await reorderWatchPhotosAction({ watchId, orderedIds: [photoId, photo2Id] })

    expect(result).toEqual({
      success: false,
      error: 'Photos changed in another tab. Refresh and try again.',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('(b3) unexpected error → generic fallback copy', async () => {
    authAs()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(watchDAL.bulkReorderPhotos as Mock).mockRejectedValueOnce(new Error('DB down'))

    const result = await reorderWatchPhotosAction({ watchId, orderedIds: [photoId] })

    expect(result).toEqual({ success: false, error: "Couldn't save new order." })
    errSpy.mockRestore()
  })

  it('(c) unauthenticated → Not authenticated; no DAL call', async () => {
    authFail()

    const result = await reorderWatchPhotosAction({ watchId, orderedIds: [photoId] })

    expect(result).toEqual({ success: false, error: 'Not authenticated' })
    expect(watchDAL.bulkReorderPhotos).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('(d) extra key in payload — .strict() rejects (mass-assignment: T-61-03)', async () => {
    authAs()

    const result = await reorderWatchPhotosAction({
      watchId,
      orderedIds: [photoId],
      userId: 'injected-bad-user-id',
    })

    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(watchDAL.bulkReorderPhotos).not.toHaveBeenCalled()
  })

  it('(d2) non-UUID watchId — zod uuid rejects', async () => {
    authAs()

    const result = await reorderWatchPhotosAction({
      watchId: 'not-a-uuid',
      orderedIds: [photoId],
    })

    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(watchDAL.bulkReorderPhotos).not.toHaveBeenCalled()
  })

  it('(d3) empty orderedIds — min(1) rejects', async () => {
    authAs()

    const result = await reorderWatchPhotosAction({ watchId, orderedIds: [] })

    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(watchDAL.bulkReorderPhotos).not.toHaveBeenCalled()
  })

  it('(d4) orderedIds > 10 — max(10) rejects (T-61-04 cap backstop)', async () => {
    authAs()
    const tooMany = Array.from({ length: 11 }, (_, i) =>
      `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`,
    )

    const result = await reorderWatchPhotosAction({ watchId, orderedIds: tooMany })

    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(watchDAL.bulkReorderPhotos).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// addWatchPhotoAction — PHOTO-02
// ---------------------------------------------------------------------------
describe('addWatchPhotoAction (PHOTO-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('(e) happy path — calls addWatchPhoto + revalidatePath, returns new row id', async () => {
    authAs()
    const insertedRow = {
      id: photoId,
      watchId,
      storagePath,
      sortOrder: 0,
      createdAt: new Date(),
    }
    ;(watchDAL.addWatchPhoto as Mock).mockResolvedValueOnce(insertedRow)

    const result = await addWatchPhotoAction({ watchId, storagePath })

    expect(result).toEqual({ success: true, data: { id: photoId } })
    expect(watchDAL.addWatchPhoto).toHaveBeenCalledWith(userId, watchId, storagePath)
    expect(revalidatePath).toHaveBeenCalledWith('/w/[ref]', 'page')
  })

  it('(e2) PhotoCapExceededError → cap-reached error result (T-61-04)', async () => {
    authAs()
    ;(watchDAL.addWatchPhoto as Mock).mockRejectedValueOnce(
      new MockPhotoCapExceededError(10),
    )

    const result = await addWatchPhotoAction({ watchId, storagePath })

    expect(result.success).toBe(false)
    expect((result as { success: false; error: string }).error).toMatch(/cap|limit|10/i)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('(c) unauthenticated → Not authenticated; no DAL call', async () => {
    authFail()

    const result = await addWatchPhotoAction({ watchId, storagePath })

    expect(result).toEqual({ success: false, error: 'Not authenticated' })
    expect(watchDAL.addWatchPhoto).not.toHaveBeenCalled()
  })

  it('(d) extra key — .strict() rejects (userId injection blocked: T-61-03)', async () => {
    authAs()

    const result = await addWatchPhotoAction({
      watchId,
      storagePath,
      userId: 'injected',
    })

    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(watchDAL.addWatchPhoto).not.toHaveBeenCalled()
  })

  it('(d2) empty storagePath — min(1) rejects', async () => {
    authAs()

    const result = await addWatchPhotoAction({ watchId, storagePath: '' })

    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(watchDAL.addWatchPhoto).not.toHaveBeenCalled()
  })

  it('userId comes from session, NEVER from client payload (T-61-03)', async () => {
    authAs({ id: userId, email: 'test@horlo.app' })
    ;(watchDAL.addWatchPhoto as Mock).mockResolvedValueOnce({
      id: photoId,
      watchId,
      storagePath,
      sortOrder: 0,
      createdAt: new Date(),
    })

    await addWatchPhotoAction({ watchId, storagePath })

    // First arg to addWatchPhoto must be the session user id, not any client value
    const [calledUserId] = (watchDAL.addWatchPhoto as Mock).mock.calls[0]
    expect(calledUserId).toBe(userId)
  })

  // CR-02: cross-tenant storagePath injection must be rejected before DAL call.
  it('(CR-02-a) storagePath scoped to another user — rejected; no DAL call', async () => {
    authAs()

    const crossUserPath = `${victimUserId}/${photoId}.jpg`
    const result = await addWatchPhotoAction({ watchId, storagePath: crossUserPath })

    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(watchDAL.addWatchPhoto).not.toHaveBeenCalled()
  })

  it('(CR-02-b) storagePath containing ".." — rejected by zod refine; no DAL call', async () => {
    authAs()

    const traversalPath = `${userId}/../${victimUserId}/photo.jpg`
    const result = await addWatchPhotoAction({ watchId, storagePath: traversalPath })

    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(watchDAL.addWatchPhoto).not.toHaveBeenCalled()
  })

  it('(CR-02-c) valid storagePath scoped to caller — accepted', async () => {
    authAs()
    ;(watchDAL.addWatchPhoto as Mock).mockResolvedValueOnce({
      id: photoId,
      watchId,
      storagePath,
      sortOrder: 0,
      createdAt: new Date(),
    })

    const result = await addWatchPhotoAction({ watchId, storagePath })

    expect(result).toEqual({ success: true, data: { id: photoId } })
    expect(watchDAL.addWatchPhoto).toHaveBeenCalledWith(userId, watchId, storagePath)
  })
})

// ---------------------------------------------------------------------------
// deleteWatchPhotoAction — PHOTO-06
// ---------------------------------------------------------------------------
describe('deleteWatchPhotoAction (PHOTO-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('(f) happy path — calls deleteWatchPhoto + revalidatePath', async () => {
    authAs()
    ;(watchDAL.deleteWatchPhoto as Mock).mockResolvedValueOnce(undefined)

    const result = await deleteWatchPhotoAction({ watchId, photoId })

    expect(result).toEqual({ success: true, data: undefined })
    expect(watchDAL.deleteWatchPhoto).toHaveBeenCalledWith(userId, watchId, photoId)
    expect(revalidatePath).toHaveBeenCalledWith('/w/[ref]', 'page')
  })

  it('(f2) DAL throws (photo not found / ownership fail) → error result (T-61-02)', async () => {
    authAs()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(watchDAL.deleteWatchPhoto as Mock).mockRejectedValueOnce(
      new Error('Photo not found'),
    )

    const result = await deleteWatchPhotoAction({ watchId, photoId })

    expect(result).toEqual({ success: false, error: "Couldn't delete photo." })
    expect(revalidatePath).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('(c) unauthenticated → Not authenticated; no DAL call', async () => {
    authFail()

    const result = await deleteWatchPhotoAction({ watchId, photoId })

    expect(result).toEqual({ success: false, error: 'Not authenticated' })
    expect(watchDAL.deleteWatchPhoto).not.toHaveBeenCalled()
  })

  it('(d) extra key — .strict() rejects (T-61-03 mass-assignment)', async () => {
    authAs()

    const result = await deleteWatchPhotoAction({
      watchId,
      photoId,
      sortOrder: 0,
    })

    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(watchDAL.deleteWatchPhoto).not.toHaveBeenCalled()
  })

  it('(d2) non-UUID photoId — zod uuid rejects', async () => {
    authAs()

    const result = await deleteWatchPhotoAction({ watchId, photoId: 'bad-id' })

    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(watchDAL.deleteWatchPhoto).not.toHaveBeenCalled()
  })
})
