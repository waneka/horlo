// DAL is server-only — importing this from a client component is a build-time error.
import 'server-only'

import { db } from '@/db'
import { sql } from 'drizzle-orm'

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

export async function getLineageForReference(catalogId: string): Promise<LineageRow[]> {
  const result = await db.execute(sql`
    WITH RECURSIVE lineage(
      id, brand, model, reference, image_url,
      predecessor_catalog_id, successor_catalog_id,
      relationship_type,
      depth, direction
    ) AS (
      -- Seed: edges that touch the input catalog row (both directions).
      SELECT
        wc.id, wc.brand, wc.model, wc.reference, wc.image_url,
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
      WHERE e.predecessor_catalog_id = ${catalogId}::uuid
         OR e.successor_catalog_id   = ${catalogId}::uuid

      UNION ALL

      -- Recursive arm: follow edges from discovered catalog rows.
      -- depth < 10 guard bounds recursion (CAT-16 SC#2 mandatory).
      -- Pitfall 5: BOTH arms must carry wc.image_url for the column list to type-check.
      SELECT
        wc.id, wc.brand, wc.model, wc.reference, wc.image_url,
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
