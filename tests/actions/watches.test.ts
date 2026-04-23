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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/notifications/logger', () => ({ logNotification: vi.fn() }))
vi.mock('@/data/notifications', () => ({ findOverlapRecipients: vi.fn() }))
vi.mock('@/data/profiles', () => ({ getProfileById: vi.fn() }))

import { addWatch, editWatch, removeWatch } from '@/app/actions/watches'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import * as watchDAL from '@/data/watches'
import { logNotification } from '@/lib/notifications/logger'
import { findOverlapRecipients } from '@/data/notifications'
import { getProfileById } from '@/data/profiles'
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
