'use server'

import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'

import { getCurrentUser } from '@/lib/auth'
import { logNotification } from '@/lib/notifications/logger'
import { getProfileById } from '@/data/profiles'
import type { ActionResult } from '@/lib/actionTypes'
import {
  createComment,
  editComment,
  deleteComment,
  CommentGateError,
} from '@/data/comments'
import type { Comment, CommentTarget } from '@/data/comments'
import { logActivity } from '@/data/activities'
import { db } from '@/db'
import { watches, wearEvents, comments as commentsTable } from '@/db/schema'

// Mass-assignment protection (SEC-03, T-55-IDOR): Zod .strict() rejects any
// payload keys other than the declared fields. The authorId is NEVER accepted
// from client input — it is always derived from getCurrentUser().id on the
// server. A client that tries to POST { ..., authorId } fails the strict parse.
//
// .trim() BEFORE .min(1) — Pitfall 14: whitespace-only body fails correctly.
// .max(500) matches the Phase 53 DB CHECK (comments_body_length constraint).
const addCommentSchema = z
  .object({
    type: z.enum(['watch', 'wear']), // DAL discriminator — 'wear' not 'wear_event'
    id: z.string().uuid(),
    body: z.string().trim().min(1).max(500),
  })
  .strict()

// editCommentSchema: accepts ONLY commentId + body — no authorId from client (SEC-03, Pitfall 7).
const editCommentSchema = z
  .object({
    commentId: z.string().uuid(),
    body: z.string().trim().min(1).max(500),
  })
  .strict()

// deleteCommentSchema: accepts ONLY commentId — authorId is derived server-side (SEC-03, Pitfall 7).
const deleteCommentSchema = z
  .object({
    commentId: z.string().uuid(),
  })
  .strict()

export async function addCommentAction(data: unknown): Promise<ActionResult<Comment>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = addCommentSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    const target: CommentTarget = { type: parsed.data.type, id: parsed.data.id }

    // Resolve owner + brand/model SERVER-SIDE (SEC-03 IDOR prevention).
    // Never trust a client-supplied ownerId — always read from the DB.
    let ownerId: string
    let watchBrand: string
    let watchModel: string
    let watchImageUrl: string | null = null
    let watchStatus: string | undefined = undefined

    if (target.type === 'watch') {
      const [watchRow] = await db
        .select({
          userId: watches.userId,
          brand: watches.brand,
          model: watches.model,
          // Phase 60: watches.image_url column dropped; resolve cover via watch_photos subquery
          imageUrl: sql<string | null>`(
            SELECT wp.storage_path
            FROM watch_photos wp
            WHERE wp.watch_id = ${watches.id}
            ORDER BY wp.sort_order ASC
            LIMIT 1
          )`,
          status: watches.status,       // for D-12 gate in feed (watchStatus field)
        })
        .from(watches)
        .where(eq(watches.id, target.id))
        .limit(1)

      if (!watchRow) return { success: false, error: 'Not found' }

      ownerId = watchRow.userId
      watchBrand = watchRow.brand ?? ''
      watchModel = watchRow.model ?? ''
      watchImageUrl = watchRow.imageUrl ?? null
      watchStatus = watchRow.status ?? undefined
    } else {
      // 'wear' target: look up wearEvent → parent watch for brand/model/imageUrl
      const [wearRow] = await db
        .select({ userId: wearEvents.userId, watchId: wearEvents.watchId })
        .from(wearEvents)
        .where(eq(wearEvents.id, target.id))
        .limit(1)

      if (!wearRow) return { success: false, error: 'Not found' }

      const [watchRow] = await db
        .select({
          brand: watches.brand,
          model: watches.model,
          // Phase 60: watches.image_url column dropped; resolve cover via watch_photos subquery
          imageUrl: sql<string | null>`(
            SELECT wp.storage_path
            FROM watch_photos wp
            WHERE wp.watch_id = ${watches.id}
            ORDER BY wp.sort_order ASC
            LIMIT 1
          )`,
        })
        .from(watches)
        .where(eq(watches.id, wearRow.watchId))
        .limit(1)

      ownerId = wearRow.userId
      watchBrand = watchRow?.brand ?? ''
      watchModel = watchRow?.model ?? ''
      watchImageUrl = watchRow?.imageUrl ?? null
    }

    // Pre-resolve actor profile so logNotification has denormalized fields.
    // Fetching before the primary commit keeps the logger non-blocking
    // (RESEARCH §Open Questions #5 — REVERSED from recommendation: caller resolves).
    const actorProfile = await getProfileById(user.id)

    // Inner try/catch: catches CommentGateError BEFORE the generic catch (D-09).
    // The DAL createComment throws CommentGateError when the wishlist
    // mutual-follow gate is false — we surface it as a structural discriminant
    // code:'gate' so Phase 57 can branch to GATE-03 locked-state CTA without
    // string-matching the error message.
    let comment: Comment
    try {
      comment = await createComment({ authorId: user.id, target, body: parsed.data.body })
    } catch (err) {
      if (err instanceof CommentGateError) {
        // D-09: structural discriminant — Phase 57 branches without string-matching
        return { success: false, error: err.message, code: 'gate' as const }
      }
      console.error('[addCommentAction] unexpected error:', err)
      return { success: false, error: "Couldn't post comment. Try again." }
    }

    // Cache invalidation (D-06/D-07): profile grid count badge ONLY.
    // NO comments-thread tag (D-06 — threads are uncached Server Components).
    // NO updateTag — comment actions never RYO (D-07, D-06).
    const ownerProfile = await getProfileById(ownerId)
    if (ownerProfile?.username) {
      revalidateTag(`profile:${ownerProfile.username}`, 'max')
    }

    // Notification — NOTIF-12: fire ONLY on non-self INSERT (never on edit/delete).
    // Also skip when actor === owner (self-guard); the logger's D-24 belt-and-suspenders
    // internal guard also catches this, but the explicit check here keeps intent readable.
    // AWAITED (not fire-and-forget): Next 16 workAsyncStorage is torn down when the Server
    // Action returns. We must await the insert before invalidating the bell cache —
    // otherwise the bell refetch could race the insert and re-cache a stale "no unread"
    // state. The logger's internal try/catch (D-27) guarantees logNotification never throws.
    if (ownerId !== user.id) {
      if (target.type === 'watch') {
        await logNotification({
          type: 'watch_comment',
          recipientUserId: ownerId,
          actorUserId: user.id,
          payload: {
            actor_username: actorProfile?.username ?? '',
            actor_display_name: actorProfile?.displayName ?? null,
            watch_id: target.id,                    // payload key MUST match WatchCommentPayload
            watch_brand: watchBrand,
            watch_model: watchModel,
            comment_id: comment.id,
            comment_preview: parsed.data.body.slice(0, 120),
          },
        })
      } else {
        await logNotification({
          type: 'wear_comment',
          recipientUserId: ownerId,
          actorUserId: user.id,
          payload: {
            actor_username: actorProfile?.username ?? '',
            actor_display_name: actorProfile?.displayName ?? null,
            wear_event_id: target.id,               // payload key is wear_event_id (NOT wear_id)
            watch_brand: watchBrand,
            watch_model: watchModel,
            comment_id: comment.id,
            comment_preview: parsed.data.body.slice(0, 120),
          },
        })
      }
      // Bell cache on RECIPIENT — invalidate after the awaited insert so the dot lights up.
      revalidateTag(`viewer:${ownerId}`, 'max')

      // FEED-06 / D-13: log 'commented' activity INSERT-only (never on edit/delete).
      // Guarded by the same ownerId !== user.id condition as logNotification (D-13).
      // watchId is null for wear targets (activities table has no wearEventId column;
      // wearEventId is carried in metadata only — Landmine #7 from PATTERNS.md).
      await logActivity(
        user.id,
        'commented',
        target.type === 'watch' ? target.id : null,
        {
          brand: watchBrand,
          model: watchModel,
          imageUrl: watchImageUrl,
          targetType: target.type,           // 'watch' or 'wear' — NOT 'wear_event' (Landmine #1)
          targetOwnerId: ownerId,
          ...(target.type === 'watch' ? { watchStatus } : { wearEventId: target.id }),
        },
      )
    }

    return { success: true, data: comment }
  } catch (err) {
    console.error('[addCommentAction] unexpected error:', err)
    return { success: false, error: "Couldn't post comment. Try again." }
  }
}

export async function editCommentAction(data: unknown): Promise<ActionResult<Comment>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = editCommentSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    // authorId is ALWAYS getCurrentUser().id — never a client-supplied value.
    // The DAL editComment scopes the WHERE clause by (id, authorId) — the action's
    // contribution is passing user.id (never a client value) as authorId (T-55-IDOR).
    const comment = await editComment(user.id, parsed.data.commentId, parsed.data.body)

    // Cache invalidation: profile grid count badge only (D-06/D-07).
    // Resolve owner via returned comment's watchId or wearEventId.
    // NO logNotification call — NOTIF-12 INSERT-only (edit never fires a notification).
    if (comment.watchId) {
      const [watchRow] = await db
        .select({ userId: watches.userId })
        .from(watches)
        .where(eq(watches.id, comment.watchId))
        .limit(1)

      if (watchRow) {
        const ownerProfile = await getProfileById(watchRow.userId)
        if (ownerProfile?.username) {
          revalidateTag(`profile:${ownerProfile.username}`, 'max')
        }
      }
    } else if (comment.wearEventId) {
      const [wearRow] = await db
        .select({ userId: wearEvents.userId })
        .from(wearEvents)
        .where(eq(wearEvents.id, comment.wearEventId))
        .limit(1)

      if (wearRow) {
        const ownerProfile = await getProfileById(wearRow.userId)
        if (ownerProfile?.username) {
          revalidateTag(`profile:${ownerProfile.username}`, 'max')
        }
      }
    }

    return { success: true, data: comment }
  } catch (err) {
    console.error('[editCommentAction] unexpected error:', err)
    return { success: false, error: "Couldn't update comment. Try again." }
  }
}

export async function deleteCommentAction(
  data: unknown,
): Promise<ActionResult<{ id: string }>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = deleteCommentSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    // authorId is ALWAYS getCurrentUser().id — never a client-supplied value.
    // NO logNotification or logActivity call — NOTIF-12 / D-13 INSERT-only (delete never fires).
    //
    // Read-then-delete: fetch comment row BEFORE deleting so we can resolve the
    // target owner for profile cache invalidation (Pitfall-6 gap — Phase 55 missed
    // revalidateTag on delete). Mirrors editCommentAction's owner-lookup pattern.
    // IDOR on the read: commentId is a UUID; reading watchId/wearEventId for cache
    // invalidation is low-risk. The delete itself (deleteComment) is IDOR-protected
    // by (id, authorId) WHERE scope.
    const [commentRow] = await db
      .select()
      .from(commentsTable)
      .where(eq(commentsTable.id, parsed.data.commentId))
      .limit(1)

    await deleteComment(user.id, parsed.data.commentId)

    // Resolve owner + revalidate profile cache (mirrors editCommentAction owner-lookup)
    if (commentRow?.watchId) {
      const [watchRow] = await db
        .select({ userId: watches.userId })
        .from(watches)
        .where(eq(watches.id, commentRow.watchId))
        .limit(1)

      if (watchRow) {
        const ownerProfile = await getProfileById(watchRow.userId)
        if (ownerProfile?.username) {
          revalidateTag(`profile:${ownerProfile.username}`, 'max')
        }
      }
    } else if (commentRow?.wearEventId) {
      const [wearRow] = await db
        .select({ userId: wearEvents.userId })
        .from(wearEvents)
        .where(eq(wearEvents.id, commentRow.wearEventId))
        .limit(1)

      if (wearRow) {
        const ownerProfile = await getProfileById(wearRow.userId)
        if (ownerProfile?.username) {
          revalidateTag(`profile:${ownerProfile.username}`, 'max')
        }
      }
    }

    return { success: true, data: { id: parsed.data.commentId } }
  } catch (err) {
    console.error('[deleteCommentAction] unexpected error:', err)
    return { success: false, error: "Couldn't delete comment. Try again." }
  }
}
