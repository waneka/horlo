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
  markOneReadForUser: vi.fn(),
  touchLastSeenAt: vi.fn(),
}))

vi.mock('next/cache', () => ({
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

import {
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationsSeen,
} from '@/app/actions/notifications'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import * as notificationsDAL from '@/data/notifications'
import { updateTag, revalidateTag } from 'next/cache'

const viewerUserId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const notificationId = 'cccccccc-dddd-4eee-8fff-000000000001'

describe('markAllNotificationsRead Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { success: false, error: "Not authenticated" } when getCurrentUser throws', async () => {
    ;(getCurrentUser as Mock).mockRejectedValueOnce(new UnauthorizedError())
    const result = await markAllNotificationsRead()
    expect(result).toEqual({ success: false, error: 'Not authenticated' })
    expect(notificationsDAL.markAllReadForUser).not.toHaveBeenCalled()
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('calls markAllReadForUser(user.id) on success', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@example.com' })
    ;(notificationsDAL.markAllReadForUser as Mock).mockResolvedValueOnce(undefined)

    await markAllNotificationsRead()

    expect(notificationsDAL.markAllReadForUser).toHaveBeenCalledTimes(1)
    expect(notificationsDAL.markAllReadForUser).toHaveBeenCalledWith(viewerUserId)
  })

  it('calls updateTag (NOT revalidateTag) with the viewer tag — read-your-own-writes primitive (debug session notifications-revalidate-tag-in-render round 4)', async () => {
    // revalidateTag(tag, 'max') is stale-while-revalidate and does NOT mark
    // pathWasRevalidated, so the SA response skips the RSC refetch — the
    // persistent NotificationBell keeps serving its stale entry on the next
    // navigation. updateTag(tag) is immediate expiration; the SA response
    // includes a fresh RSC payload so the bell reflects the write.
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@example.com' })
    ;(notificationsDAL.markAllReadForUser as Mock).mockResolvedValueOnce(undefined)

    await markAllNotificationsRead()

    expect(updateTag).toHaveBeenCalledTimes(1)
    expect(updateTag).toHaveBeenCalledWith(`viewer:${viewerUserId}`)
    expect(revalidateTag).not.toHaveBeenCalled()
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
    expect(updateTag).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

describe('markNotificationRead Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns "Not authenticated" when getCurrentUser throws', async () => {
    ;(getCurrentUser as Mock).mockRejectedValueOnce(new UnauthorizedError())
    const result = await markNotificationRead({ notificationId })
    expect(result).toEqual({ success: false, error: 'Not authenticated' })
    expect(notificationsDAL.markOneReadForUser).not.toHaveBeenCalled()
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('rejects input that fails Zod validation', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@example.com' })
    const result = await markNotificationRead({ notificationId: 'not-a-uuid' })
    expect(result).toEqual({ success: false, error: 'Invalid notification id' })
    expect(notificationsDAL.markOneReadForUser).not.toHaveBeenCalled()
  })

  it('calls updateTag (NOT revalidateTag) with the viewer tag — read-your-own-writes primitive', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@example.com' })
    ;(notificationsDAL.markOneReadForUser as Mock).mockResolvedValueOnce(undefined)

    const result = await markNotificationRead({ notificationId })

    expect(result).toEqual({ success: true, data: undefined })
    expect(notificationsDAL.markOneReadForUser).toHaveBeenCalledWith(
      viewerUserId,
      notificationId,
    )
    expect(updateTag).toHaveBeenCalledTimes(1)
    expect(updateTag).toHaveBeenCalledWith(`viewer:${viewerUserId}`)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})

describe('markNotificationsSeen Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns "Not authenticated" when getCurrentUser throws', async () => {
    ;(getCurrentUser as Mock).mockRejectedValueOnce(new UnauthorizedError())
    const result = await markNotificationsSeen()
    expect(result).toEqual({ success: false, error: 'Not authenticated' })
    expect(notificationsDAL.touchLastSeenAt).not.toHaveBeenCalled()
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('calls touchLastSeenAt(user.id) and then updateTag (NOT revalidateTag) — read-your-own-writes primitive (debug session notifications-revalidate-tag-in-render round 4)', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@example.com' })
    ;(notificationsDAL.touchLastSeenAt as Mock).mockResolvedValueOnce(undefined)

    const result = await markNotificationsSeen()

    expect(result).toEqual({ success: true, data: undefined })
    expect(notificationsDAL.touchLastSeenAt).toHaveBeenCalledWith(viewerUserId)
    expect(updateTag).toHaveBeenCalledTimes(1)
    expect(updateTag).toHaveBeenCalledWith(`viewer:${viewerUserId}`)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('returns error on DAL failure and does NOT invalidate cache (ordering: DB write MUST commit before tag invalidation)', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@example.com' })
    ;(notificationsDAL.touchLastSeenAt as Mock).mockRejectedValueOnce(new Error('DB exploded'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await markNotificationsSeen()

    expect(result.success).toBe(false)
    expect(updateTag).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
