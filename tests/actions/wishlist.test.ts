import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
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

vi.mock('@/data/watches', () => ({
  createWatch: vi.fn(),
}))

vi.mock('@/data/activities', () => ({
  logActivity: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Drizzle JOIN mock — the action does:
//   db.select({ ... }).from(wearEvents).innerJoin(...).innerJoin(...).where(...).limit(1)
let mockJoinRows: unknown[] = []

function makeSelectChain() {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(mockJoinRows),
  } as never
  return chain
}

vi.mock('@/db', () => ({
  db: {
    select: () => makeSelectChain(),
  },
}))

import { addToWishlistFromWearEvent } from '@/app/actions/wishlist'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import * as watchDAL from '@/data/watches'
import * as activitiesDAL from '@/data/activities'
import { revalidatePath } from 'next/cache'

// Valid v4 UUID literals
const viewerUserId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const actorUserId = '11111111-2222-4333-8444-555555555555'
const wearEventId = '22222222-3333-4444-8555-666666666666'
const sourceWatchId = '33333333-4444-4555-8666-777777777777'
const newWatchId = '44444444-5555-4666-8777-888888888888'

function publicWearJoinRow(overrides: Record<string, unknown> = {}) {
  return {
    watchId: sourceWatchId,
    actorId: actorUserId,
    brand: 'Rolex',
    model: 'Submariner',
    imageUrl: 'https://example.com/sub.jpg',
    movement: 'automatic',
    wornPublic: true,
    ...overrides,
  }
}

describe('addToWishlistFromWearEvent Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockJoinRows = []
  })

  it('Test 1: unauth — returns Not authenticated; no DB work', async () => {
    ;(getCurrentUser as Mock).mockRejectedValueOnce(new UnauthorizedError())
    const result = await addToWishlistFromWearEvent({ wearEventId })
    expect(result).toEqual({ success: false, error: 'Not authenticated' })
    expect(watchDAL.createWatch).not.toHaveBeenCalled()
    expect(activitiesDAL.logActivity).not.toHaveBeenCalled()
  })

  it('Test 2: missing wearEventId — Invalid request', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@h.test' })
    const result = await addToWishlistFromWearEvent({})
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(watchDAL.createWatch).not.toHaveBeenCalled()
  })

  it('Test 3: non-UUID wearEventId — Invalid request', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@h.test' })
    const result = await addToWishlistFromWearEvent({ wearEventId: 'not-a-uuid' })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(watchDAL.createWatch).not.toHaveBeenCalled()
  })

  it('Test 4: extra key in payload — .strict() rejects (mass-assignment protection)', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@h.test' })
    const result = await addToWishlistFromWearEvent({
      wearEventId,
      brand: 'Injected',
      role: 'admin',
    })
    expect(result).toEqual({ success: false, error: 'Invalid request' })
    expect(watchDAL.createWatch).not.toHaveBeenCalled()
  })

  it('Test 5: wear event not found OR privacy-gated — Wear event not found', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@h.test' })
    // Case A: no row at all.
    mockJoinRows = []
    const resultMissing = await addToWishlistFromWearEvent({ wearEventId })
    expect(resultMissing).toEqual({ success: false, error: 'Wear event not found' })
    expect(watchDAL.createWatch).not.toHaveBeenCalled()

    // Case B: row exists but actor has wornPublic=false and is not viewer.
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@h.test' })
    mockJoinRows = [publicWearJoinRow({ wornPublic: false })]
    const resultPrivate = await addToWishlistFromWearEvent({ wearEventId })
    expect(resultPrivate).toEqual({ success: false, error: 'Wear event not found' })
    expect(watchDAL.createWatch).not.toHaveBeenCalled()
  })

  it('Test 6: happy path — creates wishlist row, logs activity, revalidates /, returns watchId', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@h.test' })
    mockJoinRows = [publicWearJoinRow()]
    ;(watchDAL.createWatch as Mock).mockResolvedValueOnce({
      id: newWatchId,
      brand: 'Rolex',
      model: 'Submariner',
      status: 'wishlist',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
      imageUrl: 'https://example.com/sub.jpg',
    })
    ;(activitiesDAL.logActivity as Mock).mockResolvedValueOnce(undefined)

    const result = await addToWishlistFromWearEvent({ wearEventId })

    expect(result).toEqual({ success: true, data: { watchId: newWatchId } })

    expect(watchDAL.createWatch).toHaveBeenCalledTimes(1)
    const [calledUserId, calledData] = (watchDAL.createWatch as Mock).mock.calls[0]
    expect(calledUserId).toBe(viewerUserId)
    expect(calledData).toMatchObject({
      brand: 'Rolex',
      model: 'Submariner',
      status: 'wishlist',
      movement: 'automatic',
    })

    expect(activitiesDAL.logActivity).toHaveBeenCalledTimes(1)
    expect(activitiesDAL.logActivity).toHaveBeenCalledWith(
      viewerUserId,
      'wishlist_added',
      newWatchId,
      {
        brand: 'Rolex',
        model: 'Submariner',
        imageUrl: 'https://example.com/sub.jpg',
      },
    )

    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('Test 7: duplicate — second call still creates a NEW wishlist row (per-user-independent-entries)', async () => {
    ;(getCurrentUser as Mock).mockResolvedValue({ id: viewerUserId, email: 'v@h.test' })
    mockJoinRows = [publicWearJoinRow()]
    ;(watchDAL.createWatch as Mock)
      .mockResolvedValueOnce({
        id: newWatchId,
        brand: 'Rolex',
        model: 'Submariner',
        status: 'wishlist',
        movement: 'automatic',
        complications: [],
        styleTags: [],
        designTraits: [],
        roleTags: [],
        imageUrl: null,
      })
      .mockResolvedValueOnce({
        id: 'another-watch-id',
        brand: 'Rolex',
        model: 'Submariner',
        status: 'wishlist',
        movement: 'automatic',
        complications: [],
        styleTags: [],
        designTraits: [],
        roleTags: [],
        imageUrl: null,
      })

    const r1 = await addToWishlistFromWearEvent({ wearEventId })
    const r2 = await addToWishlistFromWearEvent({ wearEventId })

    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    expect(watchDAL.createWatch).toHaveBeenCalledTimes(2)
  })

  it('Test 8: activity log failure is non-fatal — mutation still succeeds', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@h.test' })
    mockJoinRows = [publicWearJoinRow()]
    ;(watchDAL.createWatch as Mock).mockResolvedValueOnce({
      id: newWatchId,
      brand: 'Rolex',
      model: 'Submariner',
      status: 'wishlist',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
      imageUrl: null,
    })
    // Silence expected console.error from the fire-and-forget catch block.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(activitiesDAL.logActivity as Mock).mockRejectedValueOnce(new Error('activity log down'))

    const result = await addToWishlistFromWearEvent({ wearEventId })
    expect(result).toEqual({ success: true, data: { watchId: newWatchId } })
    expect(revalidatePath).toHaveBeenCalledWith('/')
    errSpy.mockRestore()
  })

  it('Test 9 (bonus): self wear event (actor==viewer) is allowed even when wornPublic=false', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@h.test' })
    mockJoinRows = [publicWearJoinRow({ actorId: viewerUserId, wornPublic: false })]
    ;(watchDAL.createWatch as Mock).mockResolvedValueOnce({
      id: newWatchId,
      brand: 'Rolex',
      model: 'Submariner',
      status: 'wishlist',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
      imageUrl: null,
    })
    const result = await addToWishlistFromWearEvent({ wearEventId })
    expect(result.success).toBe(true)
  })
})
