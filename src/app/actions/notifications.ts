'use server'

import { revalidateTag } from 'next/cache'
import { markAllReadForUser } from '@/data/notifications'
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
