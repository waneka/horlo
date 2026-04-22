'use client'

import { useState, lazy, Suspense } from 'react'

import { WywtTile } from '@/components/home/WywtTile'
import { useViewedWears } from '@/hooks/useViewedWears'
import type { WywtRailData, WywtTile as WywtTileData } from '@/lib/wywtTypes'
import type { Watch } from '@/lib/types'

// Lazy-load the overlay + picker so they stay out of the initial home-page
// bundle. Most home-page renders never open either: a user scrolls, reads the
// feed, and leaves. Deferring the cost to first-tap keeps the primary hook
// (the rail strip) fast.
const WywtOverlay = lazy(() =>
  import('@/components/home/WywtOverlay').then((m) => ({
    default: m.WywtOverlay,
  })),
)
const WatchPickerDialog = lazy(() =>
  import('@/components/home/WatchPickerDialog').then((m) => ({
    default: m.WatchPickerDialog,
  })),
)

/**
 * WYWT rail (CONTEXT.md W-01 / W-03 / W-07, UI-SPEC § Component Inventory).
 *
 * Client component because it owns the open/close state for the overlay and
 * picker dialog, plus the viewed-state hook. Accepts already-computed
 * `WywtRailData` from a Server Component parent (Plan 08) so no DAL read
 * happens on the client.
 *
 * Self-placeholder rules (W-03):
 *   - If the viewer has NO `isSelf` tile in `data.tiles`, prepend a
 *     placeholder at position 0 that opens the WatchPickerDialog.
 *   - If the viewer DOES have an `isSelf` tile already, render it in its
 *     natural order — no placeholder.
 *
 * Accessibility:
 *   - `<section aria-labelledby="wywt-heading">` with an `sr-only` h2 per
 *     UI-SPEC § Copywriting Contract → Section Headings.
 *   - Horizontal scroll via native CSS `scroll-snap-type` (RESEARCH.md
 *     Standard Stack — rail uses native scroll-snap, only the overlay uses
 *     embla-carousel-react).
 */
export function WywtRail({
  data,
  ownedWatches,
}: {
  data: WywtRailData
  ownedWatches: Watch[]
}) {
  const { viewed, markViewed, hydrated } = useViewedWears()
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [activeTileIndex, setActiveTileIndex] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Compose the rail. The self-placeholder is prepended only when the viewer
  // has no own tile in the last 48h.
  const hasOwn = data.tiles.some((t) => t.isSelf)
  const entries: Array<{
    tile: WywtTileData | null
    isSelfPlaceholder: boolean
  }> = [
    ...(hasOwn
      ? []
      : [{ tile: null, isSelfPlaceholder: true as const }]),
    ...data.tiles.map((t) => ({
      tile: t,
      isSelfPlaceholder: false as const,
    })),
  ]

  const openAt = (tile: WywtTileData) => {
    // Mark the tile as viewed immediately on open and drive the overlay's
    // initial slide. The overlay will also fire onViewed when the user swipes,
    // but the first-tap case is handled here so the rail's ring updates even
    // if the overlay fails to mount.
    markViewed(tile.wearEventId)
    const dataIndex = data.tiles.findIndex(
      (t) => t.wearEventId === tile.wearEventId,
    )
    setActiveTileIndex(Math.max(0, dataIndex))
    setOverlayOpen(true)
  }

  return (
    <section aria-labelledby="wywt-heading" className="space-y-3">
      <h2 id="wywt-heading" className="sr-only">
        Wear activity from your network
      </h2>
      <div className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2">
        {entries.map((entry, i) => (
          <div
            key={entry.tile?.wearEventId ?? `self-${i}`}
            className="snap-start"
          >
            <WywtTile
              tile={entry.tile}
              isSelfPlaceholder={entry.isSelfPlaceholder}
              viewedIds={viewed}
              hydrated={hydrated}
              onOpen={() => {
                if (entry.tile) openAt(entry.tile)
              }}
              onOpenPicker={() => setPickerOpen(true)}
            />
          </div>
        ))}
      </div>

      <Suspense fallback={null}>
        {overlayOpen && (
          <WywtOverlay
            tiles={data.tiles}
            initialIndex={activeTileIndex}
            open={overlayOpen}
            onOpenChange={setOverlayOpen}
            onViewed={markViewed}
            viewerId={data.viewerId}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {pickerOpen && (
          <WatchPickerDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            watches={ownedWatches}
          />
        )}
      </Suspense>
    </section>
  )
}
