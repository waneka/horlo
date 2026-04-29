/**
 * Phase 19.1 Plan 05 — Integration: addWatch with photoSourcePath → D-21 write-through
 *
 * Gated on DATABASE_URL so the suite skips cleanly in CI without local Supabase.
 *
 * Strategy: mock upsertCatalogFromUserInput to return a pre-inserted catalog row id.
 * This bypasses the watches_catalog_natural_key constraint which may be absent in
 * local dev DBs not yet fully migrated. updateCatalogTaste and applyUserUploadedPhoto
 * use real implementations so D-21/D-22 writes are exercised end-to-end.
 *
 * Tests:
 *   1. addWatch with photoSourcePath → catalog row gets image_source_quality='user_uploaded'
 *      (D-21) and extracted_from_photo=true (D-22).
 *   2. addWatch rejects photoSourcePath whose first segment != user.id (T-19.1-05-05).
 *   3. addWatch without photoSourcePath does NOT set image_source_quality (D-21 gate).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'

import { db } from '@/db'
import { watchesCatalog } from '@/db/schema'

const maybe = process.env.DATABASE_URL ? describe : describe.skip
const STAMP = Date.now().toString(36)

// ---------------------------------------------------------------------------
// Mutable catalog id slot — set by beforeAll, read by mock factory.
// Must be declared before vi.mock() factory runs.
// ---------------------------------------------------------------------------
let _mockCatalogId: string | null = null

// ---------------------------------------------------------------------------
// Mocks — hoisted before action imports per vitest rules.
// @/data/catalog is partially mocked: real DAL functions pass through,
// only upsertCatalogFromUserInput is stubbed to return _mockCatalogId.
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error {
    constructor(m = 'Not authenticated') {
      super(m)
      this.name = 'UnauthorizedError'
    }
  },
  getCurrentUser: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/data/activities', () => ({ logActivity: vi.fn(() => Promise.resolve()) }))
vi.mock('@/lib/notifications/logger', () => ({ logNotification: vi.fn(() => Promise.resolve()) }))
vi.mock('@/data/notifications', () => ({ findOverlapRecipients: vi.fn(() => Promise.resolve([])) }))
vi.mock('@/data/profiles', () => ({ getProfileById: vi.fn(() => Promise.resolve(null)) }))

// Partial mock of @/data/catalog: real functions used except upsertCatalogFromUserInput.
// linkWatchToCatalog also needs to be available; mock it as a no-op since watches
// insert needs a real watch row which requires the full DAL chain.
vi.mock('@/data/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/catalog')>()
  return {
    ...actual,
    // Return the pre-inserted catalog id — bypasses natural_key constraint dep.
    upsertCatalogFromUserInput: vi.fn(() => Promise.resolve(_mockCatalogId)),
  }
})

// Mock linkWatchToCatalog in watches DAL to avoid FK constraint on catalog_id.
// The watch insert itself will still run; we just don't link it to the catalog.
vi.mock('@/data/watches', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/watches')>()
  return {
    ...actual,
    linkWatchToCatalog: vi.fn(() => Promise.resolve()),
  }
})

// Mock enricher with canned taste — we test wiring not real LLM.
vi.mock('@/lib/taste/enricher', () => ({
  enrichTasteAttributes: vi.fn().mockResolvedValue({
    formality: 0.6,
    sportiness: 0.3,
    heritageScore: 0.7,
    primaryArchetype: 'dress',
    eraSignal: 'modern',
    designMotifs: ['gilt-dial'],
    confidence: 0.8,
    extractedFromPhoto: true,
  }),
}))

// Mock getCatalogSourcePhotoSignedUrl — addWatch uses this before applyUserUploadedPhoto.
vi.mock('@/lib/storage/catalogSourcePhotos', () => ({
  getCatalogSourcePhotoSignedUrl: vi.fn().mockResolvedValue('https://example.com/signed/photo.jpg'),
  uploadCatalogSourcePhoto: vi.fn().mockResolvedValue({ path: 'user/pending/abc.jpg' }),
}))

import { addWatch } from '@/app/actions/watches'
import { getCurrentUser } from '@/lib/auth'

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

maybe('Phase 19.1 Plan 05 — addWatch + photo write-through (D-21 + D-22)', () => {
  const userId = randomUUID()
  const TEST_BRAND = `_test_addphoto_${STAMP}`

  beforeAll(async () => {
    // Insert test auth.users row
    await db.execute(sql`
      INSERT INTO auth.users (id, email, aud, role, email_confirmed_at, created_at, updated_at)
      VALUES (
        ${userId}::uuid,
        ${'addphoto-' + STAMP + '@horlo.test'},
        'authenticated',
        'authenticated',
        now(),
        now(),
        now()
      )
      ON CONFLICT (id) DO NOTHING
    `)
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: `addphoto-${STAMP}@horlo.test` })
  }, 30_000)

  afterAll(async () => {
    await db.execute(sql`DELETE FROM watches WHERE user_id = ${userId}::uuid`)
    await db.execute(sql`DELETE FROM watches_catalog WHERE brand = ${TEST_BRAND}`)
    await db.execute(sql`DELETE FROM auth.users WHERE id = ${userId}::uuid`)
    vi.restoreAllMocks()
  }, 30_000)

  it('user_uploaded source quality with photoSourcePath (D-21 write-through)', async () => {
    // Pre-insert a catalog row to get a real id.
    const [inserted] = await db
      .insert(watchesCatalog)
      .values({ brand: TEST_BRAND, model: 'photo-test' })
      .returning({ id: watchesCatalog.id })
    _mockCatalogId = inserted.id

    // Photo filename must match Zod regex [0-9a-f-]+ — UUID satisfies this.
    const photoFilename = randomUUID()
    const photoPath = `${userId}/pending/${photoFilename}.jpg`

    const result = await addWatch({
      brand: TEST_BRAND,
      model: 'photo-test',
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
      photoSourcePath: photoPath,
    })

    expect(result.success).toBe(true)

    // Assert: catalog row has image_source_quality='user_uploaded' (D-21)
    const catRows = await db.execute<{
      image_source_quality: string | null
      image_source_url: string | null
      confidence: number | null
      extracted_from_photo: boolean | null
    }>(sql`
      SELECT image_source_quality, image_source_url, confidence, extracted_from_photo
        FROM watches_catalog
       WHERE id = ${_mockCatalogId}::uuid
    `) as unknown as Array<{
      image_source_quality: string | null
      image_source_url: string | null
      confidence: number | null
      extracted_from_photo: boolean | null
    }>

    expect(catRows).toHaveLength(1)
    const cat = catRows[0]!
    expect(cat.image_source_quality).toBe('user_uploaded')
    expect(cat.image_source_url).toBe(photoPath)
    // Mock enricher set confidence=0.8 and extractedFromPhoto=true (D-22)
    expect(cat.confidence).not.toBeNull()
    expect(Number(cat.confidence)).toBeCloseTo(0.8, 3)
    expect(cat.extracted_from_photo).toBe(true)
  })

  it('rejects mismatched user_id in photoSourcePath (T-19.1-05-05)', async () => {
    const wrongUserId = randomUUID()

    const result = await addWatch({
      brand: TEST_BRAND,
      model: 'reject-test',
      status: 'wishlist',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
      // First segment is a different user id — ownership check must reject
      photoSourcePath: `${wrongUserId}/pending/aabbccdd-eeff-4011-8022-334455667788.jpg`,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/photo path does not match authenticated user/i)
    }
  })

  it('addWatch without photoSourcePath does not set image_source_quality (D-21 gate)', async () => {
    // Pre-insert a fresh catalog row for this test
    const [inserted2] = await db
      .insert(watchesCatalog)
      .values({ brand: TEST_BRAND, model: 'nophoto-test' })
      .returning({ id: watchesCatalog.id })
    const nophotoId = inserted2.id
    _mockCatalogId = nophotoId  // update slot so mock returns this id

    const result = await addWatch({
      brand: TEST_BRAND,
      model: 'nophoto-test',
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
      // no photoSourcePath — applyUserUploadedPhoto must NOT fire
    })

    expect(result.success).toBe(true)

    const catRows = await db.execute<{
      image_source_quality: string | null
      confidence: number | null
    }>(sql`
      SELECT image_source_quality, confidence
        FROM watches_catalog
       WHERE id = ${nophotoId}::uuid
    `) as unknown as Array<{
      image_source_quality: string | null
      confidence: number | null
    }>

    expect(catRows).toHaveLength(1)
    const cat = catRows[0]!
    // No photo → applyUserUploadedPhoto not called → image_source_quality stays NULL
    expect(cat.image_source_quality).toBeNull()
    // Mock enricher ran in text-mode → taste fields populated
    expect(cat.confidence).not.toBeNull()
    expect(Number(cat.confidence)).toBeCloseTo(0.8, 3)
  })
})
