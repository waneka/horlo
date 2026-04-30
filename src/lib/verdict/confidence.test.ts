import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  Watch,
  UserPreferences,
  SimilarityResult,
  CatalogEntry,
} from '@/lib/types'
import type { ViewerTasteProfile } from '@/lib/verdict/types'

/**
 * Phase 20 Pitfall 4 / Phase 19.1 D-14 confidence gating thresholds (0.5 / 0.7).
 *
 * Boundary contract:
 *   - confidence === null OR < 0.5 → 6-fixed-label fallback
 *   - 0.5 ≤ confidence < 0.7      → hedged ("Possibly " prefix)
 *   - confidence ≥ 0.7            → full contextual
 */

let mockResult: SimilarityResult
const analyzeSimilaritySpy = vi.fn(() => mockResult)

vi.mock('@/lib/similarity', () => ({
  analyzeSimilarity: (...args: unknown[]) => analyzeSimilaritySpy(...args),
}))

import { computeVerdictBundle } from './composer'
import { DESCRIPTION_FOR_LABEL } from './templates'

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
    meanHeritageScore: 0.75,
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
    // High heritage score so the heritage template is a viable trigger when
    // not in fallback mode.
    heritageScore: 0.85,
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
  mockResult = buildResult({ label: 'core-fit' })
  analyzeSimilaritySpy.mockClear()
})

describe('Pitfall 4 confidence gate (Plan 02)', () => {
  it('confidence === null → 6-fixed-label fallback', () => {
    const out = computeVerdictBundle({
      candidate: buildWatch('c1'),
      // catalogEntry: null threads confidence=null through the composer's
      // CandidateTasteSnapshot construction.
      catalogEntry: null,
      collection: [],
      preferences: defaultPrefs(),
      profile: buildProfile(),
      framing: 'same-user',
    })
    expect(out.contextualPhrasings).toEqual([DESCRIPTION_FOR_LABEL['core-fit']])
  })

  it('confidence < 0.5 → 6-fixed-label fallback', () => {
    const out = computeVerdictBundle({
      candidate: buildWatch('c1'),
      catalogEntry: buildCatalogEntry({ confidence: 0.49 }),
      collection: [],
      preferences: defaultPrefs(),
      profile: buildProfile(),
      framing: 'same-user',
    })
    expect(out.contextualPhrasings).toEqual([DESCRIPTION_FOR_LABEL['core-fit']])
  })

  it('0.5 ≤ confidence < 0.7 → hedged phrasings ("Possibly " prefix)', () => {
    // Boundary 0.5 (inclusive lower) — must hedge
    const out05 = computeVerdictBundle({
      candidate: buildWatch('c1'),
      catalogEntry: buildCatalogEntry({ confidence: 0.5 }),
      collection: [],
      preferences: defaultPrefs(),
      profile: buildProfile(),
      framing: 'same-user',
    })
    const phrasings05 = out05.contextualPhrasings
    expect(phrasings05.some((p) => p.startsWith('Possibly '))).toBe(true)
    // No un-hedged "Aligns with…" form should appear at this confidence.
    expect(phrasings05).not.toContain('Aligns with your heritage-driven taste.')

    // Boundary 0.69 (just under upper) — must still hedge
    const out069 = computeVerdictBundle({
      candidate: buildWatch('c1'),
      catalogEntry: buildCatalogEntry({ confidence: 0.69 }),
      collection: [],
      preferences: defaultPrefs(),
      profile: buildProfile(),
      framing: 'same-user',
    })
    expect(out069.contextualPhrasings.some((p) => p.startsWith('Possibly '))).toBe(true)
    expect(out069.contextualPhrasings).not.toContain(
      'Aligns with your heritage-driven taste.',
    )
  })

  it('confidence ≥ 0.7 → full contextual phrasings', () => {
    // Boundary 0.7 (exact) — full contextual
    const out07 = computeVerdictBundle({
      candidate: buildWatch('c1'),
      catalogEntry: buildCatalogEntry({ confidence: 0.7 }),
      collection: [],
      preferences: defaultPrefs(),
      profile: buildProfile(),
      framing: 'same-user',
    })
    expect(out07.contextualPhrasings).toContain(
      'Aligns with your heritage-driven taste.',
    )
    expect(
      out07.contextualPhrasings.some((p) => p.startsWith('Possibly ')),
    ).toBe(false)

    // 0.95 (full) — full contextual
    const out095 = computeVerdictBundle({
      candidate: buildWatch('c1'),
      catalogEntry: buildCatalogEntry({ confidence: 0.95 }),
      collection: [],
      preferences: defaultPrefs(),
      profile: buildProfile(),
      framing: 'same-user',
    })
    expect(out095.contextualPhrasings).toContain(
      'Aligns with your heritage-driven taste.',
    )
    expect(
      out095.contextualPhrasings.some((p) => p.startsWith('Possibly ')),
    ).toBe(false)
  })
})
