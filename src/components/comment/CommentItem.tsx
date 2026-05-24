'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'

import { editCommentAction, deleteCommentAction } from '@/app/actions/comments'
import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import { timeAgo } from '@/lib/timeAgo'
import { cn } from '@/lib/utils'
import type { CommentWithAuthor } from './types'

interface CommentItemProps {
  comment: CommentWithAuthor
  /** null for unauthenticated viewer */
  viewerId: string | null
  /** Called with the server-confirmed comment (preserving author) on successful edit */
  onUpdate: (c: CommentWithAuthor) => void
  /** Called optimistically before deleteCommentAction resolves */
  onDeleteOptimistic: (id: string) => void
  /** Called to re-insert the comment if deletion fails */
  onRollbackDelete: (c: CommentWithAuthor) => void
}

/**
 * Single comment row (CMNT-06 + CMNT-07 + D-05 + D-06 + D-07).
 *
 * Author-scoped controls:
 *   - Pencil (edit) + Trash2 (delete) visible ONLY when viewerId === comment.authorId (D-05 IDOR backstop).
 *   - Always-visible because mobile has no hover state (D-05).
 *   - Edit: textarea swap (D-06 in-place); [edited] suffix on meta line when editedAt is set (D-07).
 *   - Delete: inline "Delete? · Cancel" confirm (NO AlertDialog/Dialog — D-06).
 *
 * Optimistic pattern: useState + useTransition + rollback (mirrors LikeButton house pattern).
 * editCommentAction returns Comment WITHOUT author — preserve existing comment.author on reconcile.
 */
export function CommentItem({
  comment,
  viewerId,
  onUpdate,
  onDeleteOptimistic,
  onRollbackDelete,
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editBody, setEditBody] = useState(comment.body)
  const [pending, startTransition] = useTransition()

  const isAuthor = viewerId !== null && viewerId === comment.authorId

  function handleEditSave() {
    if (editBody.trim().length === 0 || editBody === comment.body) return

    startTransition(async () => {
      const result = await editCommentAction({ commentId: comment.id, body: editBody })
      if (!result.success) {
        // Rollback: restore original body in the edit textarea
        setEditBody(comment.body)
        console.error('[CommentItem] edit failed:', result.error)
        return
      }
      // Reconcile: server-confirmed row but PRESERVE existing author (editCommentAction
      // returns Comment without author info — D-06 enrichment pattern).
      onUpdate({ ...result.data, author: comment.author })
      setIsEditing(false)
    })
  }

  function handleDeleteConfirm() {
    // Optimistic: parent removes comment from list immediately
    onDeleteOptimistic(comment.id)

    startTransition(async () => {
      const result = await deleteCommentAction({ commentId: comment.id })
      if (!result.success) {
        // Rollback: parent re-inserts the comment
        onRollbackDelete(comment)
        console.error('[CommentItem] delete failed:', result.error)
      }
      // On success: comment is already removed from list (no further action)
    })
  }

  return (
    <div className="flex gap-3">
      {/* Avatar linked to author profile */}
      <Link href={`/u/${comment.author.username}/collection`} className="flex-shrink-0">
        <AvatarDisplay
          avatarUrl={comment.author.avatarUrl}
          displayName={comment.author.displayName}
          username={comment.author.username}
          size={40}
        />
      </Link>

      {/* Right block: meta + body + controls */}
      <div className="flex-1 min-w-0">
        {/* Meta line: username · timeAgo [· edited] */}
        <p className="text-xs text-muted-foreground">
          <Link
            href={`/u/${comment.author.username}/collection`}
            className="font-semibold text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {comment.author.username}
          </Link>
          {' · '}
          {timeAgo(comment.createdAt)}
          {comment.editedAt && (
            <> · <span className="text-xs text-muted-foreground">edited</span></>
          )}
        </p>

        {/* Body — edit-in-place swaps to textarea */}
        {isEditing ? (
          <div className="mt-1 flex flex-col gap-2">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={pending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pending || editBody.trim().length === 0 || editBody === comment.body}
                onClick={handleEditSave}
                className={cn(
                  'h-8 px-4 bg-primary text-primary-foreground text-sm font-semibold rounded-md hover:opacity-90',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-50',
                )}
              >
                Save
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setEditBody(comment.body)
                  setIsEditing(false)
                }}
                className="h-8 px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 text-sm font-normal text-foreground leading-relaxed">
            {comment.body}
          </p>
        )}

        {/* Author controls: Pencil + Trash (ONLY when author, not while editing/deleting) */}
        {isAuthor && !isEditing && !isDeleting && (
          <div className="flex items-center gap-2 mt-1">
            <button
              aria-label="Edit comment"
              type="button"
              disabled={pending}
              onClick={() => {
                setEditBody(comment.body)
                setIsEditing(true)
              }}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              <Pencil className="size-4 text-muted-foreground hover:text-foreground" aria-hidden />
            </button>
            <button
              aria-label="Delete comment"
              type="button"
              disabled={pending}
              onClick={() => setIsDeleting(true)}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              <Trash2 className="size-4 text-muted-foreground hover:text-destructive" aria-hidden />
            </button>
          </div>
        )}

        {/* Inline delete confirm: "Delete? · Cancel" (NO AlertDialog — D-06) */}
        {isDeleting && !isEditing && (
          <div className="flex items-center gap-1 mt-1">
            <button
              type="button"
              className="text-sm text-destructive hover:underline focus-visible:outline-none"
              onClick={handleDeleteConfirm}
            >
              Delete?
            </button>
            <span className="text-muted-foreground mx-1">·</span>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:underline focus-visible:outline-none"
              onClick={() => setIsDeleting(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
