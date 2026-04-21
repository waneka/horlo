import 'server-only'

import { db } from '@/db'
import { activities, profiles, profileSettings, follows } from '@/db/schema'
import { and, desc, eq, not, sql } from 'drizzle-orm'
import type { FeedCursor, FeedPage, RawFeedRow } from '@/lib/feedTypes'

export type ActivityType = 'watch_added' | 'wishlist_added' | 'watch_worn'

export async function logActivity(
  userId: string,
  type: ActivityType,
  watchId: string | null,
  metadata: { brand: string; model: string; imageUrl: string | null }
) {
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
 *     collection_public / wishlist_public / worn_public) enforced in the
 *     WHERE clause — follows do NOT bypass privacy (Phase 9 D-08).
 *
 * F-05 own-filter: `not(eq(activities.userId, viewerId))`.
 * FEED-03 keyset: tuple comparison `(created_at, id) < ($cursorCreatedAt,
 * $cursorId)` — stable against concurrent inserts.
 * Returns RawFeedRow[] — aggregation happens in `aggregateFeed`
 * (caller-composed by `loadMoreFeed`).
 */
export async function getFeedForUser(
  viewerId: string,
  cursor: FeedCursor | null,
  limit = 20,
): Promise<FeedPage> {
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
        eq(profileSettings.profilePublic, true), // F-06 outer privacy gate
        sql`(
          (${activities.type} = 'watch_added'     AND ${profileSettings.collectionPublic} = true)
          OR (${activities.type} = 'wishlist_added' AND ${profileSettings.wishlistPublic} = true)
          OR (${activities.type} = 'watch_worn'     AND ${profileSettings.wornPublic}     = true)
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
    return {
      brand: typeof m.brand === 'string' ? m.brand : '',
      model: typeof m.model === 'string' ? m.model : '',
      imageUrl: typeof m.imageUrl === 'string' ? m.imageUrl : null,
    }
  }
  return { brand: '', model: '', imageUrl: null }
}
