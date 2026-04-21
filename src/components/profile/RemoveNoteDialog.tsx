'use client'

import { useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { removeNote } from '@/app/actions/notes'

interface RemoveNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  watchId: string
  brand: string
  model: string
}

export function RemoveNoteDialog({
  open,
  onOpenChange,
  watchId,
  brand,
  model,
}: RemoveNoteDialogProps) {
  const [pending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await removeNote({ watchId })
      if (result.success) {
        onOpenChange(false)
      } else {
        console.error('[RemoveNoteDialog] remove failed:', result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove this note?</DialogTitle>
          <DialogDescription>
            The note for {brand} {model} will be deleted. The watch itself
            stays in your collection.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Keep Note
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? 'Removing…' : 'Remove Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
