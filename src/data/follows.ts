import 'server-only'

import { cache } from 'react'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/db'
import { follows, profiles, profileSettings, watches } from '@/db/schema'
import { getWatchesByUser } from './watches'
import { getPreferencesByUser } from './preferences'
import { getAllWearEventsByUser } from './wearEvents'
import { computeTasteTags } from '@/lib/tasteTags'
import type { Watch, UserPreferences } from '@/lib/types'

// ---------------------------------------------------------------------------
// Follow mutation DAL (FOLL-01, FOLL-02)
// ---------------------------------------------------------------------------

/**
 * Idempotent follow insert. Duplicate pairs are a no-op thanks to the
 * follows_unique_pair constraint + onConflictDoNothing (D-10, T-09-04).
 */
export async function followUser(
  followerId: string,
  followingId: string,
): Promise<void> {
  await db
    .insert(follows)
    .values({ followerId, followingId })
    .onConflictDoNothing()
}

/**
 * Delete the follow row for this exact (follower, following) pair.
 * IDOR-safe: follower_id MUST match the caller's session id (T-09-03).
 */
export async function unfollowUser(
  followerId: string,
  followingId: string,
): Promise<void> {
  await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId),
      ),
    )
}

/**
 * Fast existence check used by ProfileHeader to hydrate the FollowButton's
 * initial state. Returns false when the pair is absent.
 */
export async function isFollowing(
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: follows.id })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId),
      ),
    )
    .limit(1)
  return rows.length > 0
}

// ---------------------------------------------------------------------------
// Follower / following list DAL (FOLL-04)
// ---------------------------------------------------------------------------

export interface FollowerListEntry {
  userId: string
  username: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  profilePublic: boolean
  watchCount: number
  wishlistCount: number
  followedAt: string
}

/**
 * Return all followers of `userId`, ordered by the time they followed
 * (most recent first). Single-pass join strategy (Pitfall 7 — no N+1):
 *   1. Resolve ordered follower ids.
 *   2. Batch-fetch profiles, profile_settings, watch aggregates.
 *   3. Merge by userId preserving the original ORDER BY desc(follows.createdAt).
 */
export async function getFollowersForProfile(
  userId: string,
): Promise<FollowerListEntry[]> {
  const followerRows = await db
    .select({
      userId: follows.followerId,
      followedAt: follows.createdAt,
    })
    .from(follows)
    .where(eq(follows.followingId, userId))
    .orderBy(desc(follows.createdAt))

  if (followerRows.length === 0) return []
  const ids = followerRows.map((r) => r.userId)
  return mergeListEntries(followerRows, ids)
}

/**
 * Return everyone `userId` is following, ordered by the time they followed
 * (most recent first). Mirror of getFollowersForProfile with follower/
 * following ids swapped.
 */
export async function getFollowingForProfile(
  userId: string,
): Promise<FollowerListEntry[]> {
  const followingRows = await db
    .select({
      userId: follows.followingId,
      followedAt: follows.createdAt,
    })
    .from(follows)
    .where(eq(follows.followerId, userId))
    .orderBy(desc(follows.createdAt))

  if (followingRows.length === 0) return []
  const ids = followingRows.map((r) => r.userId)
  return mergeListEntries(followingRows, ids)
}

// Shared merge step for the two list helpers. Keeps the list shape identical
// so Plan 03 can render both routes with one component.
async function mergeListEntries(
  ordered: Array<{ userId: string; followedAt: Date }>,
  ids: string[],
): Promise<FollowerListEntry[]> {
  const [profileRows, settingRows, watchRows] = await Promise.all([
    db.select().from(profiles).where(inArray(profiles.id, ids)),
    db
      .select()
      .from(profileSettings)
      .where(inArray(profileSettings.userId, ids)),
    db
      .select({
        userId: watches.userId,
        watchCount: sql<number>`count(*) FILTER (WHERE ${watches.status} = 'owned')::int`,
        wishlistCount: sql<number>`count(*) FILTER (WHERE ${watches.status} IN ('wishlist','grail'))::int`,
      })
      .from(watches)
      .where(inArray(watches.userId, ids))
      .groupBy(watches.userId),
  ])

  const profileById = new Map(profileRows.map((p) => [p.id, p]))
  const settingsById = new Map(settingRows.map((s) => [s.userId, s]))
  const watchById = new Map(watchRows.map((w) => [w.userId, w]))

  return ordered.flatMap((row) => {
    const p = profileById.get(row.userId)
    if (!p) return []
    const s = settingsById.get(row.userId)
    const w = watchById.get(row.userId)
    return [
      {
        userId: row.userId,
        username: p.username,
        displayName: p.displayName,
        bio: p.bio,
        avatarUrl: p.avatarUrl,
        profilePublic: s?.profilePublic ?? true,
        watchCount: w?.watchCount ?? 0,
        wishlistCount: w?.wishlistCount ?? 0,
        followedAt: row.followedAt.toISOString(),
      },
    ]
  })
}

// ---------------------------------------------------------------------------
// Taste-overlap data loader (PROF-09)
// ---------------------------------------------------------------------------

export interface TasteOverlapData {
  viewer: {
    watches: Watch[]
    preferences: UserPreferences
    tasteTags: string[]
  }
  owner: {
    watches: Watch[]
    preferences: UserPreferences
    tasteTags: string[]
  }
}

async function _getTasteOverlapDataImpl(
  viewerId: string,
  ownerId: string,
): Promise<TasteOverlapData> {
  const [
    viewerWatches,
    viewerPrefs,
    viewerWears,
    ownerWatches,
    ownerPrefs,
    ownerWears,
  ] = await Promise.all([
    getWatchesByUser(viewerId),
    getPreferencesByUser(viewerId),
    getAllWearEventsByUser(viewerId),
    getWatchesByUser(ownerId),
    getPreferencesByUser(ownerId),
    getAllWearEventsByUser(ownerId),
  ])

  // collectionAgeDays: days between the earliest acquisitionDate and now.
  // Falls back to 30 when the collection carries no dates so Daily Rotator
  // does not trigger accidentally for brand-new users.
  const ageDays = (list: Watch[]) => {
    const earliest = list
      .map((x) => x.acquisitionDate)
      .filter((d): d is string => Boolean(d))
      .sort()[0]
    if (!earliest) return 30
    return Math.max(
      1,
      Math.floor((Date.now() - new Date(earliest).getTime()) / 86_400_000),
    )
  }

  return {
    viewer: {
      watches: viewerWatches,
      preferences: viewerPrefs,
      tasteTags: computeTasteTags({
        watches: viewerWatches,
        totalWearEvents: viewerWears.length,
        collectionAgeDays: ageDays(viewerWatches),
      }),
    },
    owner: {
      watches: ownerWatches,
      preferences: ownerPrefs,
      tasteTags: computeTasteTags({
        watches: ownerWatches,
        totalWearEvents: ownerWears.length,
        collectionAgeDays: ageDays(ownerWatches),
      }),
    },
  }
}

/**
 * Per-request memoized loader for Common Ground. Callable from the layout
 * and the 6th-tab page within a single render without double-fetching.
 * Across requests the cache is fresh — CONTEXT.md D-03 "no cache across
 * renders" is preserved because React `cache()` scopes are per-request.
 */
export const getTasteOverlapData = cache(_getTasteOverlapDataImpl)
