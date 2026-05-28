import 'server-only'

import { cache } from 'react'
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm'

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

/**
 * Returns true only when both the A→B and B→A follow rows exist. Checks both
 * directions in a single round-trip via two FILTER aggregates — this is a
 * dedicated bidirectional sibling of `isFollowing`, NOT a composition of two
 * `isFollowing` calls (GATE-05).
 */
export async function isMutualFollow(
  userA: string,
  userB: string,
): Promise<boolean> {
  const rows = await db
    .select({
      aToB: sql<number>`count(*) FILTER (WHERE ${follows.followerId} = ${userA} AND ${follows.followingId} = ${userB})::int`,
      bToA: sql<number>`count(*) FILTER (WHERE ${follows.followerId} = ${userB} AND ${follows.followingId} = ${userA})::int`,
    })
    .from(follows)
    .where(
      or(
        and(eq(follows.followerId, userA), eq(follows.followingId, userB)),
        and(eq(follows.followerId, userB), eq(follows.followingId, userA)),
      ),
    )
  const row = rows[0]
  return (row?.aToB ?? 0) >= 1 && (row?.bToA ?? 0) >= 1
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
// Phase 65: Follow-scoped catalog roster (FOLL-02, FOLL-04)
// ---------------------------------------------------------------------------

/**
 * Follow-scoped catalog roster row — projected fields rendered by the new
 * FollowedOwnersModule chip stack on /w/{ref}. Shape mirrors CatalogCollector
 * (D-02 + D-11) but is a distinct exported symbol so the two surfaces (broad
 * roster vs follow-scoped) can evolve independently. NOT imported from
 * src/data/discovery.ts.
 */
export interface FollowedOwner {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

/**
 * Phase 65 FOLL-02 + FOLL-04 — "From your circle" catalog roster.
 *
 * Returns the top-N public collectors who own/wishlist/grail this catalog ref
 * AND whom the viewer follows (one-way `viewer -> owner` direction), ordered
 * by `watches.created_at DESC` (D-08 — recency of THEIR ownership is the
 * "who in my circle just got one" signal, NOT `follows.created_at`).
 *
 * Dedicated sibling of getCollectorsForCatalog (D-06) — kept separate so the
 * broad-roster call path is regression-safe; tests own the follow-direction
 * concern. NOT a flag on getCollectorsForCatalog.
 *
 * Threat surface (load-bearing — service-role pooler bypasses RLS, so the
 * DAL WHERE is the privacy gate):
 *   - D-05 layer 1: eq(profileSettings.profilePublic, true)
 *   - D-05 layer 2 (LOAD-BEARING): eq(profileSettings.collectionPublic, true)
 *     A follow does NOT override either gate — a private-collection user the
 *     viewer follows still does NOT appear. Identical contract to
 *     getCollectorsForCatalog (T-39b-01 layer 1+2).
 *   - D-05a: sql`${profiles.id} != ${viewerId}` — viewer self-exclusion.
 *     Kept explicit for symmetry with the broad roster even though follower !=
 *     followee by definition.
 *   - D-05b: inArray(watches.status, ['owned','wishlist','grail']) — excludes
 *     'sold' so the chip-count matches "owns this" semantics.
 *   - D-07 / FOLL-02 / Pitfall 1: innerJoin(follows, and(eq(followerId,
 *     viewerId), eq(followingId, profiles.id))) — viewer-as-follower ->
 *     owner-as-followee. NOT mutual; NOT reversed. Test 8 in
 *     tests/data/getFollowedOwnersForCatalog.test.ts seeds (viewer -> alice)
 *     WITHOUT the reverse and asserts alice appears (would fail if the join
 *     were reversed or mutual-only).
 *
 * Pitfalls:
 *   - Pitfall 3 — A single user can have multiple rows per catalog (e.g.
 *     owned + wishlist). The SQL overfetches at LIMIT 50 then a JS-side
 *     Set-based dedup keeps the first occurrence per userId before slicing
 *     to top-N. The SQL ORDER BY guarantees the kept row is the most-recent.
 *   - Pitfall 4 — totalCount cannot be derived from rows.length (which is
 *     dedup'd AND limited). A second query uses count(DISTINCT profiles.id)
 *     against the IDENTICAL WHERE clause + IDENTICAL follows INNER JOIN so
 *     both privacy layers, the status filter, AND the follow-direction gate
 *     apply consistently. The follows join must appear in BOTH queries
 *     (privacy consistency mandate).
 *
 * D-01a (null catalogId): catalogId is strict (`string`); call sites guard
 * with the ternary pattern from src/app/w/[ref]/page.tsx (see
 * `getCollectorsForCatalog` integration sites).
 *
 * Integration tests at tests/data/getFollowedOwnersForCatalog.test.ts prove
 * all 4 privacy edges + sort + dedup + follow-direction (Tests 1-8 per D-12).
 */
export async function getFollowedOwnersForCatalog(catalogId: string, viewerId: string, opts: { limit?: number } = {}): Promise<{ owners: FollowedOwner[]; totalCount: number }> {
  const limit = opts.limit ?? 5

  const rows = await db
    .select({
      userId: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      addedAt: watches.createdAt,
    })
    .from(watches)
    .innerJoin(profiles, eq(profiles.id, watches.userId))
    .innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
    // D-07 / FOLL-02 / Pitfall 1 — viewer-as-follower -> owner-as-followee.
    // NOT mutual; NOT reversed. Tests 7+8 lock this direction.
    .innerJoin(
      follows,
      and(
        eq(follows.followerId, viewerId),
        eq(follows.followingId, profiles.id),
      ),
    )
    .where(
      and(
        eq(watches.catalogId, catalogId),
        eq(profileSettings.profilePublic, true),    // D-05 layer 1
        eq(profileSettings.collectionPublic, true), // D-05 layer 2 (LOAD-BEARING)
        sql`${profiles.id} != ${viewerId}`,         // D-05a self-exclusion
        inArray(watches.status, ['owned', 'wishlist', 'grail']), // D-05b
      ),
    )
    .orderBy(desc(watches.createdAt), asc(profiles.username))
    .limit(50) // Pitfall 3 — overfetch for JS-side dedup

  // Pitfall 4 — separate count(DISTINCT) query for totalCount label. Identical
  // WHERE clause + IDENTICAL follows INNER JOIN so privacy layers, status
  // filter, AND follow-direction all apply consistently.
  const totalRows = await db
    .select({ count: sql<number>`count(DISTINCT ${profiles.id})::int` })
    .from(watches)
    .innerJoin(profiles, eq(profiles.id, watches.userId))
    .innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
    .innerJoin(
      follows,
      and(
        eq(follows.followerId, viewerId),
        eq(follows.followingId, profiles.id),
      ),
    )
    .where(
      and(
        eq(watches.catalogId, catalogId),
        eq(profileSettings.profilePublic, true),    // D-05 layer 1
        eq(profileSettings.collectionPublic, true), // D-05 layer 2 (LOAD-BEARING)
        sql`${profiles.id} != ${viewerId}`,         // D-05a self-exclusion
        inArray(watches.status, ['owned', 'wishlist', 'grail']), // D-05b
      ),
    )
  const totalCount = totalRows[0]?.count ?? 0

  // Pitfall 3 — JS dedup: keep first occurrence per userId (already
  // ORDER BY created_at DESC), then slice to top-N.
  const seen = new Set<string>()
  const owners: FollowedOwner[] = []
  for (const r of rows) {
    if (seen.has(r.userId)) continue
    seen.add(r.userId)
    owners.push({
      userId: r.userId,
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    })
    if (owners.length >= limit) break
  }
  return { owners, totalCount }
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
