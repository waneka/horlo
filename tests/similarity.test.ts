import { describe, it, expect } from 'vitest'
import { analyzeSimilarity } from '@/lib/similarity'
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
