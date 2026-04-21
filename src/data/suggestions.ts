import 'server-only'

import { and, eq, notInArray } from 'drizzle-orm'

import { db } from '@/db'
import { profiles, profileSettings } from '@/db/schema'
import { follows } from '@/db/schema'
import { getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { getAllWearEventsByUser } from '@/data/wearEvents'
import { computeTasteTags } from '@/lib/tasteTags'
import { computeTasteOverlap } from '@/lib/tasteOverlap'
import type { SuggestedCollector } from '@/lib/discoveryTypes'

const DEFAULT_LIMIT = 10

/**
 * Keyset cursor for Load More pagination (CONTEXT.md S-03).
 *
 * Sort key semantics: `(overlap DESC, userId ASC)`.
 * A row qualifies for the next page iff
 *   (row.overlap < cursor.overlap)
 *   OR (row.overlap === cursor.overlap AND row.userId > cursor.userId).
 */
export interface SuggestionCursor {
  overlap: number
  userId: string
}

export interface SuggestionPage {
  collectors: SuggestedCollector[]
  nextCursor: SuggestionCursor | null
}

/**
 * Overlap label → numeric overlap bucket for UI-SPEC percentage rendering.
 * Keeps the scalar deterministic without leaking similarity-engine internals.
 */
function overlapBucket(
  label: 'Strong overlap' | 'Some overlap' | 'Different taste',
): number {
  if (label === 'Strong overlap') return 0.85
  if (label === 'Some overlap') return 0.55
  return 0.2
}

/**
 * Public collectors the viewer does NOT follow, ordered by tasteOverlap DESC
 * with userId ASC as the stable secondary sort (CONTEXT.md S-01..S-04).
 *
 * Privacy:
 *   - `eq(profileSettings.profilePublic, true)` — private profiles excluded (T-10-04-02).
 *   - `notInArray(profiles.id, [viewerId, ...alreadyFollowing])` — viewer self +
 *     already-followed users excluded.
 *
 * Pagination (S-03 Load More):
 *   - If `opts.cursor` is supplied, returns the page STRICTLY AFTER the cursor
 *     row, honoring the (overlap DESC, userId ASC) keyset.
 *   - `nextCursor` is the (overlap, userId) of the LAST row returned, or null
 *     if the page exhausted the candidate set.
 *
 * sharedWatches are capped at 3 per card for UI-SPEC mini-thumb rendering.
 */
export async function getSuggestedCollectors(
  viewerId: string,
  opts?: { limit?: number; cursor?: SuggestionCursor | null },
): Promise<SuggestionPage> {
  const limit = opts?.limit ?? DEFAULT_LIMIT
  const cursor = opts?.cursor ?? null

  // 1. Viewer's follow set — exclude from suggestions.
  const followingRows = await db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, viewerId))
  const alreadyFollowing = followingRows.map((r) => r.id)

  // 2. Resolve viewer state once (used per-candidate for overlap).
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

  // 3. Candidate pool: public profiles, not viewer, not already-followed.
  const excludeIds = [viewerId, ...alreadyFollowing]
  const candidates = await db
    .select({
      userId: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(profiles)
    .innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
    .where(
      and(
        notInArray(profiles.id, excludeIds),
        eq(profileSettings.profilePublic, true),
      ),
    )

  if (candidates.length === 0) {
    return { collectors: [], nextCursor: null }
  }

  // 4. Compute overlap per candidate in parallel.
  const scored: SuggestedCollector[] = await Promise.all(
    candidates.map(async (c): Promise<SuggestedCollector> => {
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
      const overlap = overlapBucket(overlapResult.overlapLabel)
      return {
        userId: c.userId,
        username: c.username,
        displayName: c.displayName,
        avatarUrl: c.avatarUrl,
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

  // 5. Sort by (overlap DESC, userId ASC). userId is the stable secondary key
  //    so cursor comparisons are well-defined across pages.
  const ordered = scored.sort(
    (a, b) => b.overlap - a.overlap || a.userId.localeCompare(b.userId),
  )

  // 6. Keyset filter: strictly AFTER the cursor row.
  const windowed = cursor
    ? ordered.filter(
        (c) =>
          c.overlap < cursor.overlap ||
          (c.overlap === cursor.overlap && c.userId > cursor.userId),
      )
    : ordered

  const page = windowed.slice(0, limit)
  const hasMore = windowed.length > limit
  const last = page[page.length - 1]
  const nextCursor: SuggestionCursor | null =
    hasMore && last ? { overlap: last.overlap, userId: last.userId } : null

  return { collectors: page, nextCursor }
}
