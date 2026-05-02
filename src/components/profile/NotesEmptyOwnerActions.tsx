'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { WatchPickerDialog } from '@/components/home/WatchPickerDialog'
import type { Watch } from '@/lib/types'

/**
 * Phase 25 D-07 — Client wrapper around the Notes empty-state CTA + picker.
 *
 * NotesTabContent stays a Server Component; this child owns the picker open
 * state. On selection, navigates to `/watch/{id}/edit#notes` — the `#notes`
 * fragment is the existing scroll-anchor target inside the edit page (browser
 * default fragment behavior; smoothing is a follow-up — see SUMMARY).
 *
 * Branching: only mounted in NotesTabContent's owner+collectionCount>0 branch.
 * The owner+collectionCount===0 branch (D-08) renders an "Add a watch first"
 * Link directly inside NotesTabContent without this wrapper.
 *
 * Security note (T-25-05-05 in plan threat register): this wrapper is only
 * mounted in the OWNER branch (server-gated by `isOwner`). `ownedWatches` is
 * the owner's own collection. router.push('/watch/{id}/edit') lands on a route
 * that auth-gates server-side; non-owners cannot reach this UI.
 */
interface NotesEmptyOwnerActionsProps {
  ownedWatches: Watch[]
}

export function NotesEmptyOwnerActions({
  ownedWatches,
}: NotesEmptyOwnerActionsProps) {
  const router = useRouter()
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <>
      <div className="mx-auto mt-6 max-w-xs">
        <Button
          variant="default"
          className="w-full"
          onClick={() => setPickerOpen(true)}
        >
          Add notes from any watch
        </Button>
      </div>
      <WatchPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        watches={ownedWatches}
        onWatchSelected={(watchId) => {
          setPickerOpen(false)
          router.push(`/watch/${watchId}/edit#notes`)
        }}
      />
    </>
  )
}
