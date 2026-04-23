'use client'

import { useState, lazy, Suspense } from 'react'
import { Plus, Watch } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Watch as WatchType } from '@/lib/types'

/**
 * NavWearButton — the nav `+ Wear` entry point (CONTEXT.md N-01, Pitfall 10).
 *
 * This is ONE of TWO triggers that open the SAME `WatchPickerDialog`:
 *   1. WYWT rail self-placeholder tile (Plan 10-06)
 *   2. This nav button (Plan 10-08) — reused by header (default) + mobile
 *      bottom nav (Plan 14-03 `appearance="bottom-nav"`)
 *
 * DO NOT create a second picker component and DO NOT fork this component.
 * If behavior diverges between nav surfaces, add a prop (e.g. `appearance`)
 * — never copy this file.
 *
 * Lazy-loaded dialog rationale:
 *   Header renders on every authenticated route. Eager-importing the picker
 *   would ship `WatchPickerDialog` + its shadcn Dialog + markAsWorn glue on
 *   pages that never need it (e.g. `/settings`, `/preferences`, `/watch/new`
 *   itself). Lazy import + render-gated `{open && ...}` keeps the initial
 *   bundle small. Same posture as `WywtRail` (Plan 10-06).
 */
const WatchPickerDialog = lazy(() =>
  import('@/components/home/WatchPickerDialog').then((m) => ({
    default: m.WatchPickerDialog,
  })),
)

type NavWearButtonProps = {
  ownedWatches: WatchType[]
  /**
   * Visual variant. `header` (default) is the outline Button + Plus icon
   * used in the desktop top nav. `bottom-nav` is the elevated 56×56 accent
   * circle used in the mobile bottom nav (Phase 14-03, Figma node 1:4714).
   * The parent (`BottomNav`) handles column-level vertical elevation via
   * `-translate-y-5`; this component only renders the circle + label.
   */
  appearance?: 'header' | 'bottom-nav'
}

export function NavWearButton({
  ownedWatches,
  appearance = 'header',
}: NavWearButtonProps) {
  const [open, setOpen] = useState(false)

  const trigger =
    appearance === 'bottom-nav' ? (
      // D-01/D-02/D-03: 56×56 circle, Watch icon 28×28, two-layer Figma
      // shadow, accent fill. Label "Wear" below in accent color.
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Log a wear"
        className="flex flex-col items-center gap-1"
      >
        <span
          className={cn(
            'flex size-14 items-center justify-center rounded-full bg-accent',
            'shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)]',
          )}
        >
          <Watch className="size-7 text-accent-foreground" aria-hidden />
        </span>
        <span className="text-[12px] leading-[16px] font-medium text-accent">
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
          <WatchPickerDialog
            open={open}
            onOpenChange={setOpen}
            watches={ownedWatches}
          />
        </Suspense>
      )}
    </>
  )
}
