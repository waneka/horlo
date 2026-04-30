import { describe, it } from 'vitest'

/**
 * Phase 20 FIT-03 — /watch/[id] page-level verdict computation.
 *
 * Filled by Plan 04 Task: "Implement page-level compute + tests".
 */
describe('FIT-03 /watch/[id] verdict integration (Plan 04)', () => {
  it.todo('renders <CollectionFitCard> with framing="same-user" when isOwner=true')
  it.todo('renders <CollectionFitCard> with framing="cross-user" when isOwner=false')
  it.todo('does NOT render <CollectionFitCard> when viewer collection.length === 0 (D-07)')
  it.todo('passes computed VerdictBundle as prop — does not call analyzeSimilarity in WatchDetail')
})
