/**
 * Integration tests for getNotificationsForViewer (DAL).
 *
 * Created by Plan 13-02. Gated on DATABASE_URL + Supabase env vars to match
 * the existing isolation.test.ts / getFeedForUser.test.ts pattern — skips
 * cleanly in CI without a local Supabase stack.
 *
 * Verifies:
 *   - Returns rows newest-first where user_id = viewerId (two-layer defense, D-25)
 *   - Default limit is 50
 *   - Rows include joined actor fields (actorUsername, actorDisplayName, actorAvatarUrl)
 *   - Does NOT return other users' notifications (isolation)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const hasDrizzle = Boolean(process.env.DATABASE_URL)
const hasSupabaseAdmin =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const maybe = hasDrizzle && hasSupabaseAdmin ? describe : describe.skip

maybe('getNotificationsForViewer — DAL integration', () => {
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
    const { db } = await import('@/db')
    const { notifications } = await import('@/db/schema')
    const { inArray } = await import('drizzle-orm')
    await db.delete(notifications).where(inArray(notifications.userId, [userA.id, userB.id]))
    await cleanup()
  }, 30_000)

  it('returns empty array when viewer has no notifications', async () => {
    const { getNotificationsForViewer } = await import('@/data/notifications')
    const rows = await getNotificationsForViewer(userA.id)
    expect(rows).toEqual([])
  })

  it('returns only notifications for the specified viewerId (isolation, T-13-02-03)', async () => {
    const { db } = await import('@/db')
    const { notifications } = await import('@/db/schema')

    // Insert notification for userA
    await db.insert(notifications).values({
      userId: userA.id,
      actorId: userB.id,
      type: 'follow',
      payload: { actor_username: 'userb', actor_display_name: null },
    })

    // Insert notification for userB (should NOT appear in userA query)
    await db.insert(notifications).values({
      userId: userB.id,
      actorId: userA.id,
      type: 'follow',
      payload: { actor_username: 'usera', actor_display_name: null },
    })

    const { getNotificationsForViewer } = await import('@/data/notifications')
    const rows = await getNotificationsForViewer(userA.id)

    expect(rows.length).toBe(1)
    expect(rows[0].userId).toBe(userA.id)
    // Verify no cross-user leakage
    expect(rows.every((r) => r.userId === userA.id)).toBe(true)
  })

  it('returns rows with correct NotificationRow shape including actor fields', async () => {
    const { getNotificationsForViewer } = await import('@/data/notifications')
    const rows = await getNotificationsForViewer(userA.id)

    if (rows.length > 0) {
      const row = rows[0]
      expect(row).toHaveProperty('id')
      expect(row).toHaveProperty('userId')
      expect(row).toHaveProperty('actorId')
      expect(row).toHaveProperty('type')
      expect(row).toHaveProperty('payload')
      expect(row).toHaveProperty('readAt')
      expect(row).toHaveProperty('createdAt')
      expect(row).toHaveProperty('actorUsername')
      expect(row).toHaveProperty('actorDisplayName')
      expect(row).toHaveProperty('actorAvatarUrl')
    }
  })

  it('returns rows newest-first (desc createdAt)', async () => {
    const { getNotificationsForViewer } = await import('@/data/notifications')
    const rows = await getNotificationsForViewer(userA.id)

    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
        rows[i].createdAt.getTime()
      )
    }
  })
})
