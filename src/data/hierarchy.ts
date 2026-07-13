// DAL is server-only — importing this from a client component is a build-time error.
import 'server-only'

import { db } from '@/db'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { brands, watches, watchesCatalog, watchFamilies } from '@/db/schema'

/**
 * Phase 35 D-08 — getLineageForReference(catalogId)
 *
 * Returns the lineage neighborhood around the given catalog row, walking
 * `watch_lineage_edges` in BOTH directions (predecessors AND successors) up to
 * depth 10. Each row carries a `direction` field ('forward' = successor side,
 * 'backward' = predecessor side) so Phase 39 lineage browse UI can render
 * predecessor/successor affordances without re-querying.
 *
 * Cycle safety is two-layered (matches CAT-16 SC#2):
 *   1. Postgres 15 `CYCLE id SET is_cycle USING path` clause — handles existing
 *      cycles in stored data (e.g., service-role bypass of the BEFORE INSERT trigger).
 *   2. `WHERE depth < 10` guard inside the recursive arm — bounds recursion even
 *      in the absence of cycles.
 *
 * Both safety mechanisms are mandatory per ROADMAP §Phase 35 success criterion #2.
 *
 * @param catalogId UUID of the catalog row to walk lineage from.
 * @returns Array of LineageRow ordered by depth ascending; rows with `is_cycle = true` filtered out.
 */
export interface LineageRow {
  id: string                            // walks_catalog.id of the related row
  brand: string                         // watches_catalog.brand
  model: string                         // watches_catalog.model
  reference: string | null              // watches_catalog.reference
  imageUrl: string | null               // watches_catalog.image_url (Phase 39b — LineageRail card rendering)
  predecessor_catalog_id: string        // edge.predecessor_catalog_id
  successor_catalog_id: string          // edge.successor_catalog_id
  relationship_type: string             // edge.relationship_type (lineage_relationship_type)
  depth: number                         // 1-based depth from input catalog row
  direction: 'forward' | 'backward'     // 'forward' = successor side; 'backward' = predecessor side
  is_cycle: boolean                     // CYCLE clause output; outer SELECT filters NOT is_cycle
}

/**
 * Phase 39b NSV-02+16 — same-family rail DAL (D-39b-15).
 *
 * Ranks siblings by LIVE COUNT(watches.catalog_id) (Q2 verdict — chosen over the
 * 24h-stale denormalized owners_count for literal D-39b-15 compliance).
 *
 * Trade-off: live COUNT chosen over denormalized `watches_catalog.owners_count`
 * for D-39b-15 literal compliance. Cost: ~1ms additional query overhead per
 * request. Mitigation: rail caps at 6 cards (D-39b-17); GROUP BY is on indexed
 * familyId.
 */
export interface SameFamilyWatch {
  id: string                   // watches_catalog.id
  brand: string
  model: string
  imageUrl: string | null
  ownersCount: number
}

export async function getSameFamilyForCatalog(
  catalogId: string,
  opts: { limit?: number } = {},
): Promise<SameFamilyWatch[]> {
  const limit = opts.limit ?? 6

  // Two-pass: (1) resolve family_id; (2) find siblings ranked by live owners count.
  const rootRows = await db
    .select({ familyId: watchesCatalog.familyId })
    .from(watchesCatalog)
    .where(eq(watchesCatalog.id, catalogId))
    .limit(1)
  const familyId = rootRows[0]?.familyId
  if (!familyId) return []  // D-39b-07 hide-if-empty

  // Phase 81 Plan 05 (Task 05-1) — read-time canonical JOIN pattern (mirrors
  // Plan 02's `topUpFromCatalogPopularity` fix). Project `brand` and `model`
  // from canonical FK targets (`brands.name` / `watch_families.name`), not
  // from the drift-prone `watches_catalog.brand`/`.model` denorm columns.
  // Post-Phase-80 `brand_id` + `family_id` are NOT NULL on every catalog row,
  // so INNER JOINs cannot lose rows. GROUP BY substitutes the canonical
  // columns for the denorm ones to satisfy Postgres aggregation rules.
  const rows = await db
    .select({
      id: watchesCatalog.id,
      brand: brands.name,
      model: watchFamilies.name,
      imageUrl: watchesCatalog.imageUrl,
      ownersCount: sql<number>`COUNT(${watches.id})::int`,
    })
    .from(watchesCatalog)
    .innerJoin(brands, eq(brands.id, watchesCatalog.brandId))
    .innerJoin(watchFamilies, eq(watchFamilies.id, watchesCatalog.familyId))
    .leftJoin(watches, eq(watches.catalogId, watchesCatalog.id))
    .where(
      and(
        eq(watchesCatalog.familyId, familyId),
        sql`${watchesCatalog.id} != ${catalogId}::uuid`,
      ),
    )
    .groupBy(
      watchesCatalog.id,
      brands.name,
      watchFamilies.name,
      watchesCatalog.imageUrl,
    )
    .orderBy(
      desc(sql`COUNT(${watches.id})`),
      asc(brands.name),
      asc(watchFamilies.name),
    )
    .limit(limit)

  return rows
}

export async function getLineageForReference(catalogId: string): Promise<LineageRow[]> {
  // Phase 81 Plan 05 (Task 05-2) — read-time canonical JOIN pattern extended
  // to the recursive lineage CTE. Both arms JOIN `brands b` (on wc.brand_id)
  // and `watch_families f` (on wc.family_id) and project `b.name AS brand`
  // and `f.name AS model` in place of the drift-prone `wc.brand` / `wc.model`
  // denorm columns. INNER JOINs are safe post-Phase-80: watches_catalog.brand_id
  // + family_id are NOT NULL → JOINs cannot lose rows. Pitfall 5 invariant
  // extends to `b.name` + `f.name`: BOTH arms MUST carry the same JOINs +
  // projections or the outer SELECT type-check fails.
  const result = await db.execute(sql`
    WITH RECURSIVE lineage(
      id, brand, model, reference, image_url,
      predecessor_catalog_id, successor_catalog_id,
      relationship_type,
      depth, direction
    ) AS (
      -- Seed: edges that touch the input catalog row (both directions).
      SELECT
        wc.id, b.name AS brand, f.name AS model, wc.reference, wc.image_url,
        e.predecessor_catalog_id, e.successor_catalog_id,
        e.relationship_type::text,
        1 AS depth,
        CASE
          WHEN e.predecessor_catalog_id = ${catalogId}::uuid THEN 'forward'
          ELSE 'backward'
        END AS direction
      FROM watch_lineage_edges e
      JOIN watches_catalog wc ON (
        CASE
          WHEN e.predecessor_catalog_id = ${catalogId}::uuid THEN wc.id = e.successor_catalog_id
          ELSE wc.id = e.predecessor_catalog_id
        END
      )
      JOIN brands b ON b.id = wc.brand_id
      JOIN watch_families f ON f.id = wc.family_id
      WHERE e.predecessor_catalog_id = ${catalogId}::uuid
         OR e.successor_catalog_id   = ${catalogId}::uuid

      UNION ALL

      -- Recursive arm: follow edges from discovered catalog rows.
      -- depth < 10 guard bounds recursion (CAT-16 SC#2 mandatory).
      -- Pitfall 5: BOTH arms must carry wc.image_url AND canonical b.name/f.name
      -- for the column list to type-check + surface canonical strings.
      SELECT
        wc.id, b.name AS brand, f.name AS model, wc.reference, wc.image_url,
        e.predecessor_catalog_id, e.successor_catalog_id,
        e.relationship_type::text,
        c.depth + 1,
        CASE
          WHEN e.predecessor_catalog_id = c.id THEN 'forward'
          ELSE 'backward'
        END AS direction
      FROM watch_lineage_edges e
      JOIN lineage c ON (
        e.predecessor_catalog_id = c.id OR e.successor_catalog_id = c.id
      )
      JOIN watches_catalog wc ON (
        CASE
          WHEN e.predecessor_catalog_id = c.id THEN wc.id = e.successor_catalog_id
          ELSE wc.id = e.predecessor_catalog_id
        END
      )
      JOIN brands b ON b.id = wc.brand_id
      JOIN watch_families f ON f.id = wc.family_id
      WHERE c.depth < 10
    )
    -- Postgres 15 CYCLE clause (CAT-16 SC#2 mandatory).
    -- Marks rows that participate in cycles; outer SELECT filters them out.
    CYCLE id SET is_cycle USING path
    SELECT
      id, brand, model, reference, image_url AS "imageUrl",
      predecessor_catalog_id, successor_catalog_id,
      relationship_type, depth, direction, is_cycle
    FROM lineage
    WHERE NOT is_cycle
    ORDER BY depth ASC
  `)

  return result as unknown as LineageRow[]
}
