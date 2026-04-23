import { cacheLife, cacheTag } from 'next/cache'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { getNotificationsUnreadState } from '@/data/notifications'

/**
 * NotificationBell — nav bell with unread dot.
 *
 * CRITICAL (D-25, Pitfall 5): viewerId MUST be an explicit prop. Do NOT resolve
 * viewer identity inside the cached scope — the cache key would omit the
 * viewer and leak state across users. The parent component (Phase 14 nav,
 * currently the temporary Header placement) resolves the viewer upstream and
 * passes it down.
 *
 * Cache profile: 30s revalidate (D-26). Visiting /notifications triggers
 * revalidateTag(`viewer:${viewerId}`, 'max') so the dot reflects immediately.
 * Next 16 two-arg revalidateTag required — RESEARCH Pitfall 4.
 */
export async function NotificationBell({ viewerId }: { viewerId: string }) {
  'use cache'
  cacheTag('notifications', `viewer:${viewerId}`)
  cacheLife({ revalidate: 30 })
  const { hasUnread } = await getNotificationsUnreadState(viewerId)

  return (
    <Link
      href="/notifications"
      aria-label={hasUnread ? 'Unread notifications' : 'Notifications'}
      className="relative inline-flex items-center justify-center min-h-11 min-w-11"
    >
      <Bell className="size-5" aria-hidden />
      {hasUnread && (
        <span
          className="absolute top-0 right-0 size-2 rounded-full bg-accent"
          aria-hidden
        />
      )}
    </Link>
  )
}
