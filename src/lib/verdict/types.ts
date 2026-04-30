// Phase 20 D-04: pure-render type contract for <CollectionFitCard>. Types-only — no runtime exports.

import type { Watch, SimilarityLabel, PrimaryArchetype, EraSignal } from '@/lib/types'

/**
 * Phase 20 D-04: VerdictBundle is the pure-render contract for <CollectionFitCard>.
 *
 * Discriminated union by `framing`:
 *   - 'same-user' / 'cross-user' → full verdict (label, headline, contextual, mostSimilar, roleOverlap)
 *   - 'self-via-cross-user' (D-08) → "You own this" callout — no verdict computed
 *
 * Pitfall 3 (RSC serialization): every field is plain JSON. No date objects,
 * Map, Set, undefined-as-property. Calendar values are ISO date strings (ownedAtIso).
 */
export type Framing = 'same-user' | 'cross-user' | 'self-via-cross-user'

export interface VerdictMostSimilar {
  watch: Watch
  score: number
}

export interface VerdictBundleFull {
  framing: 'same-user' | 'cross-user'
  label: SimilarityLabel
  /** Verbatim getSimilarityLabelDisplay(label).text — chip copy. */
  headlinePhrasing: string
  /** Composer-generated phrasings (D-01 templates); falls back to single fixed-label description when confidence < 0.5. */
  contextualPhrasings: string[]
  mostSimilar: VerdictMostSimilar[]
  roleOverlap: boolean
}

export interface VerdictBundleSelfOwned {
  framing: 'self-via-cross-user'
  /** ISO date string of viewer.acquisitionDate ?? viewer.createdAt — UI formats with Intl.DateTimeFormat short month. */
  ownedAtIso: string
  /** /watch/{viewer.watchId} — viewer's per-user watches.id, not catalog id. */
  ownerHref: string
}

export type VerdictBundle = VerdictBundleFull | VerdictBundleSelfOwned

/**
 * Phase 20 D-02: viewer aggregate taste profile.
 * Null-tolerant: every numeric field is `number | null`; arrays are `[]` when empty.
 * `null` means "no signal" (collection has no Phase 19.1-enriched rows above the
 * confidence floor). Composer must skip templates whose slot resolves to null.
 */
export interface ViewerTasteProfile {
  meanFormality: number | null
  meanSportiness: number | null
  meanHeritageScore: number | null
  dominantArchetype: PrimaryArchetype | null
  dominantEraSignal: EraSignal | null
  topDesignMotifs: string[]  // always array; up to 3 entries by frequency
}

/**
 * D-01 template library entry. Predicate decides applicability + returns slot bag;
 * template is a string with ${slot} placeholders the composer fills.
 *
 * Predicate inputs include candidateTaste (the Phase 19.1 taste row of the candidate
 * watch) so templates can gate on confidence (Pitfall 4) and primaryArchetype
 * without re-querying.
 */
export interface CandidateTasteSnapshot {
  primaryArchetype: PrimaryArchetype | null
  heritageScore: number | null
  formality: number | null
  sportiness: number | null
  confidence: number | null
}

export interface Template {
  id: string
  predicate: (
    result: import('@/lib/types').SimilarityResult,
    profile: ViewerTasteProfile,
    candidate: Watch,
    candidateTaste: CandidateTasteSnapshot,
  ) => Record<string, string> | null
  template: string
}
