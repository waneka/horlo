import 'server-only'

import { and, eq, ilike, inArray, or, sql } from 'drizzle-orm'

import { db } from '@/db'
import { profiles, profileSettings, follows } from '@/db/schema'
import { computeTasteOverlap } from '@/lib/tasteOverlap'
import { computeTasteTags } from '@/lib/tasteTags'
import { getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { getAllWearEventsByUser } from '@/data/wearEvents'
import type { SearchProfileResult } from '@/lib/searchTypes'

const TRIM_MIN_LEN = 2 // D-20 server-side 2-char minimum
const BIO_MIN_LEN = 3 // D-21 bio search only when q.length >= 3
const CANDIDATE_CAP = 50 // Pitfall 5 pre-LIMIT cap (defense-in-depth before JS sort)
const DEFAULT_LIMIT = 20 // D-22 final result LIMIT

/**
 * Overlap label → numeric overlap bucket for UI percentage rendering (D-16).
 * Mirrors src/data/suggestions.ts overlapBucket — same numeric mapping so
 * row visuals stay consistent between Suggested Collectors and search.
 */
function overlapBucket(
  label: 'Strong overlap' | 'Some overlap' | 'Different taste',
): number {
  if (label === 'Strong overlap') return 0.85
  if (label === 'Some overlap') return 0.55
  return 0.2
}

/**
 * Phase 16 People Search DAL (SRCH-04).
 *
 * Two-layer privacy (D-18, Pitfall C-3): WHERE profile_public = true + RLS gate
 * on profiles. Private profiles silently excluded — no count adjustment, no
 * placeholder, zero existence leak.
 *
 * Compound predicate (D-21, Pitfall C-5):
 *   q.length === 2: username ILIKE only (bio search at 2 chars is too noisy)
 *   q.length >= 3:  or(username ILIKE, bio ILIKE)
 *
 * Server-side 2-char minimum (D-20, Pitfall C-2): defense-in-depth even though
 * the client also gates the fetch.
 *
 * Order (D-22): overlap DESC, username ASC, LIMIT 20. Overlap is JS-computed so
 * sort happens in Node after a pre-LIMIT 50 cap on the candidate query (Pitfall 5).
 *
 * Anti-N+1 (Pitfall C-4): single batched inArray() follow lookup at the end —
 * mirrors src/data/suggestions.ts.
 */
export async function searchProfiles({
  q,
  viewerId,
  limit = DEFAULT_LIMIT,
}: {
  q: string
  viewerId: string
  limit?: number
}): Promise<SearchProfileResult[]> {
  // D-20 / Pitfall C-2: server-side 2-char minimum.
  const trimmed = q.trim()
  if (trimmed.length < TRIM_MIN_LEN) return []

  const pattern = `%${trimmed}%`

  // D-21 / Pitfall C-5: compound predicate.
  const matchExpr =
    trimmed.length >= BIO_MIN_LEN
      ? or(ilike(profiles.username, pattern), ilike(profiles.bio, pattern))
      : ilike(profiles.username, pattern)

  // 1. Candidate pool with two-layer privacy + viewer self-exclusion + pre-LIMIT cap.
  const candidates = await db
    .select({
      userId: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      bio: profiles.bio,
    })
    .from(profiles)
    .innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
    .where(
      and(
        eq(profileSettings.profilePublic, true), // D-18 / Pitfall C-3
        sql`${profiles.id} != ${viewerId}`, // Pitfall 10 viewer self-exclusion
        matchExpr,
      ),
    )
    .limit(CANDIDATE_CAP) // Pitfall 5 pre-LIMIT cap

  if (candidates.length === 0) return []

  // 2. Resolve viewer state once.
  const [viewerWatches, viewerPrefs, viewerWears] = await Promise.all([
    getWatchesByUser(viewerId),
    getPreferencesByUser(viewerId),
    getAllWearEventsByUser(viewerId),
  ])
  const viewerTags = computeTasteTags({
    watches: viewerWatches,
    totalWearEvents: viewerWears.length,
    collectionAgeDays: 30,
  })

  // 3. Per-candidate overlap (mirrors src/data/suggestions.ts step 4).
  const scored = await Promise.all(
    candidates.map(async (c) => {
      const [ownerWatches, ownerPrefs, ownerWears] = await Promise.all([
        getWatchesByUser(c.userId),
        getPreferencesByUser(c.userId),
        getAllWearEventsByUser(c.userId),
      ])
      const ownerTags = computeTasteTags({
        watches: ownerWatches,
        totalWearEvents: ownerWears.length,
        collectionAgeDays: 30,
      })
      const overlapResult = computeTasteOverlap(
        {
          watches: viewerWatches,
          preferences: viewerPrefs,
          tasteTags: viewerTags,
        },
        {
          watches: ownerWatches,
          preferences: ownerPrefs,
          tasteTags: ownerTags,
        },
      )
      const overlap = overlapBucket(overlapResult.overlapLabel) // D-16 numeric mapping
      return {
        userId: c.userId,
        username: c.username,
        displayName: c.displayName,
        avatarUrl: c.avatarUrl,
        bio: c.bio,
        bioSnippet: c.bio, // line-clamp-1 handled by UI (D-14); pass full bio
        overlap,
        sharedCount: overlapResult.sharedWatches.length,
        sharedWatches: overlapResult.sharedWatches.slice(0, 3).map((s) => ({
          watchId: s.viewerWatch.id,
          brand: s.viewerWatch.brand,
          model: s.viewerWatch.model,
          imageUrl: s.viewerWatch.imageUrl ?? null,
        })),
      }
    }),
  )

  // 4. D-22: sort by overlap DESC, username ASC, then slice to limit.
  const ordered = scored.sort(
    (a, b) => b.overlap - a.overlap || a.username.localeCompare(b.username),
  )
  const top = ordered.slice(0, limit)

  // 5. Pitfall C-4: batched isFollowing lookup.
  const topIds = top.map((r) => r.userId)
  const followingRows = topIds.length
    ? await db
        .select({ id: follows.followingId })
        .from(follows)
        .where(
          and(
            eq(follows.followerId, viewerId),
            inArray(follows.followingId, topIds),
          ),
        )
    : []
  const followingSet = new Set(followingRows.map((r) => r.id))

  return top.map((r) => ({ ...r, isFollowing: followingSet.has(r.userId) }))
}
