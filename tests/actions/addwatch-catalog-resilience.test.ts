/**
 * Phase 38 Plan 04 — Unit: addWatch fail-loud catalog contract (CAT-13 D-06 closeout)
 *
 * Replaces the pre-Phase-38 CAT-08 resilience test from Phase 17 Plan 03 (Pitfall 9).
 *
 * Pre-Phase-38 contract (REMOVED): addWatch returned {success: true} even when
 *   upsertCatalogFromUserInput threw, because catalog_id was nullable and the
 *   upsert ran AFTER createWatch in a non-blocking background call.
 *
 * Post-Phase-38 contract (ASSERTED HERE): addWatch returns {success: false}
 *   when upsertCatalogFromUserInput throws OR returns null, because:
 *   1. watches.catalog_id is NOT NULL (Phase 36 DDL, Phase 38 Drizzle catch-up)
 *   2. createWatch DAL requires catalogId as 2nd positional arg (IDIOM A)
 *   3. The upsert now fires BEFORE createWatch (D-06 reordering)
 *   4. A null/thrown upsert blocks the insert — fail-loud, not fail-silent
 *
 * Outer try/catch in addWatch (lines 99-294 of src/app/actions/watches.ts) catches the
 * re-thrown catalog error and returns {success: false, error: 'Failed to create watch'}.
 *
 * Requirement: CAT-13 (via D-06 fail-loud cascade)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mocks must come before the action import so Vitest hoists them
vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error {
    constructor(m = 'Not authenticated') {
      super(m)
      this.name = 'UnauthorizedError'
    }
  },
  getCurrentUser: vi.fn(),
}))

vi.mock('@/data/watches', () => ({
  createWatch: vi.fn(),
  updateWatch: vi.fn(),
  deleteWatch: vi.fn(),
  // Plan A removed linkWatchToCatalog callsite; export still exists as @deprecated
  linkWatchToCatalog: vi.fn(),
  getWatchById: vi.fn().mockResolvedValue(null),
  getMaxWishlistSortOrder: vi.fn().mockResolvedValue(0),
}))

// Phase 38 D-06: upsertCatalogFromUserInput is the gate that determines pass/fail
vi.mock('@/data/catalog', () => ({
  upsertCatalogFromUserInput: vi.fn(), // configured per-test
  upsertCatalogFromExtractedUrl: vi.fn(),
  getCatalogById: vi.fn(),
  updateCatalogTaste: vi.fn().mockResolvedValue({ updated: true }),
  applyUserUploadedPhoto: vi.fn().mockResolvedValue({ applied: true }),
}))

vi.mock('@/lib/taste/enricher', () => ({
  enrichTasteAttributes: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/storage/catalogSourcePhotos', () => ({
  getCatalogSourcePhotoSignedUrl: vi.fn().mockResolvedValue(null),
  uploadCatalogSourcePhoto: vi.fn().mockResolvedValue({ path: 'user/pending/abc.jpg' }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock('@/data/activities', () => ({ logActivity: vi.fn(() => Promise.resolve()) }))
vi.mock('@/lib/notifications/logger', () => ({ logNotification: vi.fn(() => Promise.resolve()) }))
vi.mock('@/data/notifications', () => ({ findOverlapRecipients: vi.fn(() => Promise.resolve([])) }))
vi.mock('@/data/profiles', () => ({ getProfileById: vi.fn(() => Promise.resolve(null)) }))

import { addWatch } from '@/app/actions/watches'
import { getCurrentUser } from '@/lib/auth'
import * as watchDAL from '@/data/watches'
import * as catalogDAL from '@/data/catalog'

const viewerUserId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeef'
const validWatchInput = {
  brand: 'Omega',
  model: 'Seamaster',
  status: 'owned' as const,
  movement: 'auto' as const,
  complications: [],
  styleTags: [],
  designTraits: [],
  roleTags: [],
}

describe('addWatch fail-loud catalog contract — Phase 38 D-06 (CAT-13 closeout)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, email: 'test@horlo.test' })
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  // ---------------------------------------------------------------------------
  // Scenario A: upsertCatalogFromUserInput THROWS
  // ---------------------------------------------------------------------------

  it('returns {success: false} when upsertCatalogFromUserInput throws', async () => {
    vi.mocked(catalogDAL.upsertCatalogFromUserInput).mockRejectedValueOnce(new Error('boom'))

    // Outer try/catch in addWatch catches the re-thrown error and converts to {success: false}
    const result = await addWatch(validWatchInput)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Failed to create watch')
    }
  })

  it('does NOT call createWatch when upsertCatalogFromUserInput throws', async () => {
    vi.mocked(catalogDAL.upsertCatalogFromUserInput).mockRejectedValueOnce(new Error('boom'))
    await addWatch(validWatchInput)
    // Critical assertion: the fail-loud reorder means the watches insert NEVER fires
    expect(watchDAL.createWatch).not.toHaveBeenCalled()
  })

  it('logs the catalog upsert failure to console.error', async () => {
    const boom = new Error('boom')
    vi.mocked(catalogDAL.upsertCatalogFromUserInput).mockRejectedValueOnce(boom)
    await addWatch(validWatchInput)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/catalog upsert failed/i),
      boom,
    )
  })

  // ---------------------------------------------------------------------------
  // Scenario B: upsertCatalogFromUserInput returns null (the "no row created" case)
  // ---------------------------------------------------------------------------

  it('returns {success: false} when upsertCatalogFromUserInput returns null', async () => {
    vi.mocked(catalogDAL.upsertCatalogFromUserInput).mockResolvedValueOnce(null)

    // addWatch throws '[addWatch] catalog upsert returned null...' which the outer catch converts
    const result = await addWatch(validWatchInput)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Failed to create watch')
    }
  })

  it('does NOT call createWatch when upsertCatalogFromUserInput returns null', async () => {
    vi.mocked(catalogDAL.upsertCatalogFromUserInput).mockResolvedValueOnce(null)
    await addWatch(validWatchInput)
    expect(watchDAL.createWatch).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // Scenario C: happy path (sanity — proves the test setup is wired correctly)
  // ---------------------------------------------------------------------------

  it('returns {success: true} when upsertCatalogFromUserInput returns a catalogId', async () => {
    // Phase 81 D-81-01 — upsert helper now returns { catalogId, brandName, familyName } | null.
    vi.mocked(catalogDAL.upsertCatalogFromUserInput).mockResolvedValueOnce({
      catalogId: 'cat-resilience-01',
      brandName: 'Omega',
      familyName: 'Seamaster',
    })
    vi.mocked(watchDAL.createWatch).mockResolvedValueOnce({
      id: 'w-resilience-01',
      ...validWatchInput,
    } as never)

    const result = await addWatch(validWatchInput)

    expect(result.success).toBe(true)
    // Critical: createWatch called with 3-arg IDIOM A — userId, catalogId, data
    expect(watchDAL.createWatch).toHaveBeenCalledWith(
      viewerUserId,
      'cat-resilience-01',
      expect.objectContaining({ brand: 'Omega', model: 'Seamaster' }),
    )
  })

  // ---------------------------------------------------------------------------
  // Anti-regression: linkWatchToCatalog is NEVER called post-Phase-38
  // (createWatch sets catalogId atomically; the deprecated linkWatchToCatalog is unused)
  // ---------------------------------------------------------------------------

  it('does NOT call linkWatchToCatalog even on the happy path (Phase 38 D-06: atomic catalogId at insert)', async () => {
    // Phase 81 D-81-01 — upsert helper now returns { catalogId, brandName, familyName } | null.
    vi.mocked(catalogDAL.upsertCatalogFromUserInput).mockResolvedValueOnce({
      catalogId: 'cat-resilience-02',
      brandName: 'Omega',
      familyName: 'Seamaster',
    })
    vi.mocked(watchDAL.createWatch).mockResolvedValueOnce({
      id: 'w-resilience-02',
      ...validWatchInput,
    } as never)

    await addWatch(validWatchInput)

    // Plan A removed the post-create linkWatchToCatalog call; the DAL export is @deprecated
    expect(watchDAL.linkWatchToCatalog).not.toHaveBeenCalled()
  })
})
