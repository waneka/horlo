/**
 * Phase 24 — DEBT-03 layer-1 preflight assertion.
 * Usage: npm run db:preflight-notification-cleanup
 *
 * Standalone pre-migration guard for the Phase 24 notification_type ENUM
 * rename+recreate (DEBT-04). Asserts zero rows in `notifications` reference a
 * type value outside the new whitelist {follow, watch_overlap}.
 *
 * Whitelist phrasing (D-01 reconciled per 24-RESEARCH.md A6): the predicate is
 * `type::text NOT IN ('follow','watch_overlap')` — whitelist over blacklist —
 * so any unexpected/corrupt values are also caught (Pitfall 2).
 *
 * Defense-in-depth: this script is layer 1 (CI-time gate). The migration's
 * in-migration `DO $$ ... RAISE EXCEPTION` block (plan 24-02) is layer 2 (last
 * line of defense at apply time). Per 24-CONTEXT.md D-01.
 *
 * Sequencing (24-CONTEXT.md D-05): run this BEFORE applying the migration via
 * `supabase db push --linked`. Exit 0 = safe to apply; exit 1 = remediate
 * (delete stub rows or pause).
 */
// Use relative import — tsx does not resolve @/* path aliases (Pitfall 7).
import { db } from '../src/db'
import { sql } from 'drizzle-orm'

async function main() {
  const result = await db.execute<{ c: number }>(sql`
    SELECT count(*)::int AS c
      FROM notifications
     WHERE type::text NOT IN ('follow', 'watch_overlap')
  `)
  const count = (result as unknown as Array<{ c: number }>)[0]?.c ?? 0

  if (count !== 0) {
    console.error(`[preflight] FAILED — ${count} notification rows have type values outside the new whitelist {follow, watch_overlap}.`)
    process.exit(1)
  }

  console.log('[preflight] OK — zero out-of-whitelist notification.type rows. Safe to apply migration.')
  process.exit(0)
}

main().catch((err) => {
  console.error('[preflight] fatal:', err)
  process.exit(1)
})
