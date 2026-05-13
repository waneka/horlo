/**
 * Phase 39b Wave 0 — operator-curation seed for catalog hierarchy (D-39b-08 / D-39b-19).
 *
 * Usage:       npm run db:seed-lineage
 * Prod usage:  DATABASE_URL="<prod session-mode pooler URL>" npm run db:seed-lineage
 *
 * Idempotency contract (D-39b-20):
 *   Pass A — UPDATE watches_catalog SET family_id WHERE family_id IS NULL
 *            (never overwrite an existing assignment — re-runs are no-ops).
 *   Pass B — INSERT watch_lineage_edges (...) ON CONFLICT
 *            (predecessor_catalog_id, successor_catalog_id, relationship_type)
 *            DO NOTHING (matches the `lineage_edges_unique_triple` constraint
 *            at src/db/schema.ts:471-475).
 *
 * Footgun T-34-04 / T-39b-02 — without an inline DATABASE_URL override, this
 * script reads `.env.local` (LOCAL Docker DB) and silently writes to the wrong
 * database. See docs/deploy-db-setup.md §34.2 for the canonical mitigation:
 *   DATABASE_URL="<prod pooler url>" npm run db:seed-lineage
 *
 * Operator authors the FAMILY_ASSIGNMENTS + LINEAGE_EDGES arrays below before
 * running. Empty arrays are safe — both passes shrink to a no-op and print
 * `family_patched=0 family_skipped=0 edges_inserted=0 edges_skipped=0`.
 */
// Use relative imports — tsx does not resolve @/* path aliases.
import { db } from '../src/db'
import { sql } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// OPERATOR-AUTHORED DATA (TODO block — operator fills before running)
//
// Family categories per 39b-CONTEXT.md §Specifics:
//   - Submariner / Sea-Dweller / GMT family
//   - Speedmaster Moonwatch family
//   - Royal Oak family
//   - Submariner homages (Tudor BB, Squale, Christopher Ward C60)
//   - Speedy chain (Sinn 103, etc.)
//
// Query prod for catalog UUIDs via Supabase Studio:
//   SELECT id, brand, model, reference FROM watches_catalog
//    WHERE brand ILIKE 'Rolex' AND model ILIKE '%Submariner%' ORDER BY model;
//   SELECT id FROM watch_families WHERE name ILIKE '%Submariner%';
//
// Target: ~20 family_id assignments + ~15 lineage edges.
// ---------------------------------------------------------------------------

const FAMILY_ASSIGNMENTS: Array<{
  catalogId: string
  familyId: string
  brand: string
  model: string
}> = [
  // operator authors ~20 entries here, e.g.:
  // { catalogId: '00000000-0000-0000-0000-000000000000', familyId: '11111111-1111-1111-1111-111111111111', brand: 'Rolex', model: 'Submariner Date 126610LN' },
]

const LINEAGE_EDGES: Array<{
  predecessorCatalogId: string
  successorCatalogId: string
  relationshipType: 'predecessor' | 'successor' | 'remake' | 'tribute' | 'homage'
  note?: string
}> = [
  // operator authors ~15 entries here, e.g.:
  // { predecessorCatalogId: '...', successorCatalogId: '...', relationshipType: 'successor', note: '116610LN → 126610LN' },
]

// ---------------------------------------------------------------------------
// Pass A — UPDATE watches_catalog.family_id WHERE family_id IS NULL.
// Idempotent: re-runs against already-assigned rows hit the WHERE filter and
// return 0 rows (no UPDATE happens). Never overwrites an operator-curated value.
// ---------------------------------------------------------------------------
async function passA_assignFamilies(): Promise<{ patched: number; skipped: number }> {
  let patched = 0
  let skipped = 0
  for (const entry of FAMILY_ASSIGNMENTS) {
    const result = await db.execute<{ updated_id: string }>(sql`
      UPDATE watches_catalog
         SET family_id = ${entry.familyId}::uuid,
             updated_at = NOW()
       WHERE id = ${entry.catalogId}::uuid
         AND family_id IS NULL
      RETURNING id AS updated_id
    `)
    const updated = (result as unknown as Array<{ updated_id: string }>).length
    if (updated > 0) {
      patched += 1
      console.log(`[seed-lineage] family: ${entry.brand} ${entry.model} ✓`)
    } else {
      skipped += 1
      console.log(
        `[seed-lineage] family: ${entry.brand} ${entry.model} (skipped — already assigned or row not found)`,
      )
    }
  }
  return { patched, skipped }
}

// ---------------------------------------------------------------------------
// Pass B — INSERT watch_lineage_edges (...) ON CONFLICT DO NOTHING.
// Idempotent via the lineage_edges_unique_triple constraint
// (predecessor_catalog_id, successor_catalog_id, relationship_type).
// ---------------------------------------------------------------------------
async function passB_insertLineageEdges(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0
  let skipped = 0
  for (const edge of LINEAGE_EDGES) {
    const result = await db.execute<{ id: string }>(sql`
      INSERT INTO watch_lineage_edges (
        predecessor_catalog_id, successor_catalog_id, relationship_type
      )
      VALUES (
        ${edge.predecessorCatalogId}::uuid,
        ${edge.successorCatalogId}::uuid,
        ${edge.relationshipType}::lineage_relationship_type
      )
      ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type)
      DO NOTHING
      RETURNING id
    `)
    const insertedRows = (result as unknown as Array<{ id: string }>).length
    if (insertedRows > 0) {
      inserted += 1
      console.log(
        `[seed-lineage] edge: ${edge.predecessorCatalogId} -[${edge.relationshipType}]-> ${edge.successorCatalogId}`,
      )
    } else {
      skipped += 1
    }
  }
  return { inserted, skipped }
}

async function main() {
  const startedAt = Date.now()
  console.log(
    `[seed-lineage] starting — ${FAMILY_ASSIGNMENTS.length} family assignments + ${LINEAGE_EDGES.length} edges`,
  )
  const families = await passA_assignFamilies()
  const edges = await passB_insertLineageEdges()
  const elapsedMs = Date.now() - startedAt
  // Load-bearing summary line — operator UAT idempotency check greps for this
  // shape after a second run to confirm family_patched=0 edges_inserted=0.
  console.log(
    `[seed-lineage] OK — family_patched=${families.patched} family_skipped=${families.skipped} edges_inserted=${edges.inserted} edges_skipped=${edges.skipped} elapsedMs=${elapsedMs}`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed-lineage] fatal:', err)
  process.exit(1)
})
