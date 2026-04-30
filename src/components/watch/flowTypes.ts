import type { ExtractedWatchData } from '@/lib/extractors'
import type { VerdictBundle } from '@/lib/verdict/types'

/**
 * Phase 20.1 D-01: state machine over the add-watch flow.
 *
 * Discriminated union by `kind`. Plan 04 (`<AddWatchFlow>`) owns the
 * useState<FlowState>. The leaf components (`<PasteSection>`,
 * `<VerdictStep>`, etc.) are pure renderers that receive the data they
 * need from the parent.
 *
 * NOTE: 'submitted-wishlist' and 'skipped' are NOT in the union — they
 * transition immediately back to 'idle' after the parent fires the
 * Server Action / appends to the rail. They never live as a render state.
 */
export type FlowState =
  | { kind: 'idle' }
  | { kind: 'extracting'; url: string }
  | { kind: 'verdict-ready'; catalogId: string; extracted: ExtractedWatchData; verdict: VerdictBundle | null }
  | { kind: 'wishlist-rationale-open'; catalogId: string; extracted: ExtractedWatchData; verdict: VerdictBundle | null }
  | { kind: 'submitting-wishlist'; catalogId: string; extracted: ExtractedWatchData; verdict: VerdictBundle | null; notes: string }
  | { kind: 'submitting-collection'; catalogId: string; extracted: ExtractedWatchData }
  | { kind: 'form-prefill'; catalogId: string; extracted: ExtractedWatchData }
  | { kind: 'manual-entry'; partial?: ExtractedWatchData | null }
  | { kind: 'extraction-failed'; partial: ExtractedWatchData | null; reason: string }

/**
 * D-14: in-session "Recently evaluated" chip rail. Capped at 5 entries
 * with FIFO eviction (Plan 04 implements the cap; this is just the type).
 * `verdict` is cached at skip time; on re-click, the parent restores it
 * to verdict-ready immediately even if the per-mount verdict cache evicted.
 */
export interface RailEntry {
  catalogId: string
  brand: string
  model: string
  imageUrl: string | null
  extracted: ExtractedWatchData
  verdict: VerdictBundle | null
}

/**
 * Pending state target for VerdictStep / WishlistRationalePanel / etc. so
 * the clicked button shows its own "Saving..." / "Skipping..." label while
 * the others stay disabled.
 */
export type PendingTarget = 'wishlist' | 'collection' | 'skip' | null
