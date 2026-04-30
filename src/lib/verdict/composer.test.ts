import { describe, it } from 'vitest'

/**
 * Phase 20 FIT-02 — Composer determinism + 4 roadmap-example template hits +
 * confidence gating (Pitfall 4) + null-tolerant slot resolution (Pitfall 2).
 *
 * Filled by Plan 02 Task: "Implement composer + composer.test.ts".
 */
describe('FIT-02 composer (Plan 02)', () => {
  it.todo('is deterministic — same (result, profile, candidate) → same VerdictBundle')
  it.todo('fires "fills-a-hole" template when archetype is novel and confidence ≥ 0.7')
  it.todo('fires "aligns-with-heritage" template when both candidate and profile heritage signals are high')
  it.todo('fires "collection-skews-contrast" template when archetypes diverge')
  it.todo('fires "overlaps-with-specific" template when top mostSimilar score ≥ 0.6')
  it.todo('falls through to 6-fixed-label phrasings when entry.confidence < 0.5')
  it.todo('hedges phrasing prefix ("Possibly ") when 0.5 ≤ entry.confidence < 0.7')
  it.todo('returns at least one phrasing even when no template fires (default fallback)')
  it.todo('preserves SimilarityLabel.text in headlinePhrasing for all 6 fixed labels')
})
