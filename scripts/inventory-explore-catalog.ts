/**
 * Quick task 260614-f82: Read-only prod inventory script.
 * Usage: PROD_DATABASE_URL=postgresql://... npm run explore:inventory
 *
 * Connects to the PROD database (NOT local) via PROD_DATABASE_URL.
 * Runs read-only SELECTs on watches_catalog to help pick list items + path nodes.
 * Writes output to .planning/quick/260614-f82-seed-explore-page-editorial-content-8-cu/INVENTORY.md
 *
 * NEVER writes anything to the database. Idempotent — re-runs overwrite the file.
 *
 * NOTE: Does NOT use --env-file=.env.local because PROD_DATABASE_URL must NOT live there.
 * The user supplies it via shell env: PROD_DATABASE_URL=... npm run explore:inventory
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import postgres from 'postgres'

const TASK_DIR = path.join(
  process.cwd(),
  '.planning/quick/260614-f82-seed-explore-page-editorial-content-8-cu',
)
const OUTPUT_FILE = path.join(TASK_DIR, 'INVENTORY.md')

async function main() {
  const connStr = process.env.PROD_DATABASE_URL
  if (!connStr) {
    console.error(
      '[inventory] ERROR: PROD_DATABASE_URL is not set.\n' +
        'Run with: PROD_DATABASE_URL=postgresql://... npm run explore:inventory\n' +
        'Use the read-only prod connection string from Supabase Dashboard → Database → Connection string → URI (port 5432 for direct, or the Session pooler).',
    )
    process.exit(1)
  }

  console.log('[inventory] Connecting to prod (read-only)...')
  const sql = postgres(connStr, { max: 1, ssl: 'require' })

  try {
    // 1. Per-brand aggregate
    console.log('[inventory] Querying per-brand aggregates...')
    const brandAgg = await sql<
      { brand: string; count: number; total_owners: number; total_wishlist: number }[]
    >`
      SELECT
        brand,
        count(*)::int             AS count,
        coalesce(sum(owners_count), 0)::int  AS total_owners,
        coalesce(sum(wishlist_count), 0)::int AS total_wishlist
      FROM public.watches_catalog
      GROUP BY brand
      ORDER BY count(*) DESC
    `

    // 2. Top 50 watches by combined popularity
    console.log('[inventory] Querying top-50 popular watches...')
    const top50 = await sql<
      {
        brand: string
        model: string
        reference: string | null
        owners_count: number
        wishlist_count: number
        image_url: string | null
      }[]
    >`
      SELECT
        brand,
        model,
        reference,
        coalesce(owners_count, 0)::int   AS owners_count,
        coalesce(wishlist_count, 0)::int AS wishlist_count,
        image_url
      FROM public.watches_catalog
      ORDER BY (coalesce(owners_count, 0) + coalesce(wishlist_count, 0)) DESC,
               brand ASC,
               model ASC
      LIMIT 50
    `

    // 3. Per-family roll-up (only where family is populated)
    console.log('[inventory] Querying per-family roll-up...')
    const familyRollup = await sql<{ family: string; brand: string; count: number }[]>`
      SELECT
        family,
        brand,
        count(*)::int AS count
      FROM public.watches_catalog
      WHERE family IS NOT NULL
      GROUP BY family, brand
      ORDER BY family ASC, brand ASC
    `

    // 4. Watches already used in curated_list_items or collection_path_nodes
    console.log('[inventory] Querying existing editorial usage...')
    const editorialUsage = await sql<
      {
        brand: string
        model: string
        reference: string | null
        usage: string
      }[]
    >`
      SELECT DISTINCT
        wc.brand,
        wc.model,
        wc.reference,
        'curated_list_items' AS usage
      FROM public.curated_list_items cli
      JOIN public.watches_catalog wc ON wc.id = cli.catalog_id

      UNION

      SELECT DISTINCT
        wc.brand,
        wc.model,
        wc.reference,
        'collection_path_nodes' AS usage
      FROM public.collection_path_nodes cpn
      JOIN public.watches_catalog wc ON wc.id = cpn.catalog_id

      ORDER BY brand ASC, model ASC
    `

    console.log('[inventory] Writing INVENTORY.md...')
    const now = new Date().toISOString().slice(0, 10)

    const lines: string[] = [
      `# Horlo Explore Content Inventory`,
      ``,
      `> Generated ${now} by inventory-explore-catalog.ts — READ-ONLY, PROD`,
      `> Use this file to select watches for LISTS.md and PATHS.md.`,
      `> Every brand/model/reference triple in LISTS.md + PATHS.md MUST appear here.`,
      ``,
      `---`,
      ``,
      `## Per-Brand Aggregate`,
      ``,
      `| brand | count | total_owners | total_wishlist |`,
      `| ----- | ----- | ------------ | -------------- |`,
      ...brandAgg.map(
        (r) =>
          `| ${r.brand} | ${r.count} | ${r.total_owners} | ${r.total_wishlist} |`,
      ),
      ``,
      `---`,
      ``,
      `## Top 50 Watches by Popularity (owners + wishlist)`,
      ``,
      `| brand | model | reference | owners | wishlist | has_image |`,
      `| ----- | ----- | --------- | ------ | -------- | --------- |`,
      ...top50.map(
        (r) =>
          `| ${r.brand} | ${r.model} | ${r.reference ?? 'null'} | ${r.owners_count} | ${r.wishlist_count} | ${r.image_url ? 'yes' : 'no'} |`,
      ),
      ``,
      `---`,
      ``,
      `## Per-Family Roll-Up (populated families only)`,
      ``,
      familyRollup.length === 0
        ? `_(no family data populated in catalog)_`
        : [
            `| family | brand | count |`,
            `| ------ | ----- | ----- |`,
            ...familyRollup.map((r) => `| ${r.family} | ${r.brand} | ${r.count} |`),
          ].join('\n'),
      ``,
      `---`,
      ``,
      `## Existing Editorial Usage`,
      ``,
      editorialUsage.length === 0
        ? `_(no watches currently referenced in curated_list_items or collection_path_nodes)_`
        : [
            `| brand | model | reference | table |`,
            `| ----- | ----- | --------- | ----- |`,
            ...editorialUsage.map(
              (r) =>
                `| ${r.brand} | ${r.model} | ${r.reference ?? 'null'} | ${r.usage} |`,
            ),
          ].join('\n'),
      ``,
    ]

    fs.mkdirSync(TASK_DIR, { recursive: true })
    fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf8')

    console.log(`[inventory] Done — wrote ${OUTPUT_FILE}`)
    console.log(
      `[inventory] Catalog size: ${brandAgg.reduce((s, r) => s + r.count, 0)} watches across ${brandAgg.length} brands`,
    )
  } finally {
    await sql.end()
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('[inventory] fatal:', err)
  process.exit(1)
})
