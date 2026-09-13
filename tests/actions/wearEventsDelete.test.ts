// tests/actions/wearEventsDelete.test.ts — quick task 260913-cae —
// deleteWearEvent Server Action contract.
//
// Mock layout mirrors tests/actions/wearEventsBackfill.test.ts — vi.mock for
// getCurrentUser + DAL + next/cache + Storage; per-test mock configuration
// via (mockedFn as Mock).mockResolvedValueOnce / mockRejectedValueOnce.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Mock } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be declared BEFORE imports that pull in the action module so
// vitest's hoisted vi.mock factories replace the real modules before they load.
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

// Mock every named export from @/data/wearEvents that the action module's
// namespace import (`import * as wearEventDAL from '@/data/wearEvents'`)
// could touch — otherwise vitest throws "X is not a function" at action load.
vi.mock('@/data/wearEvents', () => ({
  logWearEventWithVideo: vi.fn(),
  logWearEventWithPhoto: vi.fn(),
  logWearEvent: vi.fn(),
  getWornTodayIdsForUser: vi.fn(),
  hideWearPic: vi.fn(),
  unhideWearPic: vi.fn(),
  deleteWearEventForOwner: vi.fn(),
}))

vi.mock('@/data/watches', () => ({
  getWatchById: vi.fn(),
}))

vi.mock('@/data/profiles', () => ({
  getProfileById: vi.fn(),
}))

vi.mock('@/data/activities', () => ({
  logActivity: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}))

const mockRemove = vi.fn()
const mockStorageFrom = vi.fn(() => ({ remove: mockRemove }))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    storage: { from: mockStorageFrom },
  })),
}))

import { deleteWearEvent } from '@/app/actions/wearEvents'
import { getCurrentUser } from '@/lib/auth'
import * as wearEventDAL from '@/data/wearEvents'
import * as profilesDAL from '@/data/profiles'
import { updateTag, revalidatePath, revalidateTag } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Test fixtures — valid v4 UUIDs
// ---------------------------------------------------------------------------
const userId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const otherUserId = '99999999-8888-4777-8666-555555555555'
const wearEventId = '11111111-2222-4333-8444-555555555555'
const watchId = '22222222-3333-4444-8555-666666666666'

const mockUser = { id: userId, email: 'p260913@horlo.test' }
const mockProfile = { username: 'alice' }

function authAs(user: { id: string; email: string } = mockUser) {
  ;(getCurrentUser as Mock).mockResolvedValueOnce(user)
}
function authFail() {
  ;(getCurrentUser as Mock).mockRejectedValueOnce(new Error('Not authenticated'))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('deleteWearEvent (260913-cae)', () => {
  let errSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    errSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('unauthenticated → Not authenticated; DAL not called', async () => {
    authFail()

    const r = await deleteWearEvent({ wearEventId })

    expect(r).toEqual({ success: false, error: 'Not authenticated' })
    expect(wearEventDAL.deleteWearEventForOwner).not.toHaveBeenCalled()
  })

  it('non-UUID wearEventId → Invalid input; DAL not called', async () => {
    authAs()

    const r = await deleteWearEvent({ wearEventId: 'not-a-uuid' })

    expect(r).toEqual({ success: false, error: 'Invalid input' })
    expect(wearEventDAL.deleteWearEventForOwner).not.toHaveBeenCalled()
  })

  it('extra keys (mass-assignment) → Invalid input; DAL not called', async () => {
    authAs()

    const r = await deleteWearEvent({ wearEventId, userId: otherUserId })

    expect(r).toEqual({ success: false, error: 'Invalid input' })
    expect(wearEventDAL.deleteWearEventForOwner).not.toHaveBeenCalled()
  })

  it('DAL returns null → Wear not found; storage/updateTag/revalidatePath not called', async () => {
    authAs()
    ;(wearEventDAL.deleteWearEventForOwner as Mock).mockResolvedValueOnce(null)

    const r = await deleteWearEvent({ wearEventId })

    expect(r).toEqual({ success: false, error: 'Wear not found' })
    expect(mockStorageFrom).not.toHaveBeenCalled()
    expect(updateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("DAL throws → \"Couldn't delete that wear.\"; console.error called", async () => {
    authAs()
    ;(wearEventDAL.deleteWearEventForOwner as Mock).mockRejectedValueOnce(new Error('boom'))

    const r = await deleteWearEvent({ wearEventId })

    expect(r).toEqual({ success: false, error: "Couldn't delete that wear." })
    expect(errSpy).toHaveBeenCalled()
  })

  it('photo wear → storage.remove called once with exactly the photo path', async () => {
    authAs()
    const photoPath = `${userId}/${wearEventId}.jpg`
    ;(wearEventDAL.deleteWearEventForOwner as Mock).mockResolvedValueOnce({
      watchId,
      storagePaths: [photoPath],
      activityMatch: 'matched',
      removedActivityCount: 1,
    })
    ;(profilesDAL.getProfileById as Mock).mockResolvedValueOnce(mockProfile)
    mockRemove.mockResolvedValueOnce({ error: null })

    const r = await deleteWearEvent({ wearEventId })

    expect(r.success).toBe(true)
    expect(mockStorageFrom).toHaveBeenCalledWith('wear-photos')
    expect(mockRemove).toHaveBeenCalledTimes(1)
    expect(mockRemove).toHaveBeenCalledWith([photoPath])
  })

  it('video wear → storage.remove called once with both mp4 + poster paths', async () => {
    authAs()
    const mediaPath = `${userId}/${wearEventId}.mp4`
    const posterPath = `${userId}/${wearEventId}-poster.jpg`
    ;(wearEventDAL.deleteWearEventForOwner as Mock).mockResolvedValueOnce({
      watchId,
      storagePaths: [mediaPath, posterPath],
      activityMatch: 'none',
      removedActivityCount: 0,
    })
    ;(profilesDAL.getProfileById as Mock).mockResolvedValueOnce(mockProfile)
    mockRemove.mockResolvedValueOnce({ error: null })

    const r = await deleteWearEvent({ wearEventId })

    expect(r.success).toBe(true)
    expect(mockRemove).toHaveBeenCalledTimes(1)
    expect(mockRemove).toHaveBeenCalledWith([mediaPath, posterPath])
  })

  it('no media (storagePaths []) → remove not called', async () => {
    authAs()
    ;(wearEventDAL.deleteWearEventForOwner as Mock).mockResolvedValueOnce({
      watchId,
      storagePaths: [],
      activityMatch: 'none',
      removedActivityCount: 0,
    })
    ;(profilesDAL.getProfileById as Mock).mockResolvedValueOnce(mockProfile)

    const r = await deleteWearEvent({ wearEventId })

    expect(r.success).toBe(true)
    expect(mockStorageFrom).not.toHaveBeenCalled()
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('a path under another user\'s prefix or containing ".." is filtered out and never passed to remove', async () => {
    authAs()
    const otherUserPath = `${otherUserId}/${wearEventId}.jpg`
    const traversalPath = `${userId}/../escape.jpg`
    ;(wearEventDAL.deleteWearEventForOwner as Mock).mockResolvedValueOnce({
      watchId,
      storagePaths: [otherUserPath, traversalPath],
      activityMatch: 'none',
      removedActivityCount: 0,
    })
    ;(profilesDAL.getProfileById as Mock).mockResolvedValueOnce(mockProfile)

    const r = await deleteWearEvent({ wearEventId })

    expect(r.success).toBe(true)
    expect(mockStorageFrom).not.toHaveBeenCalled()
    expect(mockRemove).not.toHaveBeenCalled()
    expect(errSpy).toHaveBeenCalled()
  })

  it('remove resolves with { error } → action still returns success; console.error called', async () => {
    authAs()
    const photoPath = `${userId}/${wearEventId}.jpg`
    ;(wearEventDAL.deleteWearEventForOwner as Mock).mockResolvedValueOnce({
      watchId,
      storagePaths: [photoPath],
      activityMatch: 'matched',
      removedActivityCount: 1,
    })
    ;(profilesDAL.getProfileById as Mock).mockResolvedValueOnce(mockProfile)
    mockRemove.mockResolvedValueOnce({ error: { message: 'storage down' } })

    const r = await deleteWearEvent({ wearEventId })

    expect(r.success).toBe(true)
    expect(errSpy).toHaveBeenCalled()
  })

  it('remove throws → action still returns success; console.error called', async () => {
    authAs()
    const photoPath = `${userId}/${wearEventId}.jpg`
    ;(wearEventDAL.deleteWearEventForOwner as Mock).mockResolvedValueOnce({
      watchId,
      storagePaths: [photoPath],
      activityMatch: 'matched',
      removedActivityCount: 1,
    })
    ;(profilesDAL.getProfileById as Mock).mockResolvedValueOnce(mockProfile)
    mockRemove.mockRejectedValueOnce(new Error('network down'))

    const r = await deleteWearEvent({ wearEventId })

    expect(r.success).toBe(true)
    expect(errSpy).toHaveBeenCalled()
  })

  it('success → revalidatePath, revalidatePath(w/[ref]), updateTag(profile), updateTag(viewer) all called; revalidateTag never called; data = { username }', async () => {
    authAs()
    ;(wearEventDAL.deleteWearEventForOwner as Mock).mockResolvedValueOnce({
      watchId,
      storagePaths: [],
      activityMatch: 'none',
      removedActivityCount: 0,
    })
    ;(profilesDAL.getProfileById as Mock).mockResolvedValueOnce(mockProfile)

    const r = await deleteWearEvent({ wearEventId })

    expect(revalidatePath).toHaveBeenCalledWith('/')
    expect(revalidatePath).toHaveBeenCalledWith('/w/[ref]', 'page')
    expect(updateTag).toHaveBeenCalledWith('profile:alice')
    expect(updateTag).toHaveBeenCalledWith(`viewer:${userId}`)
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(r).toEqual({ success: true, data: { username: 'alice' } })
  })

  it('ambiguous activityMatch logs a console.warn but still succeeds', async () => {
    authAs()
    ;(wearEventDAL.deleteWearEventForOwner as Mock).mockResolvedValueOnce({
      watchId,
      storagePaths: [],
      activityMatch: 'ambiguous',
      removedActivityCount: 0,
    })
    ;(profilesDAL.getProfileById as Mock).mockResolvedValueOnce(mockProfile)

    const r = await deleteWearEvent({ wearEventId })

    expect(r.success).toBe(true)
    expect(warnSpy).toHaveBeenCalled()
  })

  it('missing owner profile → still success; updateTag(profile:) not called but updateTag(viewer:) is', async () => {
    authAs()
    ;(wearEventDAL.deleteWearEventForOwner as Mock).mockResolvedValueOnce({
      watchId,
      storagePaths: [],
      activityMatch: 'none',
      removedActivityCount: 0,
    })
    ;(profilesDAL.getProfileById as Mock).mockResolvedValueOnce(null)

    const r = await deleteWearEvent({ wearEventId })

    expect(r).toEqual({ success: true, data: { username: null } })
    expect(updateTag).toHaveBeenCalledWith(`viewer:${userId}`)
    expect(updateTag).not.toHaveBeenCalledWith(expect.stringMatching(/^profile:/))
  })

  it('DAL is called with (user.id, wearEventId)', async () => {
    authAs()
    ;(wearEventDAL.deleteWearEventForOwner as Mock).mockResolvedValueOnce({
      watchId,
      storagePaths: [],
      activityMatch: 'none',
      removedActivityCount: 0,
    })
    ;(profilesDAL.getProfileById as Mock).mockResolvedValueOnce(mockProfile)

    await deleteWearEvent({ wearEventId })

    expect(wearEventDAL.deleteWearEventForOwner).toHaveBeenCalledWith(userId, wearEventId)
  })

  // Sanity: createSupabaseServerClient is only invoked when there is media to remove.
  it('createSupabaseServerClient not called when there is no media', async () => {
    authAs()
    ;(wearEventDAL.deleteWearEventForOwner as Mock).mockResolvedValueOnce({
      watchId,
      storagePaths: [],
      activityMatch: 'none',
      removedActivityCount: 0,
    })
    ;(profilesDAL.getProfileById as Mock).mockResolvedValueOnce(mockProfile)

    await deleteWearEvent({ wearEventId })

    expect(createSupabaseServerClient).not.toHaveBeenCalled()
  })
})
