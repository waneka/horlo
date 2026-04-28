import 'server-only'

import { and, eq, ilike, inArray, or, sql } from 'drizzle-orm'

import { db } from '@/db'
import { profiles, profileSettings, follows } from '@/db/schema'
import { computeTasteOverlap } from '@/lib/tasteOverlap'
import { computeTasteTags } from '@/lib/tasteTags'
import { getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { getAllWearEventsByUser } from '@/data/wearEvents'
import type { SearchProfileResult, SearchCollectionResult } from '@/lib/searchTypes'

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

// ---------------------------------------------------------------------------
// Phase 19 SRCH-11 + SRCH-12: searchCollections (Collections tab DAL)
// ---------------------------------------------------------------------------

const SEARCH_COLLECTIONS_TRIM_MIN_LEN = 2
const SEARCH_COLLECTIONS_CANDIDATE_CAP = 50
const SEARCH_COLLECTIONS_DEFAULT_LIMIT = 20

/**
 * Phase 19 Collections tab DAL (SRCH-11, SRCH-12, D-09..D-12, D-16).
 *
 * Two-layer privacy (SRCH-12 / Pitfall 6): WHERE ps.profile_public = true
 * AND ps.collection_public = true AND p.id != viewerId. Both privacy AND
 * clauses are explicit — copy-paste from searchProfiles only enforces
 * profilePublic, which would leak collectors with private collections.
 *
 * Match paths (D-09 / D-10): a collector matches if ANY of their watches
 * matches via brand ILIKE, model ILIKE, or
 * EXISTS(SELECT 1 FROM unnest(style_tags|role_tags|complications) ILIKE %q%).
 * design_traits is INTENTIONALLY EXCLUDED per D-09 — only style_tags + role_tags
 * + complications + brand/model are searched.
 *
 * Sort (D-16): SQL pre-sort is matchCount DESC, username ASC; JS post-sort
 * adds tasteOverlap DESC as the secondary tie-break. Pre-LIMIT 50 candidates,
 * final slice to 20 (D-04).
 *
 * All q + viewerId interpolations use Drizzle template binds — never string
 * concatenated into SQL text (T-19-01-02 mitigation).
 */
export async function searchCollections({
  q,
  viewerId,
  limit = SEARCH_COLLECTIONS_DEFAULT_LIMIT,
}: {
  q: string
  viewerId: string
  limit?: number
}): Promise<SearchCollectionResult[]> {
  const trimmed = q.trim()
  if (trimmed.length < SEARCH_COLLECTIONS_TRIM_MIN_LEN) return []

  const pattern = `%${trimmed}%`

  // Single CTE-shaped query: every (profileId, watchId) pair where the watch
  // matches the query AND the profile passes two-layer privacy. GROUP BY
  // profile_id, count, aggregate matched watches into a JSON array.
  const rows = await db.execute<{
    user_id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    match_count: number
    matched_watches: Array<{
      watch_id: string
      brand: string
      model: string
      image_url: string | null
      match_path: 'name' | 'tag'
    }> | null
    matched_tags: string[] | null
  }>(sql`
    WITH matched AS (
      SELECT
        w.id AS watch_id,
        w.user_id,
        w.brand,
        w.model,
        w.image_url,
        CASE
          WHEN w.brand ILIKE ${pattern} OR w.model ILIKE ${pattern}
          THEN 'name'
          ELSE 'tag'
        END AS match_path,
        ARRAY(
          SELECT t FROM unnest(w.style_tags || w.role_tags || w.complications) t
           WHERE t ILIKE ${pattern}
        ) AS matched_tag_elements
      FROM watches w
      INNER JOIN profile_settings ps ON ps.user_id = w.user_id
      INNER JOIN profiles p ON p.id = w.user_id
      WHERE
        ps.profile_public = true
        AND ps.collection_public = true
        AND p.id != ${viewerId}
        AND (
          w.brand ILIKE ${pattern}
          OR w.model ILIKE ${pattern}
          OR EXISTS (SELECT 1 FROM unnest(w.style_tags) t WHERE t ILIKE ${pattern})
          OR EXISTS (SELECT 1 FROM unnest(w.role_tags) t WHERE t ILIKE ${pattern})
          OR EXISTS (SELECT 1 FROM unnest(w.complications) t WHERE t ILIKE ${pattern})
        )
    )
    SELECT
      p.id AS user_id,
      p.username,
      p.display_name,
      p.avatar_url,
      COUNT(*)::int AS match_count,
      jsonb_agg(
        jsonb_build_object(
          'watch_id', m.watch_id,
          'brand', m.brand,
          'model', m.model,
          'image_url', m.image_url,
          'match_path', m.match_path
        ) ORDER BY (m.match_path = 'name') DESC, m.brand ASC
      ) FILTER (WHERE m.watch_id IS NOT NULL) AS matched_watches,
      (
        SELECT COALESCE(array_agg(DISTINCT tag), ARRAY[]::text[])
          FROM matched m2, unnest(m2.matched_tag_elements) tag
         WHERE m2.user_id = p.id
      ) AS matched_tags
    FROM profiles p
    JOIN matched m ON m.user_id = p.id
    GROUP BY p.id, p.username, p.display_name, p.avatar_url
    ORDER BY match_count DESC, p.username ASC
    LIMIT ${SEARCH_COLLECTIONS_CANDIDATE_CAP}
  `)

  const candidates = rows as unknown as Array<{
    user_id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    match_count: number
    matched_watches: Array<{
      watch_id: string
      brand: string
      model: string
      image_url: string | null
      match_path: 'name' | 'tag'
    }> | null
    matched_tags: string[] | null
  }>

  if (candidates.length === 0) return []

  // Resolve viewer state once for tasteOverlap secondary sort.
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

  const scored = await Promise.all(
    candidates.map(async (c) => {
      const [ownerWatches, ownerPrefs, ownerWears] = await Promise.all([
        getWatchesByUser(c.user_id),
        getPreferencesByUser(c.user_id),
        getAllWearEventsByUser(c.user_id),
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
      const overlap = overlapBucket(overlapResult.overlapLabel)
      return {
        userId: c.user_id,
        username: c.username,
        displayName: c.display_name,
        avatarUrl: c.avatar_url,
        matchCount: c.match_count,
        tasteOverlap: overlap,
        matchedWatches: (c.matched_watches ?? []).slice(0, 3).map((m) => ({
          watchId: m.watch_id,
          brand: m.brand,
          model: m.model,
          imageUrl: m.image_url,
          matchPath: m.match_path,
        })),
        matchedTags: (c.matched_tags ?? []).slice(0, 5),
      }
    }),
  )

  // D-16 sort: matchCount DESC, tasteOverlap DESC, username ASC.
  const ordered = scored.sort(
    (a, b) =>
      b.matchCount - a.matchCount ||
      b.tasteOverlap - a.tasteOverlap ||
      a.username.localeCompare(b.username),
  )
  return ordered.slice(0, limit)
}
