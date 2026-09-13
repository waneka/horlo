'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { deleteWearEvent } from '@/app/actions/wearEvents'

interface WearDeleteButtonProps {
  wearEventId: string
  ownerUsername: string
}

/**
 * Owner-only "Delete wear" control + confirmation dialog (quick task
 * 260913-cae, DD-5). Rendered on /wear/[wearEventId] directly below
 * <WearDetailMetadata>, gated server-side on wear.userId === viewerId in
 * page.tsx — this component itself does not re-check ownership (the
 * `deleteWearEvent` Server Action is the real IDOR gate; see its doc
 * comment for T-QK-IDOR).
 *
 * DD-5: deliberately NOT added to WearOverflowMenu/WearCard — WearCard is
 * shared with the stories lane, and opening a Dialog from a base-ui
 * DropdownMenuItem adds focus-return complexity for a single-surface action.
 */
export function WearDeleteButton({ wearEventId, ownerUsername }: WearDeleteButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(next: boolean) {
    if (pending) return // block closing mid-delete (double-submit guard)
    if (next) setError(null) // one-shot state reset on open, not on mount
    setOpen(next)
  }

  function handleConfirm() {
    if (pending) return
    startTransition(async () => {
      const result = await deleteWearEvent({ wearEventId })
      if (!result.success) {
        setError(result.error)
        return
      }
      setOpen(false)
      toast('Wear deleted')
      const username = result.data.username ?? ownerUsername
      router.replace(username ? `/u/${username}/worn` : '/')
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <div className="px-4 md:max-w-[600px] md:mx-auto w-full">
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20"
            />
          }
        >
          <Trash2 className="size-4" aria-hidden />
          Delete wear
        </DialogTrigger>
      </div>
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
