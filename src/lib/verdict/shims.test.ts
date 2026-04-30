import { describe, it } from 'vitest'

/**
 * Phase 20 D-09 — caller shim catalogEntryToSimilarityInput preserves engine inputs.
 *
 * Filled by Plan 02 Task: "Implement shims + tests".
 */
describe('D-09 catalogEntryToSimilarityInput shim (Plan 02)', () => {
  it.todo('round-trip: shim\'d Watch produces same SimilarityResult as a real Watch with identical fields')
  it.todo('coerces unknown movement string to "other" (closed union safety)')
  it.todo('coerces unknown crystalType to undefined (Watch optional)')
  it.todo('preserves styleTags / designTraits / roleTags / complications arrays verbatim')
  it.todo('sets candidate.status = "wishlist" with comment referencing engine line 225 (Pitfall 7)')
  it.todo('threads catalog UUID through to id slot — does not collide with viewer collection ids (A1)')
})
