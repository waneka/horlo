import 'server-only'

import { and, asc, desc, eq, ne } from 'drizzle-orm'

import { db } from '@/db'
import { profiles, profileSettings, watchesCatalog } from '@/db/schema'
import { getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { getAllWearEventsByUser } from '@/data/wearEvents'
import { computeTasteTags } from '@/lib/tasteTags'
import { computeTasteOverlap } from '@/lib/tasteOverlap'
import { rationaleFor } from '@/lib/recommendations'
import type { Recommendation } from '@/lib/discoveryTypes'
import type { Watch } from '@/lib/types'

/**
 * Pool of top similar collectors from which we deterministically sample
 * SAMPLED_SEED_SIZE per 6h window (Phase 75 D-06). Bumped from 15 → 30 to
 * double the rotation surface area; Postgres cost is unchanged because the
 * dominant cost is the per-public-profile overlap loop (linear in public-
 * collector count), not the slice size.
 */
const SEED_POOL_SIZE = 30

/**
 * Post-shuffle take count — the actual number of seed collectors whose owned
 * watches feed the candidate-map build (Phase 75 D-09). Mirrors the legacy
 * pre-rotation SEED_POOL_SIZE so the candidate-pool size for a typical render
 * is unchanged.
 */
const SAMPLED_SEED_SIZE = 15

/**
 * 6-hour rotation window — rail rotates 4× per day (Phase 75 D-07).
 * Same window → same seed → same shuffled order → same recs (cache-stable
 * within `cacheLife('minutes')` 1hr expire). Next window → different recs.
 * Faster (e.g., 1h) would defeat the cache; slower (24h) feels stale.
 */
const ROTATION_WINDOW_MS = 6 * 60 * 60 * 1000

/**
 * Sparse-pool guard — if post-exclusion `candidateMap.size` falls below this
 * threshold, `topUpFromCatalogPopularity()` appends synthetic catalog-
 * popularity recs until the rail has at least this many cards (Phase 75 D-10).
 * Below 8 the home rail "From Collectors Like You" feels broken — operator
 * observation 2026-05-30.
 */
const SPARSE_POOL_THRESHOLD = 8

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

  // 5. Top SEED_POOL_SIZE (30 per D-06), then deterministically sample
  //    SAMPLED_SEED_SIZE (15) per 6h window per D-07/D-08/D-09 — Fisher-Yates
  //    shuffle of the top-30 using mulberry32(seedFor(viewerId, windowBucket))
  //    then take the first SAMPLED_SEED_SIZE. Highest-overlap collectors still
  //    bias toward selection because the shuffle is uniform over 30 entries
  //    (the top-15 by rank hit ~50% of the post-shuffle first-15 on average).
  const rankedTop30 = overlapScores
    .sort((a, b) => b.score - a.score)
    .slice(0, SEED_POOL_SIZE)
  const windowBucket = Math.floor(Date.now() / ROTATION_WINDOW_MS)
  const rng = mulberry32(seedFor(viewerId, windowBucket))
  // Fisher-Yates shuffle in-place using the seeded PRNG.
  for (let i = rankedTop30.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[rankedTop30[i], rankedTop30[j]] = [rankedTop30[j], rankedTop30[i]]
  }
  const seeds = rankedTop30.slice(0, SAMPLED_SEED_SIZE)

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
    /**
     * Owner id of the representative instance, or `null` for synthetic catalog-
     * popularity top-up rows appended by `topUpFromCatalogPopularity()` per
     * Phase 75 D-12 — those rows have no single owner.
     */
    ownerId: string | null
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

  // 6b. Sparse-pool top-up (Phase 75 D-10/D-11/D-12/D-13/D-14). When viewer
  //     exclusion collapses the candidate pool below SPARSE_POOL_THRESHOLD,
  //     append synthetic catalog-popularity rows (ordered by
  //     watches_catalog.ownersCount DESC, brand ASC) until the rail can render
  //     at least SPARSE_POOL_THRESHOLD cards. Synthetic rows carry
  //     `ownerId: null` (D-12) + `count: 0`, which routes them through the
  //     existing community-fallback rationale "Popular in the community"
  //     (D-13 — no new rationale template). Determinism within the 6h window
  //     is guaranteed by the daily pg_cron refresh of ownersCount (D-14), so
  //     the top-up does not need PRNG seeding.
  if (candidateMap.size < SPARSE_POOL_THRESHOLD) {
    const needed = SPARSE_POOL_THRESHOLD - candidateMap.size
    await topUpFromCatalogPopularity(candidateMap, excluded, needed)
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

// ───────────────────────────────────────────────────────────────────────────
// Phase 75 D-08/D-09 — deterministic-per-6h-window sampling helpers.
//
// `seedFor` + `mulberry32` are EXPORTED so the unit test suite at
// `src/data/__tests__/recommendations.test.ts` (Phase 75 D-16) can exercise
// them directly without DB mocks.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Cheap deterministic 32-bit hash combining `viewerId` with a 6h windowBucket.
 * Same (viewerId, windowBucket) → same output; different input → different
 * output (with the usual djb2-style avalanche). Pure, no external deps.
 *
 * Used by `getRecommendationsForViewer` to seed the per-window PRNG that
 * shuffles the top-30 collector pool before taking the first 15 (D-09).
 */
export function seedFor(viewerId: string, windowBucket: number): number {
  let h = windowBucket >>> 0
  for (let i = 0; i < viewerId.length; i++) {
    h = ((h << 5) - h + viewerId.charCodeAt(i)) >>> 0
  }
  return h
}

/**
 * mulberry32 — fast, well-distributed 32-bit PRNG. Pure (no state outside the
 * returned closure), deterministic for a given seed, no external dependency
 * (~5 lines). Used by `getRecommendationsForViewer` for the Fisher-Yates
 * shuffle of the top-30 collector pool (D-08).
 *
 * Not cryptographically secure — and intentionally so (T-75-02-02): the PRNG
 * controls UX rotation, not authorization.
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Phase 75 D-10/D-11/D-14 — sparse-pool catalog-popularity top-up.
 *
 * Mutates `candidateMap` in place by appending up to `needed` synthetic
 * catalog rows ordered by `(watches_catalog.ownersCount DESC, brand ASC)`,
 * skipping any row whose normalized (brand|model) key is already present in
 * `candidateMap` or in `excluded` (viewer's owned/wishlist/grail set).
 *
 * Synthetic rows carry:
 *   - `ownerId: null` (D-12 — no single owner; surfaces as
 *     `representativeOwnerId: null` on the resulting Recommendation)
 *   - `count: 0` (routes through community-fallback rationale per D-13)
 *   - a synthetic Watch shape sufficient for the existing map step to render
 *     a Recommendation (id = catalog row id; tag arrays empty so no rule-
 *     template fires)
 *
 * Determinism within the 6h window is provided by the daily pg_cron refresh
 * of `watches_catalog.ownersCount` at 03:00 UTC (D-14) — no PRNG needed.
 *
 * Per D-11 the query uses `ownersCount` ONLY (NOT `ownersCount + wishlist`
 * + Count) because ownership is the semantic match for the rail title
 * "collectors LIKE YOU own."
 */
export async function topUpFromCatalogPopularity(
  candidateMap: Map<
    string,
    { key: string; watch: Watch; ownerId: string | null; count: number }
  >,
  excluded: Set<string>,
  needed: number,
): Promise<void> {
  if (needed <= 0) return

  const rows = await db
    .select({
      id: watchesCatalog.id,
      brand: watchesCatalog.brand,
      model: watchesCatalog.model,
      reference: watchesCatalog.reference,
      imageUrl: watchesCatalog.imageUrl,
      ownersCount: watchesCatalog.ownersCount,
    })
    .from(watchesCatalog)
    .orderBy(desc(watchesCatalog.ownersCount), asc(watchesCatalog.brand))
    .limit(20)

  let appended = 0
  for (const row of rows) {
    if (appended >= needed) break
    const key = `${row.brand.trim().toLowerCase()}|${row.model.trim().toLowerCase()}`
    if (excluded.has(key)) continue
    if (candidateMap.has(key)) continue
    // Synthetic Watch shape — only the fields downstream consumers read.
    const syntheticWatch: Watch = {
      id: row.id,
      brand: row.brand,
      model: row.model,
      status: 'owned',
      movement: 'auto',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
      imageUrl: row.imageUrl ?? undefined,
    }
    candidateMap.set(key, {
      key,
      watch: syntheticWatch,
      ownerId: null,
      count: 0,
    })
    appended++
  }
}
