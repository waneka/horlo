import { describe, it, expect } from 'vitest'
import { WINDOW_DAYS, DEFAULT_WEAR_WINDOW, type WearWindowKey } from '@/lib/wear'
import { filterEventsByWindow, buildLeaderboard } from '@/lib/stats'

describe('WINDOW_DAYS / DEFAULT_WEAR_WINDOW (D-09, D-13)', () => {
  it('defines the five window keys with the correct day counts', () => {
    expect(WINDOW_DAYS).toEqual({
      '1mo': 30,
      '3mo': 90,
      '6mo': 182,
      '12mo': 365,
      all: null,
    })
  })

  it('defaults to the 3mo window', () => {
    expect(DEFAULT_WEAR_WINDOW).toBe('3mo')
  })
})

describe('filterEventsByWindow (D-13)', () => {
  const TODAY = '2026-09-12'

  it('1mo keeps the boundary date (today - 29 days)', () => {
    const events = [{ wornDate: '2026-08-14' }]
    expect(filterEventsByWindow(events, '1mo', TODAY)).toEqual(events)
  })

  it('1mo drops the day before the boundary', () => {
    const events = [{ wornDate: '2026-08-13' }]
    expect(filterEventsByWindow(events, '1mo', TODAY)).toEqual([])
  })

  it('3mo keeps the boundary date (today - 89 days)', () => {
    const events = [{ wornDate: '2026-06-15' }]
    expect(filterEventsByWindow(events, '3mo', TODAY)).toEqual(events)
  })

  it('3mo drops the day before the boundary', () => {
    const events = [{ wornDate: '2026-06-14' }]
    expect(filterEventsByWindow(events, '3mo', TODAY)).toEqual([])
  })

  it('6mo keeps the boundary date (today - 181 days)', () => {
    const events = [{ wornDate: '2026-03-15' }]
    expect(filterEventsByWindow(events, '6mo', TODAY)).toEqual(events)
  })

  it('6mo drops the day before the boundary', () => {
    const events = [{ wornDate: '2026-03-14' }]
    expect(filterEventsByWindow(events, '6mo', TODAY)).toEqual([])
  })

  it('12mo keeps the boundary date (today - 364 days)', () => {
    const events = [{ wornDate: '2025-09-13' }]
    expect(filterEventsByWindow(events, '12mo', TODAY)).toEqual(events)
  })

  it('12mo drops the day before the boundary', () => {
    const events = [{ wornDate: '2025-09-12' }]
    expect(filterEventsByWindow(events, '12mo', TODAY)).toEqual([])
  })

  it('keeps today itself in every window', () => {
    const windows: WearWindowKey[] = ['1mo', '3mo', '6mo', '12mo', 'all']
    for (const window of windows) {
      const events = [{ wornDate: TODAY }]
      expect(filterEventsByWindow(events, window, TODAY)).toEqual(events)
    }
  })

  it("'all' returns every event including a very old one", () => {
    const events = [{ wornDate: '2001-01-01' }, { wornDate: TODAY }]
    expect(filterEventsByWindow(events, 'all', TODAY)).toEqual(events)
  })

  it('computes month/year boundaries with UTC day arithmetic (1mo across a month boundary)', () => {
    const kept = [{ wornDate: '2026-01-31' }]
    const dropped = [{ wornDate: '2026-01-30' }]
    expect(filterEventsByWindow(kept, '1mo', '2026-03-01')).toEqual(kept)
    expect(filterEventsByWindow(dropped, '1mo', '2026-03-01')).toEqual([])
  })

  it('returns the same element objects (does not clone) and never mutates the input array', () => {
    const a = { wornDate: TODAY, watchId: 'a' }
    const b = { wornDate: '2001-01-01', watchId: 'b' }
    const events = [a, b]
    const originalLength = events.length
    const result = filterEventsByWindow(events, '3mo', TODAY)
    expect(result).toEqual([a])
    expect(result[0]).toBe(a)
    expect(events).toHaveLength(originalLength)
    expect(events[0]).toBe(a)
    expect(events[1]).toBe(b)
  })
})

describe('buildLeaderboard (D-11, D-13)', () => {
  const A = { id: 'a', brand: 'Omega', model: 'Speedmaster' }
  const B = { id: 'b', brand: 'Rolex', model: 'Datejust' }
  const C = { id: 'c', brand: 'Seiko', model: 'SKX' }

  it('counts wears per owned watch', () => {
    const events = [
      { watchId: 'a', wornDate: '2026-09-01' },
      { watchId: 'a', wornDate: '2026-09-02' },
      { watchId: 'a', wornDate: '2026-09-03' },
      { watchId: 'b', wornDate: '2026-09-01' },
    ]
    const rows = buildLeaderboard([A, B], events)
    expect(rows.find((r) => r.watch.id === 'a')?.count).toBe(3)
    expect(rows.find((r) => r.watch.id === 'b')?.count).toBe(1)
  })

  it('includes zero-wear owned watches with count 0 and null mostRecentWornDate', () => {
    const events = [{ watchId: 'a', wornDate: '2026-09-01' }]
    const rows = buildLeaderboard([A, C], events)
    const row = rows.find((r) => r.watch.id === 'c')
    expect(row).toBeDefined()
    expect(row?.count).toBe(0)
    expect(row?.mostRecentWornDate).toBeNull()
  })

  it('excludes events for watches not in the owned list', () => {
    const events = [
      { watchId: 'a', wornDate: '2026-09-01' },
      { watchId: 'x', wornDate: '2026-09-01' },
    ]
    const rows = buildLeaderboard([A], events)
    expect(rows).toHaveLength(1)
    expect(rows[0].watch.id).toBe('a')
  })

  it('breaks a count tie by most-recent wornDate desc', () => {
    const events = [
      { watchId: 'a', wornDate: '2026-08-01' },
      { watchId: 'a', wornDate: '2026-09-01' },
      { watchId: 'b', wornDate: '2026-07-01' },
      { watchId: 'b', wornDate: '2026-08-01' },
    ]
    const rows = buildLeaderboard([B, A], events)
    expect(rows.map((r) => r.watch.id)).toEqual(['a', 'b'])
  })

  it("breaks a count-and-date tie by 'Brand Model' A to Z", () => {
    const events = [
      { watchId: 'b', wornDate: '2026-09-01' },
      { watchId: 'a', wornDate: '2026-09-01' },
    ]
    const rows = buildLeaderboard([B, A], events)
    expect(rows.map((r) => r.watch.id)).toEqual(['a', 'b'])
  })

  it('sorts zero-wear rows A to Z among themselves, always after count > 0 rows', () => {
    const events = [{ watchId: 'a', wornDate: '2026-09-01' }]
    const rows = buildLeaderboard([C, B, A], events)
    expect(rows.map((r) => r.watch.id)).toEqual(['a', 'b', 'c'])
  })

  it('returns an empty array for an empty owned list', () => {
    expect(buildLeaderboard([], [{ watchId: 'a', wornDate: '2026-09-01' }])).toEqual([])
  })

  it('does not mutate the ownedWatches array order', () => {
    const events = [{ watchId: 'c', wornDate: '2026-09-01' }]
    const owned = [A, B, C]
    buildLeaderboard(owned, events)
    expect(owned).toEqual([A, B, C])
  })
})
