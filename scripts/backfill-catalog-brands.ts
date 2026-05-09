/**
 * Phase 34 backfill script — CAT-15, D-03/D-05.
 * Usage: npm run db:backfill-catalog-brands -- [--patch-country=scripts/country.json]
 *
 * Auto-derives brands from `watches_catalog.brand` (DISTINCT ON normalized) and
 * links `watches_catalog.brand_id` via the GENERATED `name_normalized` JOIN.
 * Optional --patch-country=<json-path> applies a `name_normalized → country` map
 * after derivation.
 *
 * Idempotent — re-runs after success are no-ops because:
 *   Pass A: ON CONFLICT (name_normalized) DO NOTHING
 *   Pass B: WHERE country_of_origin IS NULL filter
 *   Pass C: WHERE brand_id IS NULL filter shrinks to empty
 *
 * Uses service-role DATABASE_URL via the existing src/db client. NEVER use the
 * anon client.
 *
 * Footgun T-34-04 / T-17-BACKFILL-PROD-DB: For prod runs, OVERRIDE the env-file
 * URL with `DATABASE_URL=<prod pooler> npm run db:backfill-catalog-brands -- ...`.
 * Without the inline override, this script reads `.env.local` (LOCAL Docker DB)
 * and silently backfills the wrong database.
 *
 * Env loading: relies on `--env-file=.env.local` from package.json. Avoids depending
 * on a transitively-resolved `dotenv` package.
 */
// Use relative imports — tsx does not resolve @/* path aliases.
import { db } from '../src/db'
import { sql } from 'drizzle-orm'
import { readFileSync } from 'node:fs'

interface ParsedArgs {
  patchCountry: string | null
}

function parseArgs(): ParsedArgs {
  const args = new Map<string, string>(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=')
      return [k, v ?? 'true']
    }),
  )
  return { patchCountry: args.get('patch-country') ?? null }
}

/**
 * Pass A — INSERT brands derived from DISTINCT (lower(trim(brand))) catalog rows.
 * Picks the lowest-id catalog row's `brand` text as the canonical name (Pitfall 5).
 * Slug derived inline as `lower(regexp_replace(trim(brand), '\s+', '-', 'g'))` per D-01b.
 * ON CONFLICT (name_normalized) DO NOTHING — idempotent.
 */
async function passA_deriveBrands(): Promise<number> {
  const result = await db.execute<{ inserted: number }>(sql`
    WITH ins AS (
      INSERT INTO brands (name, slug)
      SELECT DISTINCT ON (lower(trim(brand)))
             brand,
             lower(regexp_replace(trim(brand), '\s+', '-', 'g'))
        FROM watches_catalog
       WHERE brand IS NOT NULL
       ORDER BY lower(trim(brand)), id ASC
      ON CONFLICT (name_normalized) DO NOTHING
      RETURNING id
    )
    SELECT count(*)::int AS inserted FROM ins
  `)
  const inserted = (result as unknown as Array<{ inserted: number }>)[0]?.inserted ?? 0
  console.log(`[backfill-catalog-brands] passA: inserted ${inserted} brand rows`)
  return inserted
}

/**
 * Pass B (optional) — Apply country_of_origin from JSON.
 * Keys must match brands.name_normalized (lowercased trimmed brand text).
 * WHERE country_of_origin IS NULL filter makes this idempotent on re-run AND
 * avoids overwriting prior operator-curated values.
 * V5 input validation: JSON.parse fails fast on non-JSON; country values are
 * length-capped at 64 chars defensively.
 */
async function passB_patchCountry(jsonPath: string): Promise<number> {
  const raw = readFileSync(jsonPath, 'utf-8')
  const map = JSON.parse(raw) as Record<string, string>
  let patched = 0
  for (const [nameNormalized, country] of Object.entries(map)) {
    if (typeof nameNormalized !== 'string' || typeof country !== 'string') continue
    if (country.length === 0 || country.length > 64) continue
    const result = await db.execute<{ patched: number }>(sql`
      WITH upd AS (
        UPDATE brands
           SET country_of_origin = ${country}
         WHERE name_normalized = ${nameNormalized}
           AND country_of_origin IS NULL
        RETURNING id
      )
      SELECT count(*)::int AS patched FROM upd
    `)
    patched += (result as unknown as Array<{ patched: number }>)[0]?.patched ?? 0
  }
  console.log(`[backfill-catalog-brands] passB: patched ${patched} country values from ${jsonPath}`)
  return patched
}

/**
 * Pass C — UPDATE watches_catalog.brand_id via name_normalized JOIN.
 * Idempotent on `wc.brand_id IS NULL`.
 */
async function passC_linkCatalog(): Promise<number> {
  const result = await db.execute<{ linked: number }>(sql`
    WITH upd AS (
      UPDATE watches_catalog wc
         SET brand_id = b.id
        FROM brands b
       WHERE wc.brand_normalized = b.name_normalized
         AND wc.brand_id IS NULL
      RETURNING wc.id
    )
    SELECT count(*)::int AS linked FROM upd
  `)
  const linked = (result as unknown as Array<{ linked: number }>)[0]?.linked ?? 0
  console.log(`[backfill-catalog-brands] passC: linked ${linked} watches_catalog rows`)
  return linked
}

async function main() {
  const startedAt = Date.now()
  const args = parseArgs()

  const inserted = await passA_deriveBrands()
  const patched = args.patchCountry ? await passB_patchCountry(args.patchCountry) : 0
  const linked = await passC_linkCatalog()

  // Final assertion — every catalog row whose brand_normalized is non-null MUST
  // have brand_id populated post-link. Failure dumps offenders.
  const remaining = await db.execute<{ c: number }>(sql`
    SELECT count(*)::int AS c FROM watches_catalog
     WHERE brand_normalized IS NOT NULL AND brand_id IS NULL
  `)
  const remainingCount = (remaining as unknown as Array<{ c: number }>)[0]?.c ?? 0
  if (remainingCount !== 0) {
    const offenders = await db.execute(sql`
      SELECT id, brand FROM watches_catalog
       WHERE brand_normalized IS NOT NULL AND brand_id IS NULL
       LIMIT 50
    `)
    console.error(`[backfill-catalog-brands] FAILED — ${remainingCount} catalog rows unlinked:`)
    console.table(offenders)
    process.exit(1)
  }

  const elapsedMs = Date.now() - startedAt
  console.log(`[backfill-catalog-brands] OK — inserted=${inserted} patched=${patched} linked=${linked} unlinked=0 elapsedMs=${elapsedMs}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[backfill-catalog-brands] fatal:', err)
  process.exit(1)
})
