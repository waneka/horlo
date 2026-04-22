'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { markAsWorn } from '@/app/actions/wearEvents'
import type { Watch } from '@/lib/types'

/**
 * Shared watch-picker dialog (CONTEXT.md W-02 / N-01, RESEARCH.md Pitfall 10).
 *
 * ONE component, TWO call sites:
 *   1. WYWT rail self-placeholder tile → opens this dialog to log today's wear
 *   2. Top-nav `+ Wear` button (Plan 10-08) → opens this same dialog
 *
 * Do NOT duplicate this dialog. If a second call site needs slight different
 * copy, add a prop — don't fork the component.
 *
 * States:
 *   - viewer has no owned watches → empty-state copy with `/watch/new` CTA
 *   - idle → searchable list, submit disabled until a row is selected
 *   - submitting → submit disabled with "Logging…" label
 *   - error → inline destructive-colored "Couldn't log that wear."
 *   - success → calls onOpenChange(false) to close the dialog
 *
 * Copywriting per UI-SPEC § Copywriting Contract:
 *   - Title: "Log a wear"
 *   - Submit: "Log wear" / pending "Logging…"
 *   - Dismiss: "Keep browsing"
 *   - Empty: "Add a watch first" / body / "Add watch"
 *   - Error: "Couldn't log that wear."
 */

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Pass the viewer's full watch set; this component filters to status='owned'. */
  watches: Watch[]
}

export function WatchPickerDialog({ open, onOpenChange, watches }: Props) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Only `owned` watches can be logged as a wear. Wishlist / sold / grail
  // are filtered out — logging a wear for a sold watch is a product bug.
  const ownedWatches = useMemo(
    () => watches.filter((w) => w.status === 'owned'),
    [watches],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ownedWatches
    return ownedWatches.filter((w) =>
      `${w.brand} ${w.model}`.toLowerCase().includes(q),
    )
  }, [ownedWatches, query])

  const handleSubmit = () => {
    if (!selectedId) return
    setError(null)
    startTransition(async () => {
      const result = await markAsWorn(selectedId)
      if (!result.success) {
        setError("Couldn't log that wear.")
        return
      }
      // Success: close, reset internal state so the next open is clean.
      onOpenChange(false)
      setSelectedId(null)
      setQuery('')
    })
  }

  const handleDismiss = () => {
    onOpenChange(false)
    // Reset transient state so a subsequent open starts clean.
    setSelectedId(null)
    setQuery('')
    setError(null)
  }

  // Empty-state variant — viewer has no owned watches at all.
  if (ownedWatches.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogTitle>Add a watch first</DialogTitle>
          <DialogDescription className="text-base">
            You don&apos;t have any watches yet. Add one to log your wear.
          </DialogDescription>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              type="button"
              onClick={handleDismiss}
            >
              Keep browsing
            </Button>
            <Link
              href="/watch/new"
              className="inline-flex items-center justify-center h-8 px-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
            >
              Add watch
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Log a wear</DialogTitle>

        <Input
          placeholder="Search your watches"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-2"
          aria-label="Search watches"
        />

        <ul
          className="max-h-80 overflow-y-auto divide-y divide-border mt-2"
          role="listbox"
          aria-label="Your watches"
        >
          {filtered.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                role="option"
                aria-selected={selectedId === w.id}
                onClick={() => setSelectedId(w.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition ${
                  selectedId === w.id
                    ? 'bg-muted'
                    : 'hover:bg-muted/40'
                }`}
              >
                <span className="text-sm font-semibold">{w.brand}</span>
                <span className="text-sm text-muted-foreground">
                  {w.model}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {error && (
          <p role="alert" className="text-sm text-destructive pt-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            type="button"
            onClick={handleDismiss}
            disabled={pending}
          >
            Keep browsing
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedId || pending}
          >
            {pending ? 'Logging…' : 'Log wear'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
