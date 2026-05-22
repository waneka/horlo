/**
 * Phase 54 — DAL gate integration tests (SEC-02 + GATE-01 + GATE-04 + GATE-05).
 *
 * ASSUMES DATABASE_URL points to LOCAL Supabase Docker. NEVER export the prod
 * pooler URL before running `npm run test`. Strict localhost guard below prevents
 * accidental prod runs (T-54-01 mitigation).
 *
 * Threats / requirements covered:
 *   - SEC-02: non-mutual-follower calling createComment on wishlist watch via
 *     DAL directly (bypassing RLS) → must throw CommentGateError
 *   - GATE-01: getCommentsForTarget returns [] for non-mutual viewer on wishlist watch
 *   - GATE-01 open path: non-wishlist watches are open to any authenticated user
 *   - GATE-04: collection owner can always comment on own watches
 *   - GATE-05: isMutualFollow returns false for one-way follow (A→B without B→A)
 *   - mutual path: mutual follower can comment on wishlist watch
 *
 * NEGATIVE CELLS FIRST — catches inverted gate / missing gate early.
 *
 * NOTE: These tests call the DAL directly (Drizzle db, RLS-bypassing).
 * The DAL gate is the load-bearing privacy layer — that is the point of this test.
 *
 * Suite is RED until Wave 1 (src/data/follows.ts isMutualFollow) and
 * Wave 2 (src/data/comments.ts createComment + getCommentsForTarget) land.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { inArray, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/db'
import {
  users,
  profiles,
  profileSettings,
  follows,
  watches,
  watchesCatalog,
  comments,
} from '@/db/schema'
import { createComment, CommentGateError, getCommentsForTarget } from '@/data/comments'
import { isMutualFollow } from '@/data/follows'

// Pitfall 5: strict localhost guard — prevents accidental prod runs (T-54-01).
const dbUrlIsLocal =
  typeof process.env.DATABASE_URL === 'string' &&
  (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'))

const maybe =
  process.env.DATABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  dbUrlIsLocal
    ? describe
    : describe.skip

maybe('Phase 54 DAL gate — SEC-02 + GATE-01 + GATE-04 + GATE-05', () => {
  // Fixed UUIDs in the 000000000054XX namespace for deterministic cleanup.
  const ids = {
    owner:   '00000000-0000-0000-0000-0000000054a0', // owns the watches
    mutual:  '00000000-0000-0000-0000-0000000054a1', // follows owner AND owner follows back
    oneWay:  '00000000-0000-0000-0000-0000000054a2', // follows owner, owner does NOT follow back
    stranger: '00000000-0000-0000-0000-0000000054a3', // no follow relationship
  } as const
  const allIds = Object.values(ids) as string[]

  let wishlistWatchId: string
  let ownedWatchId: string

  async function cleanup() {
    // FK dependency order: comments → watch_likes → wear_likes → watches → follows → profileSettings → profiles → users
    await db.delete(comments).where(
      // delete comments on watches owned by our test users
      inArray(comments.authorId, allIds),
    )
    await db.delete(watches).where(inArray(watches.userId, allIds))
    await db.delete(follows).where(inArray(follows.followerId, allIds))
    await db.delete(follows).where(inArray(follows.followingId, allIds))
    await db.delete(profileSettings).where(inArray(profileSettings.userId, allIds))
    await db.delete(profiles).where(inArray(profiles.id, allIds))
    await db.delete(users).where(inArray(users.id, allIds))
  }

  beforeAll(async () => {
    // Run cleanup first to remove any leftover rows from a prior aborted run.
    await cleanup()

    const stamp = Date.now().toString(36)

    // 1. Insert users (the shadow `users` table for FK integrity).
    await db.insert(users).values(
      Object.entries(ids).map(([k, id]) => ({
        id,
        email: `${k.toLowerCase()}-p54-${stamp}@horlo.test`,
      })),
    )

    // 2. Update profiles with distinct usernames (auto-created by DB trigger on users insert).
    for (const [k, id] of Object.entries(ids)) {
      await db
        .update(profiles)
        .set({
          username: `p54_${k.toLowerCase()}_${stamp}`,
          displayName: k,
        })
        .where(eq(profiles.id, id))
    }

    // 3. Insert follow relationships.
    //    mutual ↔ owner: both directions.
    //    oneWay → owner: only A→B, NOT B→A.
    //    stranger: no follow rows.
    await db.insert(follows).values([
      { followerId: ids.mutual, followingId: ids.owner },
      { followerId: ids.owner,  followingId: ids.mutual },
      { followerId: ids.oneWay, followingId: ids.owner },
    ])

    // 4. Seed a catalog row (watches.catalogId is NOT NULL per Phase 38 D-08).
    const catalogId = randomUUID()
    await db
      .insert(watchesCatalog)
      .values({ id: catalogId, brand: 'Brand-54', model: 'Model-54', source: 'user_promoted' })
      .onConflictDoNothing()

    // 5. Insert a wishlist watch owned by owner (gate subject).
    const wishlistRows = await db
      .insert(watches)
      .values({
        userId: ids.owner,
        brand: 'Brand-54',
        model: 'Wishlist-54',
        status: 'wishlist' as const,
        catalogId,
      })
      .returning()
    wishlistWatchId = wishlistRows[0].id

    // 6. Insert an owned watch owned by owner (control — non-wishlist, gate is open).
    const ownedRows = await db
      .insert(watches)
      .values({
        userId: ids.owner,
        brand: 'Brand-54',
        model: 'Owned-54',
        status: 'owned' as const,
        catalogId,
      })
      .returning()
    ownedWatchId = ownedRows[0].id
  }, 30_000)

  afterAll(async () => {
    await cleanup()
  }, 30_000)

  // ===========================================================================
  // NEGATIVE CELLS FIRST — catches inverted gate / missing gate early (SEC-02)
  // ===========================================================================

  it('SEC-02: one-way follower calling createComment on wishlist watch throws CommentGateError', async () => {
    await expect(
      createComment({
        authorId: ids.oneWay,
        target: { type: 'watch', id: wishlistWatchId },
        body: 'one-way-reject',
      }),
    ).rejects.toBeInstanceOf(CommentGateError)
  })

  it('SEC-02: stranger calling createComment on wishlist watch throws CommentGateError', async () => {
    await expect(
      createComment({
        authorId: ids.stranger,
        target: { type: 'watch', id: wishlistWatchId },
        body: 'stranger-reject',
      }),
    ).rejects.toBeInstanceOf(CommentGateError)
  })

  it('GATE-01 read-gate: getCommentsForTarget returns [] for one-way viewer on wishlist watch', async () => {
    const result = await getCommentsForTarget(ids.oneWay, {
      type: 'watch',
      id: wishlistWatchId,
    })
    expect(result).toEqual([])
  })

  // ===========================================================================
  // POSITIVE CELLS
  // ===========================================================================

  it('GATE-04: owner can createComment on own wishlist watch (owner bypass)', async () => {
    await expect(
      createComment({
        authorId: ids.owner,
        target: { type: 'watch', id: wishlistWatchId },
        body: 'owner comment',
      }),
    ).resolves.not.toThrow()
  })

  it('GATE-04: getCommentsForTarget for owner on own wishlist watch returns the comment', async () => {
    const result = await getCommentsForTarget(ids.owner, {
      type: 'watch',
      id: wishlistWatchId,
    })
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].body).toBe('owner comment')
  })

  it('GATE-01 open path: stranger can createComment on owned (non-wishlist) watch', async () => {
    await expect(
      createComment({
        authorId: ids.stranger,
        target: { type: 'watch', id: ownedWatchId },
        body: 'stranger on owned',
      }),
    ).resolves.not.toThrow()
  })

  it('mutual path: mutual follower can createComment on wishlist watch (GATE-05)', async () => {
    await expect(
      createComment({
        authorId: ids.mutual,
        target: { type: 'watch', id: wishlistWatchId },
        body: 'mutual comment',
      }),
    ).resolves.not.toThrow()
  })

  it('GATE-05: isMutualFollow returns false when only A→B exists (not B→A)', async () => {
    // oneWay → owner exists; owner → oneWay does NOT
    await expect(isMutualFollow(ids.oneWay, ids.owner)).resolves.toBe(false)
  })

  it('GATE-05: isMutualFollow returns true when both directions present', async () => {
    // mutual ↔ owner: both rows were inserted in beforeAll
    await expect(isMutualFollow(ids.mutual, ids.owner)).resolves.toBe(true)
  })
})
