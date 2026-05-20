// Phase 20 D-04: pure-render type contract for <CollectionFitCard>. Types-only — no runtime exports.

import type { Watch, SimilarityLabel, EraSignal, CatalogTasteAttributes } from '@/lib/types'

/**
 * Phase 20 D-04: VerdictBundle is the pure-render contract for <CollectionFitCard>.
 *
 * Discriminated by `framing`:
 *   - 'same-user' / 'cross-user' → full verdict (label, headline, contextual, mostSimilar, roleOverlap)
 *
 * Phase 50.1 ARCH-02 — the 'self-via-cross-user' (D-08) framing was retired when
 * `/catalog/[catalogId]` started issuing a server-side redirect to `/watch/[id]`
 * for the owner viewer; the old "You own this" callout is unreachable and was
 * removed in the v5.2 close-out cleanup.
 *
 * Pitfall 3 (RSC serialization): every field is plain JSON. No date objects,
 * Map, Set, undefined-as-property.
 */
export type Framing = 'same-user' | 'cross-user'

export interface VerdictMostSimilar {
  watch: Watch
  score: number
}

export interface VerdictBundleFull {
  framing: Framing
  label: SimilarityLabel
  /** Verbatim getSimilarityLabelDisplay(label).text — chip copy. */
  headlinePhrasing: string
  /** Composer-generated phrasings (D-01 templates); falls back to single fixed-label description when confidence < 0.5. */
  contextualPhrasings: string[]
  /** Phase 28 D-19 — 1st-person rationale-voice strings, lockstep with contextualPhrasings.
   *  rationalePhrasings.length === contextualPhrasings.length and
   *  rationalePhrasings[i] is the rationale-voice version of contextualPhrasings[i]. */
  rationalePhrasings: string[]
  mostSimilar: VerdictMostSimilar[]
  roleOverlap: boolean
  /** Phase 40 FIT-05 D-14/D-15 — candidate's CAT-13 taste from catalogEntry; null when catalogEntry is null. Confidence-gate (>= 0.5) applied DOWNSTREAM in CollectionFitCard, not here. */
  candidateCatalogTaste: CatalogTasteAttributes | null
}

/** Post-ARCH-02 alias: only the full-verdict shape remains. */
export type VerdictBundle = VerdictBundleFull

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
  /**
   * Phase 49.1 D-VERDICT-03 — `dominantArchetype` removed; era axis now carries
   * the "dominant categorical signal" load for verdict templates.
   */
  dominantEraSignal: EraSignal | null
  topDesignMotifs: string[]  // always array; up to 3 entries by frequency
}

/**
 * D-01 template library entry. Predicate decides applicability + returns slot bag;
 * template is a string with ${slot} placeholders the composer fills.
 *
 * Predicate inputs include candidateTaste (the Phase 19.1 taste row of the candidate
 * watch) so templates can gate on confidence (Pitfall 4) and eraSignal without
 * re-querying.
 *
 * Phase 49.1 D-VERDICT-01 — `primaryArchetype` removed; templates pivot to the
 * `eraSignal` axis. Composer threads `catalogEntry.eraSignal` into the snapshot.
 */
export interface CandidateTasteSnapshot {
  eraSignal: EraSignal | null
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
  /** Phase 28 D-17 — 1st-person rationale-voice template; same `${slot}` grammar as `template`. */
  rationaleTemplate: string
}
