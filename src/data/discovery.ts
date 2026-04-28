import 'server-only'

import { and, asc, desc, eq, inArray, notInArray, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  follows,
  profiles,
  profileSettings,
  watches,
  watchesCatalog,
} from '@/db/schema'

/**
 * Phase 18 /explore Discovery DAL.
 *
 * Three reader functions powering the /explore rails (DISC-04, DISC-05, DISC-06):
 *   - getMostFollowedCollectors  → Popular Collectors rail
 *   - getTrendingCatalogWatches  → Trending Watches rail
 *   - getGainingTractionCatalogWatches → Gaining Traction rail (Task 3)
 *
 * Two-layer privacy on the Popular Collectors path mirrors src/data/search.ts
 * (`profileSettings.profilePublic = true` JOIN + RLS at DB layer). All COUNT
 * aggregates cast to ::int (Pitfall 2). notInArray guarded by length check
 * (Pitfall 6). 'server-only' guarantees no client bundle inclusion (DAL discipline).
 */

export interface PopularCollector {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  followersCount: number
  watchCount: number
}

export interface TrendingWatch {
  id: string
  brand: string
  model: string
  reference: string | null
  imageUrl: string | null
  ownersCount: number
  wishlistCount: number
}

/**
 * Most-followed public profiles, exclude-self + exclude-already-followed.
 *
 * Two-layer privacy: profile_public = true (DAL WHERE) + RLS on profiles table.
 * Mirrors src/data/search.ts:searchProfiles + src/data/suggestions.ts exclusion
 * shape. Tie-break: followersCount DESC, username ASC (D-15).
 *
 * DISC-04. T-18-01-01 (info disclosure), T-18-01-05 (DoS via empty notInArray),
 * T-18-01-06 (count() coercion).
 */
export async function getMostFollowedCollectors(
  viewerId: string,
  opts: { limit?: number } = {},
): Promise<PopularCollector[]> {
  const limit = opts.limit ?? 5

  // 1. Already-followed exclusion (mirrors getSuggestedCollectors step 1).
  const followingRows = await db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, viewerId))
  const excludeIds = [viewerId, ...followingRows.map((r) => r.id)]

  // 2. Aggregate followers; two-layer-privacy gate via profileSettings JOIN.
  //    notInArray guard per Pitfall 6 — excludeIds is always >= 1 here
  //    (viewerId is spread in), so the guard is defense-in-depth against any
  //    future refactor that might skip the viewer prepend.
  const rows = await db
    .select({
      userId: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      followersCount: sql<number>`count(${follows.id})::int`,
    })
    .from(profiles)
    .innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
    .leftJoin(follows, eq(follows.followingId, profiles.id))
    .where(
      and(
        eq(profileSettings.profilePublic, true), // T-18-01-01 two-layer privacy
        excludeIds.length > 0 ? notInArray(profiles.id, excludeIds) : undefined,
      ),
    )
    .groupBy(profiles.id, profileSettings.profilePublic)
    .orderBy(desc(sql<number>`count(${follows.id})::int`), asc(profiles.username))
    .limit(Math.max(limit, 50))

  if (rows.length === 0) return []

  // 3. Hydrate watchCount via inArray batch (anti-N+1, mirrors mergeListEntries).
  //    Status filter: 'owned' watches only — wishlist/sold/grail are not "in
  //    the user's collection" for display purposes (matches Phase 10
  //    SuggestedCollectorRow precedent).
  const ids = rows.map((r) => r.userId)
  const watchAggs = await db
    .select({
      userId: watches.userId,
      watchCount: sql<number>`count(*) FILTER (WHERE ${watches.status} = 'owned')::int`,
    })
    .from(watches)
    .where(inArray(watches.userId, ids))
    .groupBy(watches.userId)
  const watchById = new Map(watchAggs.map((w) => [w.userId, w.watchCount]))

  // 4. JS slice to final limit (already SQL-sorted).
  return rows.slice(0, limit).map((r) => ({
    userId: r.userId,
    username: r.username,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    followersCount: r.followersCount,
    watchCount: watchById.get(r.userId) ?? 0,
  }))
}

/**
 * Trending watches by weighted signal score.
 *
 * Score = owners_count + 0.5 * wishlist_count (DISC-05).
 * Tie-break: brand_normalized ASC, model_normalized ASC (D-15).
 * Excludes score === 0 rows (RESEARCH Pattern 5 line 577 — no-signal noise).
 *
 * The denormalized counts on watches_catalog are populated by the Phase 17
 * pg_cron daily refresh. At <500 watches/user × <1000 catalog rows the unsorted
 * Seq Scan + sort is sub-50ms (RESEARCH Pattern 5 line 437) — no covering index
 * required.
 */
export async function getTrendingCatalogWatches(
  opts: { limit?: number } = {},
): Promise<TrendingWatch[]> {
  const limit = opts.limit ?? 5
  const rows = await db
    .select({
      id: watchesCatalog.id,
      brand: watchesCatalog.brand,
      model: watchesCatalog.model,
      reference: watchesCatalog.reference,
      imageUrl: watchesCatalog.imageUrl,
      ownersCount: watchesCatalog.ownersCount,
      wishlistCount: watchesCatalog.wishlistCount,
    })
    .from(watchesCatalog)
    .where(
      sql`(${watchesCatalog.ownersCount} + 0.5 * ${watchesCatalog.wishlistCount}) > 0`,
    )
    .orderBy(
      desc(sql`(${watchesCatalog.ownersCount} + 0.5 * ${watchesCatalog.wishlistCount})`),
      asc(watchesCatalog.brandNormalized),
      asc(watchesCatalog.modelNormalized),
    )
    .limit(limit)
  return rows
}

export interface GainingTractionWatch {
  id: string
  brand: string
  model: string
  reference: string | null
  imageUrl: string | null
  delta: number
}

export interface GainingTractionResult {
  window: number // 0 = no snapshots, 1-6 = partial window, 7 = full week
  watches: GainingTractionWatch[]
}

/**
 * 7-day-delta-vs-oldest-snapshot ranking on watches_catalog rows.
 *
 * D-12 partial-window logic + D-15 tie-break (delta DESC, brand_normalized ASC,
 * model_normalized ASC).
 *
 * SQL idiom: DISTINCT ON (catalog_id) ORDER BY catalog_id, snapshot_date ASC
 *            picks the OLDEST snapshot per catalog row in the [today − window,
 *            today] range.
 *
 * Index reachable: watches_catalog_snapshots_date_idx (snapshot_date,
 * catalog_id) — Phase 17.
 *
 * snapshot_date is stored as TEXT (Pitfall 3). All date math casts through
 * ::date so Postgres uses date arithmetic, not lexicographic string compare.
 *
 * Three windows per D-12:
 *   - 0 snapshots ever → window=0, watches=[] (deploy-day case, Pitfall 4)
 *   - 1..6 days of snapshots → window = max-age clamped to [1, 7]
 *   - 7+ days → window=7
 *
 * DISC-06. T-18-01-02 (SQL injection mitigation): all variables interpolated
 * via Drizzle ${} parameterization (prepared statements); window is
 * server-computed integer; limit is server-validated `opts.limit ?? 5`. No
 * string concatenation of any input.
 */
export async function getGainingTractionCatalogWatches(
  opts: { limit?: number } = {},
): Promise<GainingTractionResult> {
  const limit = opts.limit ?? 5

  // 1. Discover snapshot age — what is the oldest snapshot date we have?
  //    Pitfall 3: cast snapshot_date through ::date so MIN + EXTRACT use date
  //    arithmetic instead of lexicographic TEXT compare.
  const oldestRows = await db.execute<{ oldest: string | null; max_age_days: number }>(sql`
    SELECT MIN(snapshot_date::date)::text AS oldest,
           COALESCE(EXTRACT(DAY FROM (current_date - MIN(snapshot_date::date)))::int, 0) AS max_age_days
      FROM watches_catalog_daily_snapshots
  `)
  const oldest = (oldestRows as unknown as Array<{ oldest: string | null; max_age_days: number }>)[0]
  if (!oldest || !oldest.oldest) {
    return { window: 0, watches: [] }
  }

  // window = clamp(max_age_days, 1, 7) — D-12 cases 2 + 3.
  const window = Math.max(1, Math.min(oldest.max_age_days ?? 0, 7))

  // 2. Compute delta. Pick OLDEST snapshot per catalog row within last `window`
  //    days, JOIN to current catalog counts. Score = current − snap; excludes
  //    non-positive deltas so only "gaining" rows surface.
  //
  //    Pitfall 3: snapshot_date::date cast on the WHERE predicate is critical;
  //    without it the comparison is TEXT against an interval expression and
  //    Postgres will refuse the implicit coercion or produce wrong results.
  const rows = await db.execute<{
    id: string
    brand: string
    model: string
    reference: string | null
    image_url: string | null
    delta: number
  }>(sql`
    WITH base AS (
      SELECT DISTINCT ON (s.catalog_id)
             s.catalog_id,
             s.owners_count   AS snap_owners,
             s.wishlist_count AS snap_wishlist
        FROM watches_catalog_daily_snapshots s
       WHERE s.snapshot_date::date >= (current_date - ${window} * INTERVAL '1 day')::date
       ORDER BY s.catalog_id, s.snapshot_date ASC
    )
    SELECT wc.id,
           wc.brand,
           wc.model,
           wc.reference,
           wc.image_url,
           ROUND(
             (wc.owners_count + 0.5 * wc.wishlist_count)
             - (base.snap_owners + 0.5 * base.snap_wishlist)
           )::int AS delta
      FROM watches_catalog wc
      JOIN base ON base.catalog_id = wc.id
     WHERE (wc.owners_count + 0.5 * wc.wishlist_count)
           > (base.snap_owners + 0.5 * base.snap_wishlist)
     ORDER BY delta DESC,
              wc.brand_normalized ASC,
              wc.model_normalized ASC
     LIMIT ${limit}
  `)

  const watches = (rows as unknown as Array<{
    id: string
    brand: string
    model: string
    reference: string | null
    image_url: string | null
    delta: number
  }>).map((r) => ({
    id: r.id,
    brand: r.brand,
    model: r.model,
    reference: r.reference,
    imageUrl: r.image_url,
    delta: r.delta,
  }))

  return { window, watches }
}
