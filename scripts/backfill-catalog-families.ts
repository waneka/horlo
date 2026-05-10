/**
 * Phase 35 backfill script — CAT-16, D-12.
 * Usage: npm run db:backfill-catalog-families
 *
 * Reads scripts/seed-data/families.json. For each entry:
 *   Pass A: INSERT INTO watch_families (brand_id, name, slug)
 *           ON CONFLICT (brand_id, name_normalized) DO NOTHING
 *           Resolves brand_id by JOIN brands.slug = entry.brand_slug.
 *           If brand_slug does not resolve, logs a warning and skips (per Q4 resolution).
 *
 * Pass B: UPDATE watches_catalog SET family_id = wf.id
 *         FROM watch_families wf JOIN brands b ON wf.brand_id = b.id
 *         WHERE watches_catalog.brand_id = wf.brand_id
 *           AND lower(trim(watches_catalog.model)) = wf.name_normalized
 *           AND watches_catalog.family_id IS NULL
 *         (Idempotent: WHERE family_id IS NULL filter shrinks to empty on re-run.)
 *
 * Idempotent end-to-end. Prod runs are safe; interrupted-then-resumed runs are safe.
 *
 * Uses service-role DATABASE_URL via the existing src/db client. NEVER use the anon client.
 *
 * Footgun T-34-04 / T-17-BACKFILL-PROD-DB: For prod runs, OVERRIDE the env-file URL with
 *   DATABASE_URL=<prod pooler> npm run db:backfill-catalog-families
 * Without the inline override, this script reads .env.local (LOCAL Docker DB) and silently
 * backfills the wrong database.
 */
// Use relative imports — tsx does not resolve @/* path aliases.
import { db } from '../src/db'
import { sql } from 'drizzle-orm'
import { readFileSync } from 'node:fs'

interface FamilySeed {
  brand_slug: string
  name: string
  slug?: string
}

const SEED_PATH = 'scripts/seed-data/families.json'

/**
 * Pass A — INSERT families resolved by brand_slug.
 * Per Q4 resolution: missing brand_slug logs warning + skips (does not fail).
 */
async function passA_insertFamilies(): Promise<{ inserted: number; skipped: number }> {
  const seeds: FamilySeed[] = JSON.parse(readFileSync(SEED_PATH, 'utf-8'))
  let inserted = 0
  let skipped = 0

  for (const seed of seeds) {
    const result = await db.execute<{ inserted: number; resolved: number }>(sql`
      WITH brand AS (
        SELECT id FROM brands WHERE slug = ${seed.brand_slug} LIMIT 1
      ),
      ins AS (
        INSERT INTO watch_families (brand_id, name, slug)
        SELECT brand.id, ${seed.name}, ${seed.slug ?? null}
          FROM brand
        ON CONFLICT (brand_id, name_normalized) DO NOTHING
        RETURNING id
      )
      SELECT
        (SELECT count(*)::int FROM ins)   AS inserted,
        (SELECT count(*)::int FROM brand) AS resolved
    `)
    const row = (result as unknown as Array<{ inserted: number; resolved: number }>)[0]
    const insertedThis = row?.inserted ?? 0
    const resolvedThis = row?.resolved ?? 0

    if (resolvedThis === 0) {
      console.warn(`[backfill-catalog-families] WARN — brand_slug not resolved: ${seed.brand_slug} (name=${seed.name}); skipping insert`)
      skipped++
      continue
    }
    inserted += insertedThis
  }

  console.log(`[backfill-catalog-families] passA: inserted ${inserted} family rows; skipped ${skipped} (unresolved brand_slug)`)
  return { inserted, skipped }
}

/**
 * Pass B — Link watches_catalog.family_id by (brand_id + name_normalized) match.
 * Family name is matched against the catalog row's normalized model text.
 * Idempotent via WHERE family_id IS NULL.
 */
async function passB_linkCatalog(): Promise<number> {
  const result = await db.execute<{ linked: number }>(sql`
    WITH upd AS (
      UPDATE watches_catalog wc
         SET family_id = wf.id
        FROM watch_families wf
       WHERE wc.brand_id = wf.brand_id
         AND lower(trim(wc.model)) = wf.name_normalized
         AND wc.family_id IS NULL
      RETURNING wc.id
    )
    SELECT count(*)::int AS linked FROM upd
  `)
  const linked = (result as unknown as Array<{ linked: number }>)[0]?.linked ?? 0
  console.log(`[backfill-catalog-families] passB: linked ${linked} watches_catalog rows`)
  return linked
}

async function main() {
  const startedAt = Date.now()
  const { inserted, skipped } = await passA_insertFamilies()
  const linked = await passB_linkCatalog()

  // Final assertion: at least the seeded families are present in DB.
  const families = await db.execute<{ c: number }>(sql`SELECT count(*)::int AS c FROM watch_families`)
  const familyCount = (families as unknown as Array<{ c: number }>)[0]?.c ?? 0
  if (familyCount === 0) {
    console.error(`[backfill-catalog-families] FAILED — watch_families is empty after passA. Check brands table is populated and brand slugs match families.json.`)
    process.exit(1)
  }

  console.log(`[backfill-catalog-families] OK — inserted=${inserted} skipped=${skipped} linked=${linked} totalFamilies=${familyCount} elapsedMs=${Date.now() - startedAt}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[backfill-catalog-families] fatal:', err)
  process.exit(1)
})
