/**
 * Phase 27 backfill — per-user ROW_NUMBER ranking (WISH-01).
 *
 * Wave 0 RED scaffold. Plan 02 ships the drizzle/supabase migration whose
 * backfill assigns sort_order = row_number() PARTITION BY user_id ORDER BY
 * created_at DESC. Each user's wishlist+grail set should land 0..N with no
 * duplicates; newest createdAt should get sort_order = 0.
 *
 * Seeds 2 users × 3 wishlist watches with explicit createdAt (1ms apart).
 * Reads back via Drizzle and asserts shape.
 *
 * Gated on DATABASE_URL.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql, eq, and, asc, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/db'
import { users, watches } from '@/db/schema'

const maybe = process.env.DATABASE_URL ? describe : describe.skip
const STAMP = `p27bf${Date.now().toString(36)}`

maybe(`Phase 27 backfill — sort_order ROW_NUMBER ranking per user (WISH-01) [${STAMP}]`, () => {
  const userIdA = randomUUID()
  const userIdB = randomUUID()
  const seededUserIds = [userIdA, userIdB]
  const seededWatchIds: string[] = []

  // createdAt timestamps 1ms apart so ordering is deterministic.
  // Per-user: oldest = base, middle = base+1ms, newest = base+2ms
  // → after backfill, newest createdAt should land sort_order = 0.
  const baseTime = Date.now()

  beforeAll(async () => {
    await db
      .insert(users)
      .values([
        { id: userIdA, email: `${STAMP}-a@horlo.test` },
        { id: userIdB, email: `${STAMP}-b@horlo.test` },
      ])
      .onConflictDoNothing()

    // Seed 3 wishlist watches per user with distinct createdAt.
    for (const uid of seededUserIds) {
      for (let i = 0; i < 3; i++) {
        const id = randomUUID()
        seededWatchIds.push(id)
        await db.insert(watches).values({
          id,
          userId: uid,
          brand: `${STAMP}-Brand-${i}`,
          model: `Model-${i}`,
          status: 'wishlist',
          movement: 'automatic',
          complications: [],
          styleTags: [],
          designTraits: [],
          roleTags: [],
          createdAt: new Date(baseTime + i),
          updatedAt: new Date(baseTime + i),
        })
      }
    }
  }, 30_000)

  afterAll(async () => {
    if (seededWatchIds.length > 0) {
      await db.delete(watches).where(inArray(watches.id, seededWatchIds))
    }
    await db.delete(users).where(inArray(users.id, seededUserIds))
  }, 30_000)

  it('per-user backfill: sort_order is 0..N in createdAt DESC order, no cross-user collision', async () => {
    const rowsA = await db
      .select({
        id: watches.id,
        sortOrder: watches.sortOrder,
        createdAt: watches.createdAt,
      })
      .from(watches)
      .where(
        and(
          eq(watches.userId, userIdA),
          inArray(watches.status, ['wishlist', 'grail']),
        ),
      )
      .orderBy(asc(watches.sortOrder))

    expect(rowsA.map((r) => r.sortOrder)).toEqual([0, 1, 2])

    // Newest createdAt should land at sort_order = 0.
    const sortedByDate = [...rowsA].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    expect(sortedByDate[0].sortOrder).toBe(0)

    // user B should also land 0..2 independently.
    const rowsB = await db
      .select({ sortOrder: watches.sortOrder })
      .from(watches)
      .where(
        and(
          eq(watches.userId, userIdB),
          inArray(watches.status, ['wishlist', 'grail']),
        ),
      )
      .orderBy(asc(watches.sortOrder))
    expect(rowsB.map((r) => r.sortOrder)).toEqual([0, 1, 2])
  })

  it('no duplicate (user_id, sort_order) tuples in wishlist+grail post-backfill', async () => {
    // Mirrors the supabase migration's own DO $$ assertion at the test level.
    // PARTITION BY user_id ORDER BY created_at DESC should never produce ties.
    const result = await db.execute(sql`
      SELECT user_id, sort_order, count(*) c
        FROM watches
       WHERE status IN ('wishlist', 'grail')
       GROUP BY user_id, sort_order
       HAVING count(*) > 1
    `)
    const rows = (result as unknown as Array<{ user_id: string; sort_order: number; c: number }>) ?? []
    expect(rows).toHaveLength(0)
  })
})
