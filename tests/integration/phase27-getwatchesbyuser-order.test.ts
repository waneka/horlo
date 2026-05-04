/**
 * Phase 27 — getWatchesByUser ORDER BY sort_order ASC, created_at DESC (WISH-01).
 *
 * Wave 0 RED scaffold. Plan 02 modifies `getWatchesByUser` in src/data/watches.ts
 * to add `.orderBy(asc(watches.sortOrder), desc(watches.createdAt))`. Today the
 * function returns rows in arbitrary order; after Plan 02 ships, both tests pass.
 *
 * Test 1: 3 wishlist watches with explicit sort_order [2,0,1] and distinct
 * createdAt → returned filtered to wishlist sorts ascending [0,1,2].
 * Test 2: 2 wishlist watches share sort_order=0 with distinct createdAt →
 * newest createdAt sorts first (createdAt DESC tiebreaker).
 *
 * Gated on DATABASE_URL.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/db'
import { users, watches } from '@/db/schema'
import { getWatchesByUser } from '@/data/watches'

const maybe = process.env.DATABASE_URL ? describe : describe.skip
const STAMP = `p27od${Date.now().toString(36)}`

maybe(`Phase 27 — getWatchesByUser ORDER BY sort_order ASC, createdAt DESC (WISH-01) [${STAMP}]`, () => {
  const userId = randomUUID()
  const seededUserIds = [userId]

  // Test 1 ids — three watches with explicit sort_order [2, 0, 1]
  const t1a = randomUUID() // sortOrder 2
  const t1b = randomUUID() // sortOrder 0
  const t1c = randomUUID() // sortOrder 1

  // Test 2 ids — two watches sharing sortOrder=0; newest createdAt should sort first
  // Different user to keep the two tests' assertions independent.
  const userId2 = randomUUID()
  seededUserIds.push(userId2)
  const t2Old = randomUUID()  // older createdAt
  const t2New = randomUUID()  // newer createdAt

  const seededWatchIds = [t1a, t1b, t1c, t2Old, t2New]

  const baseTime = Date.now()

  beforeAll(async () => {
    await db
      .insert(users)
      .values([
        { id: userId, email: `${STAMP}-1@horlo.test` },
        { id: userId2, email: `${STAMP}-2@horlo.test` },
      ])
      .onConflictDoNothing()

    // Test 1 seed — three wishlist watches, explicit sortOrder, distinct createdAt.
    // Plan 02 maps domain sortOrder → row sort_order via mapDomainToRow extension.
    // For now, rely on sortOrder column existing post-migration; pass it as a row field.
    // Use raw insert via Drizzle's values with sortOrder column from schema.
    await db.insert(watches).values([
      {
        id: t1a,
        userId,
        brand: `${STAMP}`,
        model: 'A',
        status: 'wishlist',
        movement: 'automatic',
        complications: [],
        styleTags: [],
        designTraits: [],
        roleTags: [],
        sortOrder: 2,
        createdAt: new Date(baseTime),
        updatedAt: new Date(baseTime),
      },
      {
        id: t1b,
        userId,
        brand: `${STAMP}`,
        model: 'B',
        status: 'wishlist',
        movement: 'automatic',
        complications: [],
        styleTags: [],
        designTraits: [],
        roleTags: [],
        sortOrder: 0,
        createdAt: new Date(baseTime + 1),
        updatedAt: new Date(baseTime + 1),
      },
      {
        id: t1c,
        userId,
        brand: `${STAMP}`,
        model: 'C',
        status: 'wishlist',
        movement: 'automatic',
        complications: [],
        styleTags: [],
        designTraits: [],
        roleTags: [],
        sortOrder: 1,
        createdAt: new Date(baseTime + 2),
        updatedAt: new Date(baseTime + 2),
      },
    ])

    // Test 2 seed — two wishlist watches sharing sortOrder=0, distinct createdAt.
    await db.insert(watches).values([
      {
        id: t2Old,
        userId: userId2,
        brand: `${STAMP}-tie`,
        model: 'OLD',
        status: 'wishlist',
        movement: 'automatic',
        complications: [],
        styleTags: [],
        designTraits: [],
        roleTags: [],
        sortOrder: 0,
        createdAt: new Date(baseTime),
        updatedAt: new Date(baseTime),
      },
      {
        id: t2New,
        userId: userId2,
        brand: `${STAMP}-tie`,
        model: 'NEW',
        status: 'wishlist',
        movement: 'automatic',
        complications: [],
        styleTags: [],
        designTraits: [],
        roleTags: [],
        sortOrder: 0,
        createdAt: new Date(baseTime + 1000),
        updatedAt: new Date(baseTime + 1000),
      },
    ])
  }, 30_000)

  afterAll(async () => {
    if (seededWatchIds.length > 0) {
      await db.delete(watches).where(inArray(watches.id, seededWatchIds))
    }
    await db.delete(users).where(inArray(users.id, seededUserIds))
  }, 30_000)

  it('returns watches in sort_order ASC order', async () => {
    const all = await getWatchesByUser(userId)
    const wishlist = all.filter((w) => w.status === 'wishlist')
    // Three Test 1 watches expected in sortOrder asc → [0, 1, 2] → models [B, C, A]
    expect(wishlist.map((w) => w.sortOrder)).toEqual([0, 1, 2])
    expect(wishlist.map((w) => w.id)).toEqual([t1b, t1c, t1a])
  })

  it('uses createdAt DESC as tiebreaker when sort_order ties', async () => {
    const all = await getWatchesByUser(userId2)
    const wishlist = all.filter((w) => w.status === 'wishlist')
    // Both have sortOrder=0; newest createdAt (t2New) should come first.
    expect(wishlist).toHaveLength(2)
    expect(wishlist[0].id).toBe(t2New)
    expect(wishlist[1].id).toBe(t2Old)
  })
})
