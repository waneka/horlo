import 'server-only'

import { and, eq, ne } from 'drizzle-orm'

import { db } from '@/db'
import { profiles, profileSettings } from '@/db/schema'
import { getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { getAllWearEventsByUser } from '@/data/wearEvents'
import { computeTasteTags } from '@/lib/tasteTags'
import { computeTasteOverlap } from '@/lib/tasteOverlap'
import { rationaleFor } from '@/lib/recommendations'
import type { Recommendation } from '@/lib/discoveryTypes'
import type { Watch } from '@/lib/types'

/**
 * Top-N similar collectors sampled per recommendation request (CONTEXT.md C-01).
 * At MVP scale (<500 public collectors) a single-pass scan is acceptable.
 */
const SEED_POOL_SIZE = 15

/** Maximum cards surfaced in the UI (CONTEXT.md C-04: "cap ~12"). */
const REC_CAP = 12

/** Score bump applied when a rule-template fired (not the fallback). */
const RULE_MATCH_BONUS = 50

/**
 * Compose tasteOverlap ranking + candidate filter + rule-based rationale
 * (CONTEXT.md C-01..C-07). Returns up to REC_CAP recommendations for the
 * "From Collectors Like You" home section.
 *
 * Algorithm:
 *   1. Resolve viewer's collection + preferences + wear events.
 *   2. If viewer has 0 owned watches → return [] (L-02 section hides).
 *   3. Fetch all PUBLIC collectors (profile_public=true AND collection_public=true, != viewer).
 *   4. For each, compute tasteOverlap → rank by (sharedWatches * 10 + sharedTasteTags).
 *   5. Take top SEED_POOL_SIZE as the candidate pool.
 *   6. Collect seeds' owned watches, normalize (brand, model) to lowercase+trim
 *      for dedupe, remove anything viewer already owns / wishlists / grails.
 *   7. Score each candidate via rule-based rationale. Return top REC_CAP
 *      sorted by score DESC with alphabetical brand tiebreak.
 *
 * Privacy (T-10-04-01): seed pool filter uses profileSettings.profilePublic AND
 * profileSettings.collectionPublic — private users' collections are NEVER
 * sampled. The viewer's own profile is excluded via ne(profiles.id, viewerId).
 *
 * Cache-key safety (T-10-04-03): `viewerId` is a function argument, never read
 * from `getCurrentUser()` internally. Plan 07 will wrap this DAL in a
 * `'use cache'` Server Component with `viewerId` as a prop so the viewer id
 * becomes part of the cache key (Pitfall 7).
 */
export async function getRecommendationsForViewer(
  viewerId: string,
): Promise<Recommendation[]> {
  // 1. Resolve viewer's state once.
  const [viewerWatches, viewerPrefs, viewerWears] = await Promise.all([
    getWatchesByUser(viewerId),
    getPreferencesByUser(viewerId),
    getAllWearEventsByUser(viewerId),
  ])

  // 2. Empty collection → no seed base. Return empty; UI hides per L-02.
  const viewerOwned = viewerWatches.filter((w) => w.status === 'owned')
  if (viewerOwned.length === 0) return []

  // 3. Candidate public collectors (T-10-04-01: require BOTH profile_public
  //    AND collection_public to sample their owned watches).
  const publicProfiles = await db
    .select({ id: profiles.id })
    .from(profiles)
    .innerJoin(
      profileSettings,
      eq(profileSettings.userId, profiles.id),
    )
    .where(
      and(
        ne(profiles.id, viewerId),
        eq(profileSettings.profilePublic, true),
        eq(profileSettings.collectionPublic, true),
      ),
    )

  if (publicProfiles.length === 0) return []

  const viewerTags = computeTasteTags({
    watches: viewerWatches,
    totalWearEvents: viewerWears.length,
    collectionAgeDays: 30,
  })

  // 4. Compute overlap for each public profile.
  const overlapScores = await Promise.all(
    publicProfiles.map(async (p) => {
      const [ownerWatches, ownerPrefs, ownerWears] = await Promise.all([
        getWatchesByUser(p.id),
        getPreferencesByUser(p.id),
        getAllWearEventsByUser(p.id),
      ])
      const ownerTags = computeTasteTags({
        watches: ownerWatches,
        totalWearEvents: ownerWears.length,
        collectionAgeDays: 30,
      })
      const result = computeTasteOverlap(
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
      const score =
        result.sharedWatches.length * 10 + result.sharedTasteTags.length
      return { ownerId: p.id, ownerWatches, score }
    }),
  )

  // 5. Top SEED_POOL_SIZE.
  const seeds = overlapScores
    .sort((a, b) => b.score - a.score)
    .slice(0, SEED_POOL_SIZE)

  // 6. Build candidate pool. Exclude viewer's owned/wishlist/grail (C-02 +
  //    normalized-dedupe per C-07: .trim().toLowerCase()).
  const norm = (w: { brand: string; model: string }) =>
    `${w.brand.trim().toLowerCase()}|${w.model.trim().toLowerCase()}`
  const excluded = new Set<string>()
  for (const v of viewerWatches) {
    if (v.status === 'owned' || v.status === 'wishlist' || v.status === 'grail') {
      excluded.add(norm(v))
    }
  }

  interface CandidateRow {
    key: string
    watch: Watch
    ownerId: string
    count: number
  }
  const candidateMap = new Map<string, CandidateRow>()
  for (const seed of seeds) {
    for (const w of seed.ownerWatches) {
      if (w.status !== 'owned') continue
      const key = norm(w)
      if (excluded.has(key)) continue
      const existing = candidateMap.get(key)
      if (existing) {
        existing.count++
      } else {
        candidateMap.set(key, {
          key,
          watch: w,
          ownerId: seed.ownerId,
          count: 1,
        })
      }
    }
  }

  // 7. Score + rationale per candidate.
  const recs: Recommendation[] = [...candidateMap.values()].map((c) => {
    const rationale = rationaleFor({
      candidateBrand: c.watch.brand,
      candidateModel: c.watch.model,
      candidateRoleTags: c.watch.roleTags,
      candidateStyleTags: c.watch.styleTags,
      viewerOwnedWatches: viewerWatches,
      viewerOwnershipCount: c.count,
    })
    return {
      representativeWatchId: c.watch.id,
      representativeOwnerId: c.ownerId,
      brand: c.watch.brand,
      model: c.watch.model,
      imageUrl: c.watch.imageUrl ?? null,
      ownershipCount: c.count,
      rationale,
      score:
        c.count * 100 +
        (rationale !== 'Popular in the community' ? RULE_MATCH_BONUS : 0),
    }
  })

  // Sort by score DESC, stable alphabetical brand tiebreak.
  return recs
    .sort((a, b) => b.score - a.score || a.brand.localeCompare(b.brand))
    .slice(0, REC_CAP)
}
