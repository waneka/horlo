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

// Drizzle mock — the action calls db.select() TWICE on followers-tier non-self cases:
//   1. JOIN (wear_events + watches + profile_settings) → mockJoinRows
//   2. follows check (wear_events.visibility === 'followers' && !isSelf only) → mockFollowRows
//
// Simple contract:
//   - Each test sets mockJoinRows for the JOIN result and mockFollowRows for the optional follows check.
//   - Tests that call the action multiple times use mockSelectQueue to enqueue [joinRows] per invocation;
//     the mock pops from the queue first, then falls back to mockJoinRows.
//   - selectCallCount counts every db.select() call in the test — used by Tests 9-11 to assert
//     that the correct number of queries was issued.
let mockJoinRows: unknown[] = []        // JOIN result for the current/single action invocation
let mockFollowRows: unknown[] = []      // follows-check result (used only when action issues it)
let mockSelectQueue: unknown[][] = []   // optional queue for multi-call tests (each entry = one JOIN result)
let selectCallCount = 0

function makeSelectChain(rowsPromise: Promise<unknown[]>) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: () => rowsPromise,
  } as never
  return chain
}

// Per-invocation call index: resets each time a new action invocation starts (i.e., at callIdx=0
// within the action). We detect "new invocation" by tracking whether the previous call was the
// last expected call for the prior invocation. Since this is complex for a simple public/private
// case, we use a simpler heuristic: the mock vi.fn() for db.select is replaced with an
// implementation that uses a flat response queue populated by helper functions on a per-test basis.
//
// For single-invocation tests (most tests): just set mockJoinRows (queue not needed).
// For multi-invocation tests (Test 7): push multiple entries into mockSelectQueue before the test.
// For followers-tier tests (Tests 10, 11): set mockJoinRows + mockFollowRows; the action will call
//   db.select twice and the mock dispatches JOIN first (call #1), follows second (call #2).
//
// Dispatch logic: uses a flat _responseQueue that is rebuilt from mockSelectQueue/mockJoinRows at
// the start of each vi.fn() call.
let _joinCallCount = 0

vi.mock('@/db', () => ({
  db: {
    select: () => {
      selectCallCount++
      // Determine which rows to return.
      // If mockSelectQueue has entries, pop the first as the JOIN result for this invocation.
      // Otherwise use mockJoinRows.
      // The follows-check call is the second call after a followers-tier JOIN: we detect it by
      // checking if mockFollowRows was set AND we have already returned a JOIN row (joinCallCount > 0).
      // We track "are we in a follows check?" by whether mockFollowRows is non-empty and we've
      // already dispatched a JOIN for the current logical invocation.
      //
      // Simplified: alternate JOIN / follows only when mockFollowRows is non-empty.
      // Otherwise always return JOIN rows (handles all public/private cases without follows).
      let rows: unknown[]
      if (mockSelectQueue.length > 0) {
        // Multi-invocation test: pop queue entry as JOIN result.
        rows = mockSelectQueue.shift() ?? []
        _joinCallCount++
      } else if (_joinCallCount === 0 || mockFollowRows.length === 0) {
        // Single-invocation OR no follows needed yet: this is a JOIN call.
        rows = mockJoinRows
        _joinCallCount++
      } else {
        // Second call after a JOIN when mockFollowRows is populated: follows check.
        rows = mockFollowRows
        _joinCallCount = 0  // reset for next invocation within the same test
      }
      return makeSelectChain(Promise.resolve(rows))
    },
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
    profilePublic: true,
    visibility: 'public',
    ...overrides,
  }
}

describe('addToWishlistFromWearEvent Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockJoinRows = []
    mockSelectQueue = []
    mockFollowRows = []
    selectCallCount = 0
    _joinCallCount = 0
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

  it('Test 5: wear event not found OR privacy-gated (three-tier) — Wear event not found', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@h.test' })
    // Case A: no row at all.
    mockJoinRows = []
    const resultMissing = await addToWishlistFromWearEvent({ wearEventId })
    expect(resultMissing).toEqual({ success: false, error: 'Wear event not found' })
    expect(watchDAL.createWatch).not.toHaveBeenCalled()

    // Case B: row exists but actor's wear is visibility='private' and viewer is not the actor.
    // Per src/app/actions/wishlist.ts the three-tier gate denies non-self + non-public + non-followers-with-follow.
    // This exercises the 'private' deny branch explicitly (no follows query should be issued — isSelf=false, visibility !== 'followers').
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@h.test' })
    mockJoinRows = [publicWearJoinRow({ visibility: 'private' })]
    const resultPrivate = await addToWishlistFromWearEvent({ wearEventId })
    expect(resultPrivate).toEqual({ success: false, error: 'Wear event not found' })
    expect(watchDAL.createWatch).not.toHaveBeenCalled()

    // Case C: row exists with profilePublic=false (G-4 outer gate fails) even for 'public' visibility.
    // Exercises the profilePublic=false deny branch — confirms the outer gate is not bypassable via visibility alone.
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@h.test' })
    mockJoinRows = [publicWearJoinRow({ profilePublic: false, visibility: 'public' })]
    const resultOuterGate = await addToWishlistFromWearEvent({ wearEventId })
    expect(resultOuterGate).toEqual({ success: false, error: 'Wear event not found' })
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

  it('Test 9 (bonus): G-5 self-bypass — self wear event (actorId == viewerUserId) is allowed regardless of visibility', async () => {
    ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: viewerUserId, email: 'v@h.test' })
    // Even visibility='private' + profilePublic=false must succeed when viewer is the actor.
    // isSelf short-circuits the canSee logic (src/app/actions/wishlist.ts:84,104).
    mockJoinRows = [publicWearJoinRow({
      actorId: viewerUserId,
      visibility: 'private',
      profilePublic: false,
    })]
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
    // G-5 self-bypass must NOT issue a follows query (selectCallCount stays at 1).
    expect(selectCallCount).toBe(1)
  })
})
