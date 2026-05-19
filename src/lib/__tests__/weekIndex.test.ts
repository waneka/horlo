// src/lib/__tests__/weekIndex.test.ts
// Phase 47 Plan 01 Task 4 — unit tests for the shared getWeekIndex utility.
//
// Coverage:
//   1. Same-week stability: two Dates within the same 7-day window return the same index
//   2. +7-day increment: getWeekIndex(dateA + 7 days) === getWeekIndex(dateA) + 1
//   3. Monotonicity: index is non-decreasing as the Date advances

import { describe, it, expect } from 'vitest'
import { getWeekIndex } from '@/lib/weekIndex'

describe('getWeekIndex', () => {
  it('returns the same integer for two dates within the same 7-day window', () => {
    // Compute the start of a clean 7-day epoch window to guarantee no boundary crossing.
    // Week-window boundaries: every multiple of 604800000 ms from Unix epoch.
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000
    const windowStart = new Date(Math.floor(Date.now() / WEEK_MS) * WEEK_MS)
    // 1 day after window start — safely within the same 7-day window
    const samePeriod = new Date(windowStart.getTime() + 1 * 24 * 60 * 60 * 1000)

    expect(getWeekIndex(windowStart)).toBe(getWeekIndex(samePeriod))
  })

  it('advances by exactly 1 when the date advances by exactly 7 days', () => {
    const dateA = new Date('2020-01-01T00:00:00Z')
    const dateB = new Date(dateA.getTime() + 7 * 24 * 60 * 60 * 1000)

    expect(getWeekIndex(dateB)).toBe(getWeekIndex(dateA) + 1)
  })

  it('is monotonically non-decreasing as the date advances', () => {
    const start = new Date('2020-01-01T00:00:00Z')
    const indices: number[] = []
    // Sample weekly over 12 weeks
    for (let w = 0; w < 12; w++) {
      const date = new Date(start.getTime() + w * 7 * 24 * 60 * 60 * 1000)
      indices.push(getWeekIndex(date))
    }

    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1])
    }
  })

  it('returns a non-negative integer', () => {
    const now = new Date('2026-05-19T00:00:00Z')
    const idx = getWeekIndex(now)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(idx)).toBe(true)
  })
})
