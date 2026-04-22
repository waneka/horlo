import 'server-only'

import { db } from '@/db'
import { activities, profiles, profileSettings, follows } from '@/db/schema'
import { and, desc, eq, not, sql } from 'drizzle-orm'
import type { FeedCursor, RawFeedRow } from '@/lib/feedTypes'
import type { WearVisibility } from '@/lib/wearVisibility'

/**
 * Result shape returned by `getFeedForUser`. Carries raw (un-aggregated)
 * rows. The public `FeedPage` in @/lib/feedTypes is the POST-aggregation
 * shape with `FeedRow[]` (raw | aggregated); keep them distinct so callers
 * that want to aggregate (Server Action) and callers that want the raw
 * stream (SSR initial render) both get accurate types.
 */
export interface RawFeedPage {
  rows: RawFeedRow[]
  nextCursor: FeedCursor | null
}

export type ActivityType = 'watch_added' | 'wishlist_added' | 'watch_worn'

export type WatchAddedMetadata = {
  brand: string
  model: string
  imageUrl: string | null
}

export type WishlistAddedMetadata = {
  brand: string
  model: string
  imageUrl: string | null
}

/**
 * Phase 12 D-10: widened metadata for watch_worn rows. The `visibility`
 * field is REQUIRED so the feed DAL can gate per-row without joining back
 * to wear_events. Pitfall G-7 mitigation: TypeScript flags any caller that
 * forgets to pass visibility.
 */
export type WatchWornMetadata = {
  brand: string
  model: string
  imageUrl: string | null
  visibility: WearVisibility
}

export type ActivityMetadata =
  | WatchAddedMetadata
  | WishlistAddedMetadata
  | WatchWornMetadata

export async function logActivity(
  userId: string,
  type: 'watch_added',
  watchId: string | null,
  metadata: WatchAddedMetadata,
): Promise<void>
export async function logActivity(
  userId: string,
  type: 'wishlist_added',
  watchId: string | null,
  metadata: WishlistAddedMetadata,
): Promise<void>
export async function logActivity(
  userId: string,
  type: 'watch_worn',
  watchId: string | null,
  metadata: WatchWornMetadata,
): Promise<void>
export async function logActivity(
  userId: string,
  type: ActivityType,
  watchId: string | null,
  metadata: ActivityMetadata,
): Promise<void> {
  await db.insert(activities).values({
    userId,
    type,
    watchId,
    metadata,
  })
}

/**
 * FEED-01..04 DAL. Two-layer privacy (Phase 8 D-15, Phase 9 D-20):
 *   - OUTER gate: RLS `activities_select_own_or_followed` (Plan 01) admits
 *     only own + followed rows. The innerJoin on `follows` here is
 *     redundant with RLS but makes the DAL correct even if invoked via a
 *     service-role connection (the tests seed this way, and server
 *     renders may run through the postgres role depending on deployment).
 *   - INNER gate: per-event privacy (profile_public /
 *     collection_public / wishlist_public) and per-row visibility for
 *     watch_worn (Phase 12 metadata gate) enforced in the WHERE clause —
 *     follows do NOT bypass privacy (Phase 9 D-08).
 *
 * F-05 own-filter: `not(eq(activities.userId, viewerId))`.
 * FEED-03 keyset: tuple comparison `(created_at, id) < ($cursorCreatedAt,
 * $cursorId)` — stable against concurrent inserts. `created_at` is a
 * Postgres `timestamptz` with microsecond precision, so `id` is a
 * rare-case tiebreaker that only fires when two rows share a
 * microsecond-identical `created_at`. UUID v4 `id` values give effective
 * uniqueness; this invariant is what FEED-03 leans on.
 * Returns RawFeedRow[] — aggregation happens in `aggregateFeed`
 * (caller-composed by `loadMoreFeed`).
 */
export async function getFeedForUser(
  viewerId: string,
  cursor: FeedCursor | null,
  limit = 20,
): Promise<RawFeedPage> {
  const cursorClause = cursor
    ? sql`(${activities.createdAt}, ${activities.id}) < (${new Date(cursor.createdAt)}, ${cursor.id})`
    : sql`TRUE`

  const rows = await db
    .select({
      id: activities.id,
      type: activities.type,
      createdAt: activities.createdAt,
      watchId: activities.watchId,
      metadata: activities.metadata,
      userId: activities.userId,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(activities)
    .innerJoin(profiles, eq(profiles.id, activities.userId))
    .innerJoin(profileSettings, eq(profileSettings.userId, activities.userId))
    .innerJoin(
      follows,
      and(eq(follows.followerId, viewerId), eq(follows.followingId, activities.userId)),
    )
    .where(
      and(
        not(eq(activities.userId, viewerId)), // F-05 own-filter
        eq(profileSettings.profilePublic, true), // F-06 outer privacy gate (G-4)
        // Phase 12 (WYWT-10) feed-side visibility gate.
        //
        // The watch_worn branch reads `activities.metadata->>'visibility'` rather
        // than JOINing back to wear_events (avoids latency on the hot feed path).
        // The simplified `IN ('public','followers')` predicate is valid here
        // because the outer innerJoin on `follows` (above) already restricts the
        // feed to followed actors only — every admitted row is from a followed
        // actor by construction, so a `'followers'` row is automatically a
        // follower-of relationship.
        //
        // ASSUMPTION A2 (RESEARCH §"Pattern 2"): if a future plan widens the
        // follows-JOIN (e.g., admitting "popular" non-followed actors), this
        // simplification BREAKS and followers wears leak to non-followers. If
        // you change the JOIN structure, you MUST add a per-row follower check
        // back to this branch.
        //
        // D-09 fail-closed: legacy `watch_worn` activity rows written before
        // Phase 12 have no `visibility` key in metadata. Postgres `->>` returns
        // NULL for missing key; `NULL IN ('public','followers')` evaluates to
        // NULL, which is treated as not-true in WHERE — legacy rows are
        // excluded without an explicit IS NOT NULL check. The Plan 01 matrix
        // file's "feed D-09 fail-closed" cell pins this expectation.
        sql`(
          (${activities.type} = 'watch_added'     AND ${profileSettings.collectionPublic} = true)
          OR (${activities.type} = 'wishlist_added' AND ${profileSettings.wishlistPublic} = true)
          OR (${activities.type} = 'watch_worn'     AND ${activities.metadata}->>'visibility' IN ('public','followers'))
        )`,
        cursorClause,
      ),
    )
    .orderBy(desc(activities.createdAt), desc(activities.id))
    .limit(limit + 1) // +1 sentinel: if we got back limit+1 rows there's a next page

  const hasMore = rows.length > limit
  const pageRows = rows.slice(0, limit)
  const last = pageRows[pageRows.length - 1]
  const nextCursor: FeedCursor | null =
    hasMore && last
      ? { createdAt: last.createdAt.toISOString(), id: last.id }
      : null

  return {
    rows: pageRows.map((r): RawFeedRow => ({
      kind: 'raw',
      id: r.id,
      type: r.type as ActivityType,
      createdAt: r.createdAt.toISOString(),
      watchId: r.watchId,
      metadata: normalizeMetadata(r.metadata),
      userId: r.userId,
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    })),
    nextCursor,
  }
}

function normalizeMetadata(raw: unknown): RawFeedRow['metadata'] {
  if (raw && typeof raw === 'object') {
    const m = raw as Record<string, unknown>
    const v = m.visibility
    const visibility: WearVisibility | undefined =
      v === 'public' || v === 'followers' || v === 'private' ? v : undefined
    return {
      brand: typeof m.brand === 'string' ? m.brand : '',
      model: typeof m.model === 'string' ? m.model : '',
      imageUrl: typeof m.imageUrl === 'string' ? m.imageUrl : null,
      ...(visibility ? { visibility } : {}),
    }
  }
  return { brand: '', model: '', imageUrl: null }
}
