/**
 * Phase 24 integration test — notification_type enum cleanup (DEBT-04)
 *
 * Verifies the post-migration shape of notification_type and notifications.type column.
 * Runs only against an applied DB (assumes the Phase 24 rename+recreate migration has run).
 *
 * Gated on DATABASE_URL so this stays skipped in CI without the local stack
 * (mirrors the tests/integration/phase11-schema.test.ts pattern).
 *
 * Green after plan 24-02 migration is applied locally via docker exec psql
 * (or via supabase db push --linked against prod per D-05 sequencing).
 */
import { describe, it, expect } from 'vitest'
import { sql } from 'drizzle-orm'

import { db } from '@/db'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 24 — notification_type enum cleanup (DEBT-04)', () => {
  it('notification_type enum has exactly two values: follow, watch_overlap', async () => {
    const rows = await db.execute<{ enumlabel: string }>(sql`
      SELECT enumlabel
        FROM pg_enum
        JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
       WHERE pg_type.typname = 'notification_type'
       ORDER BY enumsortorder
    `)
    const labels = (rows as unknown as Array<{ enumlabel: string }>).map((r) => r.enumlabel)
    expect(labels).toEqual(['follow', 'watch_overlap'])
  })

  it('notifications.type column references the new (not _old) enum', async () => {
    const rows = await db.execute<{ udt_name: string }>(sql`
      SELECT udt_name
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'notifications'
         AND column_name = 'type'
    `)
    const udt = (rows as unknown as Array<{ udt_name: string }>)[0]?.udt_name
    expect(udt).toBe('notification_type')
  })

  it('notification_type_old is gone (drop succeeded)', async () => {
    const rows = await db.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM pg_type WHERE typname = 'notification_type_old'
    `)
    const count = (rows as unknown as Array<{ count: number }>)[0]?.count ?? 0
    expect(count).toBe(0)
  })
})
