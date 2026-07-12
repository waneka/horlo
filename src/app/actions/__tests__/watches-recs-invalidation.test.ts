// Phase 75 Plan 01 — DISC-RECS-CACHE regression test (D-15)
//
// Each of the four watch-mutation Server Actions MUST invalidate the home
// "From collectors like you" rail's per-viewer cache entry by calling
// `updateTag(`viewer:${user.id}:recs`)` — the Next 16 read-your-own-writes
// primitive for Server Actions (D-02). The matching cacheTag is registered
// in src/components/home/CollectorsLikeYou.tsx (Task 1).
//
// 4 cases (one per mutation):
//   1. addWatch                  — assert updateTag fires with viewer:viewer-1:recs
//   2. moveWishlistToCollection  — same assertion on the wishlist→owned UPDATE path
//   3. editWatch                 — same assertion on the non-transition UPDATE path
//   4. removeWatch               — same assertion on the DELETE path
//
// Each case ALSO asserts NO call shape `revalidateTag('viewer:viewer-1:recs', ...)`
// (D-02 enforcement — the read-your-own-write primitive is updateTag, NOT
// the stale-while-revalidate `revalidateTag(tag, 'max')` variant).
//
// DEVIATION from plan (Rule 3): plan specified asserting
// `revalidateTag(`viewer:viewer-1:recs`)` with default semantics. That form
// is deprecated in Next 16 and does NOT type-check — the executor migrated
// the call sites to `updateTag` in Task 2 per Next 16 docs and AGENTS.md
// "Heed deprecation notices." The semantic — read-your-own-writes — is
// preserved verbatim; the assertion target shifts from `revalidateTag`-default
// to `updateTag` (Next 16's named primitive for this case).
//
// Mock pattern mirrors src/app/actions/__tests__/moveWishlistToCollection.test.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/data/watches', async () => {
  const actual = await vi.importActual<typeof import('@/data/watches')>('@/data/watches')
  return {
    ...actual,
    getWatchById: vi.fn(),
    createWatch: vi.fn(),
    updateWatch: vi.fn(),
    deleteWatch: vi.fn(),
    getMaxWishlistSortOrder: vi.fn(),
  }
})
vi.mock('@/data/catalog', async () => {
  const actual = await vi.importActual<typeof import('@/data/catalog')>('@/data/catalog')
  return {
    ...actual,
    upsertCatalogFromUserInput: vi.fn(),
    getCatalogById: vi.fn(),
    applyUserUploadedPhoto: vi.fn(),
    updateCatalogTaste: vi.fn(),
  }
})
vi.mock('@/data/activities', () => ({ logActivity: vi.fn() }))
vi.mock('@/data/notifications', () => ({ findOverlapRecipients: vi.fn() }))
vi.mock('@/lib/notifications/logger', () => ({ logNotification: vi.fn() }))
vi.mock('@/data/profiles', () => ({ getProfileById: vi.fn() }))
vi.mock('@/app/actions/account', () => ({ purgeWatchPhotos: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}))

import {
  addWatch,
  moveWishlistToCollection,
  editWatch,
  removeWatch,
} from '@/app/actions/watches'
import { getCurrentUser } from '@/lib/auth'
import {
  getWatchById,
  createWatch,
  updateWatch,
  deleteWatch,
  getMaxWishlistSortOrder,
} from '@/data/watches'
import { upsertCatalogFromUserInput } from '@/data/catalog'
import { findOverlapRecipients } from '@/data/notifications'
import { getProfileById } from '@/data/profiles'
import { updateTag, revalidateTag } from 'next/cache'

// RFC 4122 v4 strict UUID — passes Zod uuid validation.
const VALID_UUID = '11111111-1111-4111-8111-111111111111'
const VIEWER_ID = 'viewer-1'
const RECS_TAG = `viewer:${VIEWER_ID}:recs`

// Minimal happy-path payload for addWatch — satisfies insertWatchSchema.
function mkAddWatchInput() {
  return {
    brand: 'Omega',
    model: 'Speedmaster',
    status: 'owned' as const,
  }
}

// Build a minimal Watch row that the DAL mocks resolve with. Cast at
// the use-site to keep the helper free of `any` while matching the
// canonical pattern from moveWishlistToCollection.test.ts.
function mkWatchRow(overrides: Partial<{ status: string; brand: string; model: string }> = {}) {
  return {
    id: VALID_UUID,
    catalogId: '22222222-2222-4222-8222-222222222222',
    brand: overrides.brand ?? 'Omega',
    model: overrides.model ?? 'Speedmaster',
    status: overrides.status ?? 'owned',
    imageUrl: null,
    notes: null,
  }
}

describe('Phase 75 — watch mutations invalidate viewer:${user.id}:recs (DISC-RECS-CACHE)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Defaults that every case relies on. Per-case overrides follow.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getCurrentUser).mockResolvedValue({ id: VIEWER_ID } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getProfileById).mockResolvedValue({
      id: VIEWER_ID,
      username: 'viewer_username',
      displayName: 'Viewer',
    } as any)
    vi.mocked(findOverlapRecipients).mockResolvedValue([])
  })

  // ──────────────────────────────────────────────────────────────────────
  // Case 1: addWatch — happy-path INSERT fires updateTag(viewer:${id}:recs)
  // ──────────────────────────────────────────────────────────────────────
  it('addWatch — calls updateTag(viewer:${user.id}:recs) once with default semantics', async () => {
    // Phase 81 D-81-01 — upsert helper returns { catalogId, brandName, familyName } | null.
    vi.mocked(upsertCatalogFromUserInput).mockResolvedValue({
      catalogId: '22222222-2222-4222-8222-222222222222',
      brandName: 'MockBrand',
      familyName: 'MockModel',
    })
    vi.mocked(getMaxWishlistSortOrder).mockResolvedValue(0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createWatch).mockResolvedValue(mkWatchRow({ status: 'owned' }) as any)

    const result = await addWatch(mkAddWatchInput())

    expect(result.success).toBe(true)

    // D-02 enforcement: updateTag fires once with the per-viewer recs tag.
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith(RECS_TAG)

    // D-02 negative assertion: NO revalidateTag call shape on the recs tag.
    // Cross-user fan-out calls (profile, explore, viewer:recipient) are fine
    // — we filter on the recs tag specifically.
    const staleCalls = vi
      .mocked(revalidateTag)
      .mock.calls.filter((c) => c[0] === RECS_TAG)
    expect(staleCalls).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────────────────
  // Case 2: moveWishlistToCollection — wishlist→owned UPDATE fires updateTag
  // ──────────────────────────────────────────────────────────────────────
  it('moveWishlistToCollection — calls updateTag(viewer:${user.id}:recs) once with default semantics', async () => {
    const priorRow = mkWatchRow({ status: 'wishlist' })
    const updatedRow = mkWatchRow({ status: 'owned' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(updateWatch).mockResolvedValue(updatedRow as any)

    const result = await moveWishlistToCollection(VALID_UUID)

    expect(result.success).toBe(true)

    // D-02 enforcement.
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith(RECS_TAG)

    // D-02 negative assertion.
    const staleCalls = vi
      .mocked(revalidateTag)
      .mock.calls.filter((c) => c[0] === RECS_TAG)
    expect(staleCalls).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────────────────
  // Case 3: editWatch — non-transition UPDATE fires updateTag
  // ──────────────────────────────────────────────────────────────────────
  it('editWatch — calls updateTag(viewer:${user.id}:recs) once with default semantics', async () => {
    const priorRow = mkWatchRow({ status: 'owned' })
    const updatedRow = mkWatchRow({ status: 'owned', model: 'Speedmaster Pro' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(updateWatch).mockResolvedValue(updatedRow as any)

    // Edit payload: plain field update (NOT a status transition to 'sold' —
    // that path uses db.transaction which isn't wired through the DAL mocks).
    const result = await editWatch(VALID_UUID, { model: 'Speedmaster Pro' })

    expect(result.success).toBe(true)

    // D-02 enforcement.
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith(RECS_TAG)

    // D-02 negative assertion.
    const staleCalls = vi
      .mocked(revalidateTag)
      .mock.calls.filter((c) => c[0] === RECS_TAG)
    expect(staleCalls).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────────────────
  // Case 4: removeWatch — DELETE fires updateTag
  // ──────────────────────────────────────────────────────────────────────
  it('removeWatch — calls updateTag(viewer:${user.id}:recs) once with default semantics', async () => {
    vi.mocked(deleteWatch).mockResolvedValue(undefined)

    const result = await removeWatch(VALID_UUID)

    expect(result.success).toBe(true)

    // D-02 enforcement.
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith(RECS_TAG)

    // D-02 negative assertion.
    const staleCalls = vi
      .mocked(revalidateTag)
      .mock.calls.filter((c) => c[0] === RECS_TAG)
    expect(staleCalls).toHaveLength(0)
  })
})
