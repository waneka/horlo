// Phase 70 Plan 03 — moveWishlistToCollection Server Action (DUPE-03)
//
// 6 unit cases verify the wishlist→owned UPDATE path that DupeBanner's
// "Move to Collection" affordance commits. Action wraps editWatch-equivalent
// behaviour PLUS fires the side-effects editWatch deliberately skips:
// logActivity('watch_added') + overlap notifications + the addWatch
// revalidatePath / revalidateTag matrix.
//
// Threat coverage:
//   - T-70-01 IDOR — Zod uuid + watchDAL.getWatchById(user.id, watchId) two-layer gate
//   - T-70-02 Tampering (double-click) — idempotent already-owned branch
//   - T-70-03 Tampering (status whitelist) — sold/grail rejection
//
// Mock pattern mirrors src/app/actions/__tests__/reorderWishlist.test.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/data/watches', async () => {
  const actual = await vi.importActual<typeof import('@/data/watches')>('@/data/watches')
  return {
    ...actual,
    getWatchById: vi.fn(),
    updateWatch: vi.fn(),
  }
})
vi.mock('@/data/activities', () => ({ logActivity: vi.fn() }))
vi.mock('@/data/notifications', () => ({ findOverlapRecipients: vi.fn() }))
vi.mock('@/lib/notifications/logger', () => ({ logNotification: vi.fn() }))
vi.mock('@/data/profiles', () => ({ getProfileById: vi.fn() }))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { moveWishlistToCollection } from '@/app/actions/watches'
import { getCurrentUser } from '@/lib/auth'
import { getWatchById, updateWatch } from '@/data/watches'
import { logActivity } from '@/data/activities'
import { findOverlapRecipients } from '@/data/notifications'
import { logNotification } from '@/lib/notifications/logger'
import { getProfileById } from '@/data/profiles'

// RFC 4122 v4 strict UUID — passes Zod uuid validation (Zod 4 strict regex).
const VALID_UUID = '11111111-1111-4111-8111-111111111111'

describe('Phase 70 — moveWishlistToCollection (DUPE-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ──────────────────────────────────────────────────────────────────────
  // Case 1: Auth gate — getCurrentUser rejects → "Not authenticated"
  // ──────────────────────────────────────────────────────────────────────
  it('auth gate — getCurrentUser rejects → "Not authenticated"; getWatchById NOT called', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('Not authenticated'))
    const result = await moveWishlistToCollection(VALID_UUID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authenticated')
    // Auth-first ordering verification — DAL never reached.
    expect(getWatchById).not.toHaveBeenCalled()
    expect(updateWatch).not.toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────────────────────────────
  // Case 2: Zod gate — invalid (non-UUID) watchId → "Invalid request"
  // ──────────────────────────────────────────────────────────────────────
  it('zod gate — non-uuid watchId → "Invalid request"; getCurrentUser called but getWatchById NOT', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-id' } as any)
    const result = await moveWishlistToCollection('not-a-uuid')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid request')
    expect(getCurrentUser).toHaveBeenCalledOnce()
    expect(getWatchById).not.toHaveBeenCalled()
    expect(updateWatch).not.toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────────────────────────────
  // Case 3: Happy path — wishlist → owned
  // ──────────────────────────────────────────────────────────────────────
  it('happy path — wishlist→owned: updateWatch + logActivity fired; returns updated watch', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-id' } as any)
    const priorRow = {
      id: VALID_UUID,
      status: 'wishlist',
      brand: 'Omega',
      model: 'Speedmaster',
      imageUrl: null,
      notes: 'wanted this since 2019',
    }
    const updated = {
      id: VALID_UUID,
      status: 'owned',
      brand: 'Omega',
      model: 'Speedmaster',
      imageUrl: null,
      notes: 'wanted this since 2019',
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(updateWatch).mockResolvedValue(updated as any)
    vi.mocked(findOverlapRecipients).mockResolvedValue([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getProfileById).mockResolvedValue({ id: 'user-id', username: 'tester', displayName: 'Tester' } as any)

    const result = await moveWishlistToCollection(VALID_UUID)

    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual(updated)

    // updateWatch payload: status flipped, notes carried over, pricePaid null
    expect(updateWatch).toHaveBeenCalledWith(
      'user-id',
      VALID_UUID,
      expect.objectContaining({
        status: 'owned',
        pricePaid: null,
        notes: 'wanted this since 2019',
      }),
    )

    // logActivity fired with watch_added + WatchAddedMetadata shape (no `source` field — Pitfall 3)
    expect(logActivity).toHaveBeenCalledWith(
      'user-id',
      'watch_added',
      VALID_UUID,
      expect.objectContaining({ brand: 'Omega', model: 'Speedmaster' }),
    )
    // Pitfall 3 resolution — `source: 'wishlist_move'` is NOT in metadata
    expect(logActivity).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ source: 'wishlist_move' }),
    )

    // Overlap notifications block at least attempted
    expect(findOverlapRecipients).toHaveBeenCalledWith(
      expect.objectContaining({
        brand: 'Omega',
        model: 'Speedmaster',
        actorUserId: 'user-id',
      }),
    )
  })

  // ──────────────────────────────────────────────────────────────────────
  // Case 4: Idempotent already-owned — T-70-02 mitigation
  // ──────────────────────────────────────────────────────────────────────
  it('idempotent already-owned — returns {success:true, data:priorRow} WITHOUT side effects', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-id' } as any)
    const priorRow = {
      id: VALID_UUID,
      status: 'owned',
      brand: 'Rolex',
      model: 'Submariner',
      imageUrl: null,
      notes: null,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)

    const result = await moveWishlistToCollection(VALID_UUID)

    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual(priorRow)

    // T-70-02 verification: no re-fire of side-effects on double-click race
    expect(updateWatch).not.toHaveBeenCalled()
    expect(logActivity).not.toHaveBeenCalled()
    expect(findOverlapRecipients).not.toHaveBeenCalled()
    expect(logNotification).not.toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────────────────────────────
  // Case 5: Status whitelist — sold/grail rejection — T-70-03 mitigation
  // ──────────────────────────────────────────────────────────────────────
  it('status whitelist — sold rejected with "Cannot move sold watch to collection"', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-id' } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue({
      id: VALID_UUID,
      status: 'sold',
      brand: 'Tudor',
      model: 'Black Bay',
    } as any)

    const result = await moveWishlistToCollection(VALID_UUID)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Cannot move sold watch to collection')
    expect(updateWatch).not.toHaveBeenCalled()
  })

  it('status whitelist — grail rejected with "Cannot move grail watch to collection"', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-id' } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue({
      id: VALID_UUID,
      status: 'grail',
      brand: 'Patek Philippe',
      model: 'Nautilus 5711',
    } as any)

    const result = await moveWishlistToCollection(VALID_UUID)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Cannot move grail watch to collection')
    expect(updateWatch).not.toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────────────────────────────
  // Case 6: Not-yours rejection — T-70-01 IDOR mitigation (second layer)
  // ──────────────────────────────────────────────────────────────────────
  it('not-yours — getWatchById returns null → "Watch not found"; updateWatch NOT called', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-id' } as any)
    // Valid UUID but the row doesn't belong to this user — DAL returns null.
    vi.mocked(getWatchById).mockResolvedValue(null)

    const result = await moveWishlistToCollection(VALID_UUID)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Watch not found')
    // Verify the second-layer ownership gate caught the cross-user attempt,
    // not a Zod failure (case 2 covers Zod). getWatchById was called with the
    // authenticated user.id — confirming the IDOR mitigation pathway.
    expect(getWatchById).toHaveBeenCalledWith('user-id', VALID_UUID)
    expect(updateWatch).not.toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────────────────────────────
  // Case 7 (bonus side-effect chain): non-empty recipients → logNotification
  // ──────────────────────────────────────────────────────────────────────
  it('side-effect chain — non-empty findOverlapRecipients → logNotification per recipient', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'actor-id' } as any)
    const priorRow = {
      id: VALID_UUID,
      status: 'wishlist',
      brand: 'Omega',
      model: 'Speedmaster',
      imageUrl: null,
      notes: null,
    }
    const updated = {
      id: VALID_UUID,
      status: 'owned',
      brand: 'Omega',
      model: 'Speedmaster',
      imageUrl: null,
      notes: null,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(updateWatch).mockResolvedValue(updated as any)
    vi.mocked(findOverlapRecipients).mockResolvedValue([
      { userId: 'recipient-A' },
      { userId: 'recipient-B' },
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getProfileById).mockResolvedValue({
      id: 'actor-id',
      username: 'actor_user',
      displayName: 'Actor User',
    } as any)

    const result = await moveWishlistToCollection(VALID_UUID)

    expect(result.success).toBe(true)
    expect(logNotification).toHaveBeenCalledTimes(2)
    expect(logNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'watch_overlap',
        recipientUserId: 'recipient-A',
        actorUserId: 'actor-id',
        payload: expect.objectContaining({
          actor_username: 'actor_user',
          watch_id: VALID_UUID,
          watch_brand: 'Omega',
          watch_model: 'Speedmaster',
        }),
      }),
    )
  })
})
