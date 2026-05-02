import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getNotificationsForViewer } from '@/data/notifications'
import { NotificationsInbox } from '@/components/notifications/NotificationsInbox'
import { NotificationsEmptyState } from '@/components/notifications/NotificationsEmptyState'
import { MarkNotificationsSeenOnMount } from '@/components/notifications/MarkNotificationsSeenOnMount'
import { MarkAllReadButton } from '@/components/notifications/MarkAllReadButton'

/**
 * /notifications page — NOTIF-05 inbox surface.
 *
 * On every render:
 *   1. Resolve viewer (redirect to /login if unauth).
 *   2. Fetch last 50 notifications.
 *   3. Render NotificationsInbox (grouped + collapsed) OR NotificationsEmptyState.
 *
 * D-07 "visit clears the bell dot" is delivered by <MarkNotificationsSeenOnMount />,
 * a client component that invokes the `markNotificationsSeen` Server Action on mount.
 * That SA is the only legal home for the touchLastSeenAt + revalidateTag pair — Next 16
 * forbids revalidateTag during render (node_modules/next/dist/server/web/spec-extension/
 * revalidate.js:113-119 throws E7 when workUnitStore.phase === 'render').
 *
 * Mark all read is delivered by <MarkAllReadButton /> (Phase 25 D-20) — a
 * Client Component using useFormStatus for pending state ('Marking…') that
 * fires toast.success('Notifications cleared') on resolution. The Server
 * Action call there still triggers revalidateTag (src/app/actions/
 * notifications.ts), so this Server Component re-renders with rows updated.
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

  const rows = await getNotificationsForViewer(user.id, 50)

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 lg:px-8 lg:py-12">
      {/* D-07 + RESEARCH Pitfall 6: client-side dispatch of the seen-at + cache
          invalidate SA. Must NOT run during render (Next 16 rejects revalidateTag
          with phase === 'render'). */}
      <MarkNotificationsSeenOnMount />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Notifications</h1>
        {rows.length > 0 && <MarkAllReadButton />}
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
