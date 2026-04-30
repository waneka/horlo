import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  Watch,
  UserPreferences,
  SimilarityResult,
  SimilarityLabel,
  CatalogEntry,
} from '@/lib/types'
import type { ViewerTasteProfile } from '@/lib/verdict/types'

/**
 * Phase 20 FIT-02 — Composer determinism + 4 roadmap-example template hits +
 * confidence gating (Pitfall 4) + null-tolerant slot resolution (Pitfall 2).
 *
 * The composer calls analyzeSimilarity internally; we mock it so each test
 * controls the SimilarityResult shape directly. The 4 roadmap-example
 * predicates are exercised one-per-test against composed inputs.
 */

let mockResult: SimilarityResult
const analyzeSimilaritySpy = vi.fn(() => mockResult)

vi.mock('@/lib/similarity', () => ({
  analyzeSimilarity: (...args: unknown[]) => analyzeSimilaritySpy(...args),
}))

import { computeVerdictBundle } from './composer'
import { HEADLINE_FOR_LABEL, DESCRIPTION_FOR_LABEL } from './templates'

function defaultPrefs(): UserPreferences {
  return {
    preferredStyles: [],
    dislikedStyles: [],
    preferredDesignTraits: [],
    dislikedDesignTraits: [],
    preferredComplications: [],
    complicationExceptions: [],
    preferredDialColors: [],
    dislikedDialColors: [],
    overlapTolerance: 'medium',
  }
}

function buildWatch(id: string, overrides: Partial<Watch> = {}): Watch {
  return {
    id,
    brand: 'Brand',
    model: 'Model',
    status: 'wishlist',
    movement: 'automatic',
    complications: [],
    styleTags: [],
    designTraits: [],
    roleTags: [],
    ...overrides,
  }
}

function buildProfile(overrides: Partial<ViewerTasteProfile> = {}): ViewerTasteProfile {
  return {
    meanFormality: null,
    meanSportiness: null,
    meanHeritageScore: null,
    dominantArchetype: null,
    dominantEraSignal: null,
    topDesignMotifs: [],
    ...overrides,
  }
}

function buildCatalogEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'cat-1',
    brand: 'Brand',
    model: 'Model',
    reference: null,
    source: 'admin_curated',
    imageUrl: null,
    imageSourceUrl: null,
    imageSourceQuality: null,
    movement: 'automatic',
    caseSizeMm: 40,
    lugToLugMm: null,
    waterResistanceM: null,
    crystalType: null,
    dialColor: null,
    isChronometer: null,
    productionYear: null,
    productionYearIsEstimate: false,
    styleTags: [],
    designTraits: [],
    roleTags: [],
    complications: [],
    ownersCount: 0,
    wishlistCount: 0,
    formality: null,
    sportiness: null,
    heritageScore: null,
    primaryArchetype: null,
    eraSignal: null,
    designMotifs: [],
    confidence: null,
    extractedFromPhoto: false,
    createdAt: '2026-04-29T00:00:00Z',
    updatedAt: '2026-04-29T00:00:00Z',
    ...overrides,
  }
}

function buildResult(overrides: Partial<SimilarityResult> = {}): SimilarityResult {
  return {
    label: 'core-fit',
    score: 0.5,
    mostSimilarWatches: [],
    roleOverlap: false,
    reasoning: [],
    ...overrides,
  }
}

beforeEach(() => {
  mockResult = buildResult()
  analyzeSimilaritySpy.mockClear()
})

describe('FIT-02 composer (Plan 02)', () => {
  it('is deterministic — same (result, profile, candidate) → same VerdictBundle', () => {
    mockResult = buildResult({ label: 'core-fit' })
    const args = {
      candidate: buildWatch('c1'),
      catalogEntry: buildCatalogEntry({ confidence: 0.8, primaryArchetype: 'dive' as const }),
      collection: [],
      preferences: defaultPrefs(),
      profile: buildProfile({ dominantArchetype: 'dive' as const }),
      framing: 'same-user' as const,
    }
    const a = computeVerdictBundle(args)
    const b = computeVerdictBundle(args)
    expect(a).toEqual(b)
  })

  it('fires "fills-a-hole" template when archetype is novel and confidence ≥ 0.7', () => {
    mockResult = buildResult({ label: 'taste-expansion' })
    const out = computeVerdictBundle({
      candidate: buildWatch('c1'),
      catalogEntry: buildCatalogEntry({
        confidence: 0.8,
        primaryArchetype: 'dress',
      }),
      collection: [],
      preferences: defaultPrefs(),
      profile: buildProfile({ dominantArchetype: 'dive' }),
      framing: 'same-user',
    })
    expect(out.contextualPhrasings).toContain(
      'Fills a hole in your collection — your first dress.',
    )
  })

  it('fires "aligns-with-heritage" template when both candidate and profile heritage signals are high', () => {
    mockResult = buildResult({ label: 'core-fit' })
    const out = computeVerdictBundle({
      candidate: buildWatch('c1'),
      catalogEntry: buildCatalogEntry({
        confidence: 0.8,
        heritageScore: 0.85,
      }),
      collection: [],
      preferences: defaultPrefs(),
      profile: buildProfile({ meanHeritageScore: 0.75 }),
      framing: 'same-user',
    })
    expect(out.contextualPhrasings).toContain(
      'Aligns with your heritage-driven taste.',
    )
  })

  it('fires "collection-skews-contrast" template when archetypes diverge', () => {
    mockResult = buildResult({ label: 'taste-expansion' })
    const out = computeVerdictBundle({
      candidate: buildWatch('c1'),
      catalogEntry: buildCatalogEntry({
        confidence: 0.8,
        primaryArchetype: 'dive',
      }),
      collection: [],
      preferences: defaultPrefs(),
      profile: buildProfile({ dominantArchetype: 'dress' }),
      framing: 'same-user',
    })
    expect(out.contextualPhrasings).toContain(
      'Your collection skews dress — this is a dive.',
    )
  })

  it('fires "overlaps-with-specific" template when top mostSimilar score ≥ 0.6', () => {
    const topWatch = buildWatch('owned-1', { brand: 'Rolex', model: 'Submariner' })
    mockResult = buildResult({
      label: 'familiar-territory',
      mostSimilarWatches: [{ watch: topWatch, score: 0.7 }],
    })
    const out = computeVerdictBundle({
      candidate: buildWatch('c1'),
      catalogEntry: buildCatalogEntry({ confidence: 0.8 }),
      collection: [],
      preferences: defaultPrefs(),
      profile: buildProfile(),
      framing: 'same-user',
    })
    expect(out.contextualPhrasings).toContain(
      'Overlaps strongly with your Rolex Submariner.',
    )
  })

  it('falls through to 6-fixed-label phrasings when entry.confidence < 0.5', () => {
    mockResult = buildResult({ label: 'core-fit' })
    const out = computeVerdictBundle({
      candidate: buildWatch('c1'),
      catalogEntry: buildCatalogEntry({ confidence: 0.3 }),
      collection: [],
      preferences: defaultPrefs(),
      profile: buildProfile(),
      framing: 'same-user',
    })
    expect(out.contextualPhrasings).toEqual([DESCRIPTION_FOR_LABEL['core-fit']])
    expect(out.contextualPhrasings).toEqual(['Highly aligned with your taste'])
  })

  it('hedges phrasing prefix ("Possibly ") when 0.5 ≤ entry.confidence < 0.7', () => {
    mockResult = buildResult({ label: 'core-fit' })
    const out = computeVerdictBundle({
      candidate: buildWatch('c1'),
      catalogEntry: buildCatalogEntry({
        confidence: 0.6,
        heritageScore: 0.85,
      }),
      collection: [],
      preferences: defaultPrefs(),
      profile: buildProfile({ meanHeritageScore: 0.75 }),
      framing: 'same-user',
    })
    expect(out.contextualPhrasings).toContain(
      'Possibly aligns with your heritage-driven taste.',
    )
    // No phrasing should remain in its un-hedged form when hedging is active.
    expect(out.contextualPhrasings).not.toContain(
      'Aligns with your heritage-driven taste.',
    )
  })

  it('returns at least one phrasing even when no template fires (default fallback)', () => {
    // Setup that guarantees no template predicate matches:
    // - label='familiar-territory' (no core-fit / hard-mismatch / role-overlap)
    // - heritageScore=0 → not heritage
    // - no archetypes → no fills-a-hole / archetype-echo / collection-skews-contrast
    // - empty mostSimilarWatches → no overlaps-with-specific
    // - profile has dominantArchetype='dive' so first-watch does NOT fire
    // - confidence=0.8 (full, not fallback)
    mockResult = buildResult({ label: 'familiar-territory' })
    const out = computeVerdictBundle({
      candidate: buildWatch('c1'),
      catalogEntry: buildCatalogEntry({
        confidence: 0.8,
        heritageScore: 0,
        primaryArchetype: null,
        formality: null,
        sportiness: null,
      }),
      collection: [],
      preferences: defaultPrefs(),
      profile: buildProfile({ dominantArchetype: 'dive', meanFormality: 0.5 }),
      framing: 'same-user',
    })
    expect(out.contextualPhrasings.length).toBeGreaterThanOrEqual(1)
  })

  it('preserves SimilarityLabel.text in headlinePhrasing for all 6 fixed labels', () => {
    const labels: SimilarityLabel[] = [
      'core-fit',
      'familiar-territory',
      'role-duplicate',
      'taste-expansion',
      'outlier',
      'hard-mismatch',
    ]
    for (const label of labels) {
      mockResult = buildResult({ label })
      const out = computeVerdictBundle({
        candidate: buildWatch('c1'),
        catalogEntry: buildCatalogEntry({ confidence: 0.8 }),
        collection: [],
        preferences: defaultPrefs(),
        profile: buildProfile(),
        framing: 'same-user',
      })
      expect(out.headlinePhrasing).toBe(HEADLINE_FOR_LABEL[label])
    }
  })
})
