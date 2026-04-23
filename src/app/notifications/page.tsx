import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { revalidateTag } from 'next/cache'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getNotificationsForViewer, touchLastSeenAt } from '@/data/notifications'
import { markAllNotificationsRead } from '@/app/actions/notifications'
import { NotificationsInbox } from '@/components/notifications/NotificationsInbox'
import { NotificationsEmptyState } from '@/components/notifications/NotificationsEmptyState'

/**
 * /notifications page — NOTIF-05 inbox surface.
 *
 * On every render:
 *   1. Resolve viewer (redirect to /login if unauth).
 *   2. touchLastSeenAt(viewerId) — clears the bell dot (D-07).
 *   3. revalidateTag(`viewer:${id}`, 'max') — invalidates the bell cache so the
 *      dot refreshes on next page render (RESEARCH Pitfall 6).
 *   4. Fetch last 50 notifications.
 *   5. Render NotificationsInbox (grouped + collapsed) OR NotificationsEmptyState.
 *
 * Mark all read is a form-submit Server Action button; on success the action
 * calls revalidateTag again (src/app/actions/notifications.ts).
 */
export default async function NotificationsPage() {
  let user: { id: string; email: string } | null = null
  let needsLogin = false
  try {
    user = await getCurrentUser()
  } catch (err) {
    if (err instanceof UnauthorizedError) needsLogin = true
    else throw err
  }
  if (needsLogin || !user) redirect('/login?next=/notifications')

  // D-07: mark the last-seen-at on every page visit so the bell clears.
  // Wrapped in try/catch so a transient write failure doesn't 500 the whole page.
  try {
    await touchLastSeenAt(user.id)
    // RESEARCH Pitfall 6: invalidate the bell cache so the dot refreshes on next nav.
    // Two-arg revalidateTag — Next 16 discipline (Pitfall 4).
    revalidateTag(`viewer:${user.id}`, 'max')
  } catch (err) {
    console.error('[notifications page] touchLastSeenAt failed (non-fatal):', err)
  }

  const rows = await getNotificationsForViewer(user.id, 50)

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 lg:px-8 lg:py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Notifications</h1>
        {rows.length > 0 && (
          <form
            action={async () => {
              'use server'
              await markAllNotificationsRead()
            }}
          >
            <button
              type="submit"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          </form>
        )}
      </div>
      <Suspense fallback={null}>
        {rows.length === 0 ? (
          <NotificationsEmptyState />
        ) : (
          <NotificationsInbox rows={rows} />
        )}
      </Suspense>
    </main>
  )
}
