import { Inbox } from 'lucide-react'

/**
 * NotificationsEmptyState — NOTIF-10 zero-row state.
 *
 * Copy locked by UI-SPEC §"Copywriting Contract". `role="status"` on the body text
 * so screen readers announce the transition to empty (e.g., after mark-all-read
 * clears everything and revalidation triggers a re-render).
 */
export function NotificationsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-4">
      <Inbox className="size-10 text-muted-foreground/40" aria-hidden />
      <h2 className="text-xl font-semibold text-foreground">
        You&apos;re all caught up
      </h2>
      <p role="status" className="text-sm text-muted-foreground text-center max-w-sm">
        Notifications from followers and collectors will appear here.
      </p>
    </div>
  )
}
