import 'server-only'

import { and, asc, desc, eq, isNotNull, ne, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  brands,
  profiles,
  profileSettings,
  watchesCatalog,
  watchFamilies,
} from '@/db/schema'
import { getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { getAllWearEventsByUser } from '@/data/wearEvents'
import { computeTasteTags } from '@/lib/tasteTags'
import { computeTasteOverlap } from '@/lib/tasteOverlap'
import { rationaleFor, topBrandOf, dominantStyleOf } from '@/lib/recommendations'
import type { Recommendation } from '@/lib/discoveryTypes'
import type { Watch } from '@/lib/types'

/**
 * Phase 81 D-81-02 — shared exclusion-key helper.
 *
 * Used by THREE call sites in this file to guarantee IDENTICAL key format
 * across (a) the viewer's owned/wishlist/grail exclusion set, (b) the peer-
 * pool candidateMap keying, and (c) the synthetic-Watch keying inside
 * `topUpFromCatalogPopularity`. Any drift between these three would surface
 * as a self-in-own-rail bug (Pitfall 5, HIGH cost — the exact class of bug
 * Phase 81 exists to close).
 *
 * Post-Phase-80 all catalog rows have brand_id + family_id NOT NULL, so all
 * watches with a non-null `catalogId` propagate brandId + familyId via the
 * LEFT JOIN in `getWatchesByUser`. The `brand|model` fallback is defensive
 * belt-and-suspenders for the Phase 17 `onDelete: 'set null'` edge case
 * (catalog row wiped → watches.catalogId=null → brandId=undefined via LEFT
 * JOIN nullable propagation). D-81 leaves the fallback in place per
 * Deferred Idea §Stripping fallback.
 */
function excludeKey(w: {
  brandId?: string
  familyId?: string
  brand: string
  model: string
}): string {
  return w.brandId && w.familyId
    ? `${w.brandId}|${w.familyId}`
    : `${w.brand.trim().toLowerCase()}|${w.model.trim().toLowerCase()}`
}

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
 * Per-brand variety cap inside the sparse-pool top-up (quick task post-260623-pzz
 * forward-fix). Without this, viewers whose top brand has many catalog rows
 * (e.g. Seiko) see the rail collapse to 8 cards of the same brand. Cap counts
 * BOTH peer-pool entries already in candidateMap and top-up entries added
 * here, so the limit applies across the full rendered rail.
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
  //
  // Phase 81 D-81-05 — brandNameLookup is built INSIDE this function scope
  // (never memoized at module scope — T-81-P02-01 cross-viewer poisoning
  // mitigation). Sourced from `SELECT id, name FROM brands WHERE id IN (…)`
  // using canonical FKs off the LEFT-JOIN-projected viewerWatches.
  const viewerBrandIds = [
    ...new Set(
      viewerWatches
        .map((w) => w.brandId)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  // Pitfall 2 mitigation — `sql.join([], …)` emits `IN ()` (Postgres 42601).
  // Skip the SELECT entirely when the viewer has zero brandId-keyed watches.
  const brandNameRows =
    viewerBrandIds.length === 0
      ? []
      : await db
          .select({ id: brands.id, name: brands.name })
          .from(brands)
          .where(
            sql`${brands.id} IN (${sql.join(
              viewerBrandIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
  const brandNameLookup = new Map<string, string>(
    brandNameRows.map((r) => [r.id, r.name]),
  )
  const viewerTopBrand = topBrandOf(viewerWatches, brandNameLookup)
  const viewerDominantStyleLabel = dominantStyleOf(viewerWatches)?.label ?? null
  // Phase 81 D-81-02 — SET of owned brand FKs (was: lowercase brand strings).
  // Fixes RECO-02 literally: Hamilton + Hamilton Watch catalog rows both
  // trigger the +100 owned-brand boost against canonical Hamilton brand_id.
  // Legacy watches (brandId=undefined) drop out — under the old strings
  // impl they inflated stale-string totals.
  const viewerOwnedBrandIds = new Set(
    viewerWatches
      .filter((w) => w.status === 'owned' && w.brandId)
      .map((w) => w.brandId!),
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
  //    normalized-dedupe per C-07).
  //
  // Phase 81 D-81-02 — keys on `${brandId}|${familyId}` when both FKs are
  // present (canonical identity, drift-immune), with `${brand}|${model}`
  // string fallback for the ON DELETE SET NULL legacy case. `excludeKey`
  // is used at ALL THREE sites (this exclusion loop + candidateMap key
  // below + synthetic-Watch key inside topUpFromCatalogPopularity) so the
  // identity property holds end-to-end (Pitfall 5 mitigation).
  const norm = excludeKey
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
      viewerOwnedBrandIds,
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
      viewerTopBrand,
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
 * Phase 75 D-10/D-11/D-12/D-13/D-14 + quick-260623-mn3 — sparse-pool
 * catalog-popularity top-up with TASTE-AWARE ranking.
 *
 * Mutates `candidateMap` in place by appending up to `needed` synthetic
 * catalog rows ranked by viewer taste signals (top brand + dominant style),
 * skipping any row whose normalized (brand|model) key is already present in
 * `candidateMap` or in `excluded` (viewer's owned/wishlist/grail set).
 *
 * Scoring (in-memory, after a broader catalog fetch):
 *   score = (brand-match ? 100 : 0)
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
 */
export async function topUpFromCatalogPopularity(
  candidateMap: Map<
    string,
    { key: string; watch: Watch; ownerId: string | null; count: number }
  >,
  excluded: Set<string>,
  needed: number,
  viewerTopBrand: { brandId: string; brandName: string } | null,
  viewerDominantStyleLabel: string | null,
  viewerOwnedBrandIds: Set<string>,
): Promise<void> {
  if (needed <= 0) return

  // Filter rows without an image — placeholder cards in the rail look broken.
  // Catalog coverage is high (~72% locally) so the filter rarely starves the
  // pool, and the LIMIT 60 + multi-brand union backstop covers thin spots.
  const hasImage = and(
    isNotNull(watchesCatalog.imageUrl),
    ne(watchesCatalog.imageUrl, ''),
  )

  // Phase 81 D-81-03 — INNER JOIN brands + watch_families so the synthetic
  // Watch rows carry CANONICAL brand + model (from brands.name / watch_families.name)
  // instead of the potentially-drift `watches_catalog.brand`/`.model` denorm
  // columns. INNER JOIN is safe post-Phase-80: watches_catalog.brand_id +
  // family_id are NOT NULL → JOINs cannot lose rows.
  const popularityRows = await db
    .select({
      id: watchesCatalog.id,
      brand: brands.name,
      model: watchFamilies.name,
      brandId: watchesCatalog.brandId,
      familyId: watchesCatalog.familyId,
      reference: watchesCatalog.reference,
      imageUrl: watchesCatalog.imageUrl,
      ownersCount: watchesCatalog.ownersCount,
      styleTags: watchesCatalog.styleTags,
    })
    .from(watchesCatalog)
    .innerJoin(brands, eq(brands.id, watchesCatalog.brandId))
    .innerJoin(watchFamilies, eq(watchFamilies.id, watchesCatalog.familyId))
    .where(hasImage)
    // Tiebreak by canonical `brands.name` for consistency with the JOIN
    // (was: `watchesCatalog.brand` denorm — could drift from canonical).
    .orderBy(desc(watchesCatalog.ownersCount), asc(brands.name))
    .limit(60)

  // Second query: ALL catalog rows whose brand_id matches any viewer-owned
  // brand_id (canonical FK identity — closes RECO-02). Skipped when viewer
  // owns zero brandId-keyed watches (Pitfall 2 guard — `sql.join([], …)`
  // would emit `IN ()` and Postgres 42601s).
  //
  // Anti-pitfall correct shape per [[drizzle-sql-any-array-pitfall]] — the
  // Drizzle sql-ANY-array anti-pattern that crashed prod home 2026-06-23
  // (digest 2193629549) is intentionally NOT introduced. `IN (sql.join(...))`
  // emits correct `IN ($1,$2,...)` syntax. Verified against local Supabase
  // before commit; forward-armor grep for the anti-pattern returns 0.
  let ownedBrandRows: typeof popularityRows = []
  if (viewerOwnedBrandIds.size > 0) {
    const brandArr = [...viewerOwnedBrandIds]
    ownedBrandRows = await db
      .select({
        id: watchesCatalog.id,
        brand: brands.name,
        model: watchFamilies.name,
        brandId: watchesCatalog.brandId,
        familyId: watchesCatalog.familyId,
        reference: watchesCatalog.reference,
        imageUrl: watchesCatalog.imageUrl,
        ownersCount: watchesCatalog.ownersCount,
        styleTags: watchesCatalog.styleTags,
      })
      .from(watchesCatalog)
      .innerJoin(brands, eq(brands.id, watchesCatalog.brandId))
      .innerJoin(watchFamilies, eq(watchFamilies.id, watchesCatalog.familyId))
      .where(
        and(
          hasImage,
          sql`${watchesCatalog.brandId} IN (${sql.join(
            brandArr.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
      )
  }

  // Merge by id (popularity-AND-owned rows would otherwise double-count).
  const seenIds = new Set<string>()
  const rows: typeof popularityRows = []
  for (const r of [...popularityRows, ...ownedBrandRows]) {
    if (seenIds.has(r.id)) continue
    seenIds.add(r.id)
    rows.push(r)
  }

  // Score each row by viewer taste signal. Phase 81 D-81-03 — brand match
  // now fires on canonical brand_id set membership (was: case-insensitive
  // string equality on denorm brand text). Closes the Hamilton / Hamilton
  // Watch drift-boost bug (RECO-02). Style match unchanged from 260623-mn3.
  const styleLabelLower = viewerDominantStyleLabel?.toLowerCase() ?? null
  const scored = rows.map((row) => {
    const brandMatch = viewerOwnedBrandIds.has(row.brandId)
    const styleMatch =
      styleLabelLower !== null &&
      (row.styleTags ?? []).some((s) => s.toLowerCase() === styleLabelLower)
    const score =
      (brandMatch ? 100 : 0) +
      (styleMatch ? 50 : 0) +
      (row.ownersCount ?? 0) / 1000
    return { row, score }
  })
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.row.brand.localeCompare(b.row.brand) ||
      a.row.model.localeCompare(b.row.model),
  )

  // Pre-seed brand counts from peer-pool entries already in candidateMap
  // so the variety cap applies across the FULL rail, not just top-up rows.
  // Phase 81 D-81-03 — key on canonical `brandId` when available, with the
  // lowercased-string fallback for legacy (catalogId=null) peer watches.
  const brandCount = new Map<string, number>()
  for (const c of candidateMap.values()) {
    const bk = c.watch.brandId ?? c.watch.brand.trim().toLowerCase()
    brandCount.set(bk, (brandCount.get(bk) ?? 0) + 1)
  }

  let appended = 0
  for (const { row } of scored) {
    if (appended >= needed) break
    // Phase 81 D-81-02 — synthetic key uses the SAME `excludeKey` helper as
    // the viewer's exclusion set + candidateMap keying above. Row always
    // carries brandId + familyId (INNER JOIN guarantees), so this resolves
    // to `${brandId}|${familyId}` — identity match with viewer's exclusion
    // key when the same catalog row is involved (Pitfall 5 mitigation).
    const key = excludeKey(row)
    if (excluded.has(key)) continue
    if (candidateMap.has(key)) continue
    // Variety cap keyed on canonical brand_id (INNER JOIN guarantees non-null).
    const brandKey = row.brandId
    if ((brandCount.get(brandKey) ?? 0) >= MAX_PER_BRAND_IN_TOPUP) continue
    // Phase 81 D-81-03 — synthetic Watch carries the JOIN-derived canonical
    // brand + model AND the FK identity (brandId + familyId). The FK fields
    // are the load-bearing addition — without them, the exclusion-key match
    // between viewer + synthetic paths falls back to string keys and drift-
    // branded rows leak through (self-in-own-rail — Pitfall 5).
    const syntheticWatch: Watch = {
      id: row.id,
      brand: row.brand,
      model: row.model,
      brandId: row.brandId,
      familyId: row.familyId,
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
    brandCount.set(brandKey, (brandCount.get(brandKey) ?? 0) + 1)
    appended++
  }
  // viewerTopBrand intentionally unused inside this function — caller still
  // threads it through per-candidate rationaleFor contexts.
  void viewerTopBrand
}
