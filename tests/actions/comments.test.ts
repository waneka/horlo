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

vi.mock('@/data/comments', () => ({
  createComment: vi.fn(),
  editComment: vi.fn(),
  deleteComment: vi.fn(),
  // CommentGateError: typed error for wishlist mutual-follow gate (D-09)
  CommentGateError: class extends Error {
    constructor(m = 'Mutual follow required') {
      super(m)
      this.name = 'CommentGateError'
    }
  },
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  // NOTE: updateTag is NOT mocked — comment actions do NOT call it (D-06/D-07)
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

import { addCommentAction, editCommentAction, deleteCommentAction } from '@/app/actions/comments'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import * as commentsDAL from '@/data/comments'
import { revalidateTag } from 'next/cache'
import { logNotification } from '@/lib/notifications/logger'
import { getProfileById } from '@/data/profiles'
import { db } from '@/db'

// Valid v4 UUID literals (M=4, N∈{8,9,a,b}) so z.string().uuid() accepts them.
const viewerUserId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const watchOwnerId = '11111111-2222-4333-8444-555555555555'
const watchId = '22222222-3333-4444-8555-666666666666'
const commentId = '44444444-5555-4666-8777-888888888888'

// Helper: set up the db.select() chain to return a specific row
function setupDbSelectChain(rows: unknown[]) {
  const limitMock = vi.fn().mockResolvedValue(rows)
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock })
  const fromMock = vi.fn().mockReturnValue({ where: whereMock })
  ;(db.select as Mock).mockReturnValue({ from: fromMock })
}

// A minimal mock comment row shape for testing
const mockComment = {
  id: commentId,
  authorId: viewerUserId,
  watchId,
  wearEventId: null,
  body: 'Great watch!',
  editedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
}

describe('addCommentAction Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // SEC-03: auth-first — unauthenticated caller rejected before any DAL call
  it('SEC-03: returns { success: false, error: \'Not authenticated\' } when getCurrentUser throws', async () => {
    ;(getCurrentUser as Mock).mockRejectedValueOnce(new UnauthorizedError())

    const result = await addCommentAction({ type: 'watch', id: watchId, body: 'Nice!' })

    expect(result).toEqual({ success: false, error: 'Not authenticated' })
    expect(commentsDAL.createComment).not.toHaveBeenCalled()
  })

  // NOTIF-12: addCommentAction on non-self target — createComment resolves,
  // logNotification called with type 'watch_comment'
  it('NOTIF-12: non-self add — createComment resolves, logNotification called with type watch_comment', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'viewer@example.com',
    })
    ;(getProfileById as Mock).mockResolvedValueOnce({
      username: 'viewer',
      displayName: 'Viewer User',
    })
    ;(commentsDAL.createComment as Mock).mockResolvedValueOnce(mockComment)
    setupDbSelectChain([{ userId: watchOwnerId }])

    const result = await addCommentAction({ type: 'watch', id: watchId, body: 'Nice watch!' })

    expect(commentsDAL.createComment).toHaveBeenCalledTimes(1)
    expect(logNotification).toHaveBeenCalledTimes(1)
    expect(logNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'watch_comment' })
    )
    expect(result).toMatchObject({ success: true, data: mockComment })
  })

  // D-09: createComment throws CommentGateError → addCommentAction returns { success: false, error: <msg>, code: 'gate' }
  it('D-09: CommentGateError from createComment → { success: false, error: msg, code: \'gate\' }', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'viewer@example.com',
    })
    ;(getProfileById as Mock).mockResolvedValueOnce({
      username: 'viewer',
      displayName: 'Viewer User',
    })
    setupDbSelectChain([{ userId: watchOwnerId }])

    const gateMessage = 'Mutual follow required'
    ;(commentsDAL.createComment as Mock).mockRejectedValueOnce(
      new commentsDAL.CommentGateError(gateMessage)
    )

    const result = await addCommentAction({ type: 'watch', id: watchId, body: 'Trying to comment...' })

    expect(result).toMatchObject({ success: false, error: gateMessage, code: 'gate' })
    expect(logNotification).not.toHaveBeenCalled()
  })

  // SEC-05: on successful add, revalidateTag('profile:{username}', 'max') called
  // AND no comments-thread tag (assert revalidateTag never called with a 'comments:' prefix)
  it('SEC-05: on successful add, profile tag revalidated; no comments-thread tag fired (D-06)', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'viewer@example.com',
    })
    ;(getProfileById as Mock)
      .mockResolvedValueOnce({ username: 'viewer', displayName: 'Viewer User' }) // actor profile
    ;(commentsDAL.createComment as Mock).mockResolvedValueOnce(mockComment)
    setupDbSelectChain([{ userId: watchOwnerId }])

    // We also need the owner profile for cache invalidation
    ;(getProfileById as Mock)
      .mockResolvedValueOnce({ username: 'owner', displayName: 'Owner User' }) // owner profile

    await addCommentAction({ type: 'watch', id: watchId, body: 'Nice!' })

    // Must call revalidateTag with a 'profile:' tag and 'max'
    expect(revalidateTag).toHaveBeenCalledWith(
      expect.stringMatching(/^profile:/),
      'max',
    )
    // Must NOT call revalidateTag with any 'comments:' prefixed tag (D-06 — threads are uncached)
    const revalidateCalls = (revalidateTag as Mock).mock.calls
    const hasCommentsTag = revalidateCalls.some(
      (call) => typeof call[0] === 'string' && call[0].startsWith('comments:')
    )
    expect(hasCommentsTag).toBe(false)
  })
})

describe('editCommentAction Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // SEC-03: editCommentAction uses server-derived authorId, not any client-supplied value
  // Additionally, a payload containing authorId must be rejected by .strict()
  it('SEC-03: payload with client-supplied authorId is rejected by Zod .strict()', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'viewer@example.com',
    })

    // authorId is NOT an accepted field — .strict() must reject it
    const result = await editCommentAction({
      commentId,
      body: 'Updated body',
      authorId: 'attacker-supplied-id',
    })

    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(commentsDAL.editComment).not.toHaveBeenCalled()
  })

  // SEC-03: on valid edit, editComment is invoked with getCurrentUser().id as authorId
  it('SEC-03: on valid edit, editComment receives getCurrentUser().id as authorId (server-derived)', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'viewer@example.com',
    })
    ;(commentsDAL.editComment as Mock).mockResolvedValueOnce({
      ...mockComment,
      body: 'Updated body',
    })

    await editCommentAction({ commentId, body: 'Updated body' })

    expect(commentsDAL.editComment).toHaveBeenCalledWith(
      viewerUserId, // server-derived from getCurrentUser().id
      commentId,
      'Updated body',
    )
  })

  // NOTIF-12: editCommentAction does NOT call logNotification (INSERT-only rule)
  it('NOTIF-12: editCommentAction does NOT call logNotification', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'viewer@example.com',
    })
    ;(commentsDAL.editComment as Mock).mockResolvedValueOnce({
      ...mockComment,
      body: 'Updated body',
    })

    await editCommentAction({ commentId, body: 'Updated body' })

    expect(logNotification).not.toHaveBeenCalled()
  })
})

describe('deleteCommentAction Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // NOTIF-12: deleteCommentAction does NOT call logNotification
  it('NOTIF-12: deleteCommentAction does NOT call logNotification', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({
      id: viewerUserId,
      email: 'viewer@example.com',
    })
    ;(commentsDAL.deleteComment as Mock).mockResolvedValueOnce(undefined)

    await deleteCommentAction({ commentId })

    expect(logNotification).not.toHaveBeenCalled()
  })
})
