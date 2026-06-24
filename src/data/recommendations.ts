import 'server-only'

import { and, asc, desc, eq, ne, sql } from 'drizzle-orm'

import { db } from '@/db'
import { profiles, profileSettings, watchesCatalog } from '@/db/schema'
import { getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { getAllWearEventsByUser } from '@/data/wearEvents'
import { computeTasteTags } from '@/lib/tasteTags'
import { computeTasteOverlap } from '@/lib/tasteOverlap'
import { rationaleFor, topBrandOf, dominantStyleOf } from '@/lib/recommendations'
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

/**
 * Per-brand cap applied to the sparse-pool catalog top-up so a viewer who
 * owns a catalog-heavy brand (e.g. Seiko, with 8+ catalog rows) does not
 * see the rail collapse to all-Seiko (quick task 260623-pzz). The cap is
 * applied AFTER scoring + sorting in topUpFromCatalogPopularity, so the
 * two surviving rows for any brand are the two highest-scoring rows for
 * that brand. Future iteration: make this viewer-adaptive (e.g. 3+ for
 * deep single-brand collections) once we have UX data.
 */
const MAX_PER_BRAND_IN_TOPUP = 2

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

  // Derive viewer taste signals ONCE here so the sparse-pool top-up can score
  // catalog rows by brand/style match without re-deriving per call (quick task
  // 260623-mn3). Both helpers return null on an empty owned-collection; in the
  // (already-excluded) empty case the sparse top-up degrades to popularity
  // ordering — back-compat with the prior behavior. These same values are
  // also derived per-candidate inside rationaleFor below; that loop is left
  // alone (this change only avoids redundant derivation inside the top-up).
  const viewerTopBrand = topBrandOf(viewerWatches)
  const viewerDominantStyleLabel = dominantStyleOf(viewerWatches)?.label ?? null

  // Full set of owned brands (lower+trim) — used by sparse-pool top-up for
  // multi-brand match AND owned-brand pool broadening (quick task 260623-pzz).
  // The single-string viewerTopBrand above is kept for back-compat / future
  // use (rationaleFor's brand-match template still uses it via topBrandOf);
  // the SET is the actual brand-match gate inside the top-up function — a
  // viewer who owns 5 brands tied 1-1-1-1-1 now sees catalog rows from any
  // of those 5 brands score +100, not only the alphabetical winner.
  const viewerOwnedBrandsLower = new Set(
    viewerWatches
      .filter((w) => w.status === 'owned')
      .map((w) => w.brand.trim().toLowerCase()),
  )

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
    await topUpFromCatalogPopularity(
      candidateMap,
      excluded,
      needed,
      viewerTopBrand,
      viewerDominantStyleLabel,
      viewerOwnedBrandsLower,
    )
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
 * Phase 75 D-10/D-11/D-12/D-13/D-14 + quick-260623-mn3 + quick-260623-pzz —
 * sparse-pool catalog-popularity top-up with TASTE-AWARE ranking + SET-based
 * multi-brand match + owned-brand pool broadening + per-brand variety cap.
 *
 * Mutates `candidateMap` in place by appending up to `needed` synthetic
 * catalog rows ranked by viewer taste signals (top brand + dominant style),
 * skipping any row whose normalized (brand|model) key is already present in
 * `candidateMap` or in `excluded` (viewer's owned/wishlist/grail set), and
 * skipping any row whose brand has already contributed MAX_PER_BRAND_IN_TOPUP
 * rows to the appended set.
 *
 * Scoring (in-memory, after a broader catalog fetch):
 *   score = (brand-match ? 100 : 0)     // SET membership over ALL owned brands
 *         + (style-overlap ? 50 : 0)
 *         + ownersCount / 1000
 *
 * The +100 / +50 weights mirror the existing `RULE_MATCH_BONUS = 50` and
 * `c.count * 100` pattern used in `getRecommendationsForViewer`'s final
 * sort. The `ownersCount / 1000` term is a sub-1 additive that lets
 * popularity bias ordering WITHIN the same +50 bucket without ever
 * crossing a brand/style step. Brand + style matches are case-insensitive
 * (mirrors `rationaleFor`'s brand-match casing convention).
 *
 * BRAND-MATCH SEMANTIC (260623-pzz):
 * The brand-match gate uses `viewerOwnedBrandsLower` (the FULL set of owned
 * brands lowercased+trimmed), NOT the single-string `viewerTopBrand`. A
 * viewer who owns 5 brands tied 1-1-1-1-1 now sees catalog rows from ANY
 * of those 5 brands score +100, not only the alphabetical winner. The
 * `viewerTopBrand` parameter is kept in the signature for back-compat /
 * future use (e.g. weighting "top-most owned" brand higher) but is no
 * longer the brand-match gate.
 *
 * POOL BROADENING (260623-pzz):
 * The popularity LIMIT 60 fetch is supplemented by a SECOND query that
 * returns ALL catalog rows whose lower(trim(brand)) appears in the viewer's
 * owned-brand SET. This eliminates alphabetical cutoff: brands like Seiko,
 * TIMEX, and Zenith — which sort late and would otherwise be cut off by
 * the LIMIT-60 popularity slice when many rows have ownersCount=0 — are
 * now guaranteed to enter the scoring pool. The two query results merge
 * via Set<id>-dedup so popularity-slice rows take priority. The second
 * query is SKIPPED when `viewerOwnedBrandsLower.size === 0` (single
 * round-trip preserved for that edge — though that edge is unreachable
 * here because the caller would have early-returned on
 * `viewerOwned.length === 0`).
 *
 * VARIETY CAP (260623-pzz):
 * After scoring + sorting, the append loop enforces
 * `MAX_PER_BRAND_IN_TOPUP = 2` — so a viewer who owns a catalog-heavy
 * brand (e.g. Seiko, with 8+ catalog rows) does NOT see the rail collapse
 * to all-Seiko even though every Seiko scores +100 or +150. The cap is
 * checked BEFORE the dedupe lookup so an excluded-by-cap row does not
 * burn an append slot; the brand-usage counter only increments on
 * successful appends.
 *
 * Tiebreaker (when score is identical): brand ASC, then model ASC —
 * deterministic, never PRNG, so the 6h rotation-window determinism
 * property is preserved end-to-end.
 *
 * Synthetic rows carry:
 *   - `ownerId: null` (D-12 — no single owner; surfaces as
 *     `representativeOwnerId: null` on the resulting Recommendation)
 *   - `count: 0` (so the score path in the outer function does NOT add
 *     RULE_MATCH_BONUS — the synthetic ordering is fully decided here)
 *   - a synthetic Watch shape carrying the catalog row's REAL `styleTags`
 *     (was `[]` pre-260623-mn3) — this is the key rationale-projection
 *     side-effect: the existing rule loop in `getRecommendationsForViewer`
 *     can now fire `Fans of {brand} love this` (brand-match template) and
 *     `Matches your {style} collection` (dominant-style template, when
 *     viewer's style share > 0.5) on top-up cards instead of always
 *     falling through to `Popular in the community`
 *
 * Determinism within the 6h window is provided by the daily pg_cron refresh
 * of `watches_catalog.ownersCount` at 03:00 UTC (D-14) plus the deterministic
 * sort comparator — no PRNG needed.
 *
 * Per D-11 the underlying popularity signal uses `ownersCount` ONLY (NOT
 * `ownersCount + wishlistCount`) because ownership is the semantic match
 * for the rail title "collectors LIKE YOU own."
 *
 * DEFERRED:
 *   - Role-based scoring (would parallel the brand/style components against
 *     viewer's top role) is intentionally OMITTED here because
 *     `watches_catalog.role_tags` is empirically 0%-populated locally;
 *     scoring on it would be dead-on-arrival until a future catalog-
 *     enrichment phase backfills role_tags from the watches table.
 *   - `designMotifs` Jaccard against viewer's aggregated motifs is also
 *     deferred — adds a DB join + computation not justified at this rail's
 *     cost ceiling. Re-evaluate when SEED-002 hybrid recommender lands.
 *   - Brand canonicalization across 'Héron Watches' vs 'Héron' etc. is a
 *     separate hygiene phase (260623-pzz out-of-scope reminder).
 *   - Viewer-adaptive cap (e.g. 3+ for deep single-brand collections) is
 *     also deferred — we have no UX data yet to support an adaptive value.
 */
export async function topUpFromCatalogPopularity(
  candidateMap: Map<
    string,
    { key: string; watch: Watch; ownerId: string | null; count: number }
  >,
  excluded: Set<string>,
  needed: number,
  viewerTopBrand: string | null,
  viewerDominantStyleLabel: string | null,
  viewerOwnedBrandsLower: Set<string>,
): Promise<void> {
  if (needed <= 0) return
  // viewerTopBrand is kept in the signature for back-compat / future use
  // but is no longer the brand-match gate (the SET is). Mark as read so
  // a future linter pass doesn't flag the unused-parameter.
  void viewerTopBrand

  // LIMIT 60 (was 20 pre-260623-mn3) — broader candidate pool so the
  // in-memory scoring step has enough brand/style-bearing rows to pick
  // from. 60 is 3× the prior cap and well within the daily-cron'd
  // watches_catalog size (~200 rows on prod, ~160 locally). Trade-off:
  // bigger fetch = better matches but slightly more DB read; the cost
  // is amortized by the outer `'use cache'` boundary in Plan 07's
  // Server Component wrapping.
  const rowsByPopularity = await db
    .select({
      id: watchesCatalog.id,
      brand: watchesCatalog.brand,
      model: watchesCatalog.model,
      reference: watchesCatalog.reference,
      imageUrl: watchesCatalog.imageUrl,
      ownersCount: watchesCatalog.ownersCount,
      // Projected so the synthetic Watch can carry real styleTags →
      // the rule loop in getRecommendationsForViewer fires the
      // dominant-style rationale template on top-up rows when the
      // viewer's dominant style overlaps the catalog row's styleTags.
      styleTags: watchesCatalog.styleTags,
    })
    .from(watchesCatalog)
    .orderBy(desc(watchesCatalog.ownersCount), asc(watchesCatalog.brand))
    .limit(60)

  // 260623-pzz pool broadening: the popularity LIMIT 60 cuts off
  // alphabetically when many rows have ownersCount=0 (true locally and on
  // cold-start prod). Without this second query, owned-brand catalog rows
  // whose brand sorts late (Seiko, TIMEX, Zenith) never make it into the
  // scoring pool. With it, EVERY owned-brand row is scored. Cost: 1 extra
  // DB round-trip per render, only when sparse-pool top-up fires (which
  // is the small-tenant/cold-start case where per-render cost is already
  // trivial). Uses `lower(trim(brand)) = ANY(...)` instead of `inArray`
  // so casing differences between the user's watches table entries and
  // the watches_catalog table are tolerated (mirrors the normalization
  // used by viewerOwnedBrandsLower itself).
  let rows = rowsByPopularity
  if (viewerOwnedBrandsLower.size > 0) {
    const ownedBrandsArr = Array.from(viewerOwnedBrandsLower)
    const rowsByOwnedBrand = await db
      .select({
        id: watchesCatalog.id,
        brand: watchesCatalog.brand,
        model: watchesCatalog.model,
        reference: watchesCatalog.reference,
        imageUrl: watchesCatalog.imageUrl,
        ownersCount: watchesCatalog.ownersCount,
        styleTags: watchesCatalog.styleTags,
      })
      .from(watchesCatalog)
      .where(
        sql`lower(trim(${watchesCatalog.brand})) = ANY(${ownedBrandsArr})`,
      )
    // Merge: popularity slice first (priority for ordering-of-discovery
    // semantics), owned-brand catch-up second. Dedupe by primary key id —
    // same-id rows in both result sets are identical, so first-write-wins.
    const seenIds = new Set(rowsByPopularity.map((r) => r.id))
    const extras = rowsByOwnedBrand.filter((r) => !seenIds.has(r.id))
    rows = [...rowsByPopularity, ...extras]
  }

  // Score each row by viewer taste signal, then sort score DESC with
  // alpha-stable tiebreak. Brand-match uses SET membership (260623-pzz);
  // style match is case-insensitive vs viewer's dominant style.
  const styleLabelLower = viewerDominantStyleLabel?.toLowerCase() ?? null
  const scored = rows.map((row) => {
    const brandLower = row.brand.trim().toLowerCase()
    const brandMatch =
      viewerOwnedBrandsLower.size > 0 &&
      viewerOwnedBrandsLower.has(brandLower)
    const styleMatch =
      styleLabelLower !== null &&
      (row.styleTags ?? []).some((s) => s.toLowerCase() === styleLabelLower)
    const score =
      (brandMatch ? 100 : 0) +
      (styleMatch ? 50 : 0) +
      (row.ownersCount ?? 0) / 1000
    return { row, score, brandLower }
  })
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.row.brand.localeCompare(b.row.brand) ||
      a.row.model.localeCompare(b.row.model),
  )

  // 260623-pzz variety cap — walks the sorted array in score order and
  // skips any row whose brand has already contributed MAX_PER_BRAND_IN_TOPUP
  // rows. The cap check is BEFORE the dedupe checks so an excluded-by-cap
  // row does not even attempt the dedupe lookup; the brand-usage counter
  // only increments on successful appends below. brandUsage is local to
  // the function call (pure relative to inputs).
  const brandUsage = new Map<string, number>()
  let appended = 0
  for (const { row, brandLower } of scored) {
    if (appended >= needed) break
    if ((brandUsage.get(brandLower) ?? 0) >= MAX_PER_BRAND_IN_TOPUP) continue
    const key = `${brandLower}|${row.model.trim().toLowerCase()}`
    if (excluded.has(key)) continue
    if (candidateMap.has(key)) continue
    // Synthetic Watch shape — only the fields downstream consumers read.
    // styleTags PROJECTED from the catalog row so the rule loop can fire
    // its dominant-style template on this row (per 260623-mn3). roleTags
    // STAYS empty because watches_catalog.role_tags is empirically 0%-
    // populated (deferred to a future catalog-enrichment phase).
    const syntheticWatch: Watch = {
      id: row.id,
      brand: row.brand,
      model: row.model,
      status: 'owned',
      movement: 'auto',
      complications: [],
      styleTags: row.styleTags ?? [],
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
    brandUsage.set(brandLower, (brandUsage.get(brandLower) ?? 0) + 1)
    appended++
  }
}
