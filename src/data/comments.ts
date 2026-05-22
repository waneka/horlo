import 'server-only'

// src/data/comments.ts — load-bearing privacy layer (do not remove this block)
//
// PRIVACY LAYER NOTE: The comments DAL runs through the Drizzle `db` client,
// which connects directly to Postgres via DATABASE_URL and BYPASSES RLS.
// `canViewerCommentOnTarget()` / `createComment()` is the SOLE enforced gate
// for the wishlist mutual-follow rule — the RLS `comments` policies are
// intentionally left non-functional (fail-closed for non-owners) and act
// only as an anon-block backstop.
//
// KNOWN LANDMINE: Anyone who routes comment reads/writes through an
// RLS-respecting supabase-js client will see ALL non-owner comment operations
// fail closed — not just wishlist — because the Phase 53 RLS SELECT USING
// subquery is purposely non-functional. All comment access MUST go through
// this DAL. See Phase 53 D-07 and Phase 54 D-02 for full rationale.

import { and, asc, eq } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'

import { db } from '@/db'
import { comments, watches } from '@/db/schema'
import { isMutualFollow } from './follows'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Comment = InferSelectModel<typeof comments>

export type CommentTarget = { type: 'watch' | 'wear'; id: string }

// ---------------------------------------------------------------------------
// CommentGateError — typed error so Phase 55 Server Actions can catch by
// instanceof without string-matching. Sibling to UnauthorizedError in auth.ts.
// ---------------------------------------------------------------------------

export class CommentGateError extends Error {
  constructor(message = 'Mutual follow required to comment on wishlist watches') {
    super(message)
    this.name = 'CommentGateError'
  }
}

// ---------------------------------------------------------------------------
// Gate predicate (D-04 — single source of truth for create, read, and Phase 57 UI)
// ---------------------------------------------------------------------------

/**
 * Returns true when the viewer is allowed to comment on the target:
 *   - Wear targets are always open (GATE-01 — no wishlist concept on wears)
 *   - Owner of the watch is always allowed (GATE-04)
 *   - Non-wishlist watches (owned/sold/grail) are open to any authenticated user (GATE-01)
 *   - Wishlist watches require mutual follow between viewer and owner (GATE-05)
 *
 * This is the load-bearing gate predicate — the same predicate drives createComment
 * (throw), getCommentsForTarget (hide), and the Phase 57 compose-box UI.
 * Keys off the watch's CURRENT status (D-11 grandfather).
 */
export async function canViewerCommentOnTarget(
  viewerId: string,
  target: CommentTarget,
): Promise<boolean> {
  // Wear targets are always open (GATE-01 — no wishlist concept on wears).
  // SHORT-CIRCUIT before any DB call (Pitfall 2).
  if (target.type === 'wear') return true

  // Fetch the watch row to check ownership and status.
  const watchRows = await db
    .select({ userId: watches.userId, status: watches.status })
    .from(watches)
    .where(eq(watches.id, target.id))
    .limit(1)

  const watch = watchRows[0]
  if (!watch) return false // watch not found — fail closed

  // Owner is always allowed regardless of watch status (GATE-04).
  if (viewerId === watch.userId) return true

  // Non-wishlist watches are open to any authenticated user (GATE-01).
  if (watch.status !== 'wishlist') return true

  // Wishlist: requires mutual follow (GATE-05, D-11 grandfather — keys off current status).
  return isMutualFollow(viewerId, watch.userId)
}

// ---------------------------------------------------------------------------
// createComment — throws CommentGateError when gate is false (SEC-02, D-05)
// ---------------------------------------------------------------------------

/**
 * Insert a new comment on a watch or wear target. Throws CommentGateError
 * when the viewer is not allowed to comment (non-mutual-follower on a wishlist
 * watch). This throw is the SEC-02 enforcement point — the DAL is the sole
 * load-bearing gate for authenticated users (D-01).
 *
 * Body length/blank validation is the DB CHECK + Phase 55 Zod's job (SEC-03).
 */
export async function createComment(input: {
  authorId: string
  target: CommentTarget
  body: string
}): Promise<Comment> {
  const { authorId, target, body } = input

  const allowed = await canViewerCommentOnTarget(authorId, target)
  if (!allowed) throw new CommentGateError()

  const rows = await db
    .insert(comments)
    .values({
      authorId,
      watchId: target.type === 'watch' ? target.id : null,
      wearEventId: target.type === 'wear' ? target.id : null,
      body,
    })
    .returning()

  return rows[0]
}

// ---------------------------------------------------------------------------
// getCommentsForTarget — returns [] for gated viewers (D-06, GATE-01 read-gate)
// ---------------------------------------------------------------------------

/**
 * Returns comments for the target in chronological order (oldest first, CMNT-03).
 * Returns [] for a gated (non-mutual) viewer on a wishlist watch — no content
 * and no count is leaked (D-06). The Phase 57 UI derives gate state from
 * canViewerCommentOnTarget separately, not from the list shape.
 */
export async function getCommentsForTarget(
  viewerId: string,
  target: CommentTarget,
): Promise<Comment[]> {
  const allowed = await canViewerCommentOnTarget(viewerId, target)
  if (!allowed) return []

  if (target.type === 'watch') {
    return db
      .select()
      .from(comments)
      .where(eq(comments.watchId, target.id))
      .orderBy(asc(comments.createdAt))
  } else {
    return db
      .select()
      .from(comments)
      .where(eq(comments.wearEventId, target.id))
      .orderBy(asc(comments.createdAt))
  }
}

// ---------------------------------------------------------------------------
// editComment — authorship-scoped IDOR-safe update (CMNT-06, T-54-08)
// ---------------------------------------------------------------------------

/**
 * Update the body of a comment the caller authored. WHERE scoped by
 * (id, authorId) — a non-author cannot edit another user's comment (IDOR-safe).
 * Sets editedAt to mark the comment as edited (CMNT-06 semantics).
 */
export async function editComment(
  authorId: string,
  commentId: string,
  body: string,
): Promise<Comment> {
  const now = new Date()
  const rows = await db
    .update(comments)
    .set({ body, editedAt: now, updatedAt: now })
    .where(and(eq(comments.id, commentId), eq(comments.authorId, authorId)))
    .returning()

  return rows[0]
}

// ---------------------------------------------------------------------------
// deleteComment — authorship-scoped IDOR-safe delete (T-54-08)
// ---------------------------------------------------------------------------

/**
 * Delete a comment the caller authored. WHERE scoped by (id, authorId) —
 * a non-author cannot delete another user's comment (IDOR-safe, mirrors
 * unfollowUser pattern in follows.ts).
 */
export async function deleteComment(
  authorId: string,
  commentId: string,
): Promise<void> {
  await db
    .delete(comments)
    .where(and(eq(comments.id, commentId), eq(comments.authorId, authorId)))
}
