// @vitest-environment node
/**
 * Quick task 260913-cae — DB-gated integration test for
 * `deleteWearEventForOwner` (src/data/wearEvents.ts).
 *
 * Mirrors tests/integration/phase15-wear-detail-gating.test.ts: fixed UUIDs,
 * DATABASE_URL-gated maybe-describe, explicit fixture insert/cleanup.
 *
 * Encodes every behavior bullet from 260913-cae-PLAN.md Task 1:
 *   - IDOR: cross-user / non-existent wearEventId -> null, deletes nothing
 *   - Owner delete removes the row; wear_likes + comments cascade
 *   - DD-1(b): watch_worn activity 1s after -> deleted, activityMatch 'matched'
 *   - DD-1(b): watch_worn activity 10 minutes after -> NOT deleted
 *   - DD-1(b): watch_worn activity for a DIFFERENT watch -> NOT deleted
 *   - DD-1(a): another wear of the same user+watch within +/-60s -> ambiguous,
 *     no activity deleted
 *   - DD-2: wear_like/wear_comment notifications matched by exact
 *     payload->>'wear_event_id' are deleted; other ids survive
 *   - DD-2: 'commented' activities matched by exact
 *     metadata->>'wearEventId' are deleted; other ids survive
 *   - storagePaths returned = exactly the non-null photoUrl/mediaPath/posterPath
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'

import { db } from '@/db'
import {
  users,
  profiles,
  profileSettings,
  watches,
  watchesCatalog,
  wearEvents,
  activities,
  notifications,
  wearLikes,
  comments,
  brands,
  watchFamilies,
} from '@/db/schema'
import { deleteWearEventForOwner, WORN_ACTIVITY_MATCH_WINDOW_MS } from '@/data/wearEvents'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('deleteWearEventForOwner (260913-cae)', () => {
  const ids = {
    O: '00000000-0000-0000-0000-0000000913c0', // owner
    X: '00000000-0000-0000-0000-0000000913c1', // stranger / cross-user caller
  } as const
  const allIds = Object.values(ids) as string[]

  let watchAId: string
  let watchBId: string
  // Fixed brand/family ids so cleanup can target them deterministically without
  // touching prod-seeded catalog rows (watches_catalog is not wipeable — memory
  // project_db_wipeable_2026_05_09; brands/watch_families created here are test-only).
  const brandId = '00000000-0000-0000-0000-0000000913b0'
  const familyAId = '00000000-0000-0000-0000-0000000913f0'
  const familyBId = '00000000-0000-0000-0000-0000000913f1'
  const catalogAId = '00000000-0000-0000-0000-0000000913ca'
  const catalogBId = '00000000-0000-0000-0000-0000000913cb'

  async function cleanup() {
    await db.delete(comments).where(inArray(comments.authorId, allIds))
    await db.delete(wearLikes).where(inArray(wearLikes.userId, allIds))
    await db.delete(notifications).where(inArray(notifications.userId, allIds))
    await db.delete(activities).where(inArray(activities.userId, allIds))
    await db.delete(wearEvents).where(inArray(wearEvents.userId, allIds))
    await db.delete(watches).where(inArray(watches.userId, allIds))
    await db.delete(watchesCatalog).where(inArray(watchesCatalog.id, [catalogAId, catalogBId]))
    await db.delete(watchFamilies).where(inArray(watchFamilies.id, [familyAId, familyBId]))
    await db.delete(brands).where(eq(brands.id, brandId))
    await db.delete(profileSettings).where(inArray(profileSettings.userId, allIds))
    await db.delete(profiles).where(inArray(profiles.id, allIds))
    await db.delete(users).where(inArray(users.id, allIds))
  }

  beforeAll(async () => {
    await cleanup()

    await db.insert(users).values(
      Object.entries(ids).map(([k, id]) => ({
        id,
        email: `${k.toLowerCase()}-260913cae-${Date.now()}@horlo.test`,
      })),
    )

    const stamp = Date.now().toString(36)
    for (const [k, id] of Object.entries(ids)) {
      await db
        .update(profiles)
        .set({ username: `q260913_${k.toLowerCase()}_${stamp}`, displayName: k })
        .where(eq(profiles.id, id))
    }

    const stamp2 = Date.now().toString(36)
    await db
      .insert(brands)
      .values({ id: brandId, name: `Brand-260913-${stamp2}`, slug: `brand-260913-${stamp2}` })
      .onConflictDoNothing()
    await db
      .insert(watchFamilies)
      .values([
        { id: familyAId, brandId, name: `Family-A-${stamp2}` },
        { id: familyBId, brandId, name: `Family-B-${stamp2}` },
      ])
      .onConflictDoNothing()
    await db
      .insert(watchesCatalog)
      .values([
        {
          id: catalogAId,
          brand: `Brand-260913-${stamp2}`,
          model: `Family-A-${stamp2}`,
          source: 'user_promoted',
          brandId,
          familyId: familyAId,
        },
        {
          id: catalogBId,
          brand: `Brand-260913-${stamp2}`,
          model: `Family-B-${stamp2}`,
          source: 'user_promoted',
          brandId,
          familyId: familyBId,
        },
      ])
      .onConflictDoNothing()

    const watchRows = await db
      .insert(watches)
      .values([
        {
          userId: ids.O,
          brand: `Brand-260913-${stamp2}`,
          model: `Family-A-${stamp2}`,
          status: 'owned' as const,
          movementType: 'auto' as const,
          catalogId: catalogAId,
        },
        {
          userId: ids.O,
          brand: `Brand-260913-${stamp2}`,
          model: `Family-B-${stamp2}`,
          status: 'owned' as const,
          movementType: 'auto' as const,
          catalogId: catalogBId,
        },
      ])
      .returning()
    watchAId = watchRows[0].id
    watchBId = watchRows[1].id
  }, 30_000)

  afterAll(async () => {
    await cleanup()
  }, 30_000)

  // Reset wear/activity/notification/comment/like state between tests so the
  // DD-1(a) ambiguity guard (a same-user+watch wear within +/-60s) never sees
  // leftover fixtures from an earlier test in this same fast-running suite —
  // without this, unrelated wear rows created seconds apart in real time would
  // all land inside each other's ambiguity windows.
  afterEach(async () => {
    await db.delete(comments).where(inArray(comments.authorId, allIds))
    await db.delete(wearLikes).where(inArray(wearLikes.userId, allIds))
    await db.delete(notifications).where(inArray(notifications.userId, allIds))
    await db.delete(activities).where(inArray(activities.userId, allIds))
    await db.delete(wearEvents).where(inArray(wearEvents.userId, allIds))
  })

  // Sequential day offsets so distinct wear_events rows for the same
  // (userId, watchId) never collide on the unique (user_id, watch_id, worn_date) index.
  let dayOffset = 0
  function nextWornDate(): string {
    dayOffset += 1
    return new Date(Date.now() - dayOffset * 86_400_000).toISOString().slice(0, 10)
  }

  async function insertWear(opts: {
    userId: string
    watchId: string
    createdAt: Date
    photoUrl?: string | null
    mediaPath?: string | null
    posterPath?: string | null
  }) {
    const rows = await db
      .insert(wearEvents)
      .values({
        userId: opts.userId,
        watchId: opts.watchId,
        wornDate: nextWornDate(),
        createdAt: opts.createdAt,
        photoUrl: opts.photoUrl ?? null,
        mediaPath: opts.mediaPath ?? null,
        posterPath: opts.posterPath ?? null,
      })
      .returning()
    return rows[0]
  }

  it('cross-user wearEventId (IDOR) returns null and deletes nothing', async () => {
    const wear = await insertWear({ userId: ids.O, watchId: watchAId, createdAt: new Date() })

    const result = await deleteWearEventForOwner(ids.X, wear.id)
    expect(result).toBeNull()

    const survivor = await db.select().from(wearEvents).where(eq(wearEvents.id, wear.id))
    expect(survivor).toHaveLength(1)
  })

  it('non-existent wearEventId returns null', async () => {
    const result = await deleteWearEventForOwner(ids.O, randomUUID())
    expect(result).toBeNull()
  })

  it('owner delete removes the wear_events row; wear_likes and comments cascade', async () => {
    const wear = await insertWear({ userId: ids.O, watchId: watchAId, createdAt: new Date() })
    await db.insert(wearLikes).values({ userId: ids.X, wearEventId: wear.id })
    await db.insert(comments).values({ authorId: ids.X, wearEventId: wear.id, body: 'nice watch' })

    const result = await deleteWearEventForOwner(ids.O, wear.id)
    expect(result).not.toBeNull()

    const wearRows = await db.select().from(wearEvents).where(eq(wearEvents.id, wear.id))
    expect(wearRows).toHaveLength(0)
    const likeRows = await db.select().from(wearLikes).where(eq(wearLikes.wearEventId, wear.id))
    expect(likeRows).toHaveLength(0)
    const commentRows = await db.select().from(comments).where(eq(comments.wearEventId, wear.id))
    expect(commentRows).toHaveLength(0)
  })

  it("DD-1(b): watch_worn activity 1s after the wear is deleted; activityMatch 'matched'", async () => {
    const createdAt = new Date()
    const wear = await insertWear({ userId: ids.O, watchId: watchAId, createdAt })
    const activityRows = await db
      .insert(activities)
      .values({
        userId: ids.O,
        type: 'watch_worn',
        watchId: watchAId,
        metadata: { brand: 'Brand-260913-A', model: 'Model-A', imageUrl: null, visibility: 'public' },
        createdAt: new Date(createdAt.getTime() + 1_000),
      })
      .returning()

    const result = await deleteWearEventForOwner(ids.O, wear.id)
    expect(result).toMatchObject({ activityMatch: 'matched', removedActivityCount: 1 })

    const survivors = await db.select().from(activities).where(eq(activities.id, activityRows[0].id))
    expect(survivors).toHaveLength(0)
  })

  it('DD-1(b): watch_worn activity 10 minutes after the wear is NOT deleted', async () => {
    const createdAt = new Date()
    const wear = await insertWear({ userId: ids.O, watchId: watchAId, createdAt })
    const activityRows = await db
      .insert(activities)
      .values({
        userId: ids.O,
        type: 'watch_worn',
        watchId: watchAId,
        metadata: { brand: 'Brand-260913-A', model: 'Model-A', imageUrl: null, visibility: 'public' },
        createdAt: new Date(createdAt.getTime() + 10 * 60_000),
      })
      .returning()

    const result = await deleteWearEventForOwner(ids.O, wear.id)
    expect(result).toMatchObject({ activityMatch: 'none', removedActivityCount: 0 })

    const survivors = await db.select().from(activities).where(eq(activities.id, activityRows[0].id))
    expect(survivors).toHaveLength(1)
  })

  it('DD-1(b): watch_worn activity for a DIFFERENT watch inside the window is NOT deleted', async () => {
    const createdAt = new Date()
    const wear = await insertWear({ userId: ids.O, watchId: watchAId, createdAt })
    const activityRows = await db
      .insert(activities)
      .values({
        userId: ids.O,
        type: 'watch_worn',
        watchId: watchBId, // different watch than the deleted wear
        metadata: { brand: 'Brand-260913-B', model: 'Model-B', imageUrl: null, visibility: 'public' },
        createdAt: new Date(createdAt.getTime() + 1_000),
      })
      .returning()

    const result = await deleteWearEventForOwner(ids.O, wear.id)
    expect(result).toMatchObject({ activityMatch: 'none', removedActivityCount: 0 })

    const survivors = await db.select().from(activities).where(eq(activities.id, activityRows[0].id))
    expect(survivors).toHaveLength(1)
  })

  it("DD-1(a): another wear of the same user+watch within +/-60s makes the match ambiguous; no activity deleted", async () => {
    const createdAt = new Date()
    const wear1 = await insertWear({ userId: ids.O, watchId: watchAId, createdAt })
    // Sibling wear inside the ambiguity window (< WORN_ACTIVITY_MATCH_WINDOW_MS away).
    await insertWear({
      userId: ids.O,
      watchId: watchAId,
      createdAt: new Date(createdAt.getTime() + WORN_ACTIVITY_MATCH_WINDOW_MS / 2),
    })
    const activityRows = await db
      .insert(activities)
      .values({
        userId: ids.O,
        type: 'watch_worn',
        watchId: watchAId,
        metadata: { brand: 'Brand-260913-A', model: 'Model-A', imageUrl: null, visibility: 'public' },
        createdAt: new Date(createdAt.getTime() + 1_000),
      })
      .returning()

    const result = await deleteWearEventForOwner(ids.O, wear1.id)
    expect(result).toMatchObject({ activityMatch: 'ambiguous', removedActivityCount: 0 })

    const survivors = await db.select().from(activities).where(eq(activities.id, activityRows[0].id))
    expect(survivors).toHaveLength(1)
  })

  it("DD-2: wear_like/wear_comment notifications with matching payload wear_event_id are deleted; a different wear_event_id survives", async () => {
    const wear = await insertWear({ userId: ids.O, watchId: watchAId, createdAt: new Date() })
    const otherWear = await insertWear({ userId: ids.O, watchId: watchAId, createdAt: new Date() })

    const matching = await db
      .insert(notifications)
      .values([
        {
          userId: ids.O,
          actorId: ids.X,
          type: 'wear_like' as const,
          payload: { wear_event_id: wear.id },
        },
        {
          userId: ids.O,
          actorId: ids.X,
          type: 'wear_comment' as const,
          payload: { wear_event_id: wear.id },
        },
      ])
      .returning()
    const surviving = await db
      .insert(notifications)
      .values({
        userId: ids.O,
        actorId: ids.X,
        type: 'wear_like' as const,
        payload: { wear_event_id: otherWear.id },
      })
      .returning()

    await deleteWearEventForOwner(ids.O, wear.id)

    const matchingSurvivors = await db
      .select()
      .from(notifications)
      .where(inArray(notifications.id, matching.map((r) => r.id)))
    expect(matchingSurvivors).toHaveLength(0)

    const otherSurvivors = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, surviving[0].id))
    expect(otherSurvivors).toHaveLength(1)
  })

  it("DD-2: 'commented' activity with matching metadata wearEventId is deleted; a different wearEventId survives", async () => {
    const wear = await insertWear({ userId: ids.O, watchId: watchAId, createdAt: new Date() })
    const otherWear = await insertWear({ userId: ids.O, watchId: watchAId, createdAt: new Date() })

    const matching = await db
      .insert(activities)
      .values({
        userId: ids.O,
        type: 'commented',
        watchId: null,
        metadata: {
          brand: 'Brand-260913-A',
          model: 'Model-A',
          imageUrl: null,
          targetType: 'wear',
          targetOwnerId: ids.O,
          wearEventId: wear.id,
        },
      })
      .returning()
    const surviving = await db
      .insert(activities)
      .values({
        userId: ids.O,
        type: 'commented',
        watchId: null,
        metadata: {
          brand: 'Brand-260913-A',
          model: 'Model-A',
          imageUrl: null,
          targetType: 'wear',
          targetOwnerId: ids.O,
          wearEventId: otherWear.id,
        },
      })
      .returning()

    await deleteWearEventForOwner(ids.O, wear.id)

    const matchingSurvivors = await db.select().from(activities).where(eq(activities.id, matching[0].id))
    expect(matchingSurvivors).toHaveLength(0)
    const otherSurvivors = await db.select().from(activities).where(eq(activities.id, surviving[0].id))
    expect(otherSurvivors).toHaveLength(1)
  })

  it('returns storagePaths containing exactly the non-null photoUrl / mediaPath / posterPath of the deleted row', async () => {
    const wear = await insertWear({
      userId: ids.O,
      watchId: watchAId,
      createdAt: new Date(),
      photoUrl: `${ids.O}/${randomUUID()}.jpg`,
      mediaPath: `${ids.O}/${randomUUID()}.mp4`,
      posterPath: `${ids.O}/${randomUUID()}-poster.jpg`,
    })

    const result = await deleteWearEventForOwner(ids.O, wear.id)
    expect(result).not.toBeNull()
    expect(result!.storagePaths.sort()).toEqual(
      [wear.photoUrl, wear.mediaPath, wear.posterPath].filter((p): p is string => !!p).sort(),
    )
  })

  it('returns storagePaths as an empty array when the wear has no media', async () => {
    const wear = await insertWear({ userId: ids.O, watchId: watchAId, createdAt: new Date() })
    const result = await deleteWearEventForOwner(ids.O, wear.id)
    expect(result).not.toBeNull()
    expect(result!.storagePaths).toEqual([])
  })
})
