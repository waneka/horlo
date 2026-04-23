'use client'

import Link from 'next/link'
import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import { timeAgo } from '@/lib/timeAgo'
import { cn } from '@/lib/utils'

/**
 * NotificationRow row prop shape — mirrors the DAL output from
 * src/data/notifications.ts (Plan 02). Exported separately here so the component
 * is self-documenting for tests and for Plan 04's page that passes these props.
 *
 * `actorCount` is populated by NotificationsInbox during display-time grouping
 * (NOTIF-08, D-15). For non-grouped rows (actor_count === 1 or non-overlap types)
 * it defaults to 1 or is omitted.
 */
export interface NotificationRowData {
  id: string
  type: 'follow' | 'watch_overlap' | 'price_drop' | 'trending_collector'
  payload: Record<string, unknown>
  readAt: Date | null
  createdAt: Date | string
  actorUsername: string | null
  actorDisplayName: string | null
  actorAvatarUrl: string | null
  /** Populated by NotificationsInbox when ≥2 overlap rows collapse. Defaults to 1. */
  actorCount?: number
}

export interface NotificationRowProps {
  row: NotificationRowData
}

export function NotificationRow({ row }: NotificationRowProps) {
  // B-8: unknown types render null — silent no-op, never a broken card.
  if (
    row.type !== 'follow' &&
    row.type !== 'watch_overlap' &&
    row.type !== 'price_drop' &&
    row.type !== 'trending_collector'
  ) {
    return null
  }

  const isUnread = row.readAt === null
  const actorName =
    row.actorDisplayName ?? row.actorUsername ?? 'Someone'
  const actorCount = row.actorCount ?? 1
  const timeLabel = timeAgo(row.createdAt)

  const href = resolveHref(row)
  const copy = resolveCopy(row, actorName, actorCount, isUnread)

  return (
    <Link
      href={href}
      aria-label={`${actorName} notification`}
      className={cn(
        'group relative flex items-center gap-3 min-h-12 bg-card px-4 py-2 transition-colors hover:bg-muted/40 focus-within:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isUnread && 'border-l-2 border-l-accent',
      )}
    >
      <AvatarDisplay
        avatarUrl={row.actorAvatarUrl}
        displayName={row.actorDisplayName}
        username={row.actorUsername ?? ''}
        size={40}
      />
      <div className="flex-1 min-w-0 text-sm text-foreground">
        {copy}
        <span className="text-muted-foreground"> · {timeLabel}</span>
      </div>
    </Link>
  )
}

function resolveHref(row: NotificationRowData): string {
  if (row.type === 'follow') {
    const username =
      (row.payload as { actor_username?: string })?.actor_username ??
      row.actorUsername ??
      ''
    return `/u/${username}`
  }
  if (row.type === 'watch_overlap') {
    const p = row.payload as { actor_username?: string; watch_id?: string }
    const username = p.actor_username ?? row.actorUsername ?? ''
    const watchId = p.watch_id ?? ''
    return `/u/${username}?focusWatch=${watchId}`
  }
  // Stub types (price_drop, trending_collector): UI-SPEC says "TBD" — route to #
  // so rows render but click is a safe no-op until wiring phase ships.
  return '#'
}

function resolveCopy(
  row: NotificationRowData,
  actorName: string,
  actorCount: number,
  isUnread: boolean,
): React.ReactNode {
  const actorClass = isUnread
    ? 'font-semibold text-foreground'
    : 'font-normal text-foreground'

  if (row.type === 'follow') {
    return (
      <>
        <span className={actorClass}>{actorName}</span>
        <span> started following you</span>
      </>
    )
  }

  if (row.type === 'watch_overlap') {
    const watchModel =
      (row.payload as { watch_model?: string })?.watch_model ?? 'a watch'
    if (actorCount > 1) {
      return (
        <>
          <span className={actorClass}>{actorName}</span>
          <span> + {actorCount - 1} others also own your </span>
          <span className="font-semibold text-foreground">{watchModel}</span>
        </>
      )
    }
    return (
      <>
        <span className={actorClass}>{actorName}</span>
        <span> also owns your </span>
        <span className="font-semibold text-foreground">{watchModel}</span>
      </>
    )
  }

  if (row.type === 'price_drop') {
    const p = row.payload as { watchModel?: string; newPrice?: string }
    return (
      <>
        <span>Your </span>
        <span className="font-semibold text-foreground">
          {p.watchModel ?? 'watch'}
        </span>
        <span> wishlist watch dropped to </span>
        <span className="font-semibold text-foreground">
          {p.newPrice ?? '—'}
        </span>
      </>
    )
  }

  // trending_collector
  const p = row.payload as { watchModel?: string; actorCount?: number }
  return (
    <>
      <span className="font-semibold text-foreground">
        {p.actorCount ?? 0} collectors
      </span>
      <span> in your taste cluster added a </span>
      <span className="font-semibold text-foreground">
        {p.watchModel ?? 'watch'}
      </span>
      <span> this week</span>
    </>
  )
}
