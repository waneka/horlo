/**
 * Phase 17 backfill script — CAT-05, D-14.
 * Usage: npm run db:backfill-catalog
 *
 * Links existing per-user `watches` rows to `watches_catalog`. Idempotent — re-runs after
 * success are no-ops because the WHERE catalog_id IS NULL filter shrinks to empty.
 *
 * Uses service-role DATABASE_URL via the existing src/db client. NEVER use the anon client.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

// Use relative imports — tsx does not resolve @/* path aliases.
import { db } from '../src/db'
import { watches } from '../src/db/schema'
import { sql } from 'drizzle-orm'

const BATCH_SIZE = 100

async function main() {
  let totalLinked = 0
  let pass = 0
  const startedAt = Date.now()

  while (true) {
    pass++
    const rows = await db.select({
      id: watches.id,
      brand: watches.brand,
      model: watches.model,
      reference: watches.reference,
    }).from(watches).where(sql`catalog_id IS NULL`).limit(BATCH_SIZE)

    if (rows.length === 0) break

    for (const row of rows) {
      // Inline the upsert+link as a single CTE for atomicity per row.
      // ON CONFLICT target: watches_catalog_natural_key (UNIQUE index promoted to constraint).
      await db.execute(sql`
        WITH ins AS (
          INSERT INTO watches_catalog (brand, model, reference, source)
          VALUES (${row.brand}, ${row.model}, ${row.reference}, 'user_promoted')
          ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO NOTHING
          RETURNING id
        ),
        existing AS (
          SELECT id FROM watches_catalog
           WHERE brand_normalized = lower(trim(${row.brand}))
             AND model_normalized = lower(trim(${row.model}))
             AND reference_normalized IS NOT DISTINCT FROM (
               CASE WHEN ${row.reference}::text IS NULL THEN NULL
                    ELSE regexp_replace(lower(trim(${row.reference}::text)), '[^a-z0-9]+', '', 'g')
               END
             )
        )
        UPDATE watches SET catalog_id = COALESCE(
          (SELECT id FROM ins LIMIT 1),
          (SELECT id FROM existing LIMIT 1)
        )
        WHERE id = ${row.id}
      `)
      totalLinked++
    }

    console.log(`[backfill] pass ${pass}: linked ${rows.length} (cumulative ${totalLinked})`)
  }

  // CAT-05 final assertion — zero unlinked. Pitfall 1 mitigation: fail LOUDLY with per-row dump.
  const remaining = await db.execute<{ c: number }>(sql`
    SELECT count(*)::int AS c FROM watches WHERE catalog_id IS NULL
  `)
  const count = (remaining as unknown as Array<{ c: number }>)[0]?.c ?? 0

  if (count !== 0) {
    const unlinked = await db.select({
      id: watches.id, brand: watches.brand, model: watches.model, reference: watches.reference,
    }).from(watches).where(sql`catalog_id IS NULL`)
    console.error(`[backfill] FAILED — ${count} watches unlinked:`)
    console.table(unlinked)
    process.exit(1)
  }

  const elapsedMs = Date.now() - startedAt
  console.log(`[backfill] OK — total linked: ${totalLinked}, unlinked remaining: 0, elapsed: ${elapsedMs}ms`)
  // postgres.js keeps the connection pool alive; force clean exit so the process terminates.
  process.exit(0)
}

main().catch((err) => {
  console.error('[backfill] fatal:', err)
  process.exit(1)
})
