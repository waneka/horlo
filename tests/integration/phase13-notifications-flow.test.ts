/**
 * Phase 13 Integration Tests: E2E notification flow against local Supabase
 * Requirements: NOTIF-02, NOTIF-03, NOTIF-06, NOTIF-09
 * Context: D-18, D-22, D-23, D-24, D-27, D-28
 *
 * Gated on DATABASE_URL + NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY so
 * the suite skips cleanly in CI without local Supabase. Mirrors the pattern from
 * tests/integration/phase11-notifications-rls.test.ts.
 *
 * These tests INTENTIONALLY FAIL until Plans 02-03 ship production code:
 *   - followUser in src/app/actions/follows.ts must call logNotification (NOTIF-02)
 *   - addWatch in src/app/actions/watches.ts must call logNotification (NOTIF-03)
 *   - markAllNotificationsRead in src/app/actions/notifications.ts (NOTIF-06)
 *   - getNotificationsForViewer in src/data/notifications.ts
 *   - touchLastSeenAt in src/data/notifications.ts
 *   - logNotification in src/lib/notifications/logger.ts
 *
 * The failure mode is "Cannot find module" or "is not a function" — RED state.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql, inArray } from 'drizzle-orm'

import { db } from '@/db'
import { notifications, profileSettings } from '@/db/schema'

// These imports reference modules that DO NOT YET EXIST in Plans 02-03.
// They are the RED imports that drive implementation.
import { followUser } from '@/app/actions/follows'
import { addWatch } from '@/app/actions/watches'
import { markAllNotificationsRead } from '@/app/actions/notifications'

const hasDrizzle = Boolean(process.env.DATABASE_URL)
const hasSupabaseAdmin =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const maybe = hasDrizzle && hasSupabaseAdmin ? describe : describe.skip

maybe('Phase 13 notifications — E2E flow (NOTIF-02, NOTIF-03, NOTIF-06, NOTIF-09)', () => {
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
    // Purge notifications so cleanup() can CASCADE the users.
    await db
      .delete(notifications)
      .where(inArray(notifications.userId, [userA.id, userB.id]))
    await cleanup()
  }, 30_000)

  // -----------------------------------------------------------
  // NOTIF-02: followUser triggers notification for recipient
  // -----------------------------------------------------------
  it('followUser inserts a follow notification for the recipient when notify_on_follow = true (NOTIF-02)', async () => {
    // Ensure userB has notify_on_follow = true (default)
    await db
      .insert(profileSettings)
      .values({ userId: userB.id, notifyOnFollow: true, notifyOnWatchOverlap: true })
      .onConflictDoUpdate({
        target: profileSettings.userId,
        set: { notifyOnFollow: true },
      })

    // Sign in as userA (the actor) and follow userB (the recipient)
    // NOTE: followUser is a Server Action that reads auth from cookies/session.
    // In this integration test, we call it directly as if server-side.
    // Plans 02-03 will wire the auth context.
    await followUser({ userId: userB.id })

    const rows = await db.execute(sql`
      SELECT COUNT(*)::int AS c
        FROM notifications
       WHERE user_id = ${userB.id}::uuid
         AND actor_id = ${userA.id}::uuid
         AND type = 'follow'
    `) as unknown as Array<{ c: number }>
    expect(rows[0]?.c).toBeGreaterThanOrEqual(1)
  })

  // -----------------------------------------------------------
  // NOTIF-09: opt-out respected at write time
  // -----------------------------------------------------------
  it('followUser does NOT insert notification when target has notify_on_follow = false (NOTIF-09)', async () => {
    // Set userB opt-out off
    await db
      .insert(profileSettings)
      .values({ userId: userB.id, notifyOnFollow: false, notifyOnWatchOverlap: true })
      .onConflictDoUpdate({
        target: profileSettings.userId,
        set: { notifyOnFollow: false },
      })

    const countBefore = await db.execute(sql`
      SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = ${userB.id}::uuid AND type = 'follow'
    `) as unknown as Array<{ c: number }>

    await followUser({ userId: userB.id })

    const countAfter = await db.execute(sql`
      SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = ${userB.id}::uuid AND type = 'follow'
    `) as unknown as Array<{ c: number }>

    // Count must not have increased
    expect(countAfter[0]?.c).toBe(countBefore[0]?.c)

    // Restore opt-in for subsequent tests
    await db
      .insert(profileSettings)
      .values({ userId: userB.id, notifyOnFollow: true, notifyOnWatchOverlap: true })
      .onConflictDoUpdate({
        target: profileSettings.userId,
        set: { notifyOnFollow: true },
      })
  })

  // -----------------------------------------------------------
  // NOTIF-03: addWatch triggers watch_overlap for matching owner
  // -----------------------------------------------------------
  it('addWatch inserts watch_overlap notification for pre-existing owner of same normalized brand/model (NOTIF-03, D-22)', async () => {
    // Seed: userA already owns a Rolex Submariner in the DB
    // When userB adds the same watch, userA gets a watch_overlap notification
    await db.execute(sql`
      INSERT INTO watches (id, user_id, brand, model, status, movement, complications, style_tags, design_traits, role_tags, updated_at)
      VALUES (
        gen_random_uuid(),
        ${userA.id}::uuid,
        'Rolex',
        'Submariner',
        'owned',
        'automatic',
        '{}',
        '{}',
        '{}',
        '{}',
        now()
      )
      ON CONFLICT DO NOTHING
    `)

    // userB adds the same watch → should trigger watch_overlap notification for userA
    await addWatch({
      brand: 'Rolex',
      model: 'Submariner',
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
    })

    const rows = await db.execute(sql`
      SELECT COUNT(*)::int AS c
        FROM notifications
       WHERE user_id = ${userA.id}::uuid
         AND actor_id = ${userB.id}::uuid
         AND type = 'watch_overlap'
         AND payload->>'watch_brand_normalized' = 'rolex'
         AND payload->>'watch_model_normalized' = 'submariner'
    `) as unknown as Array<{ c: number }>
    expect(rows[0]?.c).toBeGreaterThanOrEqual(1)
  })

  it('addWatch does NOT insert watch_overlap notification for self (D-23 self-exclusion)', async () => {
    // When userA adds a watch that userA already owns, no self-notification should fire
    const countBefore = await db.execute(sql`
      SELECT COUNT(*)::int AS c
        FROM notifications
       WHERE user_id = ${userA.id}::uuid AND actor_id = ${userA.id}::uuid
    `) as unknown as Array<{ c: number }>

    // userA adds the same watch again (as themselves)
    await addWatch({
      brand: 'Rolex',
      model: 'Submariner',
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
    })

    const countAfter = await db.execute(sql`
      SELECT COUNT(*)::int AS c
        FROM notifications
       WHERE user_id = ${userA.id}::uuid AND actor_id = ${userA.id}::uuid
    `) as unknown as Array<{ c: number }>

    // DB CHECK constraint + D-24 logger guard both prevent self-notifications
    expect(countAfter[0]?.c).toBe(countBefore[0]?.c)
  })

  it('adding same watch twice same UTC day does NOT create second overlap row (dedup partial UNIQUE)', async () => {
    // Ensure userA has watch_overlap opt-in
    await db
      .insert(profileSettings)
      .values({ userId: userA.id, notifyOnFollow: true, notifyOnWatchOverlap: true })
      .onConflictDoUpdate({
        target: profileSettings.userId,
        set: { notifyOnWatchOverlap: true },
      })

    // First add (already done in previous test, or re-do)
    await addWatch({
      brand: 'Omega',
      model: 'Speedmaster',
      status: 'owned',
      movement: 'manual',
      complications: ['chronograph'],
      styleTags: [],
      designTraits: [],
      roleTags: [],
    })

    // Second add — same brand/model same day → ON CONFLICT DO NOTHING
    await addWatch({
      brand: 'Omega',
      model: 'Speedmaster',
      status: 'owned',
      movement: 'manual',
      complications: ['chronograph'],
      styleTags: [],
      designTraits: [],
      roleTags: [],
    })

    const rows = await db.execute(sql`
      SELECT COUNT(*)::int AS c
        FROM notifications
       WHERE user_id = ${userA.id}::uuid
         AND actor_id = ${userB.id}::uuid
         AND type = 'watch_overlap'
         AND payload->>'watch_brand_normalized' = 'omega'
         AND payload->>'watch_model_normalized' = 'speedmaster'
         AND (created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
    `) as unknown as Array<{ c: number }>
    // Dedup UNIQUE index ensures at most 1 row per (recipient, brand, model, day)
    expect(rows[0]?.c).toBeLessThanOrEqual(1)
  })

  // -----------------------------------------------------------
  // NOTIF-06: markAllNotificationsRead
  // -----------------------------------------------------------
  it('markAllNotificationsRead sets read_at on caller unread rows only (NOTIF-06)', async () => {
    // Insert a notification for userA (unread)
    await db.insert(notifications).values({
      userId: userA.id,
      actorId: userB.id,
      type: 'follow',
      payload: { actor_username: 'userB', actor_display_name: null },
      readAt: null,
    })

    // markAllNotificationsRead as userA (auth context provided by Server Action)
    const result = await markAllNotificationsRead()

    expect(result.success).toBe(true)

    // All userA unread rows should now have read_at set
    const unread = await db.execute(sql`
      SELECT COUNT(*)::int AS c
        FROM notifications
       WHERE user_id = ${userA.id}::uuid
         AND read_at IS NULL
    `) as unknown as Array<{ c: number }>
    expect(unread[0]?.c).toBe(0)

    // userB rows must NOT be touched
    const userBUnread = await db.execute(sql`
      SELECT COUNT(*)::int AS c
        FROM notifications
       WHERE user_id = ${userB.id}::uuid
         AND read_at IS NULL
    `) as unknown as Array<{ c: number }>
    // userB's rows are unaffected (we didn't insert any for them in this test)
    expect(userBUnread[0]?.c).toBe(0)
  })
})
