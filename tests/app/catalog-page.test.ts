import { describe, it } from 'vitest'

/**
 * Phase 20 D-10 — /catalog/[catalogId] new route.
 *
 * Filled by Plan 06 Task: "Implement catalog page + tests".
 */
describe('D-10 /catalog/[catalogId] page (Plan 06)', () => {
  it.todo('returns 404 when catalogId does not exist in watches_catalog')
  it.todo('renders <CollectionFitCard> with framing="cross-user" when viewer does not own this catalog ref AND collection > 0')
  it.todo('hides <CollectionFitCard> entirely when viewer.collection.length === 0 (D-07)')
  it.todo('renders "You own this watch" callout when viewer already owns this catalog ref (D-08)')
  it.todo('callout link points to /watch/{viewer.watches.id} — per-user UUID, not catalog UUID')
})
