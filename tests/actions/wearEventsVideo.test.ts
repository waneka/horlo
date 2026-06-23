// tests/actions/wearEventsVideo.test.ts — Phase 76 Plan 03 — Server Action logWearWithVideo + DAL contract
//
// VID-NN -> test-N mapping (per 76-VALIDATION.md per-task verification map):
//   VID-07 (server-constructed paths)        -> Test 7
//   VID-08 (TWO probes; either miss rejects) -> Tests 5 + 6
//   VID-09 (5 MB byte gate before IDOR)      -> Test 3
//   VID-10 (compensating .remove on failure) -> Tests 8 + 9
//   VID-16 (cross-user watchId; IDOR uniform) -> Tests 4 + 7
//
// Mock layout mirrors tests/actions/watchPhotos.test.ts (Phase 61) — vi.mock
// for getCurrentUser + DAL + Storage; per-test mock configuration via
// (mockedFn as Mock).mockResolvedValueOnce / mockRejectedValueOnce.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be declared BEFORE imports that pull in the action module so
// vitest's hoisted vi.mock factories replace the real modules before they load.
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

// Mock all named exports from @/data/wearEvents that the action module's
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
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}))

import { logWearWithVideo } from '@/app/actions/wearEvents'
import { getCurrentUser } from '@/lib/auth'
import * as wearEventDAL from '@/data/wearEvents'
import * as watchDAL from '@/data/watches'
import * as profilesDAL from '@/data/profiles'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Test fixtures — valid v4 UUIDs
// ---------------------------------------------------------------------------
const userId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const watchId = '11111111-2222-4333-8444-555555555555'
const wearEventId = '22222222-3333-4444-8555-666666666666'
const VICTIM_USER_ID = 'ffffffff-eeee-4ddd-8ccc-bbbbbbbbbbbb'
void VICTIM_USER_ID // kept as a documented fixture; cross-user assertion uses getWatchById returning null

const videoPath = `${userId}/${wearEventId}.mp4`
const posterPath = `${userId}/${wearEventId}-poster.jpg`

const mockUser = { id: userId, email: 'p76@horlo.test' }
const mockWatch = {
  id: watchId,
  brand: 'Test',
  model: 'M',
  imageUrl: null,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function authAs(user: { id: string; email: string } = mockUser) {
  ;(getCurrentUser as Mock).mockResolvedValueOnce(user)
}
function authFail() {
  ;(getCurrentUser as Mock).mockRejectedValueOnce(new Error('Not authenticated'))
}

type ValidInput = Parameters<typeof logWearWithVideo>[0]
function mkInput(overrides: Partial<ValidInput> = {}): ValidInput {
  return {
    wearEventId,
    watchId,
    note: null,
    visibility: 'public',
    videoBytes: 1024 * 1024,
    today: '2026-06-22',
    ...overrides,
  }
}

// Build a Supabase-storage stub whose `.createSignedUrl(path, expiresIn)`
// returns a success/error per object kind (video .mp4 vs poster -poster.jpg)
// and whose `.remove()` returns the configured error or null. The action uses
// createSignedUrl as an O(1) existence probe (CR-01 fix — replaced paginated
// .list({search}) which capped at ~100 objects per folder). Each test that
// reaches Storage stages the stub via
// `(createSupabaseServerClient as Mock).mockResolvedValueOnce(stub)`.
function mockStorage(opts: {
  videoFound?: boolean
  posterFound?: boolean
  removeError?: { message: string } | null
} = {}) {
  const removeMock = vi.fn(() =>
    Promise.resolve({ data: null, error: opts.removeError ?? null }),
  )
  // createSignedUrl signature is (path, expiresIn). Path is
  // `${user.id}/${wearEventId}.mp4` or `${user.id}/${wearEventId}-poster.jpg`.
  // Returns { data: { signedUrl }, error: null } when the object exists, or
  // { data: null, error: { message } } when missing.
  const createSignedUrlMock = vi.fn((path: string, _expiresIn: number) => {
    const isVideo = path.endsWith('.mp4')
    const found = isVideo ? (opts.videoFound ?? true) : (opts.posterFound ?? true)
    if (!found) {
      return Promise.resolve({
        data: null,
        error: { message: 'Object not found' },
      })
    }
    return Promise.resolve({
      data: { signedUrl: `https://signed.example/${path}` },
      error: null,
    })
  })
  // Single bucket-stub instance so `.remove` calls land on the same Mock
  // regardless of how many times `.from()` is invoked inside the action.
  const bucketStub = { createSignedUrl: createSignedUrlMock, remove: removeMock }
  const fromMock = vi.fn(() => bucketStub)
  return {
    storage: { from: fromMock },
    _bucketStub: bucketStub,
    _fromMock: fromMock,
    _createSignedUrlMock: createSignedUrlMock,
    _removeMock: removeMock,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('logWearWithVideo (Phase 76 — VID-07/08/09/10/16)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Test 1: auth gate — fail BEFORE Zod/Storage/DAL
  it('(1) unauthenticated → Not authenticated; no DAL or Storage call', async () => {
    authFail()

    const r = await logWearWithVideo(mkInput())

    expect(r).toEqual({ success: false, error: 'Not authenticated' })
    expect(wearEventDAL.logWearEventWithVideo).not.toHaveBeenCalled()
    expect(createSupabaseServerClient).not.toHaveBeenCalled()
    expect(watchDAL.getWatchById).not.toHaveBeenCalled()
  })

  // Test 2: Zod gate — non-UUID wearEventId rejected
  it('(2) invalid input (non-UUID wearEventId) → Invalid input; no DAL call', async () => {
    authAs()

    const r = await logWearWithVideo(
      mkInput({ wearEventId: 'not-uuid' } as unknown as Partial<ValidInput>),
    )

    expect(r).toEqual({ success: false, error: 'Invalid input' })
    expect(wearEventDAL.logWearEventWithVideo).not.toHaveBeenCalled()
    expect(createSupabaseServerClient).not.toHaveBeenCalled()
  })

  // Test 3: VID-09 — 5 MB gate fires BEFORE IDOR check (no watchDAL call)
  it('(3) VID-09 oversize (>5 MB) → Video too large; before IDOR check', async () => {
    authAs()

    const r = await logWearWithVideo(
      mkInput({ videoBytes: 5 * 1024 * 1024 + 1 }),
    )

    expect(r).toEqual({ success: false, error: 'Video too large — maximum 5 MB' })
    expect(watchDAL.getWatchById).not.toHaveBeenCalled()
    expect(createSupabaseServerClient).not.toHaveBeenCalled()
    expect(wearEventDAL.logWearEventWithVideo).not.toHaveBeenCalled()
  })

  // Test 4: VID-16 — cross-user watchId returns uniform 'Watch not found'
  it('(4) VID-16 cross-user watchId → Watch not found (uniform IDOR error); no Storage', async () => {
    authAs()
    ;(watchDAL.getWatchById as Mock).mockResolvedValueOnce(null)

    const r = await logWearWithVideo(mkInput())

    expect(r).toEqual({ success: false, error: 'Watch not found' })
    expect(createSupabaseServerClient).not.toHaveBeenCalled()
    expect(wearEventDAL.logWearEventWithVideo).not.toHaveBeenCalled()
  })

  // Test 5: VID-08 — missing .mp4 probe → uniform 'Video upload failed'
  it('(5) VID-08 missing .mp4 Storage object → Video upload failed; no DAL call', async () => {
    authAs()
    ;(watchDAL.getWatchById as Mock).mockResolvedValueOnce(mockWatch)
    const stub = mockStorage({ videoFound: false, posterFound: true })
    ;(createSupabaseServerClient as Mock).mockResolvedValueOnce(stub)

    const r = await logWearWithVideo(mkInput())

    expect(r).toEqual({ success: false, error: 'Video upload failed — please try again' })
    expect(wearEventDAL.logWearEventWithVideo).not.toHaveBeenCalled()
  })

  // Test 6: VID-08 — missing -poster.jpg probe → same uniform error
  it('(6) VID-08 missing -poster.jpg Storage object → Video upload failed; no DAL call', async () => {
    authAs()
    ;(watchDAL.getWatchById as Mock).mockResolvedValueOnce(mockWatch)
    const stub = mockStorage({ videoFound: true, posterFound: false })
    ;(createSupabaseServerClient as Mock).mockResolvedValueOnce(stub)

    const r = await logWearWithVideo(mkInput())

    expect(r).toEqual({ success: false, error: 'Video upload failed — please try again' })
    expect(wearEventDAL.logWearEventWithVideo).not.toHaveBeenCalled()
  })

  // Test 7: VID-07 + VID-16 happy path — DAL receives SERVER-DERIVED paths
  it('(7) VID-07 happy path → DAL called with server-derived mediaPath/posterPath; success', async () => {
    authAs()
    ;(watchDAL.getWatchById as Mock).mockResolvedValueOnce(mockWatch)
    const stub = mockStorage({ videoFound: true, posterFound: true })
    ;(createSupabaseServerClient as Mock).mockResolvedValueOnce(stub)
    ;(wearEventDAL.logWearEventWithVideo as Mock).mockResolvedValueOnce(undefined)
    ;(profilesDAL.getProfileById as Mock).mockResolvedValueOnce({ username: 'u' })

    const r = await logWearWithVideo(mkInput())

    expect(r).toEqual({ success: true, data: { wearEventId } })
    expect(wearEventDAL.logWearEventWithVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        id: wearEventId,
        userId,
        watchId,
        mediaPath: videoPath,
        posterPath,
        visibility: 'public',
      }),
    )
  })

  // Test 8: VID-10 — 23505 duplicate-day → both paths removed + 'Already logged'
  it('(8) VID-10 23505 duplicate-day → cleanup of BOTH paths + Already logged this watch today', async () => {
    authAs()
    ;(watchDAL.getWatchById as Mock).mockResolvedValueOnce(mockWatch)
    const stub = mockStorage({ videoFound: true, posterFound: true })
    ;(createSupabaseServerClient as Mock).mockResolvedValueOnce(stub)
    ;(wearEventDAL.logWearEventWithVideo as Mock).mockRejectedValueOnce(
      Object.assign(new Error('dup'), { code: '23505' }),
    )

    const r = await logWearWithVideo(mkInput())

    expect(r).toEqual({ success: false, error: 'Already logged this watch today' })
    expect(stub._removeMock).toHaveBeenCalledWith([videoPath, posterPath])
  })

  // Test 9: VID-10 — non-23505 → both paths removed + generic 'Could not log'
  it('(9) VID-10 non-23505 DAL error → cleanup of BOTH paths + Could not log that wear', async () => {
    authAs()
    ;(watchDAL.getWatchById as Mock).mockResolvedValueOnce(mockWatch)
    const stub = mockStorage({ videoFound: true, posterFound: true })
    ;(createSupabaseServerClient as Mock).mockResolvedValueOnce(stub)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(wearEventDAL.logWearEventWithVideo as Mock).mockRejectedValueOnce(new Error('boom'))

    const r = await logWearWithVideo(mkInput())

    expect(r).toEqual({
      success: false,
      error: 'Could not log that wear. Please try again.',
    })
    expect(stub._removeMock).toHaveBeenCalledWith([videoPath, posterPath])
    errSpy.mockRestore()
  })
})
