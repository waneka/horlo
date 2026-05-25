'use client'

import { useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import { markNotificationRead } from '@/app/actions/notifications'
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
  // Phase 53 D-09: extended to 6 values; the component renders null for unknown
  // types (B-8 guard below) so Phase 56-58 can ship new type rendering incrementally.
  type: 'follow' | 'watch_overlap' | 'watch_like' | 'wear_like' | 'watch_comment' | 'wear_comment'
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
  const router = useRouter()
  // D-08: optimistic per-row read state. The reducer accepts the new readAt
  // value and returns it — simplest possible useOptimistic shape. The first
  // arg (`row.readAt`) is the server-truth; React snaps back automatically
  // if the transition rejects (see PrivacyToggleRow.tsx for the same pattern).
  const [optimisticReadAt, setOptimisticReadAt] = useOptimistic<Date | null, Date | null>(
    row.readAt,
    (_current, next) => next,
  )
  const [pending, startTransition] = useTransition()

  // B-8: unknown types render null — silent no-op, never a broken card.
  // AFTER hooks so Rules of Hooks are honored.
  // Phase 58: extended to a 6-type allowlist (D-08); genuinely-unknown future
  // types (e.g. 'price_drop') still return null safely.
  const KNOWN_TYPES = ['follow', 'watch_overlap', 'watch_like', 'wear_like', 'watch_comment', 'wear_comment']
  if (!KNOWN_TYPES.includes(row.type)) {
    return null
  }

  const isUnread = optimisticReadAt === null
  const actorName =
    row.actorDisplayName ?? row.actorUsername ?? 'Someone'
  const actorCount = row.actorCount ?? 1
  const timeLabel = timeAgo(row.createdAt)

  const href = resolveHref(row)
  const copy = resolveCopy(row, actorName, actorCount, isUnread)
  // D-02: comment preview second line — only present on comment payloads;
  // like payloads have no comment_preview field so this is null for like rows.
  const commentPreview = (row.payload as { comment_preview?: string })?.comment_preview ?? null

  function activate() {
    if (pending) return
    startTransition(async () => {
      if (isUnread) {
        setOptimisticReadAt(new Date())
        // Fire-and-await the SA but do NOT block navigation on failure —
        // router.push runs regardless. If the SA fails the next render of
        // /notifications (on back-nav or revalidation) snaps the row back to
        // unread, mirroring PrivacyToggleRow's failure model.
        const result = await markNotificationRead({ notificationId: row.id })
        if (!result.success) {
          console.error('[NotificationRow] markNotificationRead failed:', result.error)
        }
      }
      router.push(href)
    })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      activate()
    }
  }

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`${actorName} notification`}
      onClick={activate}
      onKeyDown={onKeyDown}
      className={cn(
        'group relative flex items-center gap-3 min-h-12 bg-card px-4 py-2 transition-colors hover:bg-muted/40 focus-within:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
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
        {commentPreview && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{commentPreview}</p>
        )}
      </div>
    </div>
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
  // D-07: watch_like / watch_comment → /watch/{watch_id}
  if (row.type === 'watch_like' || row.type === 'watch_comment') {
    const watchId = (row.payload as { watch_id?: string })?.watch_id ?? ''
    return `/w/${watchId}`
  }
  // D-07: wear_like / wear_comment → /wear/{wear_event_id}
  if (row.type === 'wear_like' || row.type === 'wear_comment') {
    const wearEventId = (row.payload as { wear_event_id?: string })?.wear_event_id ?? ''
    return `/wear/${wearEventId}`
  }
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

  // D-01: watch_like — "{actor} liked your {model}" / grouped: "{actor} + {N-1} others liked your {model}"
  if (row.type === 'watch_like') {
    const watchModel = (row.payload as { watch_model?: string })?.watch_model ?? 'a watch'
    if (actorCount > 1) {
      return (
        <>
          <span className={actorClass}>{actorName}</span>
          <span> + {actorCount - 1} others liked your </span>
          <span className="font-semibold text-foreground">{watchModel}</span>
        </>
      )
    }
    return (
      <>
        <span className={actorClass}>{actorName}</span>
        <span> liked your </span>
        <span className="font-semibold text-foreground">{watchModel}</span>
      </>
    )
  }

  // D-01: wear_like — "{actor} liked your {model} wear" / grouped: "{actor} + {N-1} others liked your {model} wear"
  if (row.type === 'wear_like') {
    const watchModel = (row.payload as { watch_model?: string })?.watch_model ?? 'a watch'
    if (actorCount > 1) {
      return (
        <>
          <span className={actorClass}>{actorName}</span>
          <span> + {actorCount - 1} others liked your </span>
          <span className="font-semibold text-foreground">{watchModel}</span>
          <span> wear</span>
        </>
      )
    }
    return (
      <>
        <span className={actorClass}>{actorName}</span>
        <span> liked your </span>
        <span className="font-semibold text-foreground">{watchModel}</span>
        <span> wear</span>
      </>
    )
  }

  // D-01: watch_comment — "{actor} commented on your {model}" (D-05: never grouped)
  if (row.type === 'watch_comment') {
    const watchModel = (row.payload as { watch_model?: string })?.watch_model ?? 'a watch'
    return (
      <>
        <span className={actorClass}>{actorName}</span>
        <span> commented on your </span>
        <span className="font-semibold text-foreground">{watchModel}</span>
      </>
    )
  }

  // D-01: wear_comment — "{actor} commented on your {model} wear" (D-05: never grouped)
  if (row.type === 'wear_comment') {
    const watchModel = (row.payload as { watch_model?: string })?.watch_model ?? 'a watch'
    return (
      <>
        <span className={actorClass}>{actorName}</span>
        <span> commented on your </span>
        <span className="font-semibold text-foreground">{watchModel}</span>
        <span> wear</span>
      </>
    )
  }

  return null
}
