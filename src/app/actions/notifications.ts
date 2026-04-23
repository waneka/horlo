'use server'

import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { markAllReadForUser, markOneReadForUser } from '@/data/notifications'
import { getCurrentUser } from '@/lib/auth'
import type { ActionResult } from '@/lib/actionTypes'

/**
 * markAllNotificationsRead — NOTIF-06 + CONTEXT.md D-10.
 *
 * Sets read_at = now() on ALL rows where user_id = current user AND read_at IS NULL.
 * Server-side WHERE filter only — NEVER trusts a client-supplied id list (Pitfall B-5).
 *
 * Cache invalidation (RESEARCH Pitfall 6): calls revalidateTag(`viewer:${user.id}`, 'max')
 * so the bell DAL (Phase 13 Plan 04 NotificationBell `'use cache'` scope) refetches
 * on next render. The 'max' second argument is Next.js 16's explicit revalidation
 * profile — single-arg form is deprecated (RESEARCH Pitfall 4, pinned docs).
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
    // Invalidate the bell cache for this viewer.
    // Next 16 two-arg form — `'max'` is the explicit revalidation profile.
    revalidateTag(`viewer:${user.id}`, 'max')
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
 * Cache invalidation (RESEARCH Pitfall 6): calls revalidateTag(`viewer:${user.id}`, 'max')
 * so the bell DAL refetches. The 'max' second argument is Next 16's explicit
 * revalidation profile (Pitfall 4 — single-arg form is deprecated).
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
    revalidateTag(`viewer:${user.id}`, 'max')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[markNotificationRead] unexpected error:', err)
    return { success: false, error: "Couldn't mark as read. Try again." }
  }
}
