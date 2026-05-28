// Pure RSC — no client directive, no hooks, no event handlers.
//
// Phase 64 UAT 2026-05-27 (refines D-09/D-10): the verdict + empty-collection
// states no longer live in the WatchDetailHero right column. Squeezing the full
// Collection Fit card into a ~40% column made the cross-user hero feel cramped,
// so the unified hero template (title → spec strip → like+jump → owner actions)
// is now identical across all branches, and this block carries the "context
// card" — full-width, below the hero, where it can breathe.
//
// Render priority:
//   1. cross-user verdict → <CollectionFitCard/> (full buy-decision card).
//   2. no verdict + empty collection + catalogTaste confidence ≥ 0.5 →
//      <ReferenceIdentityCard/> (D-10 fresh-account fallback).
//   3. no verdict + empty collection (no usable taste) → muted caption.
//   4. owned (same-user verdict) → null. The role-overlap note lives in
//      WatchDetailTrailing per the same UAT pass.

import type { VerdictBundle } from '@/lib/verdict/types'
import type { Watch } from '@/lib/types'
import { CollectionFitCard } from '@/components/insights/CollectionFitCard'
import { ReferenceIdentityCard } from '@/components/insights/ReferenceIdentityCard'

interface WatchDetailContextBlockProps {
  verdict: VerdictBundle | null
  watch: Watch
  collection: Watch[]
}

export function WatchDetailContextBlock({
  verdict,
  watch,
  collection,
}: WatchDetailContextBlockProps) {
  // 1. Cross-user candidate evaluation — the verdict's real job.
  if (verdict && verdict.framing === 'cross-user') {
    return <CollectionFitCard verdict={verdict} />
  }

  // 2 & 3. Empty-collection viewer (D-10): taste reference or fallback caption.
  if (!verdict && collection.length === 0) {
    const taste = watch.catalogTaste ?? null
    const hasHighConfidenceTaste =
      taste !== null &&
      taste.confidence !== null &&
      taste.confidence !== undefined &&
      taste.confidence >= 0.5
    if (hasHighConfidenceTaste) {
      return <ReferenceIdentityCard taste={taste} />
    }
    return (
      <p className="text-sm text-muted-foreground text-center py-2">
        Add a few watches to see how this one fits your collection.
      </p>
    )
  }

  // 4. Owned with same-user verdict → no context card. WatchDetailTrailing
  // surfaces the only useful slice (role-overlap note).
  return null
}
