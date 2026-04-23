/**
 * Integration tests for getNotificationsUnreadState (DAL).
 *
 * Created by Plan 13-02. Gated on DATABASE_URL + Supabase env vars to match
 * the existing isolation.test.ts / getFeedForUser.test.ts pattern — skips
 * cleanly in CI without a local Supabase stack.
 *
 * Verifies:
 *   - Returns { hasUnread: false } when no notifications exist
 *   - Returns { hasUnread: true } when a notification exists after last_seen_at
 *   - Returns { hasUnread: false } when all notifications are before last_seen_at
 *   - viewerId is an explicit argument (D-25 — never closures over getCurrentUser)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const hasDrizzle = Boolean(process.env.DATABASE_URL)
const hasSupabaseAdmin =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const maybe = hasDrizzle && hasSupabaseAdmin ? describe : describe.skip

maybe('getNotificationsUnreadState — DAL integration', () => {
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

  it('returns { hasUnread: false } when no notifications exist for viewer', async () => {
    const { getNotificationsUnreadState } = await import('@/data/notifications')
    const result = await getNotificationsUnreadState(userA.id)
    expect(result).toEqual({ hasUnread: false })
  })

  it('returns { hasUnread: true } after a new notification is inserted', async () => {
    const { db } = await import('@/db')
    const { notifications } = await import('@/db/schema')
    const { sql } = await import('drizzle-orm')

    // Insert a follow notification for userA from userB
    await db.insert(notifications).values({
      userId: userA.id,
      actorId: userB.id,
      type: 'follow',
      payload: { actor_username: 'userb', actor_display_name: null },
    })

    const { getNotificationsUnreadState } = await import('@/data/notifications')
    const result = await getNotificationsUnreadState(userA.id)
    expect(result).toEqual({ hasUnread: true })
  })

  it('returns hasUnread: false after touchLastSeenAt updates the seen timestamp', async () => {
    const { touchLastSeenAt, getNotificationsUnreadState } = await import('@/data/notifications')

    // Update last_seen_at to now (clears unread dot)
    await touchLastSeenAt(userA.id)

    const result = await getNotificationsUnreadState(userA.id)
    expect(result).toEqual({ hasUnread: false })
  })
})
