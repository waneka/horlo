/**
 * Phase 13 Integration Test: profile_settings migration validation
 * Requirements: NOTIF-04 (notifications_last_seen_at), NOTIF-09 (opt-out columns)
 * Context: D-06, D-16, D-18, 13-CONTEXT.md
 *
 * Gated on DATABASE_URL so the suite skips cleanly in CI without local Supabase.
 * Verifies that the 3 new columns exist in the live DB with correct types, defaults,
 * and NOT NULL constraints (per supabase/migrations/20260425000000_phase13_profile_settings_notifications.sql).
 * Also verifies backfill coverage (Pitfall 2 from 13-RESEARCH.md).
 *
 * These tests can PASS in Plan 01 because the schema push (Task 2) runs before this
 * test file is authored. They are "integration green" intentionally — only unit/component
 * tests remain RED (production code not yet written).
 */
import { describe, it, expect } from 'vitest'
import { sql } from 'drizzle-orm'
import { db } from '@/db'

const hasDrizzle = Boolean(process.env.DATABASE_URL)
const maybe = hasDrizzle ? describe : describe.skip

maybe('Phase 13 profile_settings migration — column verification', () => {
  it('has notifications_last_seen_at timestamptz NOT NULL DEFAULT now()', async () => {
    const rows = await db.execute(sql`
      SELECT data_type, is_nullable, column_default
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'profile_settings'
         AND column_name = 'notifications_last_seen_at'
    `) as unknown as Array<{ data_type: string; is_nullable: string; column_default: string }>
    expect(rows).toHaveLength(1)
    expect(rows[0]?.data_type).toBe('timestamp with time zone')
    expect(rows[0]?.is_nullable).toBe('NO')
    expect(rows[0]?.column_default).toMatch(/now\(\)/)
  })

  it('has notify_on_follow boolean NOT NULL DEFAULT true', async () => {
    const rows = await db.execute(sql`
      SELECT data_type, is_nullable, column_default
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'profile_settings'
         AND column_name = 'notify_on_follow'
    `) as unknown as Array<{ data_type: string; is_nullable: string; column_default: string }>
    expect(rows).toHaveLength(1)
    expect(rows[0]?.data_type).toBe('boolean')
    expect(rows[0]?.is_nullable).toBe('NO')
    expect(rows[0]?.column_default).toBe('true')
  })

  it('has notify_on_watch_overlap boolean NOT NULL DEFAULT true', async () => {
    const rows = await db.execute(sql`
      SELECT data_type, is_nullable, column_default
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'profile_settings'
         AND column_name = 'notify_on_watch_overlap'
    `) as unknown as Array<{ data_type: string; is_nullable: string; column_default: string }>
    expect(rows).toHaveLength(1)
    expect(rows[0]?.data_type).toBe('boolean')
    expect(rows[0]?.is_nullable).toBe('NO')
    expect(rows[0]?.column_default).toBe('true')
  })

  it('backfill coverage: no rows have NULL notifications_last_seen_at (Pitfall 2)', async () => {
    const rows = await db.execute(sql`
      SELECT COUNT(*)::int AS c
        FROM profile_settings
       WHERE notifications_last_seen_at IS NULL
    `) as unknown as Array<{ c: number }>
    expect(rows[0]?.c).toBe(0)
  })

  it('all 3 new columns exist (combined count check)', async () => {
    const rows = await db.execute(sql`
      SELECT COUNT(*)::int AS c
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'profile_settings'
         AND column_name IN ('notifications_last_seen_at', 'notify_on_follow', 'notify_on_watch_overlap')
    `) as unknown as Array<{ c: number }>
    expect(rows[0]?.c).toBe(3)
  })
})
