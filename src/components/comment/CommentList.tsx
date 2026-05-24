'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { addCommentAction } from '@/app/actions/comments'
import type { CommentTarget } from '@/data/comments'
import { CommentCompose } from './CommentCompose'
import { CommentGateLocked } from './CommentGateLocked'
import { CommentItem } from './CommentItem'
import type { CommentAuthor, CommentWithAuthor } from './types'

interface CommentListProps {
  initialComments: CommentWithAuthor[]
  target: CommentTarget
  canComment: boolean
  /** true when the watch owner follows the viewer (needed by CommentGateLocked) */
  ownerFollowsViewer: boolean
  ownerUserId: string
  ownerUsername: string
  /** null for unauthenticated viewer */
  viewerId: string | null
  /** Viewer's own author info for optimistic comment insert; null for anon */
  viewerAuthor: CommentAuthor | null
  /** true when the viewer is already following the owner (viewer→owner direction) */
  viewerIsFollowing: boolean
  /** SC-5 (Phase 57.1): optional callback to propagate optimistic count deltas to WearCard */
  onCountChange?: (delta: number) => void
}

/**
 * Optimistic comment list (CMNT-01 + CMNT-03 + CMNT-08).
 *
 * Layout: compose-above-list (CMNT-08 — newest-first / compose above).
 * Optimistic inserts at TOP (newest-first order).
 *
 * Pattern: useState + useTransition + rollback — mirrors LikeButton house pattern.
 *   - Insert optimistic comment at [top of list] on submit (CMNT-08).
 *   - On success: reconcile temp id + createdAt to server-confirmed row.
 *   - On failure: rollback to previous comments state.
 *   - Gate rejection (code==='gate'): flip local canComment to false silently (T-57-13).
 *   - disabled={pending} blocks double-submit (T-57-12).
 */
export function CommentList({
  initialComments,
  target,
  canComment: initialCanComment,
  ownerFollowsViewer,
  ownerUserId,
  ownerUsername,
  viewerId,
  viewerAuthor,
  viewerIsFollowing,
  onCountChange,
}: CommentListProps) {
  const router = useRouter()
  const [comments, setComments] = useState<CommentWithAuthor[]>(initialComments)
  const [canComment, setCanComment] = useState(initialCanComment)
  const [pending, startTransition] = useTransition()
  // composeBody ref for clearing on success — CommentCompose is controlled by the parent
  const [composeKey, setComposeKey] = useState(0)

  function handleSubmit(body: string) {
    if (!viewerId) return

    const fallbackAuthor: CommentAuthor = viewerAuthor ?? {
      username: 'me',
      displayName: null,
      avatarUrl: null,
    }

    // Build optimistic comment with temp id (replaced on reconcile)
    const optimistic: CommentWithAuthor = {
      id: crypto.randomUUID(),
      authorId: viewerId,
      body,
      createdAt: new Date(),
      editedAt: null,
      updatedAt: new Date(),
      watchId: target.type === 'watch' ? target.id : null,
      wearEventId: target.type === 'wear' ? target.id : null,
      author: fallbackAuthor,
    }

    // Insert at TOP — newest-first (CMNT-03 / CMNT-08).
    // Functional update so we never capture a stale `comments` snapshot (CR-01).
    setComments((prev) => [optimistic, ...prev])
    // SC-5 (Phase 57.1): propagate +1 to WearCard local count (optional — noop on /watch/[id])
    onCountChange?.(+1)

    startTransition(async () => {
      const result = await addCommentAction({ type: target.type, id: target.id, body })
      if (!result.success) {
        // Rollback: remove ONLY the optimistic row via a functional update, so any
        // concurrent edit/delete that landed while the action was in flight is preserved
        // (CR-01 — a plain setComments(comments) would blow those away).
        setComments((prev) => prev.filter((c) => c.id !== optimistic.id))
        // SC-5 (Phase 57.1): reverse the optimistic +1 on rollback (covers both gate-reject and generic fail)
        onCountChange?.(-1)
        // Gate rejection: the action gate is the race backstop (T-57-13 / D-09)
        if (result.code === 'gate') {
          setCanComment(false)
        }
        console.error('[CommentList] action failed:', result.error)
        return
      }
      // Reconcile: replace temp id with server-confirmed row (preserving author)
      // Note: no onCountChange call here — the +1 from the optimistic insert already stands (D-03)
      setComments((prev) =>
        prev.map((c) =>
          c.id === optimistic.id ? { ...result.data, author: optimistic.author } : c,
        ),
      )
      // Clear compose box on success by re-mounting CommentCompose
      setComposeKey((k) => k + 1)
      // D-01 (Phase 57.1): re-fetch RSC payload so /watch/[id] count badge updates.
      // Uses router.refresh() from next/navigation (client cache only — NOT next/cache server refresh).
      // Safe: /watch/[id] has no unstable_instant; CommentThread is uncached RSC; client state preserved.
      // Harmless on wears surfaces — local optimistic count survives the RSC merge per Next.js docs.
      router.refresh()
    })
  }

  function handleUpdate(updated: CommentWithAuthor) {
    setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  function handleDeleteOptimistic(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id))
    // SC-5 (Phase 57.1): decrement count optimistically when a comment is removed
    onCountChange?.(-1)
  }

  function handleRollbackDelete(comment: CommentWithAuthor) {
    // Re-insert at the approximate original position by id sort (safe approximation
    // since the list is newest-first; inserting at the index where the temp gap was
    // would require tracking position — instead re-insert at original createdAt position).
    setComments((prev) => {
      // Insert after all comments with a newer createdAt (i.e. before older ones)
      const insertIdx = prev.findIndex(
        (c) => c.createdAt < comment.createdAt,
      )
      if (insertIdx === -1) {
        return [...prev, comment]
      }
      const next = [...prev]
      next.splice(insertIdx, 0, comment)
      return next
    })
    // SC-5 (Phase 57.1): restore count when delete is rolled back
    onCountChange?.(+1)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Compose above the list (CMNT-08) or locked gate state */}
      {canComment ? (
        <CommentCompose
          key={composeKey}
          viewerId={viewerId}
          pending={pending}
          onSubmit={handleSubmit}
        />
      ) : (
        <CommentGateLocked
          ownerUsername={ownerUsername}
          ownerUserId={ownerUserId}
          ownerFollowsViewer={ownerFollowsViewer}
          viewerId={viewerId}
          viewerIsFollowing={viewerIsFollowing}
        />
      )}

      {/* Comment list: newest-first (initialComments arrives DESC from DAL) */}
      {comments.map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          viewerId={viewerId}
          onUpdate={handleUpdate}
          onDeleteOptimistic={handleDeleteOptimistic}
          onRollbackDelete={handleRollbackDelete}
        />
      ))}
    </div>
  )
}
