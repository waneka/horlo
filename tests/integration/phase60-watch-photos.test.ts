// @vitest-environment jsdom
/**
 * Phase 60 — watch_photos schema + DAL integration tests (SC1/SC2/SC3).
 * SC1: table exists, image_url dropped, index exists, backfill rows at sort_order=0.
 * SC2: getWatchesByUser resolves imageUrl from watch_photos cover (cover wins over catalog).
 * SC3: addWatchPhoto throws PhotoCapExceededError at MAX_PHOTOS_PER_WATCH+1.
 * Cross-tenant: addWatchPhoto for another user's watch throws access-denied.
 *
 * Gated on DATABASE_URL — skip in CI without local Supabase.
 * Cases SC1 a-c PASS once migration applied locally (Plan 01 Task 3).
 * Cases SC2/SC3/cross-tenant are RED until Plan 03 lands the DAL (expected Wave 0 state).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '@/db'
import { users, watches, watchesCatalog, watchPhotos } from '@/db/schema'
import { getWatchesByUser, addWatchPhoto, MAX_PHOTOS_PER_WATCH, PhotoCapExceededError } from '@/data/watches'

const maybe = process.env.DATABASE_URL ? describe : describe.skip
const STAMP = `p60wp${Date.now().toString(36)}`

maybe(`Phase 60 — watch_photos schema + DAL [${STAMP}]`, () => {
  const userId = randomUUID()
  const otherUserId = randomUUID()
  const watchId = randomUUID()
  const catalogId = randomUUID()
  const otherCatalogId = randomUUID()
  const otherWatchId = randomUUID()

  beforeAll(async () => {
    // Seed users
    await db.insert(users).values([
      { id: userId, email: `${STAMP}-owner@horlo.test` },
      { id: otherUserId, email: `${STAMP}-other@horlo.test` },
    ]).onConflictDoNothing()

    // Seed catalog rows (catalogId is NOT NULL on watches)
    await db.insert(watchesCatalog).values([
      {
        id: catalogId,
        brand: 'Test',
        model: 'Ref',
        reference: STAMP,
        source: 'user_promoted',
        imageUrl: 'https://catalog.example.com/photo.jpg',
      },
      {
        id: otherCatalogId,
        brand: 'Test',
        model: 'Other',
        reference: `${STAMP}-other`,
        source: 'user_promoted',
      },
    ]).onConflictDoNothing()

    // Seed watches
    await db.insert(watches).values([
      {
        id: watchId,
        userId,
        brand: 'Test',
        model: 'Ref',
        status: 'owned',
        catalogId,
        complications: [],
        styleTags: [],
        designTraits: [],
        roleTags: [],
      },
      {
        id: otherWatchId,
        userId: otherUserId,
        brand: 'Test',
        model: 'Other',
        status: 'owned',
        catalogId: otherCatalogId,
        complications: [],
        styleTags: [],
        designTraits: [],
        roleTags: [],
      },
    ]).onConflictDoNothing()
  })

  afterAll(async () => {
    // Clean up in dependency order
    await db.delete(watchPhotos).where(eq(watchPhotos.watchId, watchId))
    await db.delete(watchPhotos).where(eq(watchPhotos.watchId, otherWatchId))
    await db.delete(watches).where(eq(watches.id, watchId))
    await db.delete(watches).where(eq(watches.id, otherWatchId))
    await db.delete(watchesCatalog).where(eq(watchesCatalog.id, catalogId))
    await db.delete(watchesCatalog).where(eq(watchesCatalog.id, otherCatalogId))
    await db.delete(users).where(eq(users.id, userId))
    await db.delete(users).where(eq(users.id, otherUserId))
  })

  // ---- SC1: Schema assertions ----

  it('SC1 — watch_photos table has required columns', async () => {
    const result = await db.execute(sql`
      SELECT column_name
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'watch_photos'
       ORDER BY column_name
    `)
    const rows = result as unknown as Array<{ column_name: string }>
    const colNames = rows.map((r) => r.column_name)
    expect(colNames).toContain('id')
    expect(colNames).toContain('watch_id')
    expect(colNames).toContain('storage_path')
    expect(colNames).toContain('sort_order')
    expect(colNames).toContain('created_at')
  })

  it('SC1 — watches table no longer has image_url column (column dropped)', async () => {
    const result = await db.execute(sql`
      SELECT column_name
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'watches'
         AND column_name = 'image_url'
    `)
    const rows = result as unknown as unknown[]
    expect(rows.length).toBe(0)
  })

  it('SC1 — watch_photos_watch_id_sort_idx index exists', async () => {
    const result = await db.execute(sql`
      SELECT indexname, indexdef
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'watch_photos'
         AND indexname = 'watch_photos_watch_id_sort_idx'
    `)
    const rows = result as unknown as Array<{ indexname: string; indexdef: string }>
    expect(rows[0]).toBeDefined()
    expect(rows[0].indexdef).toMatch(/watch_id/)
    expect(rows[0].indexdef).toMatch(/sort_order/)
  })

  // ---- SC2: Cover resolution (RED until Plan 03 DAL) ----

  it('SC2 — getWatchesByUser: watch with watch_photos row resolves imageUrl from storage_path (cover wins)', async () => {
    const coverPath = `${userId}/${randomUUID()}.jpg`
    await db.insert(watchPhotos).values({
      id: randomUUID(),
      watchId,
      storagePath: coverPath,
      sortOrder: 0,
    })

    try {
      const result = await getWatchesByUser(userId)
      const w = result.find((r) => r.id === watchId)
      expect(w).toBeDefined()
      expect(w?.imageUrl).toBe(coverPath)
    } finally {
      await db.delete(watchPhotos).where(
        and(eq(watchPhotos.watchId, watchId), eq(watchPhotos.storagePath, coverPath))
      )
    }
  })

  it('SC2 — getWatchesByUser: watch with NO watch_photos but catalog imageUrl resolves to catalog fallback', async () => {
    // Ensure no watch_photos rows for watchId
    await db.delete(watchPhotos).where(eq(watchPhotos.watchId, watchId))

    const result = await getWatchesByUser(userId)
    const w = result.find((r) => r.id === watchId)
    expect(w).toBeDefined()
    expect(w?.imageUrl).toBe('https://catalog.example.com/photo.jpg')
  })

  // ---- SC3: Photo cap enforcement (RED until Plan 03 DAL) ----

  it('SC3 — addWatchPhoto throws PhotoCapExceededError when at MAX_PHOTOS_PER_WATCH', async () => {
    // Insert MAX_PHOTOS_PER_WATCH photos
    const ids: string[] = []
    for (let i = 0; i < MAX_PHOTOS_PER_WATCH; i++) {
      const id = randomUUID()
      ids.push(id)
      await db.insert(watchPhotos).values({
        id,
        watchId,
        storagePath: `${userId}/${id}.jpg`,
        sortOrder: i,
      })
    }

    try {
      await expect(
        addWatchPhoto(userId, watchId, `${userId}/${randomUUID()}.jpg`)
      ).rejects.toThrow(PhotoCapExceededError)
    } finally {
      await db.delete(watchPhotos).where(eq(watchPhotos.watchId, watchId))
    }
  })

  // ---- Cross-tenant: ownership enforcement (RED until Plan 03 DAL) ----

  it('cross-tenant — addWatchPhoto for another user\'s watch throws access-denied', async () => {
    await expect(
      addWatchPhoto(userId, otherWatchId, `${userId}/${randomUUID()}.jpg`)
    ).rejects.toThrow(/access denied|not found/i)
  })
})
