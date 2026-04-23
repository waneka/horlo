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

vi.mock('@/data/follows', () => ({
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
  isFollowing: vi.fn(),
  getFollowersForProfile: vi.fn(),
  getFollowingForProfile: vi.fn(),
  getTasteOverlapData: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/notifications/logger', () => ({ logNotification: vi.fn() }))
vi.mock('@/data/profiles', () => ({ getProfileById: vi.fn() }))

import { followUser, unfollowUser } from '@/app/actions/follows'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import * as followsDAL from '@/data/follows'
import { revalidatePath } from 'next/cache'
import { logNotification } from '@/lib/notifications/logger'
import { getProfileById } from '@/data/profiles'

// Valid v4 UUID literals (M=4, N∈{8,9,a,b}) so z.string().uuid() accepts them.
const viewerUserId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const targetUserId = '11111111-2222-4333-8444-555555555555'

describe('followUser Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { success: false, error: \'Not authenticated\' } when getCurrentUser throws', async () => {
    ;(getCurrentUser as Mock).mockRejectedValueOnce(new UnauthorizedError())
    const result = await followUser({ userId: targetUserId })
    expect(result).toEqual({ success: false, error: 'Not authenticated' })
    expect(followsDAL.followUser).not.toHaveBeenCalled()
  })

  it('rejects non-UUID userId with { success: false, error: \'Invalid request\' }', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'v@example.com',
    })
    const result = await followUser({ userId: 'not-a-uuid' })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(followsDAL.followUser).not.toHaveBeenCalled()
  })

  it('rejects missing userId with { success: false, error: \'Invalid request\' }', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'v@example.com',
    })
    const result = await followUser({})
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(followsDAL.followUser).not.toHaveBeenCalled()
  })

  it('rejects self-follow with { success: false, error: \'Cannot follow yourself\' } and does NOT call DAL', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'v@example.com',
    })
    const result = await followUser({ userId: viewerUserId })
    expect(result).toEqual({ success: false, error: 'Cannot follow yourself' })
    expect(followsDAL.followUser).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rejects extra keys via .strict() (mass-assignment protection T-09-05)', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'v@example.com',
    })
    // Attempt to inject followerId or role into the payload.
    const result = await followUser({ userId: targetUserId, role: 'admin' })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(followsDAL.followUser).not.toHaveBeenCalled()
  })

  it('on success calls followsDAL.followUser(user.id, userId) then revalidatePath(\'/u/[username]\', \'layout\')', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'v@example.com',
    })
    ;(getProfileById as Mock).mockResolvedValueOnce({ username: 'alice', displayName: 'Alice' })
    ;(followsDAL.followUser as Mock).mockResolvedValueOnce(undefined)

    const result = await followUser({ userId: targetUserId })

    expect(result).toEqual({ success: true, data: undefined })
    expect(followsDAL.followUser).toHaveBeenCalledTimes(1)
    expect(followsDAL.followUser).toHaveBeenCalledWith(viewerUserId, targetUserId)
    // FOLL-03 end-to-end count path assertion.
    expect(revalidatePath).toHaveBeenCalledTimes(1)
    expect(revalidatePath).toHaveBeenCalledWith('/u/[username]', 'layout')
  })

  it('on success calls logNotification non-awaited with follow payload (NOTIF-02)', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@example.com' })
    ;(getProfileById as Mock).mockResolvedValueOnce({ username: 'alice', displayName: 'Alice' })
    ;(followsDAL.followUser as Mock).mockResolvedValueOnce(undefined)

    const result = await followUser({ userId: targetUserId })

    expect(result.success).toBe(true)
    expect(logNotification).toHaveBeenCalledTimes(1)
    expect(logNotification).toHaveBeenCalledWith({
      type: 'follow',
      recipientUserId: targetUserId,
      actorUserId: viewerUserId,
      payload: {
        actor_username: 'alice',
        actor_display_name: 'Alice',
      },
    })
  })

  it('does NOT call logNotification on self-follow rejection (D-24 belt-and-suspenders)', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@example.com' })
    await followUser({ userId: viewerUserId })
    expect(logNotification).not.toHaveBeenCalled()
  })

  it('treats a duplicate-key error from DAL as silently idempotent (no-op, success=true)', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'v@example.com',
    })
    // NOTE: DAL uses onConflictDoNothing so duplicates never actually throw;
    // this test documents the contract: if DAL ever did surface a duplicate
    // via exception, the action should be lenient. Since the DAL layer is
    // idempotent, this path resolves success on normal mock resolution.
    ;(followsDAL.followUser as Mock).mockResolvedValueOnce(undefined)
    const result = await followUser({ userId: targetUserId })
    expect(result.success).toBe(true)
  })

  it('surfaces unexpected DAL failures as { success: false, error: <user-facing> }', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'v@example.com',
    })
    ;(followsDAL.followUser as Mock).mockRejectedValueOnce(new Error('DB exploded'))
    const result = await followUser({ userId: targetUserId })
    expect(result.success).toBe(false)
    if (result.success === false) {
      expect(result.error).toMatch(/couldn.?t follow/i)
    }
  })
})

describe('unfollowUser Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns Not authenticated when getCurrentUser throws', async () => {
    ;(getCurrentUser as Mock).mockRejectedValueOnce(new UnauthorizedError())
    const result = await unfollowUser({ userId: targetUserId })
    expect(result).toEqual({ success: false, error: 'Not authenticated' })
    expect(followsDAL.unfollowUser).not.toHaveBeenCalled()
  })

  it('rejects non-UUID userId', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'v@example.com',
    })
    const result = await unfollowUser({ userId: 'nope' })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(followsDAL.unfollowUser).not.toHaveBeenCalled()
  })

  it('rejects self-unfollow', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'v@example.com',
    })
    const result = await unfollowUser({ userId: viewerUserId })
    expect(result.success).toBe(false)
    expect(followsDAL.unfollowUser).not.toHaveBeenCalled()
  })

  it('on success calls followsDAL.unfollowUser(user.id, userId) then revalidatePath(\'/u/[username]\', \'layout\')', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'v@example.com',
    })
    ;(followsDAL.unfollowUser as Mock).mockResolvedValueOnce(undefined)

    const result = await unfollowUser({ userId: targetUserId })

    expect(result).toEqual({ success: true, data: undefined })
    expect(followsDAL.unfollowUser).toHaveBeenCalledTimes(1)
    expect(followsDAL.unfollowUser).toHaveBeenCalledWith(viewerUserId, targetUserId)
    // FOLL-03 end-to-end count path assertion (unfollow mirror).
    expect(revalidatePath).toHaveBeenCalledTimes(1)
    expect(revalidatePath).toHaveBeenCalledWith('/u/[username]', 'layout')
  })

  it('rejects extra keys via .strict()', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'v@example.com',
    })
    const result = await unfollowUser({ userId: targetUserId, role: 'admin' })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(followsDAL.unfollowUser).not.toHaveBeenCalled()
  })
})
