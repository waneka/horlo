/**
 * Phase 11 Migration 2 integration tests — NOTIF-01 acceptance:
 *   1. Recipient-only SELECT RLS on notifications (Pitfall B-4)
 *   2. Self-notification CHECK rejection (Pitfall B-9)
 *   3. Watch-overlap dedup UNIQUE (ON CONFLICT DO NOTHING idempotence — Pitfall B-3)
 *
 * Gated on DATABASE_URL (drizzle) and SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL
 * (for seedTwoUsers) so the suite skips cleanly in CI without the local stack.
 *
 * Wave 0 contract per .planning/phases/11-schema-storage-foundation/11-VALIDATION.md.
 * Green outcomes depend on Plan 05's [BLOCKING] schema push applying Migration 2 locally.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { sql, inArray } from 'drizzle-orm'

import { db } from '@/db'
import { notifications, users } from '@/db/schema'

const hasDrizzle = Boolean(process.env.DATABASE_URL)
const hasSupabaseAdmin =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const maybe = hasDrizzle && hasSupabaseAdmin ? describe : describe.skip

maybe('Phase 11 notifications — NOTIF-01 RLS + CHECK + dedup', () => {
  let userA: { id: string; email: string }
  let userB: { id: string; email: string }
  let cleanup: () => Promise<void>

  beforeAll(async () => {
    const { seedTwoUsers } = await import('../fixtures/users')
    const seed = await seedTwoUsers()
    userA = seed.userA
    userB = seed.userB
    cleanup = seed.cleanup
  }, 30_000)

  afterAll(async () => {
    if (!userA || !userB) return
    // Purge any notifications created by the tests so cleanup() can CASCADE the users.
    await db
      .delete(notifications)
      .where(inArray(notifications.userId, [userA.id, userB.id]))
    await cleanup()
  }, 30_000)

  // -----------------------------------------------------------
  // (1) Recipient-only SELECT RLS
  // -----------------------------------------------------------
  it('recipient can SELECT own notifications; non-recipient cannot (B-4)', async () => {
    // Insert a notification for userA via Drizzle (service-role; bypasses RLS).
    await db.insert(notifications).values({
      userId: userA.id,
      actorId: userB.id, // B follows A — legal per CHECK since actor != user
      type: 'follow',
      payload: {
        actor_username: 'userB',
        actor_display_name: null,
      },
    })

    // User A reads as authenticated — should see the row.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    // Sign in as userA using the admin-created password from seedTwoUsers
    const clientA = createClient(url, anonKey, { auth: { persistSession: false } })
    await clientA.auth.signInWithPassword({ email: userA.email, password: 'test-password-A' })
    const asA = await clientA.from('notifications').select('id, user_id').eq('user_id', userA.id)
    expect(asA.error).toBeNull()
    expect((asA.data ?? []).length).toBeGreaterThanOrEqual(1)

    // User B tries to read user A's notifications — RLS returns 0 rows.
    const clientB = createClient(url, anonKey, { auth: { persistSession: false } })
    await clientB.auth.signInWithPassword({ email: userB.email, password: 'test-password-B' })
    const asB = await clientB.from('notifications').select('id, user_id').eq('user_id', userA.id)
    expect(asB.error).toBeNull()
    expect(asB.data ?? []).toEqual([])
  })

  // -----------------------------------------------------------
  // (2) Self-notification CHECK constraint
  // -----------------------------------------------------------
  it('rejects insert where actor_id equals user_id (B-9)', async () => {
    // Drizzle wraps the PostgreSQL error: e.message = "Failed query: ..."
    // The constraint name is in e.cause.message. Check both levels.
    await expect(
      db.insert(notifications).values({
        userId: userA.id,
        actorId: userA.id, // violates CHECK
        type: 'follow',
        payload: {},
      }),
    ).rejects.toSatisfy((e: unknown) => {
      const err = e as { message?: string; cause?: { message?: string } }
      const text = `${err.message ?? ''} ${err.cause?.message ?? ''}`
      return /notifications_no_self_notification|check constraint/i.test(text)
    })
  })

  // -----------------------------------------------------------
  // (3) Watch-overlap dedup UNIQUE partial index
  // -----------------------------------------------------------
  it('watch-overlap dedup: ON CONFLICT DO NOTHING inserts exactly once per (user, brand, model, day) (B-3)', async () => {
    // Use raw SQL so we can add `ON CONFLICT DO NOTHING` against the partial UNIQUE index.
    // Drizzle's insert().onConflictDoNothing() defaults to the primary key; here we need
    // to hit the named partial UNIQUE index `notifications_watch_overlap_dedup`.
    const payloadLiteral = sql`jsonb_build_object(
      'watch_brand_normalized', 'rolex',
      'watch_model_normalized', 'submariner',
      'watch_brand', 'Rolex',
      'watch_model', 'Submariner',
      'actor_username', 'userB',
      'actor_display_name', NULL
    )`

    // First insert — lands the row.
    await db.execute(sql`
      INSERT INTO notifications (user_id, actor_id, type, payload)
      VALUES (${userA.id}::uuid, ${userB.id}::uuid, 'watch_overlap', ${payloadLiteral})
      ON CONFLICT DO NOTHING
    `)

    // Second insert — identical (user, brand, model, day) — no-op.
    await db.execute(sql`
      INSERT INTO notifications (user_id, actor_id, type, payload)
      VALUES (${userA.id}::uuid, ${userB.id}::uuid, 'watch_overlap', ${payloadLiteral})
      ON CONFLICT DO NOTHING
    `)

    // Count — exactly 1 watch_overlap row for userA with this brand/model today.
    const rows = await db.execute(sql`
      SELECT COUNT(*)::int AS count
        FROM notifications
       WHERE user_id = ${userA.id}::uuid
         AND type = 'watch_overlap'
         AND payload->>'watch_brand_normalized' = 'rolex'
         AND payload->>'watch_model_normalized' = 'submariner'
         AND (created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
    `)
    const count = ((rows as unknown as Array<{ count: number }>) ?? [])[0]?.count
    expect(count).toBe(1)
  })
})
