import { NotificationRow, type NotificationRowData } from './NotificationRow'

/**
 * NotificationsInbox — /notifications page body.
 *
 * Responsibilities:
 *   1. Display-time grouping (NOTIF-08, D-15): adjacent watch_overlap rows with
 *      the same (brand_normalized, model_normalized, date_trunc('day', createdAt))
 *      collapse into one rendered row with actor_count populated.
 *   2. Bucket by Today / Yesterday / Earlier (D-02): sticky h2 subheaders,
 *      empty buckets omitted.
 *
 * Invariant (Pitfall 7): rows are pre-filtered to a single recipient by the
 * DAL's WHERE user_id = viewerId, so we don't need recipientUserId in the
 * grouping key. Document this for future maintainers.
 */
export interface NotificationsInboxProps {
  rows: NotificationRowData[]
  /** Reference "now" for bucketing — defaults to new Date(). Override for tests. */
  now?: Date
}

export function NotificationsInbox({ rows, now = new Date() }: NotificationsInboxProps) {
  // Step 1: NOTIF-08 display-time collapse.
  const collapsed = collapseWatchOverlaps(rows)

  // Step 2: D-02 bucket by Today / Yesterday / Earlier.
  const buckets = bucketByDay(collapsed, now)

  return (
    <div className="divide-y divide-border">
      {buckets.today.length > 0 && (
        <section>
          <h2 className="text-xs font-normal uppercase tracking-wide text-muted-foreground py-2 px-4 sticky top-0 bg-background z-10">
            Today
          </h2>
          {buckets.today.map((row) => (
            <NotificationRow key={row.id} row={row} />
          ))}
        </section>
      )}
      {buckets.yesterday.length > 0 && (
        <section>
          <h2 className="text-xs font-normal uppercase tracking-wide text-muted-foreground py-2 px-4 sticky top-0 bg-background z-10">
            Yesterday
          </h2>
          {buckets.yesterday.map((row) => (
            <NotificationRow key={row.id} row={row} />
          ))}
        </section>
      )}
      {buckets.earlier.length > 0 && (
        <section>
          <h2 className="text-xs font-normal uppercase tracking-wide text-muted-foreground py-2 px-4 sticky top-0 bg-background z-10">
            Earlier
          </h2>
          {buckets.earlier.map((row) => (
            <NotificationRow key={row.id} row={row} />
          ))}
        </section>
      )}
    </div>
  )
}

/**
 * NOTIF-08: collapse adjacent watch_overlap rows that share
 * (brand_normalized, model_normalized, calendar day). The most-recent row
 * wins for actor display (avatar + name); actor_count is the group size.
 *
 * Non-overlap rows (follow) pass through unchanged.
 *
 * Pitfall 7: rows are already viewer-scoped by DAL WHERE user_id = viewerId,
 * so the group key does NOT need recipientUserId.
 */
function collapseWatchOverlaps(rows: NotificationRowData[]): NotificationRowData[] {
  const groups = new Map<string, NotificationRowData[]>()
  const nonOverlap: NotificationRowData[] = []

  for (const row of rows) {
    if (row.type !== 'watch_overlap') {
      nonOverlap.push(row)
      continue
    }
    const p = row.payload as { watch_brand_normalized?: string; watch_model_normalized?: string }
    const brand = p.watch_brand_normalized ?? ''
    const model = p.watch_model_normalized ?? ''
    const day = toUtcDayKey(row.createdAt)
    const key = `${brand}|${model}|${day}`
    const existing = groups.get(key)
    if (existing) existing.push(row)
    else groups.set(key, [row])
  }

  const collapsed: NotificationRowData[] = [...nonOverlap]
  for (const group of groups.values()) {
    // Most recent actor wins (rows arrive newest-first from DAL; first in array is newest).
    const mostRecent = group[0]
    collapsed.push({ ...mostRecent, actorCount: group.length })
  }

  // Re-sort by createdAt desc, id desc to preserve newest-first after merging.
  collapsed.sort((a, b) => {
    const aTs = typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : a.createdAt.getTime()
    const bTs = typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : b.createdAt.getTime()
    if (bTs !== aTs) return bTs - aTs
    return b.id.localeCompare(a.id)
  })
  return collapsed
}

function toUtcDayKey(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/**
 * Bucket rows into Today / Yesterday / Earlier based on the user's LOCAL calendar day.
 * (D-02 wording is user-facing — "Today" means user-local today.)
 *
 * `now` is injectable for deterministic tests.
 */
function bucketByDay(
  rows: NotificationRowData[],
  now: Date,
): { today: NotificationRowData[]; yesterday: NotificationRowData[]; earlier: NotificationRowData[] } {
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)

  const today: NotificationRowData[] = []
  const yesterday: NotificationRowData[] = []
  const earlier: NotificationRowData[] = []

  for (const row of rows) {
    const created =
      typeof row.createdAt === 'string' ? new Date(row.createdAt) : row.createdAt
    if (created.getTime() >= startOfToday.getTime()) today.push(row)
    else if (created.getTime() >= startOfYesterday.getTime()) yesterday.push(row)
    else earlier.push(row)
  }

  return { today, yesterday, earlier }
}
