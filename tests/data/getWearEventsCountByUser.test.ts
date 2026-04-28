/**
 * Integration tests for getWearEventsCountByUser (DAL).
 *
 * Phase 18 Plan 01 Task 1 — hero gate count helper for /explore (DISC-03).
 * Gated on DATABASE_URL + Supabase admin env vars to match Phase 17 / Phase 16
 * precedent. Skips cleanly in CI without a local Supabase stack.
 *
 * Verifies:
 *   - Returns 0 for a user with no wear events
 *   - Returns the correct count when wear events exist
 *   - Returns 0 for a different user (no cross-user count leak — T-18-01-04)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'

const hasDrizzle = Boolean(process.env.DATABASE_URL)
const hasSupabaseAdmin =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const maybe = hasDrizzle && hasSupabaseAdmin ? describe : describe.skip

maybe('getWearEventsCountByUser — DAL integration', () => {
  let userA: { id: string; email: string }
  let userB: { id: string; email: string }
  let watchAId: string
  let watchBId: string
  let cleanup: () => Promise<void>

  beforeAll(async () => {
    const { seedTwoUsers } = await import('../fixtures/users')
    const seed = await seedTwoUsers()
    userA = seed.userA
    userB = seed.userB
    cleanup = seed.cleanup

    // Seed a watch per user so we can insert wear events with valid FK targets.
    const { db } = await import('@/db')
    const { watches } = await import('@/db/schema')
    watchAId = randomUUID()
    watchBId = randomUUID()
    await db.insert(watches).values([
      {
        id: watchAId,
        userId: userA.id,
        brand: 'Rolex',
        model: 'Submariner',
        status: 'owned',
        movement: 'automatic',
      },
      {
        id: watchBId,
        userId: userB.id,
        brand: 'Tudor',
        model: 'Black Bay',
        status: 'owned',
        movement: 'automatic',
      },
    ])
  }, 30_000)

  afterAll(async () => {
    if (!userA || !userB) return
    const { db } = await import('@/db')
    const { wearEvents, watches } = await import('@/db/schema')
    const { inArray } = await import('drizzle-orm')
    await db
      .delete(wearEvents)
      .where(inArray(wearEvents.userId, [userA.id, userB.id]))
    await db
      .delete(watches)
      .where(inArray(watches.userId, [userA.id, userB.id]))
    await cleanup()
  }, 30_000)

  beforeEach(async () => {
    const { db } = await import('@/db')
    const { wearEvents } = await import('@/db/schema')
    const { inArray } = await import('drizzle-orm')
    await db
      .delete(wearEvents)
      .where(inArray(wearEvents.userId, [userA.id, userB.id]))
  })

  it('returns 0 for a user with no wear events', async () => {
    const { getWearEventsCountByUser } = await import('@/data/wearEvents')
    const result = await getWearEventsCountByUser(userA.id)
    expect(result).toBe(0)
  })

  it('returns the correct count when wear events exist', async () => {
    const { db } = await import('@/db')
    const { wearEvents } = await import('@/db/schema')
    await db.insert(wearEvents).values([
      { userId: userA.id, watchId: watchAId, wornDate: '2026-04-01' },
      { userId: userA.id, watchId: watchAId, wornDate: '2026-04-02' },
      { userId: userA.id, watchId: watchAId, wornDate: '2026-04-03' },
    ])

    const { getWearEventsCountByUser } = await import('@/data/wearEvents')
    const result = await getWearEventsCountByUser(userA.id)
    expect(result).toBe(3)
  })

  it('returns 0 for a different user (no cross-user count leak — T-18-01-04)', async () => {
    const { db } = await import('@/db')
    const { wearEvents } = await import('@/db/schema')
    // Insert 3 wear events for userA only.
    await db.insert(wearEvents).values([
      { userId: userA.id, watchId: watchAId, wornDate: '2026-04-01' },
      { userId: userA.id, watchId: watchAId, wornDate: '2026-04-02' },
      { userId: userA.id, watchId: watchAId, wornDate: '2026-04-03' },
    ])

    const { getWearEventsCountByUser } = await import('@/data/wearEvents')
    // userB query MUST return 0 — no leak from userA's events.
    const result = await getWearEventsCountByUser(userB.id)
    expect(result).toBe(0)
  })
})
