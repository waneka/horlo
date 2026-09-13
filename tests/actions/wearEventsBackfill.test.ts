// tests/actions/wearEventsBackfill.test.ts — Phase 84 Plan 02 — logBackfillWear
// Server Action contract (WEAR-02).
//
// WEAR-02 / D-NN -> test-N mapping:
//   D-02 (server rejects future wornDate independent of client <input max>) -> Test 3
//   D-03/D-04 (accepts watchId+wornDate+note+visibility, photo-less)        -> Test 5
//   D-05 (duplicate (user,watch,wornDate) -> friendly 23505 backstop)      -> Test 7
//   D-06 (activity written only when wornDate === today)                   -> Tests 6, 10
//   IDOR (cross-user watchId -> uniform 'Watch not found')                 -> Test 4
//   Cache invalidation (updateTag read-your-own-writes)                    -> Tests 5, 11
//
// Mock layout mirrors tests/actions/wearEventsVideo.test.ts — vi.mock for
// getCurrentUser + DAL + next/cache + Storage; per-test mock configuration
// via (mockedFn as Mock).mockResolvedValueOnce / mockRejectedValueOnce.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be declared BEFORE imports that pull in the action module so
// vitest's hoisted vi.mock factories replace the real modules before they load.
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

// Mock every named export from @/data/wearEvents that the action module's
// namespace import (`import * as wearEventDAL from '@/data/wearEvents'`)
// could touch — otherwise vitest throws "X is not a function" at action load.
vi.mock('@/data/wearEvents', () => ({
  logWearEventWithVideo: vi.fn(),
  logWearEventWithPhoto: vi.fn(),
  logWearEvent: vi.fn(),
  getWornTodayIdsForUser: vi.fn(),
  hideWearPic: vi.fn(),
  unhideWearPic: vi.fn(),
}))

vi.mock('@/data/watches', () => ({
  getWatchById: vi.fn(),
}))

vi.mock('@/data/profiles', () => ({
  getProfileById: vi.fn(),
}))

vi.mock('@/data/activities', () => ({
  logActivity: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}))

import { logBackfillWear } from '@/app/actions/wearEvents'
import { getCurrentUser } from '@/lib/auth'
import * as wearEventDAL from '@/data/wearEvents'
import * as watchDAL from '@/data/watches'
import * as profilesDAL from '@/data/profiles'
import { logActivity } from '@/data/activities'
import { updateTag, revalidatePath, revalidateTag } from 'next/cache'

// ---------------------------------------------------------------------------
// Test fixtures — valid v4 UUIDs
// ---------------------------------------------------------------------------
const userId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const watchId = '11111111-2222-4333-8444-555555555555'

const mockUser = { id: userId, email: 'p84@horlo.test' }
const mockWatch = {
  id: watchId,
  brand: 'Omega',
  model: 'Speedmaster',
  imageUrl: null,
}
const mockProfile = { username: 'alice' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function authAs(user: { id: string; email: string } = mockUser) {
  ;(getCurrentUser as Mock).mockResolvedValueOnce(user)
}
function authFail() {
  ;(getCurrentUser as Mock).mockRejectedValueOnce(new Error('Not authenticated'))
}

type ValidInput = Parameters<typeof logBackfillWear>[0]
function mkInput(overrides: Record<string, unknown> = {}): ValidInput {
  return {
    watchId,
    wornDate: '2026-08-01',
    today: '2026-09-12',
    note: null,
    visibility: 'public',
    ...overrides,
  } as ValidInput
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('logBackfillWear (Phase 84 Plan 02 — WEAR-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Test 1: auth gate — fail BEFORE Zod/IDOR/DAL
  it('(1) unauthenticated → Not authenticated; no DAL call', async () => {
    authFail()

    const r = await logBackfillWear(mkInput())

    expect(r).toEqual({ success: false, error: 'Not authenticated' })
    expect(wearEventDAL.logWearEventWithPhoto).not.toHaveBeenCalled()
    expect(watchDAL.getWatchById).not.toHaveBeenCalled()
  })

  // Test 2: Zod gate — every malformed-field case rejected uniformly
  it('(2) invalid input rejected for each malformed field; no DAL insert in any case', async () => {
    // Every call in this loop must authenticate successfully — use
    // mockResolvedValue (not Once) so all 7 iterations pass auth.
    ;(getCurrentUser as Mock).mockResolvedValue(mockUser)

    const invalidCases: Record<string, unknown>[] = [
      { wornDate: '2026-9-1' }, // fails regex shape
      { wornDate: '2026-02-30' }, // regex-valid, not a real calendar date
      { today: 'yesterday' }, // fails regex shape
      { note: 'x'.repeat(201) }, // exceeds 200-char cap
      { visibility: 'secret' }, // not in the 3-tier enum
      { watchId: 'not-a-uuid' }, // fails uuid check
      { photoUrl: 'x' }, // extra unknown key — .strict() rejects
    ]

    for (const overrides of invalidCases) {
      const r = await logBackfillWear(mkInput(overrides))
      expect(r).toEqual({ success: false, error: 'Invalid input' })
    }

    expect(wearEventDAL.logWearEventWithPhoto).not.toHaveBeenCalled()
    expect(watchDAL.getWatchById).not.toHaveBeenCalled()
  })

  // Test 3: D-02 — future wornDate rejected server-side, independent of
  // the client <input max>. IDOR check runs before the date check, so the
  // watch must resolve successfully here.
  it('(3) D-02 future wornDate → "Can\'t log a wear for a future date."; no insert, no activity', async () => {
    authAs()
    ;(watchDAL.getWatchById as Mock).mockResolvedValueOnce(mockWatch)

    const r = await logBackfillWear(
      mkInput({ wornDate: '2026-09-13', today: '2026-09-12' }),
    )

    expect(r).toEqual({
      success: false,
      error: "Can't log a wear for a future date.",
    })
    expect(wearEventDAL.logWearEventWithPhoto).not.toHaveBeenCalled()
    expect(logActivity).not.toHaveBeenCalled()
  })

  // Test 4: IDOR — cross-user watchId returns uniform 'Watch not found'
  it('(4) IDOR cross-user watchId → Watch not found (uniform); no insert', async () => {
    authAs()
    ;(watchDAL.getWatchById as Mock).mockResolvedValueOnce(null)

    const r = await logBackfillWear(mkInput())

    expect(r).toEqual({ success: false, error: 'Watch not found' })
    expect(watchDAL.getWatchById).toHaveBeenCalledWith(userId, watchId)
    expect(wearEventDAL.logWearEventWithPhoto).not.toHaveBeenCalled()
  })

  // Test 5: D-03/D-04 — past-date success writes a photo-less wear, no
  // activity, and invalidates the owner's profile cache read-your-own-writes.
  it('(5) past-date success → photo-less insert; no activity; RYO cache invalidation', async () => {
    authAs()
    ;(watchDAL.getWatchById as Mock).mockResolvedValueOnce(mockWatch)
    ;(wearEventDAL.logWearEventWithPhoto as Mock).mockResolvedValueOnce(undefined)
    ;(profilesDAL.getProfileById as Mock).mockResolvedValueOnce(mockProfile)

    const r = await logBackfillWear(
      mkInput({
        wornDate: '2026-08-01',
        today: '2026-09-12',
        note: '  strap swap  ',
        visibility: 'followers',
      }),
    )

    expect(wearEventDAL.logWearEventWithPhoto).toHaveBeenCalledTimes(1)
    const call = (wearEventDAL.logWearEventWithPhoto as Mock).mock.calls[0][0]
    expect(call).toMatchObject({
      userId,
      watchId,
      wornDate: '2026-08-01',
      note: 'strap swap',
      photoUrl: null,
      visibility: 'followers',
    })
    expect(call.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(logActivity).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/')
    expect(updateTag).toHaveBeenCalledWith('profile:alice')
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(r).toEqual({
      success: true,
      data: { wearEventId: call.id },
    })
  })

  // Test 6: D-06 — today success writes the watch_worn activity
  it('(6) D-06 today success → logActivity called once with brand/model/visibility', async () => {
    authAs()
    ;(watchDAL.getWatchById as Mock).mockResolvedValueOnce(mockWatch)
    ;(wearEventDAL.logWearEventWithPhoto as Mock).mockResolvedValueOnce(undefined)
    ;(profilesDAL.getProfileById as Mock).mockResolvedValueOnce(mockProfile)

    const r = await logBackfillWear(
      mkInput({
        wornDate: '2026-09-12',
        today: '2026-09-12',
        visibility: 'public',
      }),
    )

    expect(logActivity).toHaveBeenCalledTimes(1)
    expect(logActivity).toHaveBeenCalledWith(userId, 'watch_worn', watchId, {
      brand: mockWatch.brand,
      model: mockWatch.model,
      imageUrl: null,
      visibility: 'public',
    })
    expect(r.success).toBe(true)
  })

  // Test 7: D-05 — duplicate-day 23505 backstop returns the friendly error
  // and logs no activity.
  it('(7) D-05 duplicate 23505 → friendly error; no activity; no cache invalidation', async () => {
    authAs()
    ;(watchDAL.getWatchById as Mock).mockResolvedValueOnce(mockWatch)
    ;(wearEventDAL.logWearEventWithPhoto as Mock).mockRejectedValueOnce(
      Object.assign(new Error('dup'), { code: '23505' }),
    )

    const r = await logBackfillWear(
      mkInput({ wornDate: '2026-09-12', today: '2026-09-12' }),
    )

    expect(r).toEqual({
      success: false,
      error: 'Already logged this watch on that date.',
    })
    expect(logActivity).not.toHaveBeenCalled()
    expect(updateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  // Test 8: other DB error → generic message
  it('(8) other DB error (non-23505) → generic "Couldn\'t log that wear."', async () => {
    authAs()
    ;(watchDAL.getWatchById as Mock).mockResolvedValueOnce(mockWatch)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(wearEventDAL.logWearEventWithPhoto as Mock).mockRejectedValueOnce(
      Object.assign(new Error('boom'), { code: 'XX000' }),
    )

    const r = await logBackfillWear(mkInput())

    expect(r).toEqual({ success: false, error: "Couldn't log that wear." })
    errSpy.mockRestore()
  })

  // Test 9: whitespace-only note normalizes to null
  it('(9) whitespace-only note → inserted note is null', async () => {
    authAs()
    ;(watchDAL.getWatchById as Mock).mockResolvedValueOnce(mockWatch)
    ;(wearEventDAL.logWearEventWithPhoto as Mock).mockResolvedValueOnce(undefined)
    ;(profilesDAL.getProfileById as Mock).mockResolvedValueOnce(mockProfile)

    await logBackfillWear(mkInput({ note: '   ' }))

    const call = (wearEventDAL.logWearEventWithPhoto as Mock).mock.calls[0][0]
    expect(call.note).toBeNull()
  })

  // Test 10: activity failure is non-fatal — the write still succeeds
  it('(10) today activity log failure is non-fatal → still success', async () => {
    authAs()
    ;(watchDAL.getWatchById as Mock).mockResolvedValueOnce(mockWatch)
    ;(wearEventDAL.logWearEventWithPhoto as Mock).mockResolvedValueOnce(undefined)
    ;(profilesDAL.getProfileById as Mock).mockResolvedValueOnce(mockProfile)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(logActivity as Mock).mockRejectedValueOnce(new Error('feed down'))

    const r = await logBackfillWear(
      mkInput({ wornDate: '2026-09-12', today: '2026-09-12' }),
    )

    expect(r.success).toBe(true)
    errSpy.mockRestore()
  })

  // Test 11: missing owner profile → still success, no updateTag call
  it('(11) missing owner profile → still success; updateTag not called', async () => {
    authAs()
    ;(watchDAL.getWatchById as Mock).mockResolvedValueOnce(mockWatch)
    ;(wearEventDAL.logWearEventWithPhoto as Mock).mockResolvedValueOnce(undefined)
    ;(profilesDAL.getProfileById as Mock).mockResolvedValueOnce(null)

    const r = await logBackfillWear(mkInput())

    expect(r.success).toBe(true)
    expect(updateTag).not.toHaveBeenCalled()
  })
})
