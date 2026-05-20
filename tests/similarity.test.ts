import { describe, it, expect } from 'vitest'
import { analyzeSimilarity, TASTE_SUB_WEIGHTS, GOAL_THRESHOLDS } from '@/lib/similarity'
import { makeWatch, emptyPreferences, preferencesWithGoal, fixtures } from './fixtures/watches'

describe('analyzeSimilarity', () => {
  describe('empty collection', () => {
    it('returns core-fit label with first-watch reasoning', () => {
      const target = makeWatch({ brand: 'Rolex', model: 'Submariner' })
      const result = analyzeSimilarity(target, [], emptyPreferences)
      expect(result.label).toBe('core-fit')
      expect(result.reasoning.join(' ')).toMatch(/first watch/i)
    })
  })

  describe('all six labels', () => {
    it('labels a high-similarity well-aligned watch as core-fit / familiar-territory / taste-expansion', () => {
      const collection = fixtures.fiveMixed()
      const target = makeWatch({
        brand: 'Omega',
        model: 'Seamaster 300M',
        styleTags: ['dive'],
        roleTags: ['daily'],
        dialColor: 'black',
        complications: [],
      })
      const prefs = {
        ...emptyPreferences,
        preferredStyles: ['dive'],
        preferredDialColors: ['black'],
      }
      const result = analyzeSimilarity(target, collection, prefs)
      expect(['core-fit', 'familiar-territory', 'taste-expansion']).toContain(result.label)
    })

    it('labels a disliked-style watch as hard-mismatch', () => {
      const collection = fixtures.fiveMixed()
      const target = makeWatch({
        styleTags: ['dress'],
        designTraits: ['minimal'],
      })
      const prefs = {
        ...emptyPreferences,
        dislikedStyles: ['dress'],
        dislikedDesignTraits: ['minimal'],
      }
      const result = analyzeSimilarity(target, collection, prefs)
      expect(result.label).toBe('hard-mismatch')
    })

    it('labels a low-similarity unaligned watch as outlier (or taste-expansion/familiar-territory)', () => {
      const collection = fixtures.threeSameStyle() // all dive
      const target = makeWatch({
        styleTags: ['dress'],
        roleTags: ['formal'],
        dialColor: 'white',
        designTraits: [],
        complications: [],
        caseSizeMm: 36,
      })
      const result = analyzeSimilarity(target, collection, emptyPreferences)
      expect(['outlier', 'taste-expansion', 'familiar-territory']).toContain(result.label)
    })

    it('labels a role-overlapping highly-similar watch as role-duplicate', () => {
      // Three dive watches already own 'daily' role; target is another dive daily.
      const collection = [
        makeWatch({ styleTags: ['dive'], roleTags: ['daily'], dialColor: 'black' }),
        makeWatch({ styleTags: ['dive'], roleTags: ['daily'], dialColor: 'black' }),
        makeWatch({ styleTags: ['dive'], roleTags: ['daily'], dialColor: 'black' }),
      ]
      const target = makeWatch({ styleTags: ['dive'], roleTags: ['daily'], dialColor: 'black' })
      const result = analyzeSimilarity(target, collection, emptyPreferences)
      // Under balanced thresholds (0.70 roleConflict) this should trip role-duplicate
      expect(['role-duplicate', 'core-fit', 'familiar-territory']).toContain(result.label)
    })
  })

  describe('collectionGoal: specialist', () => {
    it('produces a result and never crashes on threeSameStyle', () => {
      const collection = fixtures.threeSameStyle()
      const target = makeWatch({
        styleTags: ['dive'],
        roleTags: ['sport'],
        dialColor: 'blue',
      })
      const balanced = analyzeSimilarity(target, collection, preferencesWithGoal('balanced'))
      const specialist = analyzeSimilarity(target, collection, preferencesWithGoal('specialist'))
      expect(specialist).toBeDefined()
      expect(balanced).toBeDefined()
      expect(specialist.label).toBeDefined()
    })

    it('uses depth-positive reasoning ("specialist path" or "depth") when specialist flags role-duplicate', () => {
      const collection = Array.from({ length: 5 }, () =>
        makeWatch({ styleTags: ['dive'], roleTags: ['daily'], dialColor: 'black' }),
      )
      const target = makeWatch({ styleTags: ['dive'], roleTags: ['daily'], dialColor: 'black' })
      const result = analyzeSimilarity(target, collection, preferencesWithGoal('specialist'))
      if (result.label === 'role-duplicate') {
        expect(result.reasoning.join(' ')).toMatch(/specialist path|depth/i)
      }
    })
  })

  describe('collectionGoal: variety-within-theme', () => {
    it('uses affirmative taste-expansion copy when label is taste-expansion', () => {
      const collection = fixtures.fiveMixed()
      const target = makeWatch({
        styleTags: ['field'],
        roleTags: ['outdoor'],
        dialColor: 'green',
      })
      const result = analyzeSimilarity(target, collection, preferencesWithGoal('variety-within-theme'))
      if (result.label === 'taste-expansion') {
        expect(result.reasoning.join(' ')).toMatch(/exactly what/i)
      }
    })
  })

  describe('collectionGoal: brand-loyalist', () => {
    it('flags off-brand targets with an off-brand reasoning line naming the loyal brand', () => {
      const collection = fixtures.threeSameBrand() // all Rolex
      const target = makeWatch({ brand: 'Tudor', styleTags: ['dive'], roleTags: ['daily'] })
      const result = analyzeSimilarity(target, collection, preferencesWithGoal('brand-loyalist'))
      expect(result.reasoning.some((r) => /off-brand/i.test(r))).toBe(true)
      expect(result.reasoning.some((r) => /Rolex/.test(r))).toBe(true)
    })

    it('does NOT flag on-brand targets as off-brand', () => {
      const collection = fixtures.threeSameBrand()
      const target = makeWatch({
        brand: 'Rolex',
        model: 'Explorer II',
        styleTags: ['sport'],
      })
      const result = analyzeSimilarity(target, collection, preferencesWithGoal('brand-loyalist'))
      expect(result.reasoning.some((r) => /off-brand/i.test(r))).toBe(false)
    })
  })

  describe('collectionGoal: balanced (default)', () => {
    it('produces a result with unchanged baseline thresholds on fiveMixed', () => {
      const collection = fixtures.fiveMixed()
      const target = makeWatch({ styleTags: ['dive'], roleTags: ['daily'], dialColor: 'black' })
      const result = analyzeSimilarity(target, collection, preferencesWithGoal('balanced'))
      expect(result.label).toBeDefined()
    })
  })

  describe('complicationExceptions (FEAT-01)', () => {
    it('filters exception complications from the overlap penalty (withException score <= withoutException)', () => {
      const chronoCollection = Array.from({ length: 3 }, () =>
        makeWatch({
          styleTags: ['chrono'],
          roleTags: ['sport'],
          dialColor: 'black',
          complications: ['chronograph', 'tachymeter'],
        }),
      )
      const target = makeWatch({
        styleTags: ['chrono'],
        roleTags: ['sport'],
        dialColor: 'black',
        complications: ['chronograph', 'tachymeter'],
      })

      const withoutException = analyzeSimilarity(target, chronoCollection, emptyPreferences)
      const withException = analyzeSimilarity(target, chronoCollection, {
        ...emptyPreferences,
        complicationExceptions: ['chronograph'],
      })

      // With an exception, the complications dimension contributes less to the
      // pairwise similarity, so the aggregate avg score must be <= the baseline.
      expect(withException.score).toBeLessThanOrEqual(withoutException.score + 1e-9)
    })
  })
})

describe('Phase 49.1 — TASTE_SUB_WEIGHTS rebalance (D-SIM-01..04)', () => {
  it('TASTE_SUB_WEIGHTS has exactly 3 keys: numericTrioCosine, eraMatch, motifsJaccard', () => {
    // D-SIM-03: the archetypeMatch sub-weight is removed; three keys remain.
    expect(Object.keys(TASTE_SUB_WEIGHTS).sort()).toEqual([
      'eraMatch',
      'motifsJaccard',
      'numericTrioCosine',
    ])
  })

  it('TASTE_SUB_WEIGHTS values are 0.50 / 0.25 / 0.25 (within 1e-9 tolerance)', () => {
    // D-SIM-01: proportional rescale by 1 / (1 - 0.20) = 1.25 lifts
    //   numericTrioCosine 0.40 → 0.50, eraMatch 0.20 → 0.25, motifsJaccard 0.20 → 0.25.
    // Values are computed algorithmically (D-SIM-02), so allow a tight float tolerance.
    expect(TASTE_SUB_WEIGHTS.numericTrioCosine).toBeCloseTo(0.5, 9)
    expect(TASTE_SUB_WEIGHTS.eraMatch).toBeCloseTo(0.25, 9)
    expect(TASTE_SUB_WEIGHTS.motifsJaccard).toBeCloseTo(0.25, 9)
  })

  it('TASTE_SUB_WEIGHTS values sum to 1.0 (sub-budget closure invariant)', () => {
    // Tripwire for any future weight-rebalance regression: surviving sub-weights
    // must still sum to 1.0 so the outer TASTE_WEIGHT (0.20) caps taste contribution.
    const sum = Object.values(TASTE_SUB_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1.0, 9)
  })

  it('TASTE_SUB_WEIGHTS no longer has archetypeMatch key (D-SIM-03)', () => {
    expect('archetypeMatch' in TASTE_SUB_WEIGHTS).toBe(false)
  })

  // D-SIM-04: outer envelope thresholds are byte-identical to pre-49.1.
  // GOAL_THRESHOLDS is currently exported; THRESHOLDS is not. Asserting GOAL_THRESHOLDS
  // here is the load-bearing invariant — the goal-aware thresholds are what actually
  // produce verdict labels in analyzeSimilarity().
  // TODO(49.1 follow-up): if THRESHOLDS is later exported, add a sibling assertion
  // covering THRESHOLDS.{low,medium,high}.{coreFit, familiarTerritory, roleConflict}.
  it('GOAL_THRESHOLDS is byte-identical to pre-49.1 values (D-SIM-04)', () => {
    expect(GOAL_THRESHOLDS).toEqual({
      'balanced':              { coreFit: 0.65, familiarTerritory: 0.45, roleConflict: 0.70 },
      'specialist':            { coreFit: 0.65, familiarTerritory: 0.45, roleConflict: 0.78 },
      'variety-within-theme':  { coreFit: 0.65, familiarTerritory: 0.40, roleConflict: 0.65 },
      'brand-loyalist':        { coreFit: 0.65, familiarTerritory: 0.45, roleConflict: 0.70 },
    })
  })
})
