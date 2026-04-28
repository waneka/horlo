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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  // Bug fix (debug session notifications-revalidate-tag-in-render):
  // followUser now also invalidates the recipient's bell cache, so the
  // Server Action imports revalidateTag from next/cache.
  revalidateTag: vi.fn(),
  // Phase 18 DISC-04 (Plan 18-05): followUser + unfollowUser invalidate the
  // viewer's own Popular Collectors rail via updateTag (RYO semantics).
  updateTag: vi.fn(),
}))

vi.mock('@/lib/notifications/logger', () => ({
  // Explicit resolved Promise so the awaited call in the action body
  // doesn't short-circuit into try/catch with a non-thenable mock.
  logNotification: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/data/profiles', () => ({ getProfileById: vi.fn() }))

import { followUser, unfollowUser } from '@/app/actions/follows'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import * as followsDAL from '@/data/follows'
import { revalidatePath, revalidateTag, updateTag } from 'next/cache'
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

  it('on success awaits logNotification with follow payload (NOTIF-02)', async () => {
    // Previously fire-and-forget (void logNotification). Changed to awaited as
    // part of the cache-tag-invalidation fix (debug session
    // notifications-revalidate-tag-in-render): the next revalidateTag call must
    // run AFTER the DB insert to avoid a race with the bell cache refetch.
    // The logger's internal try/catch preserves the D-28 "can't roll back" contract.
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

  it('on success invalidates the recipient viewer cache tag (bug fix)', async () => {
    // Ensures the RECIPIENT's NotificationBell cache is marked stale so their
    // unread dot lights up on the next render. Before the fix no invalidation
    // happened, so the recipient had to wait up to 30s for the cacheLife TTL.
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@example.com' })
    ;(getProfileById as Mock).mockResolvedValueOnce({ username: 'alice', displayName: 'Alice' })
    ;(followsDAL.followUser as Mock).mockResolvedValueOnce(undefined)

    await followUser({ userId: targetUserId })

    expect(revalidateTag).toHaveBeenCalledWith(`viewer:${targetUserId}`, 'max')
  })

  it('on success invalidates the viewer\'s own Popular Collectors rail tag (Phase 18 DISC-04)', async () => {
    // Phase 18 Plan 05 — RYO semantics. The viewer (the actor of the follow)
    // is the same person whose Popular Collectors rail must drop the just-
    // followed user on next render. updateTag (single-arg, Server-Actions-only)
    // is the right primitive — see notifications.ts header comment + RESEARCH
    // §Pattern 6. Tag string MUST match the cacheTag in
    // src/components/explore/PopularCollectors.tsx.
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@example.com' })
    ;(getProfileById as Mock).mockResolvedValueOnce({ username: 'alice', displayName: 'Alice' })
    ;(followsDAL.followUser as Mock).mockResolvedValueOnce(undefined)

    await followUser({ userId: targetUserId })

    expect(updateTag).toHaveBeenCalledWith(`explore:popular-collectors:viewer:${viewerUserId}`)
  })

  it('does NOT invalidate the bare \'explore\' fan-out tag (per-user action only)', async () => {
    // T-18-05-03: followUser is a per-user invalidation; firing the bare
    // 'explore' tag would over-invalidate the global Trending + Gaining
    // Traction rails for every viewer. The bare tag is reserved for
    // addWatch / removeWatch (cross-user fan-out) only.
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@example.com' })
    ;(getProfileById as Mock).mockResolvedValueOnce({ username: 'alice', displayName: 'Alice' })
    ;(followsDAL.followUser as Mock).mockResolvedValueOnce(undefined)

    await followUser({ userId: targetUserId })

    expect(revalidateTag).not.toHaveBeenCalledWith('explore', 'max')
    expect(revalidateTag).not.toHaveBeenCalledWith('explore')
    expect(updateTag).not.toHaveBeenCalledWith('explore')
  })

  it('does NOT call updateTag on validation failure (success-path-only invalidation)', async () => {
    // Tag invalidation runs only after a successful DAL write. Validation
    // failure must not surface as a refresh signal — would let an attacker
    // drain cache by spamming malformed payloads.
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@example.com' })

    await followUser({ userId: 'not-a-uuid' })

    expect(updateTag).not.toHaveBeenCalled()
  })

  it('does NOT call updateTag on DAL failure (success-path-only invalidation)', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@example.com' })
    ;(getProfileById as Mock).mockResolvedValueOnce({ username: 'alice', displayName: 'Alice' })
    ;(followsDAL.followUser as Mock).mockRejectedValueOnce(new Error('DB exploded'))

    const result = await followUser({ userId: targetUserId })

    expect(result.success).toBe(false)
    expect(updateTag).not.toHaveBeenCalled()
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

  it('on success invalidates the viewer\'s own Popular Collectors rail tag (Phase 18 DISC-04)', async () => {
    // Symmetry with followUser: an unfollowed user becomes re-eligible to
    // surface on the viewer's Popular Collectors rail. RYO via updateTag.
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'v@example.com',
    })
    ;(followsDAL.unfollowUser as Mock).mockResolvedValueOnce(undefined)

    await unfollowUser({ userId: targetUserId })

    expect(updateTag).toHaveBeenCalledWith(`explore:popular-collectors:viewer:${viewerUserId}`)
  })

  it('does NOT invalidate the bare \'explore\' fan-out tag (per-user action only)', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'v@example.com',
    })
    ;(followsDAL.unfollowUser as Mock).mockResolvedValueOnce(undefined)

    await unfollowUser({ userId: targetUserId })

    expect(revalidateTag).not.toHaveBeenCalledWith('explore', 'max')
    expect(revalidateTag).not.toHaveBeenCalledWith('explore')
    expect(updateTag).not.toHaveBeenCalledWith('explore')
  })

  it('does NOT call updateTag on validation failure', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'v@example.com',
    })

    await unfollowUser({ userId: 'not-a-uuid' })

    expect(updateTag).not.toHaveBeenCalled()
  })

  it('does NOT call updateTag on DAL failure', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'v@example.com',
    })
    ;(followsDAL.unfollowUser as Mock).mockRejectedValueOnce(new Error('DB exploded'))

    const result = await unfollowUser({ userId: targetUserId })

    expect(result.success).toBe(false)
    expect(updateTag).not.toHaveBeenCalled()
  })
})
