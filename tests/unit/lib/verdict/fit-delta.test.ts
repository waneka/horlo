import { describe, it, expect } from 'vitest'
import { computeDeltaPhrase } from '@/lib/verdict/fit-delta'
import type { CatalogTasteAttributes } from '@/lib/types'

// Fixture builder — defaults represent a mid-range profile; each test overrides only differing fields.
// Phase 49.1 D-SCOPE-01c — primaryArchetype dimension removed from fit-delta's
// ranked output. CatalogTasteAttributes still carries the field (Plan 06 drops it
// from the type); fixture keeps it null for shape parity until then.
function taste(overrides: Partial<CatalogTasteAttributes>): CatalogTasteAttributes {
  return {
    formality: 0.5,
    sportiness: 0.5,
    heritageScore: 0.5,
    primaryArchetype: null,
    eraSignal: 'modern',
    designMotifs: ['brushed'],
    confidence: 0.9,
    extractedFromPhoto: false,
    ...overrides,
  }
}

describe('computeDeltaPhrase — D-16 delta algorithm', () => {
  // Scenario 1: Identical taste profiles — all deltas zero → "Very similar" fallback
  it('returns "Very similar across all taste dimensions" when all deltas are below threshold', () => {
    const profile = taste({})
    expect(computeDeltaPhrase(profile, profile)).toBe(
      'Very similar across all taste dimensions',
    )
  })

  // Scenario 2: Formality-dominant scalar (candidate higher) — delta 0.6 dominates
  it('returns "This is more formal" when formality delta is highest and candidate > owned', () => {
    const candidate = taste({ formality: 0.9, sportiness: 0.5, heritageScore: 0.5 })
    const owned = taste({ formality: 0.3, sportiness: 0.5, heritageScore: 0.5 })
    expect(computeDeltaPhrase(candidate, owned)).toBe('This is more formal')
  })

  // Scenario 3: Sportiness-dominant scalar (candidate lower) — delta 0.6 dominates
  it('returns "This is less sport" when sportiness delta is highest and candidate < owned', () => {
    const candidate = taste({ formality: 0.5, sportiness: 0.2, heritageScore: 0.5 })
    const owned = taste({ formality: 0.5, sportiness: 0.8, heritageScore: 0.5 })
    expect(computeDeltaPhrase(candidate, owned)).toBe('This is less sport')
  })

  // Scenario 4: Heritage-dominant (candidate higher) — delta 0.7 dominates
  it('returns "More heritage-leaning" when heritageScore delta is highest and candidate > owned', () => {
    const candidate = taste({ formality: 0.5, sportiness: 0.5, heritageScore: 0.9 })
    const owned = taste({ formality: 0.5, sportiness: 0.5, heritageScore: 0.2 })
    expect(computeDeltaPhrase(candidate, owned)).toBe('More heritage-leaning')
  })

  // Scenario 5 (Phase 49.1 D-SCOPE-01c) — "Different archetype: X vs Y" test
  // removed; primaryArchetype dimension dropped from fit-delta's ranked output.

  // Scenario 6: Era mismatch — all scalars within threshold, motifs identical
  it('returns "Different era: Vintage Leaning vs Modern" when eraSignal differs and dominates', () => {
    const candidate = taste({ eraSignal: 'vintage-leaning' })
    const owned = taste({ eraSignal: 'modern' })
    expect(computeDeltaPhrase(candidate, owned)).toBe('Different era: Vintage Leaning vs Modern')
  })

  // Scenario 7: Motif mismatch — candidate and owned have entirely disjoint motifs (jaccard=0)
  it('returns "Different design motifs" when motif jaccard is 0 and that delta dominates', () => {
    const candidate = taste({ designMotifs: ['brushed', 'polished'] })
    const owned = taste({ designMotifs: ['matte', 'satin'] })
    expect(computeDeltaPhrase(candidate, owned)).toBe('Different design motifs')
  })

  // Scenario 8: Null scalar gracefully excluded — candidate.formality=null; sportiness delta=0.3 wins
  it('excludes null scalars without crashing and returns a valid directional phrase', () => {
    const candidate = taste({ formality: null, sportiness: 0.8, heritageScore: 0.5 })
    const owned = taste({ formality: 0.5, sportiness: 0.5, heritageScore: 0.5 })
    const result = computeDeltaPhrase(candidate, owned)
    // sportiness: candidate(0.8) > owned(0.5) → "This is more sport"
    expect(result).toMatch(/(more|less) sport/)
    // Must not be NaN or crash
    expect(result).not.toContain('NaN')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
