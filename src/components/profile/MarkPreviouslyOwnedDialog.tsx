'use client'

import { useEffect, useState, useTransition } from 'react'
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
import { DisposalFields } from '@/components/watch/DisposalFields'
import { markWatchPreviouslyOwned } from '@/app/actions/watches'
import { todayLocalISO } from '@/lib/wear'
import type { DisposalReason, Watch } from '@/lib/types'

interface MarkPreviouslyOwnedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  watch: Pick<Watch, 'id' | 'brand' | 'model'>
}

/**
 * Phase 85 (LIFE-03, D-06/D-07/D-08) — the disposal dialog.
 *
 * The ONLY way to move an owned watch to `previously_owned` (D-07) — a
 * reason is always required. Not destructive-styled and asks for no second
 * confirmation (D-04/D-12 — disposal is reversible).
 *
 * Field state resets on the OPEN interaction, never on mount (Router Cache
 * stale-instance lesson). `ProfileWatchCard` opens this dialog
 * programmatically via `setState` from a menu-item click, which does not
 * route through Base UI's own `onOpenChange(true)` callback — so reset runs
 * both there (`handleOpenChange`) AND in a `useEffect` keyed on `open`
 * becoming true, covering both entry paths.
 */
export function MarkPreviouslyOwnedDialog({
  open,
  onOpenChange,
  watch,
}: MarkPreviouslyOwnedDialogProps) {
  const [reason, setReason] = useState<DisposalReason | null>(null)
  const [disposalDate, setDisposalDate] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function resetFields() {
    setReason(null)
    setDisposalDate(todayLocalISO())
    setSellPrice('')
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (next) resetFields()
    onOpenChange(next)
  }

  useEffect(() => {
    if (open) resetFields()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleSubmit() {
    if (!reason) return
    const today = todayLocalISO()
    // T-85-19: client-side future-date UX guard only — the server
    // independently re-validates via its own client-supplied `today`.
    if (disposalDate && disposalDate > today) {
      setError("Disposal date can't be in the future.")
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await markWatchPreviouslyOwned({
        watchId: watch.id,
        disposalReason: reason,
        sellPrice: sellPrice.trim() ? Number(sellPrice) : undefined,
        disposalDate: disposalDate.trim() ? disposalDate : undefined,
        today,
      })
      if (!result.success) {
        setError(
          result.error === "Disposal date can't be in the future."
            ? result.error
            : "Couldn't update this watch.",
        )
        return
      }
      onOpenChange(false)
      toast.success('Moved to previously owned')
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as previously owned</DialogTitle>
          <DialogDescription>
            Record how {watch.brand} {watch.model} left your collection. You can undo this later
            from the edit page.
          </DialogDescription>
        </DialogHeader>
        <DisposalFields
          idPrefix={`dispose-${watch.id}`}
          reason={reason}
          onReasonChange={setReason}
          disposalDate={disposalDate}
          onDisposalDateChange={setDisposalDate}
          sellPrice={sellPrice}
          onSellPriceChange={setSellPrice}
          maxDate={todayLocalISO()}
          disabled={pending}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="default" disabled={!reason || pending} onClick={handleSubmit}>
            {pending ? 'Saving…' : 'Mark as previously owned'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
