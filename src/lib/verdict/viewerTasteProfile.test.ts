import { describe, it } from 'vitest'

/**
 * Phase 20 D-02 — pure aggregate taste profile, null-tolerant.
 *
 * Filled by Plan 02 Task: "Implement viewerTasteProfile + tests".
 */
describe('D-02 viewerTasteProfile (Plan 02)', () => {
  it.todo('returns EMPTY_PROFILE when collection has zero watches')
  it.todo('skips catalog rows with confidence < CONFIDENCE_FLOOR (0.5)')
  it.todo('mean of all-NULL formality column returns null (not NaN, not 0)')
  it.todo('mode of all-NULL primaryArchetype column returns null')
  it.todo('topDesignMotifs returns [] when all designMotifs arrays are empty')
  it.todo('topDesignMotifs returns top-3 by frequency, ties broken by insertion order')
  it.todo('mean of mixed null + numeric column averages only the non-null entries')
  it.todo('handles a 0-watch collection without throwing (D-07 guarded path is upstream)')
})
