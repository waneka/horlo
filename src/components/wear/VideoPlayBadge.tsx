import { Play } from 'lucide-react'

/**
 * Centered play-icon overlay for video wear tiles (Phase 77 — D-13, D-14, D-16).
 *
 * Usage: place inside a `relative overflow-hidden` container — typically a
 * `<WywtTile>` rendering a video poster image. Sized via responsive clamp so
 * the badge stays legible from 32px floors up to 56px on larger tiles.
 *
 * NOT rendered on the composer's post-capture preview (D-16) — that surface
 * shows the live inline player, not a poster + play badge.
 *
 * `aria-hidden` because the parent tile's `aria-label` covers the meaning
 * (e.g. "Watch tile — taps to play video").
 */
export function VideoPlayBadge() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div
        className="rounded-full bg-black/50 flex items-center justify-center"
        style={{ width: 'clamp(32px, 24%, 56px)', height: 'clamp(32px, 24%, 56px)' }}
      >
        <Play
          className="fill-white stroke-none"
          style={{ width: 'calc(100% - 16px)', height: 'calc(100% - 16px)' }}
          aria-hidden
        />
      </div>
    </div>
  )
}
