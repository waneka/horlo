'use client'

import { useState, lazy, Suspense } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Watch } from '@/lib/types'

/**
 * NavWearButton — the nav `+ Wear` entry point (CONTEXT.md N-01, Pitfall 10).
 *
 * This is ONE of TWO triggers that open the SAME `WatchPickerDialog`:
 *   1. WYWT rail self-placeholder tile (Plan 10-06)
 *   2. This nav button (Plan 10-08)
 *
 * DO NOT create a second picker component. If behavior diverges, add a prop
 * to the shared component instead. See `WatchPickerDialog.tsx` JSDoc.
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

export function NavWearButton({ ownedWatches }: { ownedWatches: Watch[] }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label="Log a wear for today"
        className="gap-1"
      >
        <Plus className="size-4" aria-hidden />
        Wear
      </Button>
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
