/**
 * Read-only PROD inventory: list watches_catalog rows missing an image_url.
 *
 * Usage:
 *   PROD_DATABASE_URL=postgresql://... npm run catalog:missing-images
 *
 * Writes scripts/seed-data/catalog-missing-images.md — a markdown table the
 * user fills in by hand with image URLs. The matching update script will key
 * by (brand, model, reference) per project_catalog-id-divergence memory
 * (ids diverge between local and prod; the triple is the stable key).
 *
 * READ-ONLY: no INSERT/UPDATE/DELETE. Idempotent — re-runs overwrite the file.
 *
 * Reads PROD_DATABASE_URL from .env.local via tsx --env-file (see package.json
 * "catalog:missing-images" script). Can also be overridden via shell env.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import postgres from 'postgres'

const OUTPUT_FILE = path.join(
  process.cwd(),
  'scripts/seed-data/catalog-missing-images.md',
)

async function main() {
  const connStr = process.env.PROD_DATABASE_URL
  if (!connStr) {
    console.error(
      '[missing-images] ERROR: PROD_DATABASE_URL is not set.\n' +
        'Run with: PROD_DATABASE_URL=postgresql://... npm run catalog:missing-images',
    )
    process.exit(1)
  }

  console.log('[missing-images] Connecting to prod (read-only)...')
  const sql = postgres(connStr, { max: 1, prepare: false })

  try {
    console.log(
      '[missing-images] Querying catalog rows missing image_url AND with no user-uploaded photos...',
    )
    const rows = await sql<
      {
        brand: string
        model: string
        reference: string | null
        owners_count: number
        wishlist_count: number
      }[]
    >`
      SELECT
        wc.brand,
        wc.model,
        wc.reference,
        coalesce(wc.owners_count, 0)::int   AS owners_count,
        coalesce(wc.wishlist_count, 0)::int AS wishlist_count
      FROM public.watches_catalog wc
      WHERE (wc.image_url IS NULL OR btrim(wc.image_url) = '')
        AND NOT EXISTS (
          SELECT 1
          FROM public.watches w
          JOIN public.watch_photos wp ON wp.watch_id = w.id
          WHERE w.catalog_id = wc.id
        )
      ORDER BY (coalesce(wc.owners_count, 0) + coalesce(wc.wishlist_count, 0)) DESC,
               wc.brand ASC,
               wc.model ASC,
               wc.reference ASC NULLS LAST
    `

    const totalCatalog = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM public.watches_catalog
    `
    const total = totalCatalog[0]?.count ?? 0
    const missing = rows.length
    const pct = total > 0 ? ((missing / total) * 100).toFixed(1) : '0.0'

    console.log(
      `[missing-images] ${missing} of ${total} catalog rows missing image_url (${pct}%)`,
    )

    const now = new Date().toISOString().slice(0, 10)
    const lines: string[] = [
      `# Catalog rows missing image_url`,
      ``,
      `> Generated ${now} by \`npm run catalog:missing-images\` — READ-ONLY, PROD`,
      `> ${missing} of ${total} rows missing an image (${pct}%).`,
      `>`,
      `> Fill the \`image_url\` column with a direct image URL (https, ideally JPG/PNG/WebP).`,
      `> Rows you leave blank will be skipped by the update step. Key for updates is`,
      `> (brand, model, reference) per project_catalog-id-divergence — ids diverge local/prod.`,
      ``,
      `| brand | model | reference | owners | wishlist | image_url |`,
      `| ----- | ----- | --------- | ------ | -------- | --------- |`,
      ...rows.map(
        (r) =>
          `| ${r.brand} | ${r.model} | ${r.reference ?? ''} | ${r.owners_count} | ${r.wishlist_count} |  |`,
      ),
      ``,
    ]

    fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf8')
    console.log(`[missing-images] Wrote ${OUTPUT_FILE}`)
  } finally {
    await sql.end()
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('[missing-images] fatal:', err)
  process.exit(1)
})
