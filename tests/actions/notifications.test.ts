import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error {
    constructor(m = 'Not authenticated') {
      super(m)
      this.name = 'UnauthorizedError'
    }
  },
  getCurrentUser: vi.fn(),
}))

vi.mock('@/data/notifications', () => ({
  markAllReadForUser: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

import { markAllNotificationsRead } from '@/app/actions/notifications'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import * as notificationsDAL from '@/data/notifications'
import { revalidateTag } from 'next/cache'

const viewerUserId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

describe('markAllNotificationsRead Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { success: false, error: "Not authenticated" } when getCurrentUser throws', async () => {
    ;(getCurrentUser as Mock).mockRejectedValueOnce(new UnauthorizedError())
    const result = await markAllNotificationsRead()
    expect(result).toEqual({ success: false, error: 'Not authenticated' })
    expect(notificationsDAL.markAllReadForUser).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('calls markAllReadForUser(user.id) on success', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@example.com' })
    ;(notificationsDAL.markAllReadForUser as Mock).mockResolvedValueOnce(undefined)

    await markAllNotificationsRead()

    expect(notificationsDAL.markAllReadForUser).toHaveBeenCalledTimes(1)
    expect(notificationsDAL.markAllReadForUser).toHaveBeenCalledWith(viewerUserId)
  })

  it('calls revalidateTag with viewer tag AND "max" second arg (Next 16 two-arg form)', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@example.com' })
    ;(notificationsDAL.markAllReadForUser as Mock).mockResolvedValueOnce(undefined)

    await markAllNotificationsRead()

    expect(revalidateTag).toHaveBeenCalledTimes(1)
    expect(revalidateTag).toHaveBeenCalledWith(`viewer:${viewerUserId}`, 'max')
  })

  it('returns { success: true, data: undefined } on success', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@example.com' })
    ;(notificationsDAL.markAllReadForUser as Mock).mockResolvedValueOnce(undefined)

    const result = await markAllNotificationsRead()

    expect(result).toEqual({ success: true, data: undefined })
  })

  it('returns { success: false, error: <user-facing> } on unexpected DAL error', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@example.com' })
    ;(notificationsDAL.markAllReadForUser as Mock).mockRejectedValueOnce(new Error('DB exploded'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await markAllNotificationsRead()

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/couldn.?t mark/i)
    }
    expect(revalidateTag).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
