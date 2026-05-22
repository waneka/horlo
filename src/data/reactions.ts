import 'server-only'

import { and, eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import { watchLikes, wearLikes } from '@/db/schema'

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
