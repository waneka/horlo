// Phase 10 Plan 03: WYWT rail types consumed by Plan 06 UI.
//
// Type-only module with zero runtime cost. The DAL (src/data/wearEvents.ts
// getWearRailForViewer) returns WywtRailData; the UI renders each WywtTile.

import type { WearVisibility } from '@/lib/wearVisibility'

/**
 * A single rail tile. Represents the most-recent-per-actor wear event for
 * the viewer or one of the viewer's followings within the 48h rolling
 * window (CONTEXT.md W-01, W-03, W-07).
 */
export interface WywtTile {
  /** The wear_event.id — used as localStorage viewed-state key. */
  wearEventId: string
  /** The actor's user_id (== wear_event.user_id). */
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  /** The watch row this wear event references, snapshotted for rail display. */
  watchId: string
  brand: string
  model: string
  imageUrl: string | null
  /**
   * Wrist-shot photo for this wear event.
   *
   * At the DAL boundary (`getWearRailForViewer`) this is the RAW Storage
   * path (`{userId}/{wearEventId}.jpg`) in the private `wear-photos` bucket.
   * The home page Server Component (`src/app/page.tsx`) mints a signed URL
   * per request and replaces this field before passing the tiles down to
   * the client `<WywtRail>` component.
   *
   * Pitfall F-2: never cache signed URLs across requests/users — Supabase
   * Smart CDN keys each token as a separate cache entry, so per-request
   * minting is both free and correct. Mirrors the pattern in
   * `src/app/wear/[wearEventId]/page.tsx`.
   *
   * Null when the wear event has no photo (no-photo posts and pre-Phase-15
   * backfilled events).
   */
  photoUrl: string | null
  wornDate: string // ISO date 'YYYY-MM-DD'
  note: string | null
  /** Three-tier visibility tier this tile came from (Phase 12 / WYWT-10). */
  visibility: WearVisibility
  /** True when this tile is the viewer's own (renders as self-tile with edit affordance). */
  isSelf: boolean
}

/**
 * Full rail payload. Ordered by wornDate DESC (then createdAt DESC for
 * same-day tiebreak). The UI (Plan 06) is responsible for placing the
 * viewer's self-tile first regardless of server ordering.
 */
export interface WywtRailData {
  tiles: WywtTile[]
  viewerId: string
}
