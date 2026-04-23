'use server'

import { updateTag } from 'next/cache'
import { z } from 'zod'
import {
  markAllReadForUser,
  markOneReadForUser,
  touchLastSeenAt,
} from '@/data/notifications'
import { getCurrentUser } from '@/lib/auth'
import type { ActionResult } from '@/lib/actionTypes'

/**
 * Why updateTag (not revalidateTag) for ALL three SAs in this file:
 *
 * All three SAs below (markAllNotificationsRead, markNotificationRead,
 * markNotificationsSeen) are **read-your-own-writes** flows: the caller is the
 * same viewer whose bell cache is being invalidated. The user clicks (or visits)
 * and immediately expects the NotificationBell dot to reflect their own change
 * on the next render.
 *
 * Next 16 has two primitives for tag invalidation (node_modules/next/dist/docs/
 * 01-app/01-getting-started/09-revalidating.md:156-160):
 *   - revalidateTag(tag, 'max')  → stale-while-revalidate
 *   - updateTag(tag)             → immediate expiration
 *
 * The Next 16 runtime enforces this at the source level — see
 * node_modules/next/dist/server/web/spec-extension/revalidate.js:204-211:
 *
 *   // if profile is provided and this is a stale-while-revalidate
 *   // update we do not mark the path as revalidated so that server
 *   // actions don't pull their own writes
 *   if (!profile || cacheLife?.expire === 0) {
 *     store.pathWasRevalidated = ActionDidRevalidateStaticAndDynamic
 *   }
 *
 * With revalidateTag(tag, 'max'), pathWasRevalidated is NOT set. The Server
 * Action response does NOT bundle a fresh RSC payload for the tagged tree
 * (action-handler.js:866-867 — skipPageRendering = true when
 * pathWasRevalidated === undefined). The stale NotificationBell entry keeps
 * being served on the next navigation (SWR semantics serve stale, fetch fresh
 * in the background).
 *
 * With updateTag(tag), profile is undefined — pathWasRevalidated IS set
 * (StaticAndDynamic). The Server Action response includes a fresh RSC payload.
 * The client router merges it, and the bell reflects the write immediately.
 *
 * This is exactly the scenario the updateTag docs call out
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
 * updateTag.md:7-8): "read-your-own-writes scenarios, where a user makes a
 * change (like creating a post), and the UI immediately shows the change,
 * rather than stale data."
 *
 * Debug session: notifications-revalidate-tag-in-render (Round 4).
 */

/**
 * markAllNotificationsRead — NOTIF-06 + CONTEXT.md D-10.
 *
 * Sets read_at = now() on ALL rows where user_id = current user AND read_at IS NULL.
 * Server-side WHERE filter only — NEVER trusts a client-supplied id list (Pitfall B-5).
 *
 * Cache invalidation: updateTag(`viewer:${user.id}`) — read-your-own-writes
 * semantics (see file header comment).
 */
export async function markAllNotificationsRead(): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    await markAllReadForUser(user.id)
    updateTag(`viewer:${user.id}`)
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[markAllNotificationsRead] unexpected error:', err)
    return { success: false, error: "Couldn't mark notifications as read. Try again." }
  }
}

/**
 * markNotificationRead — NOTIF-05 + CONTEXT.md D-08 per-row optimistic mark-read.
 *
 * Accepts a notification id, validates it as a uuid, and sets read_at = now()
 * on that single row IF AND ONLY IF the row belongs to the caller
 * (WHERE user_id = current AND id = notificationId — two-layer defense above RLS).
 *
 * Cache invalidation: updateTag(`viewer:${user.id}`) — read-your-own-writes
 * semantics (see file header comment).
 *
 * Return shape matches markAllNotificationsRead — ActionResult<void> discriminated
 * union (D-12).
 */
const markReadSchema = z.object({ notificationId: z.string().uuid() }).strict()

export async function markNotificationRead(
  data: unknown,
): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = markReadSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid notification id' }
  }

  try {
    await markOneReadForUser(user.id, parsed.data.notificationId)
    updateTag(`viewer:${user.id}`)
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[markNotificationRead] unexpected error:', err)
    return { success: false, error: "Couldn't mark as read. Try again." }
  }
}

/**
 * markNotificationsSeen — D-07 + RESEARCH Pitfall 6, split out of render.
 *
 * Updates profile_settings.notifications_last_seen_at = now() for the current viewer
 * AND invalidates the bell cache tag (`viewer:${user.id}`) so the dot clears on the
 * next render. Next 16 forbids revalidateTag during render (node_modules/next/dist/
 * server/web/spec-extension/revalidate.js:113-119 throws E7 when workUnitStore.phase
 * === 'render'), so this pair MUST live in a Server Action, not the /notifications
 * page body. The page fires this from a client-component useEffect after mount.
 *
 * Cache invalidation: updateTag(`viewer:${user.id}`) — read-your-own-writes
 * semantics (see file header comment). The previous revalidateTag(..., 'max')
 * was SWR, which explicitly suppresses the SA's RSC-refetch response, so the
 * bell dot stuck until the bg refresh + a later nav.
 *
 * Idempotent: visiting /notifications repeatedly simply re-stamps the seen-at and
 * re-invalidates the tag — safe under rapid navigation.
 */
export async function markNotificationsSeen(): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    await touchLastSeenAt(user.id)
    updateTag(`viewer:${user.id}`)
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[markNotificationsSeen] unexpected error:', err)
    return { success: false, error: "Couldn't update notifications state. Try again." }
  }
}
