/**
 * Phase 35 backfill script — CAT-16, D-12.
 * Usage: npm run db:backfill-catalog-lineage
 *
 * Reads scripts/seed-data/lineage-edges.json. For each edge entry:
 *   1. Resolves predecessor_ref ("brand_slug/family_slug/reference") to a watches_catalog.id
 *      via JOIN brands + watch_families on slugs and reference_normalized.
 *   2. Resolves successor_ref similarly.
 *   3. If either ref does not resolve, logs warning and skips (no placeholder catalog inserts).
 *   4. INSERTs the edge with ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type)
 *      DO NOTHING. Idempotent.
 *
 * Note: cycle-detection is enforced by the BEFORE INSERT trigger (Plan 05 migration). If a seed
 * file accidentally specifies a cycle-completing edge, the trigger raises an exception and this
 * script's catch block surfaces it.
 *
 * Uses service-role DATABASE_URL via the existing src/db client. NEVER use the anon client.
 *
 * Footgun T-34-04 / T-17-BACKFILL-PROD-DB: For prod runs, OVERRIDE the env-file URL with
 *   DATABASE_URL=<prod pooler> npm run db:backfill-catalog-lineage
 */
// Use relative imports — tsx does not resolve @/* path aliases.
import { db } from '../src/db'
import { sql } from 'drizzle-orm'
import { readFileSync } from 'node:fs'

interface EdgeSeed {
  predecessor_ref: string   // "brand_slug/family_slug/reference"
  successor_ref: string
  relationship_type: 'successor' | 'predecessor' | 'remake' | 'tribute' | 'homage'
}

const SEED_PATH = 'scripts/seed-data/lineage-edges.json'

/**
 * Resolve "brand_slug/family_slug/reference" triple to a watches_catalog.id.
 * Returns null if any part fails to resolve. Uses reference_normalized for case-insensitive match.
 */
async function resolveRef(triple: string): Promise<string | null> {
  const parts = triple.split('/')
  if (parts.length !== 3) {
    console.warn(`[backfill-catalog-lineage] WARN — malformed ref triple (expected brand_slug/family_slug/reference): ${triple}`)
    return null
  }
  const [brandSlug, familySlug, reference] = parts

  const result = await db.execute<{ id: string }>(sql`
    SELECT wc.id
      FROM watches_catalog wc
      JOIN brands b          ON b.id  = wc.brand_id
      JOIN watch_families wf ON wf.id = wc.family_id
     WHERE b.slug  = ${brandSlug}
       AND wf.slug = ${familySlug}
       AND wc.reference_normalized = regexp_replace(lower(trim(${reference})), '[^a-z0-9]+', '', 'g')
     LIMIT 1
  `)
  return (result as unknown as Array<{ id: string }>)[0]?.id ?? null
}

async function main() {
  const startedAt = Date.now()
  const seeds: EdgeSeed[] = JSON.parse(readFileSync(SEED_PATH, 'utf-8'))
  let inserted = 0
  let skipped = 0

  for (const seed of seeds) {
    const predId = await resolveRef(seed.predecessor_ref)
    const succId = await resolveRef(seed.successor_ref)

    if (!predId || !succId) {
      console.warn(`[backfill-catalog-lineage] SKIP — unresolved ref(s): predecessor=${seed.predecessor_ref} (${predId ? 'OK' : 'MISSING'}) successor=${seed.successor_ref} (${succId ? 'OK' : 'MISSING'})`)
      skipped++
      continue
    }

    const result = await db.execute<{ inserted: number }>(sql`
      WITH ins AS (
        INSERT INTO watch_lineage_edges (predecessor_catalog_id, successor_catalog_id, relationship_type)
        VALUES (${predId}::uuid, ${succId}::uuid, ${seed.relationship_type}::lineage_relationship_type)
        ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type) DO NOTHING
        RETURNING id
      )
      SELECT count(*)::int AS inserted FROM ins
    `)
    inserted += (result as unknown as Array<{ inserted: number }>)[0]?.inserted ?? 0
  }

  // Final report
  const totalEdges = await db.execute<{ c: number }>(sql`SELECT count(*)::int AS c FROM watch_lineage_edges`)
  const total = (totalEdges as unknown as Array<{ c: number }>)[0]?.c ?? 0

  console.log(`[backfill-catalog-lineage] OK — inserted=${inserted} skipped=${skipped} totalEdges=${total} elapsedMs=${Date.now() - startedAt}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[backfill-catalog-lineage] fatal:', err)
  process.exit(1)
})
