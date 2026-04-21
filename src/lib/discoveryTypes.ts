// Shared type definitions for Phase 10 discovery surfaces (Collectors Like You,
// Suggested Collectors, Personal Insights wishlist-gap card). No runtime cost —
// type-only module consumed by the DAL + UI layers.
//
// These three interfaces are the stable contract for Plan 07 (UI assembly).

import type { Watch } from '@/lib/types'

/** One "From Collectors Like You" recommendation. */
export interface Recommendation {
  /**
   * A representative watch instance from a similar collector (not a canonical
   * watch — Horlo uses per-user-independent entries, no canonical watch DB).
   */
  representativeWatchId: string
  representativeOwnerId: string
  brand: string
  model: string
  imageUrl: string | null
  /** How many similar collectors in the sampled pool own this (brand, model). */
  ownershipCount: number
  /** Rule-based human rationale — e.g. "Popular among dive watch collectors". */
  rationale: string
  /** Internal score — higher is better; stable ordering for display. */
  score: number
}

/** One "Suggested Collectors" card. */
export interface SuggestedCollector {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  /** 0..1 taste-overlap percentage. Display as `Math.round(overlap * 100)` per UI-SPEC. */
  overlap: number
  /** Count of shared (brand, model) watches with viewer. */
  sharedCount: number
  /** Up to 3 mini-thumbnail watches to render in the card. */
  sharedWatches: Array<{
    watchId: string
    brand: string
    model: string
    imageUrl: string | null
  }>
}

/** Canonical roles checked for under-representation. */
export type CanonicalRole =
  | 'dive'
  | 'dress'
  | 'sport'
  | 'field'
  | 'pilot'
  | 'chronograph'
  | 'travel'
  | 'formal'
  | 'casual'

/** Output of wishlistGap() — identifies the Personal Insights "Wishlist Gap" card. */
export interface WishlistGap {
  /** The role tag identified as the gap. Null when no gap. */
  role: CanonicalRole | null
  /** Owned-role the collection leans on, for copy like "Your collection leans {top}". */
  leansOn: string | null
  /** Precomputed rationale string per UI-SPEC copywriting. */
  rationale: string | null
}

// Intentionally unused — documents the relationship between the Watch domain
// type and the Recommendation representative instance. Prevents accidental
// drift if the Watch shape evolves.
export type _RecommendationSourceWatch = Pick<
  Watch,
  'id' | 'brand' | 'model' | 'imageUrl'
>
