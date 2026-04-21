// Phase 10: Shared feed types consumed by Plans 02–09.
//
// Publishing these in a single type-only module forces the DAL (Plan 02),
// the home Server Component tree, and the UI row components (Plan 05) to
// agree on shape. Any drift surfaces as a TypeScript compile error.
//
// No runtime code lives here — this file is purely `export type` / `export
// interface` declarations, so importing it has zero bundle cost.

export type ActivityType = 'watch_added' | 'wishlist_added' | 'watch_worn'

/**
 * Keyset pagination cursor for the Network Activity feed (F-04).
 *
 * Encoded as `(created_at DESC, id DESC)` — `id` is the UUID tiebreaker for
 * rows sharing a millisecond timestamp. The wire encoding (opaque base64 vs.
 * plain tuple) is the DAL's choice per CONTEXT decisions.
 */
export interface FeedCursor {
  createdAt: string // ISO 8601 timestamp, e.g. '2026-04-21T14:23:00.000Z'
  id: string // UUID of last-seen row (tiebreaker)
}

/**
 * A single un-collapsed activity row joined with actor profile fields. One
 * per `activities` row. The DAL emits these after privacy gating (F-06)
 * but before the time-window collapse (F-08) runs.
 */
export interface RawFeedRow {
  kind: 'raw'
  id: string
  type: ActivityType
  createdAt: string // ISO 8601
  watchId: string | null
  metadata: { brand: string; model: string; imageUrl: string | null }
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

/**
 * A synthetic row representing ≥3 same-type events from the same actor
 * within a 1-hour window (F-08). Rendered as "{username} added {N} watches"
 * with the first (most recent) event's thumbnail as the representative.
 *
 * `watch_worn` is never aggregated — it's an intentional per-day signal.
 */
export interface AggregatedRow {
  kind: 'aggregated'
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  type: 'watch_added' | 'wishlist_added'
  count: number
  firstCreatedAt: string // ISO 8601 — the most recent row in the group
  lastCreatedAt: string // ISO 8601 — the oldest row in the group
  representativeMetadata: { brand: string; model: string; imageUrl: string | null }
  collapsedIds: string[] // for expand UX in Plan 05
}

export type FeedRow = RawFeedRow | AggregatedRow

export interface FeedPage {
  rows: FeedRow[]
  nextCursor: FeedCursor | null
}
