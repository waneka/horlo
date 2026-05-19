import 'server-only'

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  profiles,
  profileSettings,
  watches,
} from '@/db/schema'

/**
 * Phase 46 D-01..D-03 — Phase 18 /explore rails RETIRED.
 *
 * getMostFollowedCollectors, getTrendingCatalogWatches, and
 * getGainingTractionCatalogWatches (DISC-04, DISC-05, DISC-06) have been
 * deleted. Their UI surfaces (the three Phase 18 rails) and the two see-all
 * sub-routes are deleted with Phase 46 Plan 01. The new /explore shell
 * (Plan 03) replaces the old page with 5 editorial modules.
 *
 * Retained: getCollectorsForCatalog (Phase 39b NSV-18, DISC-11) — still used
 * by /catalog/[catalogId]/page.tsx.
 */

// ---------------------------------------------------------------------------
// Phase 39b NSV-18: getCollectorsForCatalog (DISC-11)
// ---------------------------------------------------------------------------

/**
 * Catalog other-owners roster row — projected fields rendered by
 * OtherOwnersRoster chip row on /catalog/{id}. Username + displayName +
 * avatarUrl all originate from the `profiles` table; userId is the FK target
 * for /u/{username}/collection links.
 */
export interface CatalogCollector {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

/**
 * NSV-18 catalog other-owners roster (D-39b-09..D-39b-11, DISC-AUDIT-70/72).
 *
 * Returns the top-N public collectors who own/wishlist/grail this catalog ref,
 * ordered by `watches.created_at DESC` (D-39b-10 — liveness signal over
 * follower-count influence). Self-excludes the viewer; respects two-layer
 * privacy (profilePublic + collectionPublic).
 *
 * Threat surface (load-bearing — service-role pooler bypasses RLS, so the
 * DAL WHERE is the privacy gate):
 *   - T-39b-01 layer 1: eq(profileSettings.profilePublic, true)
 *   - T-39b-01 layer 2: eq(profileSettings.collectionPublic, true) — D-39b-09
 *     NEW second-layer gate; does NOT exist in getMostFollowedCollectors
 *   - T-39b-04: sql`${profiles.id} != ${viewerId}` — viewer self-exclusion
 *   - Q1 RECOMMEND / A1: inArray(watches.status, ['owned','wishlist','grail'])
 *     excludes 'sold' so the count matches "X collectors own this" copy
 *
 * Pitfalls:
 *   - Pitfall 3 — A single user can have multiple rows per catalog (e.g.
 *     owned + wishlist). The SQL overfetches at LIMIT 50 then a JS-side
 *     Set-based dedup keeps the first occurrence per userId before slicing
 *     to top-N. The SQL ORDER BY guarantees the kept row is the most-recent.
 *   - Pitfall 4 — totalCount cannot be derived from rows.length (which is
 *     dedup'd AND limited). A second query uses count(DISTINCT profiles.id)
 *     against the IDENTICAL WHERE clause so both privacy layers and the
 *     status filter apply consistently.
 *
 * Integration tests at tests/data/getCollectorsForCatalog.test.ts prove all 4
 * privacy edges + dedup behavior.
 */
export async function getCollectorsForCatalog(
  catalogId: string,
  viewerId: string,
  opts: { limit?: number } = {},
): Promise<{ collectors: CatalogCollector[]; totalCount: number }> {
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
    .where(
      and(
        eq(watches.catalogId, catalogId),
        eq(profileSettings.profilePublic, true),    // T-39b-01 layer 1
        eq(profileSettings.collectionPublic, true), // T-39b-01 layer 2 (D-39b-09 NEW)
        sql`${profiles.id} != ${viewerId}`,         // T-39b-04 self-exclusion
        inArray(watches.status, ['owned', 'wishlist', 'grail']), // A1 / Q1 — exclude sold
      ),
    )
    .orderBy(desc(watches.createdAt), asc(profiles.username))
    .limit(50) // Pitfall 3 — overfetch for JS-side dedup

  // Pitfall 4 — separate count(DISTINCT) query for totalCount label. Identical
  // WHERE clause so privacy layers and status filter apply consistently.
  const totalRows = await db
    .select({ count: sql<number>`count(DISTINCT ${profiles.id})::int` })
    .from(watches)
    .innerJoin(profiles, eq(profiles.id, watches.userId))
    .innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
    .where(
      and(
        eq(watches.catalogId, catalogId),
        eq(profileSettings.profilePublic, true),    // T-39b-01 layer 1
        eq(profileSettings.collectionPublic, true), // T-39b-01 layer 2 (D-39b-09 NEW)
        sql`${profiles.id} != ${viewerId}`,         // T-39b-04 self-exclusion
        inArray(watches.status, ['owned', 'wishlist', 'grail']), // A1 / Q1 — exclude sold
      ),
    )
  const totalCount = totalRows[0]?.count ?? 0

  // Pitfall 3 — JS dedup: keep first occurrence per userId (already
  // ORDER BY created_at DESC), then slice to top-N.
  const seen = new Set<string>()
  const collectors: CatalogCollector[] = []
  for (const r of rows) {
    if (seen.has(r.userId)) continue
    seen.add(r.userId)
    collectors.push({
      userId: r.userId,
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    })
    if (collectors.length >= limit) break
  }
  return { collectors, totalCount }
}
