import type { RawFeedRow, AggregatedRow, FeedRow } from '@/lib/feedTypes'

const ONE_HOUR_MS = 60 * 60 * 1000

/**
 * F-08 time-window collapse: groups of ≥3 consecutive same-(userId, type) rows
 * where type ∈ {'watch_added','wishlist_added'} AND the head-to-tail createdAt
 * spread is < 1 hour collapse into one AggregatedRow. `watch_worn` never
 * aggregates (CONTEXT F-08: "nobody logs 3 wears in an hour" — it's an
 * intentional per-day signal).
 *
 * Input rows MUST already be sorted by createdAt DESC (feed order). Output
 * preserves that ordering; each aggregated group takes the slot of its first
 * (most recent) row. Groups of size 1 or 2 pass through as individual
 * RawFeedRows.
 *
 * Pure function — deterministic, no I/O, no wall-clock reads. Timestamps are
 * parsed from the input rows' ISO strings via new Date() parsing only.
 */
export function aggregateFeed(rows: RawFeedRow[]): FeedRow[] {
  const out: FeedRow[] = []
  let i = 0
  while (i < rows.length) {
    const head = rows[i]
    const aggregatable =
      head.type === 'watch_added' || head.type === 'wishlist_added'
    if (!aggregatable) {
      out.push(head)
      i++
      continue
    }
    const headMs = new Date(head.createdAt).getTime()
    let j = i + 1
    while (
      j < rows.length &&
      rows[j].userId === head.userId &&
      rows[j].type === head.type &&
      headMs - new Date(rows[j].createdAt).getTime() < ONE_HOUR_MS
    ) {
      j++
    }
    const groupSize = j - i
    if (groupSize >= 3) {
      out.push(toAggregated(rows.slice(i, j)))
    } else {
      for (let k = i; k < j; k++) out.push(rows[k])
    }
    i = j
  }
  return out
}

function toAggregated(group: RawFeedRow[]): AggregatedRow {
  const head = group[0]
  const tail = group[group.length - 1]
  return {
    kind: 'aggregated',
    userId: head.userId,
    username: head.username,
    displayName: head.displayName,
    avatarUrl: head.avatarUrl,
    // Narrowing: the aggregator only enters this branch for 'watch_added'
    // or 'wishlist_added' — watch_worn short-circuits above.
    type: head.type as 'watch_added' | 'wishlist_added',
    count: group.length,
    firstCreatedAt: head.createdAt, // most recent (DESC order → head)
    lastCreatedAt: tail.createdAt, // oldest
    representativeMetadata: head.metadata,
    collapsedIds: group.map((r) => r.id),
  }
}
