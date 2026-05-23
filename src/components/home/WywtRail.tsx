'use client'

import { useState, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'

import { WywtTile } from '@/components/home/WywtTile'
import { useViewedWears } from '@/hooks/useViewedWears'
import type { WywtRailData, WywtTile as WywtTileData } from '@/lib/wywtTypes'
import type { Watch } from '@/lib/types'

// Lazy-load the post dialog so it stays out of the initial home-page bundle.
// Most home-page renders never open it: a user scrolls, reads the feed, and
// leaves. Non-self tile taps now navigate to the routed /wears/[username] lane
// (SC-1, Phase 56A Plan 05) — the overlay is gone.
// Phase 15 Plan 03b D-04: the self-placeholder tap opens the full
// WywtPostDialog (two-step photo-post flow).
const WywtPostDialog = lazy(() =>
  import('@/components/wywt/WywtPostDialog').then((m) => ({
    default: m.WywtPostDialog,
  })),
)

/**
 * WYWT rail (CONTEXT.md W-01 / W-03 / W-07, UI-SPEC § Component Inventory).
 *
 * Client component because it owns the open/close state for the overlay and
 * post dialog, plus the viewed-state hook. Accepts already-computed
 * `WywtRailData` from a Server Component parent (Plan 08) so no DAL read
 * happens on the client.
 *
 * Self-placeholder rules (W-03):
 *   - If the viewer has NO `isSelf` tile in `data.tiles`, prepend a
 *     placeholder at position 0 that opens the WywtPostDialog (Phase 15
 *     Plan 03b D-04 — swapped from WatchPickerDialog).
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
  const router = useRouter()
  const { viewed, markViewed, hydrated } = useViewedWears()
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
    // Mark the tile as viewed immediately so the rail ring updates even if
    // navigation is slow or fails. Pass ?from= so the lane opens at the tapped
    // slide index (D-05). The server page reads searchParams.from and passes
    // initialSlideIndex as a prop to WearsLane.
    markViewed(tile.wearEventId)
    router.push(`/wears/${tile.username}?from=${tile.wearEventId}`)
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
        {pickerOpen && (
          <WywtPostDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            ownedWatches={ownedWatches}
            viewerId={data.viewerId}
          />
        )}
      </Suspense>
    </section>
  )
}
