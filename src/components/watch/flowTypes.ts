import type { ExtractedWatchData } from '@/lib/extractors'
import type { ExtractErrorCategory } from './ExtractErrorCard'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'

/**
 * State transition map (D-02 — Phase 70 CLNP-05):
 *
 * search-idle ──onPick (owned)──────────────────→ /w/[ref]                          [DUPE-01]
 * search-idle ──onPick (wishlist)───────────────→ confirming(dupeContext: wishlist) [DUPE-03 entry]
 * search-idle ──onPick (null)───────────────────→ confirming(dupeContext: null)
 * search-idle ──onSubmitStructured──────────────→ confirming(dupeContext: lookup)   [DUPE-02 may apply]
 * search-idle ──onSwitchToUrl───────────────────→ extracting-url
 * search-idle ──Skip-search link────────────────→ manual-entry                       [CLNP-06]
 * extracting-url ──success──────────────────────→ confirming(dupeContext: lookup)
 * extracting-url ──failure──────────────────────→ extraction-failed(mode: 'url')
 * confirming ──onPrimary (success)──────────────→ photos-pending (owned) | destination (wishlist/grail)
 * confirming ──onPrimary (failure)──────────────→ confirming(pending: false) + toast.error
 * confirming ──onEditDetails────────────────────→ form-prefill
 * confirming ──onStartOver──────────────────────→ search-idle
 * confirming ──DupeBanner.onViewExisting────────→ /w/[ref]                          [DUPE-02 opt-out for owned]
 * confirming ──DupeBanner.onMoveToCollection────→ moveWishlistToCollection → /u/[username]/collection  [DUPE-03 commit]
 * confirming ──DupeBanner.onAddAnotherCopy──────→ confirming(dupeContext: null)     [DUPE-02 explicit-bypass]
 * form-prefill ──onWatchCreated─────────────────→ photos-pending (if status==='owned')
 * manual-entry ──onWatchCreated─────────────────→ photos-pending (if status==='owned') | destination otherwise [D-17]
 * manual-entry ──back affordance────────────────→ search-idle
 * photos-pending ──onDone / onSkip──────────────→ destination
 * extraction-failed ──retryAction───────────────→ search-idle
 * extraction-failed ──manualAction──────────────→ /watch/new?manual=1
 */
export type FlowState =
  | { kind: 'search-idle' }
  | { kind: 'extracting-url'; url: string }
  | { kind: 'extraction-failed'; partial: ExtractedWatchData | null; reason: string; category: ExtractErrorCategory; mode: 'url' | 'structured' }
  | { kind: 'confirming'; catalogId: string | null; extracted: ExtractedWatchData; pickedResult: SearchCatalogWatchResult | null; dupeContext: DupeContext | null; pending: boolean }
  | { kind: 'form-prefill'; catalogId: string; extracted: ExtractedWatchData }
  | { kind: 'manual-entry'; partial?: ExtractedWatchData | null }
  | { kind: 'photos-pending'; watchId: string; destination: string }

/**
 * Phase 70 Plan 04 (CLNP-05 + DUPE-02/03):
 * Carries the existing-watch context surfaced by `findViewerWatchByCatalogId`
 * into the `confirming` branch so `<DupeBanner>` (sibling above `<ConfirmStep>`)
 * can render the "Already in your collection" / "On your wishlist" affordance.
 *
 * `existingReference` is the catalog row's reference (joined through the DAL
 * in Phase 70 Plan 01); null is legitimate (some catalog rows lack a public ref)
 * and tells DupeBanner to hide its "View existing" `/w/[ref]` link per D-06.
 */
export interface DupeContext {
  existingWatchId: string
  existingStatus: 'owned' | 'wishlist'
  existingReference: string | null
}

/**
 * Phase 71 forward-coordination — `RailEntry` + `PendingTarget` exports
 * STAY in Phase 70. Phase 71 deletes them alongside the `RecentlyEvaluatedRail`
 * disposition per CLNP-04. Shape preserved verbatim from the pre-Phase-70
 * `flowTypes.ts` so existing consumers (RecentlyEvaluatedRail + its test)
 * continue to compile through this milestone.
 *
 * Note: the legacy verdict bundle field is intentionally typed as `unknown | null`
 * here to avoid a stale legacy verdict-types import (verdict is out of scope for v8.0).
 * Phase 71 deletes both fields + their consumer in a single sweep — no consumer
 * outside `RecentlyEvaluatedRail` reads `.verdict`, and the RecentlyEvaluatedRail
 * component is unrendered as of Phase 70 (CLNP-04 deferral).
 */
export interface RailEntry {
  catalogId: string
  brand: string
  model: string
  imageUrl: string | null
  extracted: ExtractedWatchData
  verdict: unknown | null
}

/**
 * Pending state target for the legacy VerdictStep / WishlistRationalePanel
 * pending-CTA disambiguation. STAYS in Phase 70 per CLNP-04 deferral; Phase 71
 * removes alongside the rail.
 */
export type PendingTarget = 'wishlist' | 'collection' | 'skip' | null
