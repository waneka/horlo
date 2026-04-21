'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { markAsWorn } from '@/app/actions/wearEvents'

interface WatchSummary {
  id: string
  brand: string
  model: string
}

export function LogTodaysWearButton({ watches }: { watches: WatchSummary[] }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string>('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      const result = await markAsWorn(selected)
      if (!result.success) {
        setError(result.error)
        return
      }
      setOpen(false)
      setSelected('')
    })
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-accent text-accent-foreground hover:bg-accent/90"
      >
        <Plus className="mr-1 size-4" />
        Log Today&apos;s Wear
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Today&apos;s Wear</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-normal" htmlFor="wear-watch-select">
              Which watch?
            </label>
            <Select
              value={selected}
              onValueChange={(v) => setSelected(v ?? '')}
            >
              <SelectTrigger id="wear-watch-select">
                <SelectValue placeholder="Choose a watch" />
              </SelectTrigger>
              <SelectContent>
                {watches.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.brand} {w.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!selected || pending}>
              {pending ? 'Logging…' : 'Log Wear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
