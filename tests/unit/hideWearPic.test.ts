/**
 * Wave 0 scaffold — WPIC-02
 * Tests for hideWearPicAction / unhideWearPicAction server actions.
 *
 * WPIC-02: Owner hide sets hidden_from_detail=true; pic excluded from re-query.
 *          Un-hide restores it. Ownership re-check rejects a watch not owned by caller.
 *
 * RED scaffold: target actions do not exist yet (created in Plan 03).
 * These tests MUST collect without import-time crashes.
 * They will turn GREEN in Plan 03.
 */

import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock getCurrentUser + watchDAL + db — mirrors wearEvents action patterns
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/data/watches', () => ({
  getWatchById: vi.fn(),
}))

vi.mock('@/db', () => ({
  db: {
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Import under test — will fail at call-time (not exported yet) until Plan 03.
// The import itself must not crash at collection.
// ---------------------------------------------------------------------------

import { hideWearPicAction, unhideWearPicAction } from '@/app/actions/wearEvents'
import { getCurrentUser } from '@/lib/auth'
import * as watchDAL from '@/data/watches'

const MOCK_USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const MOCK_WATCH_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff'
const MOCK_WEAR_EVENT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-111111111111'

describe('hideWearPicAction', () => {
  it('WPIC-02: returns error when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error('Not authenticated'))
    const result = await hideWearPicAction({ wearEventId: MOCK_WEAR_EVENT_ID, watchId: MOCK_WATCH_ID })
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('WPIC-02: returns error when watch not owned by caller (IDOR guard)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: MOCK_USER_ID } as never)
    vi.mocked(watchDAL.getWatchById).mockResolvedValueOnce(null as never)
    const result = await hideWearPicAction({ wearEventId: MOCK_WEAR_EVENT_ID, watchId: MOCK_WATCH_ID })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/watch not found/i)
  })

  it('WPIC-02: returns success when owner hides a wear pic', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: MOCK_USER_ID } as never)
    vi.mocked(watchDAL.getWatchById).mockResolvedValueOnce({ id: MOCK_WATCH_ID } as never)
    const result = await hideWearPicAction({ wearEventId: MOCK_WEAR_EVENT_ID, watchId: MOCK_WATCH_ID })
    expect(result.success).toBe(true)
  })
})

describe('unhideWearPicAction', () => {
  it('WPIC-02: returns error when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error('Not authenticated'))
    const result = await unhideWearPicAction({ wearEventId: MOCK_WEAR_EVENT_ID, watchId: MOCK_WATCH_ID })
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('WPIC-02: returns success when owner un-hides a wear pic', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: MOCK_USER_ID } as never)
    vi.mocked(watchDAL.getWatchById).mockResolvedValueOnce({ id: MOCK_WATCH_ID } as never)
    const result = await unhideWearPicAction({ wearEventId: MOCK_WEAR_EVENT_ID, watchId: MOCK_WATCH_ID })
    expect(result.success).toBe(true)
  })
})
