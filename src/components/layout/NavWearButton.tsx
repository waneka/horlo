'use client'

import { useState, lazy, Suspense } from 'react'
import { Plus, Watch } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Watch as WatchType } from '@/lib/types'

/**
 * NavWearButton — the nav `+ Wear` entry point (CONTEXT.md N-01, Pitfall 10).
 *
 * Phase 15 Plan 03b D-04: lazy target swapped from `WatchPickerDialog` to
 * `WywtPostDialog` so the nav-wear entry point now opens the full photo-
 * post flow (two-step modal: picker → compose with photo + note + visibility).
 * `LogTodaysWearButton` (profile page) remains on the quick-log markAsWorn
 * path and is NOT migrated by this plan.
 *
 * This is ONE of TWO triggers that open the SAME `WywtPostDialog`:
 *   1. WYWT rail self-placeholder tile (WywtRail — also swapped in Plan 03b)
 *   2. This nav button — reused by header (default) + mobile bottom nav
 *      (`appearance="bottom-nav"`)
 *
 * DO NOT create a second dialog component and DO NOT fork this component.
 * If behavior diverges between nav surfaces, add a prop (e.g. `appearance`)
 * — never copy this file.
 *
 * Lazy-loaded dialog rationale:
 *   Header renders on every authenticated route. Eager-importing the dialog
 *   would ship `WywtPostDialog` + `WatchPickerDialog` + `ComposeStep` +
 *   `PhotoUploader` + the heic-worker chunk on pages that never need it
 *   (e.g. `/settings`, `/preferences`, `/watch/new` itself). Lazy import +
 *   render-gated `{open && ...}` keeps the initial bundle small.
 */
const WywtPostDialog = lazy(() =>
  import('@/components/wywt/WywtPostDialog').then((m) => ({
    default: m.WywtPostDialog,
  })),
)

type NavWearButtonProps = {
  ownedWatches: WatchType[]
  /**
   * Viewer id — required by `WywtPostDialog` (Phase 15 Plan 03b) for the
   * preflight `getWornTodayIdsForUserAction` fetch and the Storage path
   * construction (`{viewerId}/{wearEventId}.jpg`). Passed through from the
   * Server Component callers (Header, BottomNavServer) which already have
   * the resolved `user.id` via `getCurrentUser()`.
   */
  viewerId: string
  /**
   * Visual variant. `header` (default) is the outline Button + Plus icon
   * used in the desktop top nav. `bottom-nav` is the 56×56 accent circle
   * used in the mobile bottom nav (Phase 14-03, Figma node 1:4714). In
   * `bottom-nav` mode this component owns its full column (flex-1 h-full
   * with a two-row icon/label shape) so its label shares the bottom
   * baseline of sibling NavLinks.
   */
  appearance?: 'header' | 'bottom-nav'
}

export function NavWearButton({
  ownedWatches,
  viewerId,
  appearance = 'header',
}: NavWearButtonProps) {
  const [open, setOpen] = useState(false)

  const trigger =
    appearance === 'bottom-nav' ? (
      // D-02/D-03: 56×56 accent circle, Watch icon 28×28, two-layer Figma
      // shadow. Column mirrors NavLink's `justify-end gap-1 pb-4` shape so
      // the "Wear" label shares the bottom baseline of Home/Explore/Add/
      // Profile. `shrink-0` on the circle prevents flex-shrink from
      // squishing it vertically when the column's natural content height
      // (56 + 4 + 16 + 16 = 92px) exceeds the 80px column; the 12px
      // overflow IS the cradle lift — no transform needed, so the label
      // stays anchored in its bottom band regardless.
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Log a wear"
        className="flex flex-1 flex-col items-center justify-end gap-1 pb-4 h-full min-h-11"
      >
        <span
          className={cn(
            'flex size-14 shrink-0 items-center justify-center rounded-full bg-accent',
            'shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)]',
          )}
        >
          <Watch className="size-7 text-accent-foreground" aria-hidden />
        </span>
        <span className="text-[12px] leading-[16px] font-semibold text-accent">
          Wear
        </span>
      </button>
    ) : (
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label="Log a wear for today"
        className="gap-1"
      >
        <Plus className="size-4" aria-hidden />
        {/*
          Label hidden below `sm:` (640px) so the 375px-mobile right cluster
          (ThemeToggle + NavWearButton + Add Watch + UserMenu) fits on one
          line without wrapping. The Plus icon remains, and the aria-label
          carries the full semantic name "Log a wear for today" for screen
          readers. Plan 10-08 acceptance criteria explicitly allows this
          fallback if the cluster doesn't fit at 375px.
        */}
        <span className="hidden sm:inline">Wear</span>
      </Button>
    )

  return (
    <>
      {trigger}
      {open && (
        <Suspense fallback={null}>
          <WywtPostDialog
            open={open}
            onOpenChange={setOpen}
            ownedWatches={ownedWatches}
            viewerId={viewerId}
          />
        </Suspense>
      )}
    </>
  )
}
