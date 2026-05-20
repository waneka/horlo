// tests/static/composer-engine-alignment.test.ts
// Phase 38 D-04 + D-15 — verbal-numeric alignment.
//
// Asserts that for every scenario in the D-15 matrix, the verbal composer
// (computeVerdictBundle → VerdictBundleFull.label) and the numeric engine
// (analyzeSimilarity → SimilarityResult.label) agree at the SimilarityLabel
// tier level. Cheap insurance against verbal-numeric drift; surfaces
// composer bugs uncovered by the Plan B engine rewire.
//
// FIT-04 boundary preserved: test calls computeVerdictBundle directly as a
// library function. CollectionFitCard.tsx is NOT imported.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { analyzeSimilarity } from '@/lib/similarity'
import { computeVerdictBundle } from '@/lib/verdict/composer'
import type { CatalogEntry, Watch, CatalogTasteAttributes } from '@/lib/types'
import type { ViewerTasteProfile } from '@/lib/verdict/types'
import { makeWatch, emptyPreferences } from '../fixtures/watches'
import {
  subLikeTaste,
  datejustLikeTaste,
  speedyLikeTaste,
  tankLikeTaste,
  lowConfTaste,
  exactlyHalfConfTaste,
  justBelowHalfTaste,
  emptyMotifsTaste,
} from '../fixtures/catalogTaste'

// Empty viewer-taste profile (no aggregated user-collection taste — composer falls back
// to the engine's per-pair signal). Mirrors the shape used in composer.test.ts.
const emptyProfile: ViewerTasteProfile = {
  meanFormality: null,
  meanSportiness: null,
  meanHeritageScore: null,
  dominantEraSignal: null,
  topDesignMotifs: [],
}

// Helper: build a minimal CatalogEntry from a CatalogTasteAttributes fixture so the
// composer receives the candidate's taste signature (it reads from `catalogEntry`,
// not from candidate.catalogTaste). Other CatalogEntry fields default to null/empty —
// Phase 38 alignment only cares about the taste surface.
function catalogEntryFrom(taste: CatalogTasteAttributes | null): CatalogEntry | null {
  if (!taste) return null
  return {
    id: 'cat-align-' + Math.random().toString(36).slice(2),
    brand: 'Brand',
    model: 'Model',
    reference: null,
    source: 'user_promoted',
    imageUrl: null,
    imageSourceUrl: null,
    imageSourceQuality: null,
    movementType: null,
    movementCaliber: null,
    caseSizeMm: null,
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
    formality: taste.formality,
    sportiness: taste.sportiness,
    heritageScore: taste.heritageScore,
    primaryArchetype: taste.primaryArchetype,
    eraSignal: taste.eraSignal,
    designMotifs: taste.designMotifs,
    confidence: taste.confidence,
    extractedFromPhoto: taste.extractedFromPhoto,
    createdAt: '2026-05-12T00:00:00Z',
    updatedAt: '2026-05-12T00:00:00Z',
  }
}

// Per RESEARCH §Pitfall 5: each scenario uses explicit `id: \`target-${name}\`` /
// `id: \`owned-${name}\`` overrides to avoid the module-level idCounter causing
// cross-test ID reuse.

interface Scenario {
  name: string
  targetTaste: CatalogTasteAttributes | null
  ownedTaste: CatalogTasteAttributes | null
}

// D-15 scenario matrix — 11 scenarios minimum per plan commitment.
const SCENARIOS: Scenario[] = [
  // D-15 — 2× taste-null (both watches lack catalog taste)
  {
    name: 'taste-null both',
    targetTaste: null,
    ownedTaste: null,
  },
  {
    name: 'taste-null target only',
    targetTaste: null,
    ownedTaste: subLikeTaste,
  },

  // D-15 — 2× low-confidence (confidence < 0.5 on one or both)
  {
    name: 'low-confidence both',
    targetTaste: lowConfTaste,
    ownedTaste: lowConfTaste,
  },
  {
    name: 'low-confidence target only',
    targetTaste: lowConfTaste,
    ownedTaste: subLikeTaste,
  },

  // D-15 — 2× high-confidence taste-compatible (matching archetype + similar numerics)
  {
    name: 'high-conf taste-compatible (sub vs sub)',
    targetTaste: subLikeTaste,
    ownedTaste: subLikeTaste,
  },
  {
    name: 'high-conf taste-compatible (datejust vs datejust)',
    targetTaste: datejustLikeTaste,
    ownedTaste: datejustLikeTaste,
  },

  // D-15 — 2× high-confidence taste-incompatible (mismatched archetype + dissimilar numerics)
  {
    name: 'high-conf taste-incompatible (sub vs tank)',
    targetTaste: subLikeTaste,
    ownedTaste: tankLikeTaste,
  },
  {
    name: 'high-conf taste-incompatible (speedy vs tank)',
    targetTaste: speedyLikeTaste,
    ownedTaste: tankLikeTaste,
  },

  // D-15 — 1× confidence exactly 0.5 (strict >= semantics: taste counts)
  {
    name: 'confidence exactly 0.5 (>= edge — taste counts)',
    targetTaste: exactlyHalfConfTaste,
    ownedTaste: exactlyHalfConfTaste,
  },

  // D-15 — 1× confidence 0.499 (strict < semantics: taste does NOT count)
  {
    name: 'confidence 0.499 (< edge — taste does not count)',
    targetTaste: justBelowHalfTaste,
    ownedTaste: justBelowHalfTaste,
  },

  // D-15 — 1× empty designMotifs (Jaccard returns 0; no crash)
  {
    name: 'empty designMotifs (no crash; Jaccard returns 0)',
    targetTaste: emptyMotifsTaste,
    ownedTaste: emptyMotifsTaste,
  },
]

describe('Phase 40 FIT-05 — candidateCatalogTaste threading (source-text guard)', () => {
  it('composer.ts return literal includes candidateCatalogTaste field wired to catalogEntry', () => {
    const composerSrc = readFileSync('src/lib/verdict/composer.ts', 'utf8')
    expect(composerSrc).toMatch(/candidateCatalogTaste:\s*catalogEntry/)
  })

  it('types.ts VerdictBundleFull declares candidateCatalogTaste field', () => {
    const typesSrc = readFileSync('src/lib/verdict/types.ts', 'utf8')
    expect(typesSrc).toMatch(/candidateCatalogTaste/)
  })
})

describe('Phase 38 D-04/D-15 — composer & engine agree at SimilarityLabel tier', () => {
  for (const s of SCENARIOS) {
    it(s.name, () => {
      const candidate: Watch = makeWatch({
        id: `target-${s.name}`,
        status: 'wishlist',
        catalogTaste: s.targetTaste,
      })
      const owned: Watch = makeWatch({
        id: `owned-${s.name}`,
        status: 'owned',
        catalogTaste: s.ownedTaste,
      })

      const engineResult = analyzeSimilarity(candidate, [owned], emptyPreferences)
      const bundle = computeVerdictBundle({
        candidate,
        catalogEntry: catalogEntryFrom(s.targetTaste),
        collection: [owned],
        preferences: emptyPreferences,
        profile: emptyProfile,
        framing: 'same-user',
      })

      // Tier-level agreement: the composer's bundle.label must equal the engine's result.label.
      // Composer.ts line 87 returns `result.label` verbatim from analyzeSimilarity — so this
      // asserts the composer does not post-process the label away from what the engine emitted.
      // If a future composer adds taste-aware label remapping (e.g., upgrading
      // 'familiar-territory' → 'core-fit' when taste-compatible), this test catches the
      // divergence at the moment of drift (D-04 invariant: verbal copy and numeric label
      // cannot drift apart silently).
      expect(bundle.label).toBe(engineResult.label)
    })
  }
})
