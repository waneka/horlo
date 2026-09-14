// Phase 85 Plan 05 — server-side lifecycle contract (LIFE-02/03/04).
//
// Covers:
//   - markWatchPreviouslyOwned (LIFE-03 disposal commit; D-05/D-06/D-08/D-03)
//   - editWatch's D-07 dialog-only guard, D-04 undo-nulling, D-02 disposal-
//     field-ignore, and D-09 promotion signal (LIFE-04)
//   - addWatch's D-07 reject-on-create guard
//   - moveWishlistToCollection's D-09 promotion signal
//
// Mock block mirrors watches-recs-invalidation.test.ts so the module imports
// cleanly and next/cache's updateTag/revalidateTag/revalidatePath are all
// vi.fn() stubs.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
  editWatch,
  moveWishlistToCollection,
  markWatchPreviouslyOwned,
} from '@/app/actions/watches'
import { getCurrentUser } from '@/lib/auth'
import { getWatchById, updateWatch, getMaxWishlistSortOrder, createWatch } from '@/data/watches'
import { getProfileById } from '@/data/profiles'
import { updateTag, revalidateTag, revalidatePath } from 'next/cache'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'
const USER_ID = 'user-id'
const TODAY = '2026-09-13'

function mkWatchRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: VALID_UUID,
    brand: 'Omega',
    model: 'Speedmaster',
    status: 'owned',
    imageUrl: null,
    notes: null,
    catalogId: null,
    ...overrides,
  }
}

describe('markWatchPreviouslyOwned (LIFE-03)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-13T12:00:00Z'))
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getCurrentUser).mockResolvedValue({ id: USER_ID } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getProfileById).mockResolvedValue({ id: USER_ID, username: 'tester' } as any)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('getCurrentUser throws → Not authenticated; updateWatch not called', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('nope'))
    const result = await markWatchPreviouslyOwned({
      watchId: VALID_UUID,
      disposalReason: 'sold',
      today: TODAY,
    })
    expect(result).toEqual({ success: false, error: 'Not authenticated' })
    expect(updateWatch).not.toHaveBeenCalled()
  })

  it('missing disposalReason → Invalid request', async () => {
    const result = await markWatchPreviouslyOwned({
      watchId: VALID_UUID,
      today: TODAY,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(updateWatch).not.toHaveBeenCalled()
  })

  it('disposalReason "burned" (not in enum) → Invalid request', async () => {
    const result = await markWatchPreviouslyOwned({
      watchId: VALID_UUID,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      disposalReason: 'burned' as any,
      today: TODAY,
    })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(updateWatch).not.toHaveBeenCalled()
  })

  it('extra key (e.g. status) → Invalid request (strict schema)', async () => {
    const result = await markWatchPreviouslyOwned({
      watchId: VALID_UUID,
      disposalReason: 'sold',
      today: TODAY,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: 'owned',
    } as any)
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(updateWatch).not.toHaveBeenCalled()
  })

  it('implausible today (2030-01-01) → Invalid request', async () => {
    const result = await markWatchPreviouslyOwned({
      watchId: VALID_UUID,
      disposalReason: 'sold',
      today: '2030-01-01',
    })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(updateWatch).not.toHaveBeenCalled()
  })

  it('disposalDate later than today → "Disposal date can\'t be in the future."', async () => {
    const result = await markWatchPreviouslyOwned({
      watchId: VALID_UUID,
      disposalReason: 'sold',
      disposalDate: '2026-09-14',
      today: TODAY,
    })
    expect(result).toEqual({ success: false, error: "Disposal date can't be in the future." })
    expect(updateWatch).not.toHaveBeenCalled()
  })

  it('getWatchById → null → Watch not found', async () => {
    vi.mocked(getWatchById).mockResolvedValue(null)
    const result = await markWatchPreviouslyOwned({
      watchId: VALID_UUID,
      disposalReason: 'sold',
      today: TODAY,
    })
    expect(result).toEqual({ success: false, error: 'Watch not found' })
    expect(updateWatch).not.toHaveBeenCalled()
  })

  it('prior status wishlist → rejected, no update', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(mkWatchRow({ status: 'wishlist' }) as any)
    const result = await markWatchPreviouslyOwned({
      watchId: VALID_UUID,
      disposalReason: 'sold',
      today: TODAY,
    })
    expect(result).toEqual({
      success: false,
      error: 'Cannot mark wishlist watch as previously owned',
    })
    expect(updateWatch).not.toHaveBeenCalled()
  })

  it('prior status previously_owned → idempotent success with prior row, no update', async () => {
    const priorRow = mkWatchRow({ status: 'previously_owned', disposalReason: 'sold' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)
    const result = await markWatchPreviouslyOwned({
      watchId: VALID_UUID,
      disposalReason: 'lost',
      today: TODAY,
    })
    expect(result).toEqual({ success: true, data: priorRow })
    expect(updateWatch).not.toHaveBeenCalled()
  })

  it('owned + full payload → updateWatch called correctly; full D-08 fan-out; success', async () => {
    const priorRow = mkWatchRow({ status: 'owned' })
    const updated = mkWatchRow({
      status: 'previously_owned',
      disposalReason: 'traded',
      sellPrice: 1500,
      disposalDate: '2026-03-02',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(updateWatch).mockResolvedValue(updated as any)

    const result = await markWatchPreviouslyOwned({
      watchId: VALID_UUID,
      disposalReason: 'traded',
      sellPrice: 1500,
      disposalDate: '2026-03-02',
      today: TODAY,
    })

    expect(result).toEqual({ success: true, data: updated })
    expect(updateWatch).toHaveBeenCalledWith(USER_ID, VALID_UUID, {
      status: 'previously_owned',
      disposalReason: 'traded',
      sellPrice: 1500,
      disposalDate: '2026-03-02',
    })
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith(`viewer:${USER_ID}:recs`)
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith('profile:tester')
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith('explore', 'max')
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/')
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/u/[username]', 'layout')
  })

  it('owned + reason only → payload carries sellPrice/disposalDate keys as undefined', async () => {
    const priorRow = mkWatchRow({ status: 'owned' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(updateWatch).mockResolvedValue(mkWatchRow({ status: 'previously_owned' }) as any)

    await markWatchPreviouslyOwned({
      watchId: VALID_UUID,
      disposalReason: 'lost',
      today: TODAY,
    })

    const call = vi.mocked(updateWatch).mock.calls[0]
    const payload = call[2] as Record<string, unknown>
    expect('sellPrice' in payload).toBe(true)
    expect(payload.sellPrice).toBeUndefined()
    expect('disposalDate' in payload).toBe(true)
    expect(payload.disposalDate).toBeUndefined()
  })

  it('negative sellPrice → Invalid request', async () => {
    const result = await markWatchPreviouslyOwned({
      watchId: VALID_UUID,
      disposalReason: 'sold',
      sellPrice: -5,
      today: TODAY,
    })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(updateWatch).not.toHaveBeenCalled()
  })
})

describe('editWatch — D-07/D-04/D-02/D-09 (LIFE-03/04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getCurrentUser).mockResolvedValue({ id: USER_ID } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getProfileById).mockResolvedValue({ id: USER_ID, username: 'tester' } as any)
  })

  it('prior wishlist, status→owned → promoted true, promotedFrom wishlist', async () => {
    const priorRow = mkWatchRow({ status: 'wishlist' })
    const updated = mkWatchRow({ status: 'owned' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(updateWatch).mockResolvedValue(updated as any)

    const result = await editWatch(VALID_UUID, { status: 'owned' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.promoted).toBe(true)
      expect(result.data.promotedFrom).toBe('wishlist')
      expect(result.data.watch).toEqual(updated)
    }
  })

  it('prior grail, status→owned → promoted true, promotedFrom grail', async () => {
    const priorRow = mkWatchRow({ status: 'grail' })
    const updated = mkWatchRow({ status: 'owned' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(updateWatch).mockResolvedValue(updated as any)

    const result = await editWatch(VALID_UUID, { status: 'owned' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.promoted).toBe(true)
      expect(result.data.promotedFrom).toBe('grail')
    }
  })

  it('prior owned, non-status edit → promoted false, promotedFrom null', async () => {
    const priorRow = mkWatchRow({ status: 'owned' })
    const updated = mkWatchRow({ status: 'owned', brand: 'Rolex' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(updateWatch).mockResolvedValue(updated as any)

    const result = await editWatch(VALID_UUID, { brand: 'Rolex' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.promoted).toBe(false)
      expect(result.data.promotedFrom).toBe(null)
    }
  })

  it('prior owned, status→wishlist → promoted false', async () => {
    const priorRow = mkWatchRow({ status: 'owned' })
    const updated = mkWatchRow({ status: 'wishlist' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(updateWatch).mockResolvedValue(updated as any)

    const result = await editWatch(VALID_UUID, { status: 'wishlist' })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.promoted).toBe(false)
  })

  it('D-07: prior owned, status→previously_owned rejected; updateWatch not called', async () => {
    const priorRow = mkWatchRow({ status: 'owned' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)

    const result = await editWatch(VALID_UUID, {
      status: 'previously_owned',
      disposalReason: 'sold',
    })

    expect(result).toEqual({
      success: false,
      error: 'Use "Mark as previously owned" to record a watch leaving your collection.',
    })
    expect(updateWatch).not.toHaveBeenCalled()
  })

  it('D-04: prior previously_owned, status→owned → disposal keys forced to undefined', async () => {
    const priorRow = mkWatchRow({
      status: 'previously_owned',
      disposalReason: 'sold',
      sellPrice: 900,
      disposalDate: '2026-01-05',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(updateWatch).mockResolvedValue(mkWatchRow({ status: 'owned' }) as any)

    await editWatch(VALID_UUID, { status: 'owned', disposalReason: 'lost', sellPrice: 10 })

    const call = vi.mocked(updateWatch).mock.calls[0]
    const payload = call[2] as Record<string, unknown>
    expect(payload.status).toBe('owned')
    expect('disposalReason' in payload).toBe(true)
    expect(payload.disposalReason).toBeUndefined()
    expect('sellPrice' in payload).toBe(true)
    expect(payload.sellPrice).toBeUndefined()
    expect('disposalDate' in payload).toBe(true)
    expect(payload.disposalDate).toBeUndefined()
  })

  it('editing an already-disposed watch: sellPrice/disposalDate pass through with valid today', async () => {
    const priorRow = mkWatchRow({
      status: 'previously_owned',
      disposalReason: 'sold',
      sellPrice: 100,
      disposalDate: '2025-01-01',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(updateWatch).mockResolvedValue(mkWatchRow({ status: 'previously_owned' }) as any)
    vi.setSystemTime(new Date('2026-09-13T12:00:00Z'))

    await editWatch(VALID_UUID, {
      status: 'previously_owned',
      sellPrice: 900,
      disposalDate: '2026-01-05',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      today: '2026-09-13',
    } as any)

    const call = vi.mocked(updateWatch).mock.calls[0]
    const payload = call[2] as Record<string, unknown>
    expect(payload.sellPrice).toBe(900)
    expect(payload.disposalDate).toBe('2026-01-05')
    expect('today' in payload).toBe(false)
  })

  it('editing a disposed watch with a future disposalDate + today → rejected', async () => {
    const priorRow = mkWatchRow({ status: 'previously_owned', disposalReason: 'sold' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)

    const result = await editWatch(VALID_UUID, {
      disposalDate: '2026-09-20',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      today: '2026-09-13',
    } as any)

    expect(result).toEqual({ success: false, error: "Disposal date can't be in the future." })
    expect(updateWatch).not.toHaveBeenCalled()
  })

  it('editing a disposed watch with disposalDate but no today → Invalid request', async () => {
    const priorRow = mkWatchRow({ status: 'previously_owned', disposalReason: 'sold' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)

    const result = await editWatch(VALID_UUID, { disposalDate: '2026-01-05' })

    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(updateWatch).not.toHaveBeenCalled()
  })

  it('D-04 reason cannot be cleared: disposalReason/sellPrice keys present-but-undefined on a still-disposed watch drop disposalReason, keep sellPrice', async () => {
    const priorRow = mkWatchRow({
      status: 'previously_owned',
      disposalReason: 'sold',
      sellPrice: 500,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(updateWatch).mockResolvedValue(mkWatchRow({ status: 'previously_owned' }) as any)

    await editWatch(VALID_UUID, {
      disposalReason: undefined,
      sellPrice: undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const call = vi.mocked(updateWatch).mock.calls[0]
    const payload = call[2] as Record<string, unknown>
    expect('disposalReason' in payload).toBe(false)
    expect('sellPrice' in payload).toBe(true)
  })

  it('D-02: disposal fields ignored for a non-previously-owned watch', async () => {
    const priorRow = mkWatchRow({ status: 'owned' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(updateWatch).mockResolvedValue(mkWatchRow({ status: 'owned', brand: 'Rolex' }) as any)

    await editWatch(VALID_UUID, { brand: 'Rolex', disposalReason: 'sold', sellPrice: 5 })

    const call = vi.mocked(updateWatch).mock.calls[0]
    const payload = call[2] as Record<string, unknown>
    expect('disposalReason' in payload).toBe(false)
    expect('sellPrice' in payload).toBe(false)
    expect('disposalDate' in payload).toBe(false)
  })
})

describe('addWatch — D-07 reject previously_owned on create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getCurrentUser).mockResolvedValue({ id: USER_ID } as any)
  })

  it('status previously_owned on addWatch → rejected, createWatch not called', async () => {
    const result = await addWatch({
      brand: 'Omega',
      model: 'Speedmaster',
      status: 'previously_owned',
    })
    expect(result).toEqual({
      success: false,
      error: 'New watches can not be added as previously owned.',
    })
    expect(createWatch).not.toHaveBeenCalled()
  })
})

describe('moveWishlistToCollection — D-09 promotion signal (LIFE-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getCurrentUser).mockResolvedValue({ id: USER_ID } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getProfileById).mockResolvedValue({ id: USER_ID, username: 'tester' } as any)
  })

  it('prior wishlist → data.watch/promoted true/promotedFrom wishlist', async () => {
    const priorRow = mkWatchRow({ status: 'wishlist' })
    const updated = mkWatchRow({ status: 'owned' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(updateWatch).mockResolvedValue(updated as any)
    vi.mocked(getMaxWishlistSortOrder).mockResolvedValue(0)

    const result = await moveWishlistToCollection(VALID_UUID)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ watch: updated, promoted: true, promotedFrom: 'wishlist' })
    }
  })

  it('prior owned → idempotent data.watch=priorRow/promoted false/promotedFrom null', async () => {
    const priorRow = mkWatchRow({ status: 'owned' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getWatchById).mockResolvedValue(priorRow as any)

    const result = await moveWishlistToCollection(VALID_UUID)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ watch: priorRow, promoted: false, promotedFrom: null })
    }
    expect(updateWatch).not.toHaveBeenCalled()
  })
})
