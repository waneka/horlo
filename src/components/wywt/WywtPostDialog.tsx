'use client'

import { useState, useMemo, useEffect } from 'react'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { WatchPickerDialog } from '@/components/home/WatchPickerDialog'
import { ComposeStep } from './ComposeStep'
import { getWornTodayIdsForUserAction } from '@/app/actions/wearEvents'
import { todayLocalISO } from '@/lib/wear'
import type { Watch } from '@/lib/types'
import type { WearVisibility } from '@/lib/wearVisibility'

/**
 * WywtPostDialog — Phase 15 Plan 03b orchestrator for the WYWT photo post flow.
 *
 * Two-step state machine (D-01, RESEARCH §Pattern 2):
 *
 *   Step 1 (picker) — renders the existing WatchPickerDialog with the NEW
 *     onWatchSelected prop (Task 1). Selection advances to Step 2 instead of
 *     calling markAsWorn.
 *
 *   Step 2 (compose) — renders ComposeStep for photo + note + visibility +
 *     submit. Clicking 'Change' returns to Step 1 preserving photo/note/
 *     visibility (D-05) — only the watch selection is cleared.
 *
 * Preflight (D-03, D-13): on open, fetch today's wear events for the viewer
 * via getWornTodayIdsForUserAction (Plan 03a Server Action wrapper around the
 * DAL helper) and pass the resulting watch-id Set to the picker so already-
 * worn watches render disabled. The Server Action returns string[] (Server
 * Actions cannot serialize Set across the RSC wire) — we convert to Set here.
 * If the preflight fails the picker simply renders every row enabled and the
 * Server Action's 23505 catch (Plan 03a) is the safety net.
 *
 * wearEventId (D-15 linchpin): generated ONCE per open session via
 * crypto.randomUUID() inside a useMemo keyed on `open`. The same id threads
 * through the Storage path (clients upload to `{userId}/{wearEventId}.jpg`)
 * and the Server Action insert, so the server can validate that the object
 * exists before writing the DB row.
 *
 * Close semantics: closing the dialog discards the whole draft (step → picker,
 * selection cleared, photo/note/visibility reset, preflight cache cleared).
 * The Change link (D-05) is the only path that preserves partial state.
 *
 * Import shape: getWornTodayIdsForUserAction is imported DIRECTLY from
 * '@/app/actions/wearEvents' — Plan 03a shipped this Server Action wrapper
 * in Wave 2, so by the time this file is on disk (Wave 3) the symbol is
 * already exported and typed. `npx tsc --noEmit` passes on first commit.
 */
export function WywtPostDialog({
  open,
  onOpenChange,
  ownedWatches,
  viewerId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  ownedWatches: Watch[]
  viewerId: string
}) {
  const [step, setStep] = useState<'picker' | 'compose'>('picker')
  const [selectedWatchId, setSelectedWatchId] = useState<string | null>(null)
  // Regenerates on every `open → true` transition. While `open === false`
  // the value is an empty string (never consumed in that state).
  const wearEventId = useMemo(
    () => (open ? crypto.randomUUID() : ''),
    [open],
  )
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [note, setNote] = useState('')
  const [visibility, setVisibility] = useState<WearVisibility>('public')
  const [wornTodayIds, setWornTodayIds] = useState<
    ReadonlySet<string> | undefined
  >()

  // Preflight fetch on open (D-13). Fire-and-forget — if it fails, the
  // picker simply doesn't disable any rows and the server-side 23505 catch
  // (Plan 03a) is the safety net.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    // WR-02: client preflight uses the user's LOCAL calendar day (matches
    // logWearWithPhoto / markAsWorn server-side). UTC computation would
    // disable a watch as "Worn today" the morning AFTER an evening wear
    // for any user west of UTC. See src/lib/wear.ts:todayLocalISO.
    const today = todayLocalISO()
    getWornTodayIdsForUserAction({ userId: viewerId, today })
      .then((ids) => {
        if (!cancelled) setWornTodayIds(new Set(ids))
      })
      .catch((err) => {
        console.error(
          '[WywtPostDialog] preflight getWornTodayIdsForUserAction failed (non-fatal):',
          err,
        )
      })
    return () => {
      cancelled = true
    }
  }, [open, viewerId])

  // Close discards the entire draft. Resetting here + in the open→false effect
  // below covers both close paths: (a) the Dialog's own close affordance calls
  // onOpenChange(false) through this component, which runs the reset branch;
  // (b) a parent unilaterally flipping `open={false}` is handled by the
  // useEffect so state is still wiped when the prop changes out-of-band.
  // Change (D-05) only resets the watch — not this path.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setStep('picker')
      setSelectedWatchId(null)
      setPhotoBlob(null)
      setNote('')
      setVisibility('public')
      setWornTodayIds(undefined)
    }
    onOpenChange(next)
  }

  // Parent-driven close: reset draft state when `open` flips to false so the
  // NEXT open starts from the picker with a fresh wearEventId. We track the
  // previous `open` value in useState and flip on the true→false transition
  // directly during render — per React docs, setting state during render is
  // the recommended pattern for "adjust state based on a changing prop"
  // (avoids the cascading-rerender hazard that
  // react-hooks/set-state-in-effect flags, and avoids the ref-mutation-in-
  // render hazard that react-hooks/refs flags).
  const [prevOpen, setPrevOpen] = useState(open)
  if (prevOpen !== open) {
    setPrevOpen(open)
    if (!open) {
      setStep('picker')
      setSelectedWatchId(null)
      setPhotoBlob(null)
      setNote('')
      setVisibility('public')
      setWornTodayIds(undefined)
    }
  }

  if (step === 'picker') {
    return (
      <WatchPickerDialog
        open={open}
        onOpenChange={handleOpenChange}
        watches={ownedWatches}
        wornTodayIds={wornTodayIds}
        onWatchSelected={(id) => {
          setSelectedWatchId(id)
          setStep('compose')
        }}
      />
    )
  }

  const selectedWatch = ownedWatches.find((w) => w.id === selectedWatchId)
  if (!selectedWatch) {
    // Defensive — shouldn't happen (step='compose' implies a prior selection).
    // Fall back to the picker rather than crashing; parent's next render will
    // pick up the cleared state.
    return (
      <WatchPickerDialog
        open={open}
        onOpenChange={handleOpenChange}
        watches={ownedWatches}
        wornTodayIds={wornTodayIds}
        onWatchSelected={(id) => {
          setSelectedWatchId(id)
          setStep('compose')
        }}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <ComposeStep
          watch={selectedWatch}
          viewerId={viewerId}
          wearEventId={wearEventId}
          photoBlob={photoBlob}
          setPhotoBlob={setPhotoBlob}
          note={note}
          setNote={setNote}
          visibility={visibility}
          setVisibility={setVisibility}
          onChange={() => {
            // D-05: preserve photo/note/visibility, reset watch only.
            setSelectedWatchId(null)
            setStep('picker')
          }}
          onSubmitted={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
