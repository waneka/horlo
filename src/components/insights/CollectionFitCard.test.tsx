import { describe, it } from 'vitest'

/**
 * Phase 20 FIT-01 — <CollectionFitCard> renders all 3 framings without computing verdict.
 *
 * Filled by Plan 03 Task: "Implement CollectionFitCard + tests".
 */
describe('FIT-01 CollectionFitCard (Plan 03)', () => {
  it.todo('renders headline + contextual phrasings + most-similar list for framing="same-user"')
  it.todo('renders identical chrome for framing="cross-user" (no lens indicator)')
  it.todo('renders "You own this watch" callout for framing="self-via-cross-user" (no verdict)')
  it.todo('hides most-similar section when verdict.mostSimilar is empty array')
  it.todo('hides role-overlap warning when verdict.roleOverlap is false')
  it.todo('renders <AlertTriangle /> from lucide-react when roleOverlap is true (replaces inline SVG)')
  it.todo('uses verbatim copy "May compete for wrist time with similar watches" from SimilarityBadge.tsx:78')
  it.todo('renders title "Collection Fit" with outline Badge variant for label')
})
