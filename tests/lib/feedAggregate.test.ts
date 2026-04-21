import { describe, it, expect } from 'vitest'
import { aggregateFeed } from '@/lib/feedAggregate'
import type { RawFeedRow } from '@/lib/feedTypes'

// Canonical anchor — tests pin timestamps relative to this instant.
const BASE = new Date('2026-04-21T14:00:00.000Z')

function iso(offsetMs: number): string {
  return new Date(BASE.getTime() + offsetMs).toISOString()
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

function mkRow(overrides: Partial<RawFeedRow> = {}): RawFeedRow {
  return {
    kind: 'raw',
    id: overrides.id ?? 'id-' + Math.random().toString(36).slice(2, 10),
    type: overrides.type ?? 'watch_added',
    createdAt: overrides.createdAt ?? iso(0),
    watchId: overrides.watchId ?? null,
    metadata: overrides.metadata ?? { brand: 'Rolex', model: 'Submariner', imageUrl: null },
    userId: overrides.userId ?? 'user-A',
    username: overrides.username ?? 'alice',
    displayName: overrides.displayName ?? 'Alice',
    avatarUrl: overrides.avatarUrl ?? null,
  }
}

describe('aggregateFeed — F-08 time-window collapse', () => {
  it('Test 1: empty input produces empty output', () => {
    expect(aggregateFeed([])).toEqual([])
  })

  it('Test 2: single watch_added row passes through as a RawFeedRow', () => {
    const row = mkRow({ id: 'a1', type: 'watch_added', createdAt: iso(0) })
    const out = aggregateFeed([row])
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('raw')
    expect((out[0] as RawFeedRow).id).toBe('a1')
  })

  it('Test 3: 2 watch_added from same user within 1hr → 2 raw rows (count < 3)', () => {
    // Input is sorted createdAt DESC — the 0-offset row is most recent.
    const rows = [
      mkRow({ id: 'a1', type: 'watch_added', createdAt: iso(0) }),
      mkRow({ id: 'a2', type: 'watch_added', createdAt: iso(-30 * MINUTE) }),
    ]
    const out = aggregateFeed(rows)
    expect(out).toHaveLength(2)
    expect(out.every((r) => r.kind === 'raw')).toBe(true)
  })

  it('Test 4: 3 watch_added from same user within 1hr → one aggregated row', () => {
    const rows = [
      mkRow({ id: 'a1', type: 'watch_added', createdAt: iso(0), metadata: { brand: 'Rolex', model: 'GMT', imageUrl: 'gmt.jpg' } }),
      mkRow({ id: 'a2', type: 'watch_added', createdAt: iso(-10 * MINUTE) }),
      mkRow({ id: 'a3', type: 'watch_added', createdAt: iso(-40 * MINUTE) }),
    ]
    const out = aggregateFeed(rows)
    expect(out).toHaveLength(1)
    const agg = out[0]
    expect(agg.kind).toBe('aggregated')
    if (agg.kind !== 'aggregated') return // narrow for TS
    expect(agg.count).toBe(3)
    expect(agg.collapsedIds).toEqual(['a1', 'a2', 'a3'])
    expect(agg.representativeMetadata).toEqual({ brand: 'Rolex', model: 'GMT', imageUrl: 'gmt.jpg' })
    expect(agg.firstCreatedAt).toBe(iso(0)) // most recent
    expect(agg.lastCreatedAt).toBe(iso(-40 * MINUTE)) // oldest
    expect(agg.type).toBe('watch_added')
  })

  it('Test 5: 5 watch_added from same user within 1hr → one aggregated row with count=5', () => {
    const rows = [
      mkRow({ id: 'a1', createdAt: iso(0) }),
      mkRow({ id: 'a2', createdAt: iso(-10 * MINUTE) }),
      mkRow({ id: 'a3', createdAt: iso(-20 * MINUTE) }),
      mkRow({ id: 'a4', createdAt: iso(-30 * MINUTE) }),
      mkRow({ id: 'a5', createdAt: iso(-40 * MINUTE) }),
    ]
    const out = aggregateFeed(rows)
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('aggregated')
    if (out[0].kind !== 'aggregated') return
    expect(out[0].count).toBe(5)
    expect(out[0].collapsedIds).toEqual(['a1', 'a2', 'a3', 'a4', 'a5'])
  })

  it('Test 6: 3 watch_added spanning > 1hr → window breaks, fewer than 3 in window emit raw', () => {
    // Row 1 at t=0, row 2 at t=-30m (same window), row 3 at t=-61m (outside window relative to row 1).
    const rows = [
      mkRow({ id: 'a1', createdAt: iso(0) }),
      mkRow({ id: 'a2', createdAt: iso(-30 * MINUTE) }),
      mkRow({ id: 'a3', createdAt: iso(-61 * MINUTE) }),
    ]
    const out = aggregateFeed(rows)
    // First two in window (<3), emit raw. Third starts a new window of size 1, also raw.
    expect(out).toHaveLength(3)
    expect(out.every((r) => r.kind === 'raw')).toBe(true)
  })

  it('Test 7: 3 watch_worn from same user within 1hr → 3 raw rows (watch_worn never aggregates)', () => {
    const rows = [
      mkRow({ id: 'w1', type: 'watch_worn', createdAt: iso(0) }),
      mkRow({ id: 'w2', type: 'watch_worn', createdAt: iso(-10 * MINUTE) }),
      mkRow({ id: 'w3', type: 'watch_worn', createdAt: iso(-20 * MINUTE) }),
    ]
    const out = aggregateFeed(rows)
    expect(out).toHaveLength(3)
    expect(out.every((r) => r.kind === 'raw')).toBe(true)
  })

  it('Test 8: 3 wishlist_added from same user within 1hr → one aggregated row (type=wishlist_added)', () => {
    const rows = [
      mkRow({ id: 'l1', type: 'wishlist_added', createdAt: iso(0) }),
      mkRow({ id: 'l2', type: 'wishlist_added', createdAt: iso(-10 * MINUTE) }),
      mkRow({ id: 'l3', type: 'wishlist_added', createdAt: iso(-20 * MINUTE) }),
    ]
    const out = aggregateFeed(rows)
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('aggregated')
    if (out[0].kind !== 'aggregated') return
    expect(out[0].type).toBe('wishlist_added')
    expect(out[0].count).toBe(3)
  })

  it('Test 9: two users each with their own 3-run → 2 aggregated rows, one per actor', () => {
    const rows = [
      mkRow({ id: 'a1', userId: 'user-A', username: 'alice', createdAt: iso(0) }),
      mkRow({ id: 'a2', userId: 'user-A', username: 'alice', createdAt: iso(-5 * MINUTE) }),
      mkRow({ id: 'a3', userId: 'user-A', username: 'alice', createdAt: iso(-10 * MINUTE) }),
      mkRow({ id: 'b1', userId: 'user-B', username: 'bob', createdAt: iso(-15 * MINUTE) }),
      mkRow({ id: 'b2', userId: 'user-B', username: 'bob', createdAt: iso(-20 * MINUTE) }),
      mkRow({ id: 'b3', userId: 'user-B', username: 'bob', createdAt: iso(-25 * MINUTE) }),
    ]
    const out = aggregateFeed(rows)
    expect(out).toHaveLength(2)
    expect(out[0].kind).toBe('aggregated')
    expect(out[1].kind).toBe('aggregated')
    if (out[0].kind !== 'aggregated' || out[1].kind !== 'aggregated') return
    expect(out[0].userId).toBe('user-A')
    expect(out[0].count).toBe(3)
    expect(out[1].userId).toBe('user-B')
    expect(out[1].count).toBe(3)
  })

  it('Test 10: interleaved watch_added and wishlist_added (length-1 runs each) → no aggregation', () => {
    // Pattern at DESC order: [w_added, wishlist_added, w_added, wishlist_added, w_added, wishlist_added]
    // Each consecutive run is length 1 — no 3-streak of same type — so all emit raw.
    const rows = [
      mkRow({ id: 'r1', type: 'watch_added', createdAt: iso(0) }),
      mkRow({ id: 'r2', type: 'wishlist_added', createdAt: iso(-5 * MINUTE) }),
      mkRow({ id: 'r3', type: 'watch_added', createdAt: iso(-10 * MINUTE) }),
      mkRow({ id: 'r4', type: 'wishlist_added', createdAt: iso(-15 * MINUTE) }),
      mkRow({ id: 'r5', type: 'watch_added', createdAt: iso(-20 * MINUTE) }),
      mkRow({ id: 'r6', type: 'wishlist_added', createdAt: iso(-25 * MINUTE) }),
    ]
    const out = aggregateFeed(rows)
    expect(out).toHaveLength(6)
    expect(out.every((r) => r.kind === 'raw')).toBe(true)
  })

  it('Test 11: watch_worn splitting a would-be 3-run of watch_added → breaks the run', () => {
    // Pattern: [added, worn, added, added]
    // Consecutive runs of same type: length 1 (added), length 1 (worn), length 2 (added) → none reach 3.
    const rows = [
      mkRow({ id: 'x1', type: 'watch_added', createdAt: iso(0) }),
      mkRow({ id: 'x2', type: 'watch_worn', createdAt: iso(-5 * MINUTE) }),
      mkRow({ id: 'x3', type: 'watch_added', createdAt: iso(-10 * MINUTE) }),
      mkRow({ id: 'x4', type: 'watch_added', createdAt: iso(-15 * MINUTE) }),
    ]
    const out = aggregateFeed(rows)
    expect(out).toHaveLength(4)
    expect(out.every((r) => r.kind === 'raw')).toBe(true)
  })

  it('Test 12: determinism — same input produces identical output on repeat calls', () => {
    const rows = [
      mkRow({ id: 'd1', createdAt: iso(0) }),
      mkRow({ id: 'd2', createdAt: iso(-10 * MINUTE) }),
      mkRow({ id: 'd3', createdAt: iso(-20 * MINUTE) }),
    ]
    const first = aggregateFeed(rows)
    const second = aggregateFeed(rows)
    expect(first).toEqual(second)
    // Also assert the aggregator has no Date.now() side-channel by using a
    // row shape whose timestamps are in the past and asserting aggregation
    // still triggers regardless of wall clock:
    const past = [
      mkRow({ id: 'p1', createdAt: '2020-01-01T00:00:00.000Z' }),
      mkRow({ id: 'p2', createdAt: '2019-12-31T23:50:00.000Z' }),
      mkRow({ id: 'p3', createdAt: '2019-12-31T23:40:00.000Z' }),
    ]
    const pastOut = aggregateFeed(past)
    expect(pastOut).toHaveLength(1)
    expect(pastOut[0].kind).toBe('aggregated')
  })
})
