import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { isSessionStale, getLastSignInAgeMs } from '@/lib/auth/lastSignInAt'

// ---------------------------------------------------------------------------
// Phase 22 SET-05 / RECONCILED D-08 + D-10 — `user.last_sign_in_at` freshness
// helper. The threshold default is 24h; staleness drives the password-change
// re-auth dialog. See 22-CONTEXT.md D-08 (RECONCILED 2026-04-30, Option C).
// ---------------------------------------------------------------------------

const FIXED_NOW = new Date('2026-04-30T12:00:00.000Z').getTime()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('isSessionStale — Phase 22 SET-05 RECONCILED D-08 freshness check', () => {
  it('returns true for null input', () => {
    expect(isSessionStale(null)).toBe(true)
  })

  it('returns true for null/undefined input', () => {
    // Required canonical name (covers Tests 1 + 2 from plan).
    expect(isSessionStale(undefined)).toBe(true)
    expect(isSessionStale(null)).toBe(true)
  })

  it('returns true for malformed ISO', () => {
    expect(isSessionStale('not-an-iso')).toBe(true)
    expect(isSessionStale('')).toBe(true)
    expect(isSessionStale('2026-99-99T99:99:99Z')).toBe(true)
  })

  it('returns false for fresh session under threshold (1h ago)', () => {
    const oneHourAgo = new Date(FIXED_NOW - 60 * 60 * 1000).toISOString()
    expect(isSessionStale(oneHourAgo)).toBe(false)
  })

  it('returns false at 23h59m', () => {
    const justUnder24h = new Date(
      FIXED_NOW - (23 * 60 + 59) * 60 * 1000,
    ).toISOString()
    expect(isSessionStale(justUnder24h)).toBe(false)
  })

  it('stale threshold 24h — returns true at 24h01m', () => {
    const justOver24h = new Date(
      FIXED_NOW - (24 * 60 + 1) * 60 * 1000,
    ).toISOString()
    expect(isSessionStale(justOver24h)).toBe(true)
  })

  it('honors custom threshold parameter', () => {
    const twelveHoursAgo = new Date(FIXED_NOW - 12 * 60 * 60 * 1000).toISOString()
    // Default 24h threshold — fresh
    expect(isSessionStale(twelveHoursAgo)).toBe(false)
    // 6h threshold — stale
    expect(isSessionStale(twelveHoursAgo, 6 * 60 * 60 * 1000)).toBe(true)
  })
})

describe('getLastSignInAgeMs — Phase 22 SET-05 supporting helper', () => {
  it('getLastSignInAgeMs returns elapsed ms', () => {
    const oneHourAgo = new Date(FIXED_NOW - 60 * 60 * 1000).toISOString()
    const age = getLastSignInAgeMs(oneHourAgo)
    expect(age).not.toBeNull()
    // Allow ±5000ms tolerance (we are on fake timers — should be exact, but
    // keep the assertion robust against any sub-ms parser drift).
    expect(Math.abs((age ?? 0) - 60 * 60 * 1000)).toBeLessThan(5000)
  })

  it('getLastSignInAgeMs returns null for null input', () => {
    expect(getLastSignInAgeMs(null)).toBeNull()
    expect(getLastSignInAgeMs(undefined)).toBeNull()
  })

  it('getLastSignInAgeMs returns null for malformed ISO', () => {
    expect(getLastSignInAgeMs('not-an-iso')).toBeNull()
    expect(getLastSignInAgeMs('')).toBeNull()
  })
})
