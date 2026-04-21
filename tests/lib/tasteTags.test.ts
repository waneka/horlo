import { describe, it, expect } from 'vitest'
import { computeTasteTags } from '@/lib/tasteTags'
import type { Watch } from '@/lib/types'

// Lightweight Watch factory for the taste-tag rules. Only fields the rules read
// need real values; everything else is filled with defaults.
function w(overrides: Partial<Watch> = {}): Watch {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    brand: overrides.brand ?? 'Generic',
    model: overrides.model ?? 'Model',
    status: overrides.status ?? 'owned',
    movement: overrides.movement ?? 'automatic',
    complications: overrides.complications ?? [],
    styleTags: overrides.styleTags ?? [],
    designTraits: overrides.designTraits ?? [],
    roleTags: overrides.roleTags ?? [],
    ...overrides,
  }
}

describe('computeTasteTags (D-06 / PROF-10)', () => {
  it('returns [] when there are no owned watches', () => {
    expect(
      computeTasteTags({ watches: [], totalWearEvents: 0, collectionAgeDays: 0 })
    ).toEqual([])
  })

  it('ignores non-owned watches when computing tags', () => {
    const watches = [
      w({ status: 'wishlist', brand: 'Rolex' }),
      w({ status: 'sold', brand: 'Rolex' }),
    ]
    expect(
      computeTasteTags({ watches, totalWearEvents: 0, collectionAgeDays: 0 })
    ).toEqual([])
  })

  it('includes "Vintage Collector" when >40% of owned watches have productionYear < 2000', () => {
    const watches = [
      w({ productionYear: 1985 }),
      w({ productionYear: 1990 }),
      w({ productionYear: 1995 }),
      w({ productionYear: 2010 }),
      w({ productionYear: 2020 }),
    ]
    const tags = computeTasteTags({ watches, totalWearEvents: 0, collectionAgeDays: 0 })
    expect(tags).toContain('Vintage Collector')
  })

  it('does NOT include "Vintage Collector" when <=40% of owned are pre-2000', () => {
    const watches = [
      w({ productionYear: 1985 }),
      w({ productionYear: 2010 }),
      w({ productionYear: 2020 }),
      w({ productionYear: 2021 }),
      w({ productionYear: 2022 }),
    ]
    const tags = computeTasteTags({ watches, totalWearEvents: 0, collectionAgeDays: 0 })
    expect(tags).not.toContain('Vintage Collector')
  })

  it('includes "{Brand} Fan" when any single brand >30% of owned collection', () => {
    const watches = [
      w({ brand: 'Omega' }),
      w({ brand: 'Omega' }),
      w({ brand: 'Omega' }),
      w({ brand: 'Omega' }),
      w({ brand: 'Rolex' }),
      w({ brand: 'Seiko' }),
      w({ brand: 'Tudor' }),
      w({ brand: 'Grand Seiko' }),
      w({ brand: 'IWC' }),
      w({ brand: 'Cartier' }),
    ]
    const tags = computeTasteTags({ watches, totalWearEvents: 0, collectionAgeDays: 0 })
    expect(tags).toContain('Omega Fan')
  })

  it('does NOT include "{Brand} Fan" when no single brand >30% of owned collection', () => {
    const watches = [
      w({ brand: 'Omega' }),
      w({ brand: 'Omega' }),
      w({ brand: 'Rolex' }),
      w({ brand: 'Rolex' }),
      w({ brand: 'Seiko' }),
      w({ brand: 'Tudor' }),
      w({ brand: 'Grand Seiko' }),
      w({ brand: 'IWC' }),
      w({ brand: 'Cartier' }),
      w({ brand: 'Longines' }),
    ]
    const tags = computeTasteTags({ watches, totalWearEvents: 0, collectionAgeDays: 0 })
    expect(tags.some((t) => t.endsWith(' Fan'))).toBe(false)
  })

  it('includes "Sport Watch Collector" when >50% of all roleTags include "sport"', () => {
    const watches = [
      w({ roleTags: ['sport', 'sport'] }),
      w({ roleTags: ['sport', 'sport'] }),
      w({ roleTags: ['sport', 'sport'] }),
      w({ roleTags: ['casual', 'casual'] }),
      w({ roleTags: ['dress', 'casual'] }),
    ]
    const tags = computeTasteTags({ watches, totalWearEvents: 0, collectionAgeDays: 0 })
    expect(tags).toContain('Sport Watch Collector')
  })

  it('does NOT include "Sport Watch Collector" when sport tags are <=50%', () => {
    const watches = [
      w({ roleTags: ['sport', 'sport'] }),
      w({ roleTags: ['sport', 'casual'] }),
      w({ roleTags: ['casual', 'casual'] }),
      w({ roleTags: ['dress', 'casual'] }),
      w({ roleTags: ['casual', 'casual'] }),
    ]
    const tags = computeTasteTags({ watches, totalWearEvents: 0, collectionAgeDays: 0 })
    expect(tags).not.toContain('Sport Watch Collector')
  })

  it('includes "Dress Watch Lover" when >50% of all roleTags include "dress" (and sport is not >50%)', () => {
    const watches = [
      w({ roleTags: ['dress', 'dress'] }),
      w({ roleTags: ['dress', 'dress'] }),
      w({ roleTags: ['dress', 'dress'] }),
      w({ roleTags: ['casual', 'casual'] }),
      w({ roleTags: ['sport', 'casual'] }),
    ]
    const tags = computeTasteTags({ watches, totalWearEvents: 0, collectionAgeDays: 0 })
    expect(tags).toContain('Dress Watch Lover')
    expect(tags).not.toContain('Sport Watch Collector')
  })

  it('includes "Diver" when >40% of all roleTags include "dive" (and sport/dress are not >50%)', () => {
    const watches = [
      w({ roleTags: ['dive', 'dive'] }),
      w({ roleTags: ['dive', 'dive'] }),
      w({ roleTags: ['dive', 'casual'] }),
      w({ roleTags: ['casual', 'sport'] }),
      w({ roleTags: ['dress', 'casual'] }),
    ]
    const tags = computeTasteTags({ watches, totalWearEvents: 0, collectionAgeDays: 0 })
    expect(tags).toContain('Diver')
    expect(tags).not.toContain('Sport Watch Collector')
    expect(tags).not.toContain('Dress Watch Lover')
  })

  it('does NOT include "Diver" when <=40% of all roleTags include "dive"', () => {
    const watches = [
      w({ roleTags: ['dive', 'casual'] }),
      w({ roleTags: ['casual', 'casual'] }),
      w({ roleTags: ['casual', 'sport'] }),
      w({ roleTags: ['dress', 'casual'] }),
      w({ roleTags: ['dress', 'casual'] }),
    ]
    const tags = computeTasteTags({ watches, totalWearEvents: 0, collectionAgeDays: 0 })
    expect(tags).not.toContain('Diver')
  })

  it('Sport beats Dress when both roleTag thresholds qualify (else-if precedence)', () => {
    // 7 sport vs 6 dress out of 13 — sport is >50%, dress is not.
    const watches = [
      w({ roleTags: ['sport', 'sport', 'sport'] }),
      w({ roleTags: ['sport', 'sport', 'sport'] }),
      w({ roleTags: ['sport'] }),
      w({ roleTags: ['dress', 'dress', 'dress'] }),
      w({ roleTags: ['dress', 'dress', 'dress'] }),
    ]
    const tags = computeTasteTags({ watches, totalWearEvents: 0, collectionAgeDays: 0 })
    expect(tags).toContain('Sport Watch Collector')
    expect(tags).not.toContain('Dress Watch Lover')
  })

  it('includes "Daily Rotator" when avg wear events / week > 5', () => {
    // 80 events over 70 days = 10 weeks → 8/week > 5
    const watches = [w()]
    const tags = computeTasteTags({ watches, totalWearEvents: 80, collectionAgeDays: 70 })
    expect(tags).toContain('Daily Rotator')
  })

  it('does NOT include "Daily Rotator" when avg wear events / week <= 5', () => {
    // 20 events over 70 days = 10 weeks → 2/week
    const watches = [w()]
    const tags = computeTasteTags({ watches, totalWearEvents: 20, collectionAgeDays: 70 })
    expect(tags).not.toContain('Daily Rotator')
  })

  it('caps output at 3 tags maximum', () => {
    // Vintage + Omega Fan + Sport + Daily Rotator = 4 candidate tags → capped to 3.
    const watches = [
      w({ brand: 'Omega', productionYear: 1985, roleTags: ['sport', 'sport'] }),
      w({ brand: 'Omega', productionYear: 1990, roleTags: ['sport', 'sport'] }),
      w({ brand: 'Omega', productionYear: 1995, roleTags: ['sport', 'sport'] }),
      w({ brand: 'Rolex', productionYear: 2010, roleTags: ['casual', 'casual'] }),
      w({ brand: 'Seiko', productionYear: 2020, roleTags: ['dress', 'casual'] }),
    ]
    const tags = computeTasteTags({ watches, totalWearEvents: 80, collectionAgeDays: 70 })
    expect(tags.length).toBeLessThanOrEqual(3)
  })

  it('matches brand exactly as stored (case-sensitive)', () => {
    const watches = [
      w({ brand: 'Omega' }),
      w({ brand: 'Omega' }),
      w({ brand: 'Omega' }),
      w({ brand: 'Omega' }),
      w({ brand: 'omega' }),
      w({ brand: 'Rolex' }),
      w({ brand: 'Seiko' }),
      w({ brand: 'Tudor' }),
      w({ brand: 'IWC' }),
      w({ brand: 'Cartier' }),
    ]
    const tags = computeTasteTags({ watches, totalWearEvents: 0, collectionAgeDays: 0 })
    expect(tags).toContain('Omega Fan')
    expect(tags).not.toContain('omega Fan')
  })
})
