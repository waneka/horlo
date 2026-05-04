/**
 * Phase 27 bulkReorderWishlist owner-only enforcement (WISH-01 D-10).
 *
 * Wave 0 RED scaffold. Plan 02 ships `bulkReorderWishlist(userId, orderedIds)`
 * in src/data/watches.ts. The DAL helper:
 *   - WHERE clause restricts to user_id + status IN ('wishlist','grail')
 *   - throws "Owner mismatch" if .returning() count != orderedIds.length
 *
 * This test seeds two users with wishlist+owned watches and exercises:
 *   (a) happy path — array index becomes sort_order
 *   (b) foreign id from another user → throws Owner mismatch
 *   (c) own owned-status id mixed in → throws Owner mismatch (status filter excludes)
 *
 * Gated on DATABASE_URL. Import resolves at type level today (TS-erased);
 * runtime call will fail until Plan 02 exports bulkReorderWishlist.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, and, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/db'
import { users, watches } from '@/db/schema'
import { bulkReorderWishlist } from '@/data/watches'

const maybe = process.env.DATABASE_URL ? describe : describe.skip
const STAMP = `p27br${Date.now().toString(36)}`

maybe(`Phase 27 — bulkReorderWishlist owner-only enforcement (WISH-01 D-10) [${STAMP}]`, () => {
  const userIdA = randomUUID()
  const userIdB = randomUUID()
  const seededUserIds = [userIdA, userIdB]

  const a1 = randomUUID()
  const a2 = randomUUID()
  const a3 = randomUUID()
  const aOwned = randomUUID()
  const b1 = randomUUID()
  const seededWatchIds = [a1, a2, a3, aOwned, b1]

  beforeAll(async () => {
    await db
      .insert(users)
      .values([
        { id: userIdA, email: `${STAMP}-a@horlo.test` },
        { id: userIdB, email: `${STAMP}-b@horlo.test` },
      ])
      .onConflictDoNothing()

    // userA: 3 wishlist + 1 owned
    for (const [id, status] of [
      [a1, 'wishlist'],
      [a2, 'wishlist'],
      [a3, 'wishlist'],
      [aOwned, 'owned'],
    ] as const) {
      await db.insert(watches).values({
        id,
        userId: userIdA,
        brand: `${STAMP}-A`,
        model: `Model-${id.slice(0, 4)}`,
        status,
        movement: 'automatic',
        complications: [],
        styleTags: [],
        designTraits: [],
        roleTags: [],
      })
    }
    // userB: 1 wishlist
    await db.insert(watches).values({
      id: b1,
      userId: userIdB,
      brand: `${STAMP}-B`,
      model: 'Model-B',
      status: 'wishlist',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
    })
  }, 30_000)

  afterAll(async () => {
    if (seededWatchIds.length > 0) {
      await db.delete(watches).where(inArray(watches.id, seededWatchIds))
    }
    await db.delete(users).where(inArray(users.id, seededUserIds))
  }, 30_000)

  it('happy path — bulkReorderWishlist(userA, [a1,a2,a3]) sets sort_order to [0,1,2] on the named ids', async () => {
    await bulkReorderWishlist(userIdA, [a1, a2, a3])
    const rows = await db
      .select({ id: watches.id, sortOrder: watches.sortOrder })
      .from(watches)
      .where(inArray(watches.id, [a1, a2, a3]))
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.sortOrder]))
    expect(byId[a1]).toBe(0)
    expect(byId[a2]).toBe(1)
    expect(byId[a3]).toBe(2)
  })

  it('rejects with Owner mismatch when payload includes another user\'s watch id', async () => {
    await expect(
      bulkReorderWishlist(userIdA, [a1, b1, a2]),
    ).rejects.toThrow(/Owner mismatch/)
  })

  it('rejects with Owner mismatch when payload includes the user\'s own owned-status watch (status filter excludes owned)', async () => {
    await expect(
      bulkReorderWishlist(userIdA, [a1, aOwned, a2]),
    ).rejects.toThrow(/Owner mismatch/)
  })
})
