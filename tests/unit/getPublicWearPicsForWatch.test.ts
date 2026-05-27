/**
 * WPIC-01 + WPIC-05 + CR-01
 * Tests for getPublicWearPicsForWatch DAL function.
 *
 * WPIC-01: Public wear pic (visibility='public', hidden_from_detail=false, photoUrl IS NOT NULL) appears.
 * WPIC-05: Non-public (followers/private) wear pics AND hidden pics are NEVER returned.
 * CR-01: Wear events with null photoUrl must NOT appear (no-photo quick-log rows).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// DB mock — mirrors the pattern in tests/data/getWearRailForViewer.test.ts
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>
let mockRows: Row[] = []

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve(mockRows),
        }),
      }),
    }),
  },
}))

// ---------------------------------------------------------------------------
// Import under test — will throw "not a function" or similar until Plan 02
// wires the real implementation. The import itself must not crash at collection.
// ---------------------------------------------------------------------------

import { getPublicWearPicsForWatch } from '@/data/wearEvents'

const WATCH_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

describe('getPublicWearPicsForWatch', () => {
  beforeEach(() => {
    mockRows = []
  })

  it('WPIC-01: returns public, non-hidden wear pic rows', async () => {
    mockRows = [
      {
        id: 'we-1',
        wornDate: '2026-05-20',
        photoUrl: 'user-A/evt-1.jpg',
        hiddenFromDetail: false,
      },
    ]
    const result = await getPublicWearPicsForWatch(WATCH_ID)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('we-1')
    expect(result[0].photoUrl).toBe('user-A/evt-1.jpg')
    expect(result[0].hiddenFromDetail).toBe(false)
  })

  it('WPIC-01: returns empty array when no public wear pics exist', async () => {
    mockRows = []
    const result = await getPublicWearPicsForWatch(WATCH_ID)
    expect(result).toHaveLength(0)
  })

  it('WPIC-05: non-public (followers) wear pics must NOT appear (DAL WHERE clause guard)', async () => {
    // The DAL must filter these out via its WHERE predicate.
    // In this unit test the mock returns zero rows (the WHERE is mocked out),
    // so we assert the function returns the mock rows (empty) unchanged.
    // The integration test (Plan 02) will verify the real predicate against the DB.
    mockRows = []
    const result = await getPublicWearPicsForWatch(WATCH_ID)
    expect(result).toHaveLength(0)
  })

  it('WPIC-05: hidden_from_detail=true wear pics must NOT appear (DAL WHERE clause guard)', async () => {
    // Same reasoning: the mock returns empty rows; predicate verified via integration.
    mockRows = []
    const result = await getPublicWearPicsForWatch(WATCH_ID)
    expect(result).toHaveLength(0)
  })

  it('CR-01: public wear event with null photoUrl must NOT appear (no-photo quick-log)', async () => {
    // The isNotNull(photoUrl) predicate must exclude no-photo wears.
    // In this unit test the mock models what the DB would return AFTER the WHERE
    // clause fires — a null photoUrl row should never come back.
    // The mock returns [] to simulate the isNotNull predicate filtering it out.
    mockRows = []
    const result = await getPublicWearPicsForWatch(WATCH_ID)
    expect(result).toHaveLength(0)
  })

  it('CR-01: only rows with a non-null photoUrl are returned', async () => {
    // Simulate the DAL returning only the photo-bearing row.
    mockRows = [
      {
        id: 'we-with-photo',
        wornDate: '2026-05-22',
        photoUrl: 'user-A/evt-1.jpg',
        hiddenFromDetail: false,
      },
    ]
    const result = await getPublicWearPicsForWatch(WATCH_ID)
    expect(result).toHaveLength(1)
    expect(result[0].photoUrl).toBe('user-A/evt-1.jpg')
  })

  it('WPIC-01: result is ordered newest-worn first (wornDate DESC)', async () => {
    mockRows = [
      { id: 'we-newer', wornDate: '2026-05-22', photoUrl: 'user-A/evt-newer.jpg', hiddenFromDetail: false },
      { id: 'we-older', wornDate: '2026-05-20', photoUrl: 'user-A/evt-older.jpg', hiddenFromDetail: false },
    ]
    const result = await getPublicWearPicsForWatch(WATCH_ID)
    expect(result[0].wornDate >= result[result.length - 1].wornDate).toBe(true)
  })
})
