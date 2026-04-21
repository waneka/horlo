import { describe, it, expect } from 'vitest'
import { computeTasteOverlap } from '@/lib/tasteOverlap'
import { GOAL_THRESHOLDS } from '@/lib/similarity'
import type { Watch, UserPreferences } from '@/lib/types'

// Lightweight Watch factory (pattern from tests/lib/tasteTags.test.ts).
// Only fields the overlap rules read get real values; everything else is defaulted.
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

// Default preferences used in the pure-function tests — balanced goal so the
// thresholds align with GOAL_THRESHOLDS.balanced (0.65 / 0.45) per plan D-03.
const prefs: UserPreferences = {
  preferredStyles: [],
  dislikedStyles: [],
  preferredDesignTraits: [],
  dislikedDesignTraits: [],
  preferredComplications: [],
  complicationExceptions: [],
  preferredDialColors: [],
  dislikedDialColors: [],
  overlapTolerance: 'medium',
  collectionGoal: 'balanced',
}

// Helper: a Rolex Submariner clone — high similarity on every dimension so the
// average score for a collection of these hits 'Strong overlap'.
function sub(overrides: Partial<Watch> = {}): Watch {
  return w({
    brand: 'Rolex',
    model: 'Submariner',
    status: 'owned',
    movement: 'automatic',
    styleTags: ['sport', 'tool'],
    roleTags: ['dive', 'sport'],
    designTraits: ['rotating-bezel', 'luminous-hands'],
    complications: ['date'],
    caseSizeMm: 40,
    waterResistanceM: 300,
    strapType: 'bracelet',
    dialColor: 'black',
    ...overrides,
  })
}

describe('computeTasteOverlap', () => {
  it('returns sharedWatches via case-insensitive + whitespace-insensitive brand+model match', () => {
    const viewer = {
      watches: [w({ brand: 'Rolex ', model: 'Submariner' })],
      preferences: prefs,
      tasteTags: [],
    }
    const owner = {
      watches: [w({ brand: 'rolex', model: 'submariner' })],
      preferences: prefs,
      tasteTags: [],
    }
    const result = computeTasteOverlap(viewer, owner)
    expect(result.sharedWatches).toHaveLength(1)
    expect(result.sharedWatches[0].brand).toBe('Rolex ')
  })

  it('returns sharedWatches of length 0 when no pair matches', () => {
    const viewer = {
      watches: [w({ brand: 'Omega', model: 'Seamaster' })],
      preferences: prefs,
      tasteTags: [],
    }
    const owner = {
      watches: [w({ brand: 'Rolex', model: 'Submariner' })],
      preferences: prefs,
      tasteTags: [],
    }
    const result = computeTasteOverlap(viewer, owner)
    expect(result.sharedWatches).toHaveLength(0)
  })

  it('sharedTasteTags is the intersection of viewer.tasteTags and owner.tasteTags preserving viewer order', () => {
    const viewer = {
      watches: [],
      preferences: prefs,
      tasteTags: ['Sport Watch Collector', 'Omega Fan', 'Diver'],
    }
    const owner = {
      watches: [],
      preferences: prefs,
      tasteTags: ['Diver', 'Omega Fan', 'Vintage Collector'],
    }
    const result = computeTasteOverlap(viewer, owner)
    // Order preserved from viewer, not owner.
    expect(result.sharedTasteTags).toEqual(['Omega Fan', 'Diver'])
  })

  it(`overlapLabel === 'Strong overlap' when average similarity >= GOAL_THRESHOLDS.balanced.coreFit (${GOAL_THRESHOLDS.balanced.coreFit})`, () => {
    // Three near-identical Subs on both sides → avg similarity should be well
    // above coreFit (0.65).
    const viewer = {
      watches: [sub({ id: 'v1' }), sub({ id: 'v2' }), sub({ id: 'v3' })],
      preferences: prefs,
      tasteTags: [],
    }
    const owner = {
      watches: [sub({ id: 'o1' }), sub({ id: 'o2' }), sub({ id: 'o3' })],
      preferences: prefs,
      tasteTags: [],
    }
    const result = computeTasteOverlap(viewer, owner)
    expect(result.overlapLabel).toBe('Strong overlap')
  })

  it(`overlapLabel === 'Some overlap' when average similarity is in [${GOAL_THRESHOLDS.balanced.familiarTerritory}, ${GOAL_THRESHOLDS.balanced.coreFit})`, () => {
    // Partial overlap: share some style/role tags but not all. This tuning aims
    // for roughly 0.45-0.65 average similarity.
    const viewer = {
      watches: [
        w({
          brand: 'Rolex',
          model: 'Submariner',
          styleTags: ['sport'],
          roleTags: ['dive'],
          designTraits: ['rotating-bezel'],
          complications: [],
          dialColor: 'black',
          strapType: 'bracelet',
          caseSizeMm: 40,
          waterResistanceM: 300,
        }),
      ],
      preferences: prefs,
      tasteTags: [],
    }
    const owner = {
      watches: [
        w({
          brand: 'Seiko',
          model: 'Turtle',
          styleTags: ['sport'],
          roleTags: ['dive'],
          designTraits: ['rotating-bezel'],
          complications: [],
          dialColor: 'blue', // differs
          strapType: 'rubber', // differs
          caseSizeMm: 45, // diff = 5 → mid similarity
          waterResistanceM: 200,
        }),
      ],
      preferences: prefs,
      tasteTags: [],
    }
    const result = computeTasteOverlap(viewer, owner)
    expect(result.overlapLabel).toBe('Some overlap')
  })

  it('overlapLabel === \'Different taste\' when viewer has zero owned watches (D-05)', () => {
    const viewer = { watches: [], preferences: prefs, tasteTags: ['Diver'] }
    const owner = {
      watches: [sub({ id: 'o1' })],
      preferences: prefs,
      tasteTags: ['Diver'],
    }
    const result = computeTasteOverlap(viewer, owner)
    expect(result.overlapLabel).toBe('Different taste')
    expect(result.sharedWatches).toEqual([])
    // Still preserve tag intersection on empty viewer collection (D-05).
    expect(result.sharedTasteTags).toEqual(['Diver'])
  })

  it('overlapLabel === \'Different taste\' when owner has zero owned watches', () => {
    const viewer = {
      watches: [sub({ id: 'v1' })],
      preferences: prefs,
      tasteTags: [],
    }
    const owner = { watches: [], preferences: prefs, tasteTags: [] }
    const result = computeTasteOverlap(viewer, owner)
    expect(result.overlapLabel).toBe('Different taste')
    expect(result.sharedWatches).toEqual([])
  })

  it('overlapLabel === \'Different taste\' when average similarity < familiarTerritory threshold', () => {
    // Two watches with no overlapping tags — should produce a very low score.
    const viewer = {
      watches: [
        w({
          brand: 'Rolex',
          model: 'Day-Date',
          styleTags: ['dress'],
          roleTags: ['formal'],
          designTraits: ['fluted-bezel'],
          complications: ['day', 'date'],
          dialColor: 'white',
          strapType: 'bracelet',
          caseSizeMm: 36,
          waterResistanceM: 30,
        }),
      ],
      preferences: prefs,
      tasteTags: [],
    }
    const owner = {
      watches: [
        w({
          brand: 'Casio',
          model: 'G-Shock',
          styleTags: ['tool'],
          roleTags: ['sport', 'rugged'],
          designTraits: ['resin-case', 'multi-function'],
          complications: ['chronograph', 'alarm'],
          dialColor: 'black',
          strapType: 'rubber',
          caseSizeMm: 48,
          waterResistanceM: 200,
        }),
      ],
      preferences: prefs,
      tasteTags: [],
    }
    const result = computeTasteOverlap(viewer, owner)
    expect(result.overlapLabel).toBe('Different taste')
  })

  it('returns empty sharedStyleRows and sharedRoleRows when either side has fewer than 3 owned watches', () => {
    const viewer = {
      watches: [sub({ id: 'v1' }), sub({ id: 'v2' })], // 2 owned
      preferences: prefs,
      tasteTags: [],
    }
    const owner = {
      watches: [sub({ id: 'o1' }), sub({ id: 'o2' }), sub({ id: 'o3' })], // 3 owned
      preferences: prefs,
      tasteTags: [],
    }
    const result = computeTasteOverlap(viewer, owner)
    expect(result.sharedStyleRows).toEqual([])
    expect(result.sharedRoleRows).toEqual([])
  })

  it('returns sharedStyleRows with { label, viewerPct, ownerPct } when both sides have >= 3 owned watches', () => {
    const viewer = {
      watches: [
        w({ styleTags: ['sport'] }),
        w({ styleTags: ['sport'] }),
        w({ styleTags: ['tool'] }),
      ],
      preferences: prefs,
      tasteTags: [],
    }
    const owner = {
      watches: [
        w({ styleTags: ['sport'] }),
        w({ styleTags: ['dress'] }),
        w({ styleTags: ['dress'] }),
      ],
      preferences: prefs,
      tasteTags: [],
    }
    const result = computeTasteOverlap(viewer, owner)
    expect(result.sharedStyleRows.length).toBeGreaterThan(0)
    for (const row of result.sharedStyleRows) {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('viewerPct')
      expect(row).toHaveProperty('ownerPct')
    }
    const sport = result.sharedStyleRows.find((r) => r.label === 'sport')
    expect(sport).toBeDefined()
    expect(sport!.viewerPct).toBeGreaterThan(0)
    expect(sport!.ownerPct).toBeGreaterThan(0)
  })

  it('filters non-owned watches from intersection (status=\'wishlist\' should NOT create a sharedWatch entry)', () => {
    const viewer = {
      watches: [w({ brand: 'Rolex', model: 'Submariner', status: 'wishlist' })],
      preferences: prefs,
      tasteTags: [],
    }
    const owner = {
      watches: [w({ brand: 'Rolex', model: 'Submariner', status: 'owned' })],
      preferences: prefs,
      tasteTags: [],
    }
    const result = computeTasteOverlap(viewer, owner)
    expect(result.sharedWatches).toHaveLength(0)
  })

  it('hasAny is true when sharedWatches has entries', () => {
    const viewer = {
      watches: [w({ brand: 'Rolex', model: 'Submariner' })],
      preferences: prefs,
      tasteTags: [],
    }
    const owner = {
      watches: [w({ brand: 'Rolex', model: 'Submariner' })],
      preferences: prefs,
      tasteTags: [],
    }
    const result = computeTasteOverlap(viewer, owner)
    expect(result.hasAny).toBe(true)
  })

  it('hasAny is true when sharedTasteTags has entries but sharedWatches is empty', () => {
    const viewer = { watches: [], preferences: prefs, tasteTags: ['Diver'] }
    const owner = { watches: [], preferences: prefs, tasteTags: ['Diver'] }
    const result = computeTasteOverlap(viewer, owner)
    expect(result.hasAny).toBe(true)
  })

  it('hasAny is false when no shared watches and no shared tags', () => {
    const viewer = { watches: [], preferences: prefs, tasteTags: ['Diver'] }
    const owner = { watches: [], preferences: prefs, tasteTags: ['Vintage Collector'] }
    const result = computeTasteOverlap(viewer, owner)
    expect(result.hasAny).toBe(false)
  })
})
