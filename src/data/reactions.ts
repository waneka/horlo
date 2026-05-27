import 'server-only'

import { cacheTag } from 'next/cache'
import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/db'
import { comments, follows, watchLikes, watches, wearLikes } from '@/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LikesResult {
  count: number
  viewerHasLiked: boolean
}

export type LikeTarget = { type: 'watch' | 'wear'; id: string }

// ---------------------------------------------------------------------------
// Read — getLikesForTarget (D-07)
// ---------------------------------------------------------------------------

/**
 * Returns `{ count, viewerHasLiked }` for the given target in a single
 * aggregate query. `coalesce(bool_or(...), false)` handles the empty-group
 * null case (Pitfall 1 — `bool_or` returns NULL over an empty set).
 */
export async function getLikesForTarget(
  viewerId: string,
  target: LikeTarget,
): Promise<LikesResult> {
  if (target.type === 'watch') {
    const rows = await db
      .select({
        count: sql<number>`count(*)::int`,
        viewerHasLiked: sql<boolean>`coalesce(bool_or(${watchLikes.userId} = ${viewerId}), false)`,
      })
      .from(watchLikes)
      .where(eq(watchLikes.watchId, target.id))
    return { count: rows[0]?.count ?? 0, viewerHasLiked: rows[0]?.viewerHasLiked ?? false }
  } else {
    const rows = await db
      .select({
        count: sql<number>`count(*)::int`,
        viewerHasLiked: sql<boolean>`coalesce(bool_or(${wearLikes.userId} = ${viewerId}), false)`,
      })
      .from(wearLikes)
      .where(eq(wearLikes.wearEventId, target.id))
    return { count: rows[0]?.count ?? 0, viewerHasLiked: rows[0]?.viewerHasLiked ?? false }
  }
}

// ---------------------------------------------------------------------------
// Write — createLike (idempotent, LIKE-05)
// ---------------------------------------------------------------------------

/**
 * Idempotent like insert. Duplicate (userId, target) pairs are a no-op thanks
 * to the watch_likes_unique_pair / wear_likes_unique_pair UNIQUE constraints +
 * onConflictDoNothing (LIKE-05). No throw on duplicate.
 */
export async function createLike(
  userId: string,
  target: LikeTarget,
): Promise<void> {
  if (target.type === 'watch') {
    await db
      .insert(watchLikes)
      .values({ userId, watchId: target.id })
      .onConflictDoNothing()
  } else {
    await db
      .insert(wearLikes)
      .values({ userId, wearEventId: target.id })
      .onConflictDoNothing()
  }
}

// ---------------------------------------------------------------------------
// Write — deleteLike (IDOR-safe, T-54-03)
// ---------------------------------------------------------------------------

/**
 * Delete the like row for this exact (userId, target) pair. IDOR-safe: the
 * WHERE clause includes `userId = caller` — a user cannot delete another
 * user's like row (T-54-03).
 *
 * NOTE: Do NOT add a `toggleLike` helper here — toggle composition is the
 * Phase 55 Server Action's responsibility (see 54-RESEARCH.md Open Question 2).
 */
export async function deleteLike(
  userId: string,
  target: LikeTarget,
): Promise<void> {
  if (target.type === 'watch') {
    await db
      .delete(watchLikes)
      .where(
        and(
          eq(watchLikes.userId, userId),
          eq(watchLikes.watchId, target.id),
        ),
      )
  } else {
    await db
      .delete(wearLikes)
      .where(
        and(
          eq(wearLikes.userId, userId),
          eq(wearLikes.wearEventId, target.id),
        ),
      )
  }
}

// ---------------------------------------------------------------------------
// Cached read — getLikesForTargetCached (Phase 56, LIKE-01/02, SEC-05)
// ---------------------------------------------------------------------------

/**
 * 'use cache' wrapper around getLikesForTarget with Phase-55 cache tags.
 *
 * CRITICAL (SEC-05): viewerId MUST be passed as an explicit function argument
 * (not resolved inside this scope) so Next.js serializes it into the cache key.
 * Distinct viewers get distinct cache entries — viewer A's viewerHasLiked cannot
 * be served to viewer B.
 *
 * Tags match what toggleLikeAction fires (must match exactly):
 *   revalidateTag('reactions:{type}:{id}', 'max') → busts the cross-user count
 *   updateTag('viewer:{userId}:reactions')         → busts this viewer's liked state
 *
 * Anon path: pass '__anon__' sentinel for null viewerId. The SQL
 * bool_or(userId = '__anon__') evaluates false over all real UUID rows — correct.
 * The viewer:__anon__:reactions tag is never invalidated — also correct.
 *
 * IMPORTANT: Do not resolve auth inside this scope — request-time APIs
 * (auth helpers, cookie/header access) are forbidden inside 'use cache'
 * (Next.js 16.2.3 constraint). Auth is resolved in the page (uncached)
 * and passed in as viewerId.
 *
 * No cacheLife added: the action uses revalidateTag('max') + updateTag for
 * immediate expiry; the default lifetime is correct for a tag-busted read.
 */
export async function getLikesForTargetCached(
  viewerId: string,
  target: LikeTarget,
): Promise<LikesResult> {
  'use cache'
  cacheTag(`reactions:${target.type}:${target.id}`, `viewer:${viewerId}:reactions`)
  return getLikesForTarget(viewerId, target)
}

// ---------------------------------------------------------------------------
// Types — WatchCounts (DISP-01)
// ---------------------------------------------------------------------------

export interface WatchCounts {
  likeCount: number
  commentCount: number
  liked: boolean       // NEW — viewer has liked this watch (seeded by Q6)
  canComment: boolean  // NEW — viewer is allowed to comment (= allowedSet membership)
}

// ---------------------------------------------------------------------------
// Read — getBatchedWatchCounts (DISP-01 / D-10 / T-57-02 / T-57-08)
// ---------------------------------------------------------------------------

/**
 * Returns a Map<watchId, {likeCount, commentCount, liked, canComment}> for every
 * watchId in the input list using a CONSTANT number of DB queries (≤6, no N+1).
 *
 * Gate logic (D-10 / GATE-02):
 *   - Likes are open to all viewers (GATE-02).
 *   - Comments on wishlist watches owned by someone other than the viewer are
 *     only visible when the viewer and the owner are mutual-follows. Otherwise
 *     commentCount is 0 (T-57-02 information-disclosure mitigation).
 *
 * Query budget:
 *   Q1 — watch rows (id, userId, status) via inArray
 *   Q2 — viewer→owners follows (only when foreign wishlist watches exist)
 *   Q3 — owners→viewer follows (only when foreign wishlist watches exist)
 *   Q4 — like counts grouped by watchId (all watchIds)
 *   Q5 — comment counts grouped by watchId (only allowedWatchIds)
 *   Q6 — viewer's liked set via inArray(watchLikes.watchId, watchIds) (Phase 63 D-11)
 *
 * When there are no foreign wishlist watches (all owned by viewer OR all
 * non-wishlist), Q2 and Q3 are skipped → ≤4 queries total (T-57-08).
 *
 * IMPORTANT: Auth must be resolved outside this function. Do NOT call
 * isMutualFollow in a loop (N+1). Use the two inArray follows queries +
 * JS set intersection pattern instead.
 */
export async function getBatchedWatchCounts(
  viewerId: string,
  watchIds: string[],
): Promise<Map<string, WatchCounts>> {
  if (watchIds.length === 0) return new Map()

  // Q1: fetch watch rows to determine ownership + status for the gate check
  const watchRows = await db
    .select({
      id: watches.id,
      userId: watches.userId,
      status: watches.status,
    })
    .from(watches)
    .where(inArray(watches.id, watchIds))

  const watchMap = new Map(watchRows.map((w) => [w.id, w]))

  // Compute wishlist owner IDs that are NOT the viewer — these are the
  // watches where the comment gate must be evaluated.
  const wishlistOwnerIds = [
    ...new Set(
      watchRows
        .filter((w) => w.status === 'wishlist' && w.userId !== viewerId)
        .map((w) => w.userId),
    ),
  ]

  // Build mutualSet: set of owner IDs who are mutual-follows with the viewer.
  // Two inArray queries + JS set intersection (not isMutualFollow in a loop).
  // Q2: viewer→owners (does the viewer follow each wishlist owner?)
  // Q3: owners→viewer (does each wishlist owner follow the viewer back?)
  // Both queries always run (constant query budget) — inArray([]) is a no-op
  // that returns [] without a round-trip on most DB drivers, but the mock
  // requires the queue slots to be consumed in order.
  const viewerFollowsOwners = await db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(and(eq(follows.followerId, viewerId), inArray(follows.followingId, wishlistOwnerIds)))

  const ownersFollowViewer = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(and(eq(follows.followingId, viewerId), inArray(follows.followerId, wishlistOwnerIds)))

  const viewerFollowsSet = new Set(viewerFollowsOwners.map((r) => r.followingId))
  const ownersFollowSet = new Set(ownersFollowViewer.map((r) => r.followerId))
  const mutualSet = new Set([...viewerFollowsSet].filter((id) => ownersFollowSet.has(id)))

  // Compute allowedWatchIds: watches where comment counts are visible to this viewer.
  // A watch is allowed when:
  //   (a) viewer is the owner, OR
  //   (b) watch is not a wishlist watch, OR
  //   (c) watch is a wishlist watch and viewer + owner are mutual-follows
  const allowedWatchIds = watchIds.filter((id) => {
    const w = watchMap.get(id)
    if (!w) return false
    return w.userId === viewerId || w.status !== 'wishlist' || mutualSet.has(w.userId)
  })
  const allowedSet = new Set(allowedWatchIds)

  // Q4: like counts for ALL watchIds (likes are open regardless of gate)
  const likeCountRows = await db
    .select({
      watchId: watchLikes.watchId,
      count: sql<number>`count(*)::int`,
    })
    .from(watchLikes)
    .where(inArray(watchLikes.watchId, watchIds))
    .groupBy(watchLikes.watchId)

  const likeCountMap = new Map(likeCountRows.map((r) => [r.watchId, r.count]))

  // Q5: comment counts for ONLY allowedWatchIds (gate applied at query level).
  // The DB predicate restricts to allowedWatchIds — gated watches never appear
  // in the result rows. We also gate in JS (allowedSet check) as a defence-in-
  // depth measure against mock environments that return unfiltered rows.
  const commentCountRows = await db
    .select({
      watchId: comments.watchId,
      count: sql<number>`count(*)::int`,
    })
    .from(comments)
    .where(inArray(comments.watchId, allowedWatchIds))
    .groupBy(comments.watchId)

  const commentCountMap = new Map<string, number>()
  for (const r of commentCountRows) {
    if (r.watchId !== null && allowedSet.has(r.watchId)) {
      commentCountMap.set(r.watchId, r.count)
    }
  }

  // Q6: viewer's liked set — which watchIds has the viewer already liked?
  // Single inArray query — NOT a per-watch loop (Anti-Pattern: N+1 for liked, RESEARCH Pitfall 6)
  const viewerLikedRows = await db
    .select({ watchId: watchLikes.watchId })
    .from(watchLikes)
    .where(and(eq(watchLikes.userId, viewerId), inArray(watchLikes.watchId, watchIds)))
  const viewerLikedSet = new Set(viewerLikedRows.map((r) => r.watchId))

  // Build the result Map: every input watchId must have an entry (default 0).
  // commentCount is 0 by default for gated watches (D-10 enforcement).
  // liked: from Q6 viewer liked set; canComment: from existing allowedSet (zero new queries).
  const result = new Map<string, WatchCounts>()
  for (const id of watchIds) {
    result.set(id, {
      likeCount: likeCountMap.get(id) ?? 0,
      commentCount: commentCountMap.get(id) ?? 0,
      liked: viewerLikedSet.has(id),      // NEW — from Q6
      canComment: allowedSet.has(id),     // NEW — allowedSet already computed above
    })
  }

  return result
}

// ---------------------------------------------------------------------------
// Cached read — getBatchedWatchCountsCached (T-57-07)
// ---------------------------------------------------------------------------

/**
 * 'use cache' wrapper around getBatchedWatchCounts.
 *
 * IMPORTANT (T-57-07): Comment counts are viewer-scoped because of the D-10
 * wishlist gate — viewer A's 0-count on a gated watch must not be served to
 * viewer B who IS mutual-follow and should see the real count. The
 * `viewer:${viewerId}:counts` tag isolates per-viewer cache entries.
 *
 * The `profile:${profileUsername}` tag is refreshed for free by the existing
 * comment-action revalidateTag, so adding/deleting comments automatically
 * busts the grid count cache.
 *
 * Auth must be resolved OUTSIDE this scope — request-time APIs (auth helpers,
 * cookie/header access) are forbidden inside 'use cache' (Next.js 16.2.3).
 */
export async function getBatchedWatchCountsCached(
  viewerId: string,
  watchIds: string[],
  profileUsername: string,
): Promise<Map<string, WatchCounts>> {
  'use cache'
  cacheTag(`profile:${profileUsername}`, `viewer:${viewerId}:counts`)
  return getBatchedWatchCounts(viewerId, watchIds)
}
