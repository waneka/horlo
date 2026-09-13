'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { deleteWearEvent } from '@/app/actions/wearEvents'

interface WearDeleteDialogProps {
  wearEventId: string
  ownerUsername: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Controlled (no trigger) delete-confirmation dialog for a wear event.
 * Originally a standalone control (quick task 260913-cae); moved into
 * WearOverflowMenu as the owner-only "Delete wear" item (quick task
 * 260913-csl) — this component now only owns the confirm/delete/navigate
 * behavior, rendered by WearOverflowMenu as a SIBLING of <DropdownMenu>
 * (outside DropdownMenuContent) so it survives the menu popup unmounting.
 *
 * Like the button it replaced, this component does not re-check ownership —
 * the `deleteWearEvent` Server Action's DAL owner-scoped SELECT is the real
 * IDOR gate (see its doc comment for T-QK-IDOR). `canDelete` upstream is a
 * UI-visibility flag only.
 */
export function WearDeleteDialog({
  wearEventId,
  ownerUsername,
  open,
  onOpenChange,
}: WearDeleteDialogProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // One-shot error reset on the closed→open transition — NOT on mount, and
  // deliberately NOT an effect-hook + setState pair (which would flash the
  // stale error for a frame and trip the react-hooks set-state-in-effect
  // lint). Adjusting state during render per the React "derived state from
  // props" pattern instead.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (pending) return // block closing mid-delete (double-submit guard)
    onOpenChange(next)
  }

  function handleConfirm() {
    if (pending) return
    startTransition(async () => {
      const result = await deleteWearEvent({ wearEventId })
      if (!result.success) {
        setError(result.error)
        return
      }
      onOpenChange(false)
      toast('Wear deleted')
      const username = result.data.username ?? ownerUsername
      router.replace(username ? `/u/${username}/worn` : '/')
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this wear?</DialogTitle>
          <DialogDescription>
            This permanently removes this wear, its photo or video, and any likes and
            comments. This can&rsquo;t be undone.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
