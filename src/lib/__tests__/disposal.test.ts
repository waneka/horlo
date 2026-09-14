// Phase 85 Plan 08 Task 1 — formatDisposalBadge (LIFE-03/D-16).
import { describe, it, expect } from 'vitest'
import { formatDisposalBadge } from '@/lib/disposal'

describe('formatDisposalBadge', () => {
  it("formats reason + date as 'Sold · Mar 2026'", () => {
    expect(formatDisposalBadge('sold', '2026-03-02')).toBe('Sold · Mar 2026')
  })

  it('formats reason alone when no date', () => {
    expect(formatDisposalBadge('traded', undefined)).toBe('Traded')
  })

  it('returns null when there is no reason, even with a date', () => {
    expect(formatDisposalBadge(undefined, '2026-03-02')).toBeNull()
  })

  it("does not off-by-one the month at a UTC-midnight boundary ('lost' + '2026-01-01' -> 'Jan 2026')", () => {
    expect(formatDisposalBadge('lost', '2026-01-01')).toBe('Lost · Jan 2026')
  })
})
