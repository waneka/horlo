import { describe, it, expect } from 'vitest'
import { timeAgo } from '@/lib/timeAgo'

// Pinned reference time so no test depends on wall clock.
const NOW = new Date('2026-04-21T14:24:30.000Z')

function minus(ms: number): Date {
  return new Date(NOW.getTime() - ms)
}

const SECOND = 1_000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

describe('timeAgo', () => {
  it("returns 'now' for the same instant (delta 0)", () => {
    expect(timeAgo(NOW, NOW)).toBe('now')
  })

  it("returns 'now' for deltas under 60 seconds", () => {
    expect(timeAgo(minus(30 * SECOND), NOW)).toBe('now')
  })

  it('formats minute deltas as `{N}m` (no space, no suffix)', () => {
    expect(timeAgo(minus(7 * MINUTE), NOW)).toBe('7m')
  })

  it('formats hour deltas as `{N}h`', () => {
    expect(timeAgo(minus(2 * HOUR), NOW)).toBe('2h')
  })

  it('formats day deltas as `{N}d`', () => {
    expect(timeAgo(minus(3 * DAY), NOW)).toBe('3d')
  })

  it('formats week deltas as `{N}w` (up to <4w)', () => {
    expect(timeAgo(minus(2 * WEEK), NOW)).toBe('2w')
  })

  it('formats >= 4 weeks as locale "MMM d"', () => {
    const result = timeAgo(minus(5 * WEEK), NOW)
    // Accept either 'Mar 17' (exact) or any 3-letter month + day shape to
    // stay robust across locale-data quirks in CI.
    expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/)
  })

  it('accepts an ISO 8601 string input', () => {
    // 1m 30s before NOW → 1m
    expect(
      timeAgo('2026-04-21T14:23:00.000Z', NOW),
    ).toBe('1m')
  })

  it('accepts a Date instance input (equivalent to the ISO string form)', () => {
    expect(
      timeAgo(new Date('2026-04-21T14:23:00.000Z'), NOW),
    ).toBe('1m')
  })

  it("clamps negative deltas (future timestamps) to 'now' to survive clock skew", () => {
    const future = new Date(NOW.getTime() + 60 * SECOND)
    expect(timeAgo(future, NOW)).toBe('now')
  })
})
