/**
 * Phase 17 — local mirror of pg_cron daily refresh (CAT-10, D-16).
 * Usage: npm run db:refresh-counts
 *
 * Calls public.refresh_watches_catalog_counts() — same function pg_cron calls in prod.
 * Recomputes owners_count + wishlist_count on watches_catalog AND writes a snapshot
 * row in watches_catalog_daily_snapshots (idempotent on (catalog_id, snapshot_date)).
 *
 * Service-role-only EXECUTE: this script reads DATABASE_URL (service-role pooler).
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

// Use relative import — tsx does not resolve @/* path aliases.
import { db } from '../src/db'
import { sql } from 'drizzle-orm'

async function main() {
  const startedAt = Date.now()
  await db.execute(sql`SELECT public.refresh_watches_catalog_counts()`)
  const elapsedMs = Date.now() - startedAt
  console.log(`[refresh-counts] OK -- counts refreshed and snapshot row written, elapsed: ${elapsedMs}ms`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[refresh-counts] fatal:', err)
  process.exit(1)
})
