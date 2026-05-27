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

vi.mock('@/data/reactions', () => ({
  getLikesForTarget: vi.fn(),
  createLike: vi.fn(),
  deleteLike: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  // NOTE: revalidatePath is NOT mocked — reactions.ts does not call it (PATTERNS.md note)
}))

vi.mock('@/lib/notifications/logger', () => ({
  // Explicit resolved Promise so the awaited call in the action body
  // doesn't short-circuit into try/catch with a non-thenable mock.
  logNotification: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/data/profiles', () => ({ getProfileById: vi.fn() }))

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
  },
}))
vi.mock('@/db/schema', () => ({ watches: {}, wearEvents: {} }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }))

import { toggleLikeAction } from '@/app/actions/reactions'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import * as reactionsDAL from '@/data/reactions'
import { revalidateTag, updateTag } from 'next/cache'
import { logNotification } from '@/lib/notifications/logger'
import { getProfileById } from '@/data/profiles'
import { db } from '@/db'

// Valid v4 UUID literals (M=4, N∈{8,9,a,b}) so z.string().uuid() accepts them.
const viewerUserId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const watchOwnerId = '11111111-2222-4333-8444-555555555555'
const watchId = '22222222-3333-4444-8555-666666666666'
const wearEventId = '33333333-4444-4555-8666-777777777777'

// Helper: set up the db.select() chain to return a specific row
function setupDbSelectChain(rows: unknown[]) {
  const limitMock = vi.fn().mockResolvedValue(rows)
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock })
  const fromMock = vi.fn().mockReturnValue({ where: whereMock })
  ;(db.select as Mock).mockReturnValue({ from: fromMock })
}

describe('toggleLikeAction Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // SEC-03: auth-first — unauthenticated caller is rejected before any DAL call
  it('SEC-03: returns { success: false, error: \'Not authenticated\' } when getCurrentUser throws, DAL not called', async () => {
    ;(getCurrentUser as Mock).mockRejectedValueOnce(new UnauthorizedError())

    const result = await toggleLikeAction({ type: 'watch', id: watchId })

    expect(result).toEqual({ success: false, error: 'Not authenticated' })
    expect(reactionsDAL.getLikesForTarget).not.toHaveBeenCalled()
    expect(reactionsDAL.createLike).not.toHaveBeenCalled()
    expect(reactionsDAL.deleteLike).not.toHaveBeenCalled()
  })

  // SEC-03: Zod .strict() mass-assignment guard — extra keys are rejected
  it('SEC-03: rejects payload with extra keys via .strict() (mass-assignment guard)', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'viewer@example.com',
    })

    // Attempt to inject actorId into the payload — .strict() must reject this
    const result = await toggleLikeAction({ type: 'watch', id: watchId, actorId: 'forged' })

    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(reactionsDAL.getLikesForTarget).not.toHaveBeenCalled()
  })

  // NOTIF-11: like direction — logNotification called when liked===true and owner !== viewer
  it('NOTIF-11: on like (viewerHasLiked:false, owner !== viewer) — createLike called, logNotification called with type watch_like', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'viewer@example.com',
    })
    ;(getProfileById as Mock).mockResolvedValueOnce({
      username: 'viewer',
      displayName: 'Viewer User',
    })
    ;(reactionsDAL.getLikesForTarget as Mock).mockResolvedValueOnce({
      count: 0,
      viewerHasLiked: false,
    })
    ;(reactionsDAL.createLike as Mock).mockResolvedValueOnce(undefined)
    // db.select chain for owner lookup
    setupDbSelectChain([{ userId: watchOwnerId }])

    const result = await toggleLikeAction({ type: 'watch', id: watchId })

    expect(reactionsDAL.createLike).toHaveBeenCalledTimes(1)
    expect(logNotification).toHaveBeenCalledTimes(1)
    expect(logNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'watch_like' })
    )
    expect(result).toMatchObject({ success: true, data: { liked: true } })
  })

  // NOTIF-11 (unlike): unlike direction — deleteLike called, logNotification NOT called
  it('NOTIF-11: on unlike (viewerHasLiked:true) — deleteLike called, logNotification NOT called', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'viewer@example.com',
    })
    ;(getProfileById as Mock).mockResolvedValueOnce({
      username: 'viewer',
      displayName: 'Viewer User',
    })
    ;(reactionsDAL.getLikesForTarget as Mock).mockResolvedValueOnce({
      count: 1,
      viewerHasLiked: true,
    })
    ;(reactionsDAL.deleteLike as Mock).mockResolvedValueOnce(undefined)
    setupDbSelectChain([{ userId: watchOwnerId }])

    const result = await toggleLikeAction({ type: 'watch', id: watchId })

    expect(reactionsDAL.deleteLike).toHaveBeenCalledTimes(1)
    expect(logNotification).not.toHaveBeenCalled()
    expect(result).toMatchObject({ success: true, data: { liked: false } })
  })

  // NOTIF-11 (self-guard): viewer === owner — logNotification NOT called even on like direction
  it('NOTIF-11: self-guard — logNotification NOT called when target owner === viewer', async () => {
    // viewer IS the owner
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'viewer@example.com',
    })
    ;(getProfileById as Mock).mockResolvedValueOnce({
      username: 'viewer',
      displayName: 'Viewer User',
    })
    ;(reactionsDAL.getLikesForTarget as Mock).mockResolvedValueOnce({
      count: 0,
      viewerHasLiked: false,
    })
    ;(reactionsDAL.createLike as Mock).mockResolvedValueOnce(undefined)
    // owner === viewer (self-like)
    setupDbSelectChain([{ userId: viewerUserId }])

    await toggleLikeAction({ type: 'watch', id: watchId })

    expect(logNotification).not.toHaveBeenCalled()
  })

  // SEC-05: on successful like, BOTH revalidateTag('reactions:watch:{id}', 'max')
  // AND updateTag('viewer:{viewerId}:reactions') are called
  it('SEC-05: on successful like calls revalidateTag(reactions:watch:{id}, max) AND updateTag(viewer:{id}:reactions)', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'viewer@example.com',
    })
    ;(getProfileById as Mock).mockResolvedValueOnce({
      username: 'viewer',
      displayName: 'Viewer User',
    })
    ;(reactionsDAL.getLikesForTarget as Mock).mockResolvedValueOnce({
      count: 0,
      viewerHasLiked: false,
    })
    ;(reactionsDAL.createLike as Mock).mockResolvedValueOnce(undefined)
    setupDbSelectChain([{ userId: watchOwnerId }])

    await toggleLikeAction({ type: 'watch', id: watchId })

    // Cross-user fan-out tag (DAL discriminator 'watch', not 'wear_event')
    expect(revalidateTag).toHaveBeenCalledWith(`reactions:watch:${watchId}`, 'max')
    // RYO tag — actor sees own liked state immediately (Server-Action-only updateTag)
    expect(updateTag).toHaveBeenCalledWith(`viewer:${viewerUserId}:reactions`)
  })

  // D-12: on successful like, revalidateTag('viewer:{userId}:counts', 'max') is called
  it('D-12: on successful like calls revalidateTag(viewer:{userId}:counts, max)', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'viewer@example.com' })
    ;(getProfileById as Mock).mockResolvedValueOnce({ username: 'viewer', displayName: 'Viewer User' })
    ;(reactionsDAL.getLikesForTarget as Mock).mockResolvedValueOnce({ count: 0, viewerHasLiked: false })
    ;(reactionsDAL.createLike as Mock).mockResolvedValueOnce(undefined)
    setupDbSelectChain([{ userId: watchOwnerId, brand: 'Rolex', model: 'Sub' }])
    ;(getProfileById as Mock).mockResolvedValueOnce({ username: 'owner', displayName: 'Owner' }) // owner profile for revalidateTag

    await toggleLikeAction({ type: 'watch', id: watchId })

    // D-12: viewer's batched counts tag must be busted so liked+canComment re-hydrates correctly
    expect(revalidateTag).toHaveBeenCalledWith(`viewer:${viewerUserId}:counts`, 'max')
  })
})
