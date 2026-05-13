import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { OtherOwnersRoster } from '@/components/insights/OtherOwnersRoster'
import type { CatalogCollector } from '@/data/discovery'

/**
 * Quick task 260513-m31 — OtherOwnersRoster count-label render contract.
 *
 * Supersedes the shipped D-39b-09 "≤5 → suppress label" rule. Per Phase 39b
 * UAT test 7 product feedback, the count label is useful at any non-zero
 * collector count; the >5 gate at `OtherOwnersRoster.tsx:51` is the only
 * thing being reversed by this task. Singular ("1 collector owns this") vs
 * plural ("{N} collectors own this") copy is also added.
 *
 * Four scenarios:
 *  1. totalCount=1 + 1 collector → singular copy renders
 *  2. totalCount=3 + 3 collectors → plural copy renders (load-bearing —
 *     proves the >5 gate is gone)
 *  3. totalCount=10 + 5 collectors → plural copy renders (regression check on
 *     the previously-supported >5 path)
 *  4. collectors=[] + totalCount=0 → component returns null (hide-if-empty
 *     contract from D-39b-07 preserved)
 */

function makeCollector(n: number): CatalogCollector {
  return {
    userId: `user-${n}`,
    username: `user${n}`,
    displayName: `User ${n}`,
    avatarUrl: null,
  }
}

function makeCollectors(count: number): CatalogCollector[] {
  return Array.from({ length: count }, (_, i) => makeCollector(i + 1))
}

describe('OtherOwnersRoster', () => {
  it('renders singular copy "1 collector owns this" when totalCount=1', () => {
    const { getByText } = render(
      <OtherOwnersRoster collectors={makeCollectors(1)} totalCount={1} />,
    )
    expect(getByText('1 collector owns this')).toBeTruthy()
  })

  it('renders plural copy "3 collectors own this" when totalCount=3 (proves D-39b-09 >5 gate removed)', () => {
    const { getByText } = render(
      <OtherOwnersRoster collectors={makeCollectors(3)} totalCount={3} />,
    )
    expect(getByText('3 collectors own this')).toBeTruthy()
  })

  it('renders plural copy "10 collectors own this" when totalCount=10 (regression check on previously-shipped >5 path)', () => {
    const { getByText } = render(
      <OtherOwnersRoster collectors={makeCollectors(5)} totalCount={10} />,
    )
    expect(getByText('10 collectors own this')).toBeTruthy()
  })

  it('returns null when collectors=[] (D-39b-07 hide-if-empty preserved)', () => {
    const { container } = render(
      <OtherOwnersRoster collectors={[]} totalCount={0} />,
    )
    expect(container.firstChild).toBeNull()
  })
})
