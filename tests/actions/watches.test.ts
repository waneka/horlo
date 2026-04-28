import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error {
    constructor(m = 'Not authenticated') {
      super(m)
      this.name = 'UnauthorizedError'
    }
  },
  getCurrentUser: vi.fn(),
}))
vi.mock('@/data/watches', () => ({
  createWatch: vi.fn(),
  updateWatch: vi.fn(),
  deleteWatch: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  // Bug fix (debug session notifications-revalidate-tag-in-render):
  // addWatch now invalidates each watch_overlap recipient's bell cache.
  revalidateTag: vi.fn(),
}))
vi.mock('@/lib/notifications/logger', () => ({
  // Explicit resolved Promise so the now-awaited logger call doesn't short-
  // circuit the action's try/catch with a non-thenable mock value.
  logNotification: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/data/notifications', () => ({ findOverlapRecipients: vi.fn() }))
vi.mock('@/data/profiles', () => ({ getProfileById: vi.fn() }))

import { addWatch, editWatch, removeWatch } from '@/app/actions/watches'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import * as watchDAL from '@/data/watches'
import { logNotification } from '@/lib/notifications/logger'
import { findOverlapRecipients } from '@/data/notifications'
import { getProfileById } from '@/data/profiles'
import { revalidateTag } from 'next/cache'
import type { Watch } from '@/lib/types'

const validWatch = {
  brand: 'Omega', model: 'Seamaster', status: 'owned' as const, movement: 'automatic' as const,
}

const viewerUserId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const recipientUserId = '11111111-2222-4333-8444-555555555555'

describe('watches Server Actions auth gate — AUTH-02', () => {
  beforeEach(() => vi.clearAllMocks())

  it('addWatch returns Not authenticated when getCurrentUser throws', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new UnauthorizedError())
    await expect(addWatch(validWatch)).resolves.toEqual({
      success: false,
      error: 'Not authenticated',
    })
    expect(watchDAL.createWatch).not.toHaveBeenCalled()
  })

  it('editWatch returns Not authenticated when getCurrentUser throws', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new UnauthorizedError())
    await expect(editWatch('w-1', validWatch)).resolves.toEqual({
      success: false,
      error: 'Not authenticated',
    })
  })

  it('removeWatch returns Not authenticated when getCurrentUser throws', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new UnauthorizedError())
    await expect(removeWatch('w-1')).resolves.toEqual({
      success: false,
      error: 'Not authenticated',
    })
  })

  it('addWatch calls DAL.createWatch with session user.id', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(watchDAL.createWatch).mockResolvedValue({ id: 'w-1', ...validWatch } as any)
    await addWatch(validWatch)
    expect(watchDAL.createWatch).toHaveBeenCalledWith('u-1', expect.objectContaining(validWatch))
  })

  it('editWatch(watchId, data) uses new two-arg signature', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(watchDAL.updateWatch).mockResolvedValue({ id: 'w-1', ...validWatch } as any)
    await editWatch('w-1', { brand: 'Rolex' })
    expect(watchDAL.updateWatch).toHaveBeenCalledWith('u-1', 'w-1', expect.objectContaining({ brand: 'Rolex' }))
  })

  it('removeWatch(watchId) uses new one-arg signature', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(watchDAL.deleteWatch).mockResolvedValue(undefined)
    await removeWatch('w-1')
    expect(watchDAL.deleteWatch).toHaveBeenCalledWith('u-1', 'w-1')
  })

  it('editWatch maps DAL "not found or access denied" to Not found', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(watchDAL.updateWatch).mockRejectedValue(
      new Error('Watch not found or access denied: w-1'),
    )
    await expect(editWatch('w-1', { brand: 'Rolex' })).resolves.toEqual({
      success: false,
      error: 'Not found',
    })
  })
})

describe('addWatch — overlap notification wiring (NOTIF-03)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls findOverlapRecipients + logNotification per recipient for owned status', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, email: 'a@b.co' })
    vi.mocked(watchDAL.createWatch).mockResolvedValue(
      { id: 'w-1', ...validWatch, status: 'owned' } as unknown as Watch
    )
    vi.mocked(findOverlapRecipients).mockResolvedValue([{ userId: recipientUserId }])
    vi.mocked(getProfileById).mockResolvedValue(
      { username: 'alice', displayName: 'Alice' } as unknown as Awaited<ReturnType<typeof getProfileById>>
    )

    const result = await addWatch(validWatch)

    expect(result.success).toBe(true)
    expect(findOverlapRecipients).toHaveBeenCalledTimes(1)
    expect(findOverlapRecipients).toHaveBeenCalledWith({
      brand: 'Omega',
      model: 'Seamaster',
      actorUserId: viewerUserId,
    })
    expect(logNotification).toHaveBeenCalledTimes(1)
    expect(logNotification).toHaveBeenCalledWith({
      type: 'watch_overlap',
      recipientUserId: recipientUserId,
      actorUserId: viewerUserId,
      payload: expect.objectContaining({
        actor_username: 'alice',
        watch_brand: 'Omega',
        watch_model: 'Seamaster',
        watch_brand_normalized: 'omega',
        watch_model_normalized: 'seamaster',
      }),
    })
    // Bug fix (debug session notifications-revalidate-tag-in-render):
    // after inserting the overlap notification, the recipient's bell cache
    // tag MUST be invalidated so their unread dot lights up on next render.
    expect(revalidateTag).toHaveBeenCalledWith(`viewer:${recipientUserId}`, 'max')
  })

  it('does NOT call findOverlapRecipients for wishlist status (RESEARCH Open Q #1)', async () => {
    const wishlistWatch = { ...validWatch, status: 'wishlist' as const }
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, email: 'a@b.co' })
    vi.mocked(watchDAL.createWatch).mockResolvedValue(
      { id: 'w-1', ...wishlistWatch } as unknown as Watch
    )

    await addWatch(wishlistWatch)

    expect(findOverlapRecipients).not.toHaveBeenCalled()
    expect(logNotification).not.toHaveBeenCalled()
  })

  it('does NOT call findOverlapRecipients for grail status (RESEARCH Open Q #1)', async () => {
    const grailWatch = { ...validWatch, status: 'grail' as const }
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, email: 'a@b.co' })
    vi.mocked(watchDAL.createWatch).mockResolvedValue(
      { id: 'w-1', ...grailWatch } as unknown as Watch
    )

    await addWatch(grailWatch)

    expect(findOverlapRecipients).not.toHaveBeenCalled()
    expect(logNotification).not.toHaveBeenCalled()
  })

  it('resolves {success:true} even when findOverlapRecipients throws (fire-and-forget)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, email: 'a@b.co' })
    vi.mocked(watchDAL.createWatch).mockResolvedValue(
      { id: 'w-1', ...validWatch, status: 'owned' } as unknown as Watch
    )
    vi.mocked(findOverlapRecipients).mockRejectedValue(new Error('DB timeout'))

    const result = await addWatch(validWatch)

    expect(result.success).toBe(true)
    expect(logNotification).not.toHaveBeenCalled()
  })
})

describe('watches Server Actions — explore fan-out invalidation (Phase 18 DISC-05/06)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('addWatch fires revalidateTag(\'explore\', \'max\') on success', async () => {
    // Phase 18 Plan 05 — bare 'explore' fan-out tag invalidates Trending +
    // Gaining Traction + Popular Collectors rails on next render. Two-arg
    // form per Pitfall 4 — single-arg revalidateTag is legacy.
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, email: 'a@b.co' })
    vi.mocked(watchDAL.createWatch).mockResolvedValue(
      { id: 'w-1', ...validWatch, status: 'owned' } as unknown as Watch
    )
    vi.mocked(findOverlapRecipients).mockResolvedValue([])

    const result = await addWatch(validWatch)

    expect(result.success).toBe(true)
    expect(revalidateTag).toHaveBeenCalledWith('explore', 'max')
  })

  it('addWatch does NOT fire \'explore\' tag on validation error', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, email: 'a@b.co' })

    const result = await addWatch({ /* missing required brand/model */ })

    expect(result.success).toBe(false)
    expect(revalidateTag).not.toHaveBeenCalledWith('explore', 'max')
  })

  it('addWatch does NOT fire \'explore\' tag on DAL failure', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, email: 'a@b.co' })
    vi.mocked(watchDAL.createWatch).mockRejectedValue(new Error('DB exploded'))

    const result = await addWatch(validWatch)

    expect(result.success).toBe(false)
    expect(revalidateTag).not.toHaveBeenCalledWith('explore', 'max')
  })

  it('editWatch fires revalidateTag(\'explore\', \'max\') on success', async () => {
    // editWatch can change status (owned ↔ wishlist) → owners_count and
    // wishlist_count shift on next pg_cron refresh, so the fan-out is
    // necessary to keep Trending + Gaining Traction in sync.
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, email: 'a@b.co' })
    vi.mocked(watchDAL.updateWatch).mockResolvedValue(
      { id: 'w-1', ...validWatch } as unknown as Watch
    )

    const result = await editWatch('w-1', { brand: 'Rolex' })

    expect(result.success).toBe(true)
    expect(revalidateTag).toHaveBeenCalledWith('explore', 'max')
  })

  it('editWatch does NOT fire \'explore\' tag on validation error', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, email: 'a@b.co' })

    // brand: '' fails the min(1) requirement
    const result = await editWatch('w-1', { brand: '' })

    expect(result.success).toBe(false)
    expect(revalidateTag).not.toHaveBeenCalledWith('explore', 'max')
  })

  it('editWatch does NOT fire \'explore\' tag on DAL failure', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, email: 'a@b.co' })
    vi.mocked(watchDAL.updateWatch).mockRejectedValue(new Error('DB exploded'))

    const result = await editWatch('w-1', { brand: 'Rolex' })

    expect(result.success).toBe(false)
    expect(revalidateTag).not.toHaveBeenCalledWith('explore', 'max')
  })

  it('removeWatch fires revalidateTag(\'explore\', \'max\') on success', async () => {
    // DELETE on watches table → owners_count/wishlist_count both shift on
    // the next pg_cron refresh — fan-out keeps the rails in sync.
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, email: 'a@b.co' })
    vi.mocked(watchDAL.deleteWatch).mockResolvedValue(undefined)

    const result = await removeWatch('w-1')

    expect(result.success).toBe(true)
    expect(revalidateTag).toHaveBeenCalledWith('explore', 'max')
  })

  it('removeWatch does NOT fire \'explore\' tag on DAL failure', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, email: 'a@b.co' })
    vi.mocked(watchDAL.deleteWatch).mockRejectedValue(new Error('DB exploded'))

    const result = await removeWatch('w-1')

    expect(result.success).toBe(false)
    expect(revalidateTag).not.toHaveBeenCalledWith('explore', 'max')
  })
})
