'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { VisibilitySegmentedControl } from '@/components/wywt/VisibilitySegmentedControl'
import {
  logBackfillWear,
  getWornTodayIdsForUserAction,
} from '@/app/actions/wearEvents'
import { todayLocalISO } from '@/lib/wear'
import type { WearVisibility } from '@/lib/wearVisibility'

interface WatchSummary {
  id: string
  brand: string
  model: string
}

interface LogTodaysWearButtonProps {
  watches: WatchSummary[]
  viewerId: string
  className?: string
}

/**
 * Unified "Log a wear" form (Phase 84 Plan 04, WEAR-02 client half).
 *
 * The single Worn-tab entry point for logging a wear on any past-or-today
 * date (D-01/D-07): an owned-watch listbox with date-aware duplicate
 * disabling (D-05), a native `type=date` field capped at today (D-02), an
 * optional note with a 200-char counter, and a visibility control that
 * always defaults to Public on open (D-04). Submits to `logBackfillWear`
 * (84-02) — no photo field (D-03).
 */
export function LogTodaysWearButton({
  watches,
  viewerId,
  className,
}: LogTodaysWearButtonProps) {
  const [open, setOpen] = useState(false)
  const [watchId, setWatchId] = useState('')
  const [wornDate, setWornDate] = useState('')
  const [maxDate, setMaxDate] = useState('')
  const [note, setNote] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [visibility, setVisibility] = useState<WearVisibility>('public')
  const [error, setError] = useState<string | null>(null)
  const [wornOnDateIds, setWornOnDateIds] = useState<ReadonlySet<string>>(
    new Set(),
  )
  const [pending, startTransition] = useTransition()

  const pathname = usePathname() ?? ''
  const addWatchHref = pathname
    ? `/watch/new?returnTo=${encodeURIComponent(pathname)}`
    : '/watch/new'

  // One-shot reset on the open EVENT (never on mount) — Router Cache lesson:
  // a stale client instance can be restored on revisit, so state must reset
  // on the user action that opens the dialog, not a mount effect.
  function handleOpen() {
    const t = todayLocalISO()
    setMaxDate(t)
    setWornDate(t)
    setWatchId('')
    setNote('')
    setNoteOpen(false)
    setVisibility('public')
    setError(null)
    setOpen(true)
  }

  // D-05: re-run the "already logged" preflight whenever the dialog is open
  // and the selected date changes, so duplicate-day rows disable themselves
  // before the user ever hits the server-side 23505 backstop.
  useEffect(() => {
    if (!open || !wornDate) return
    let cancelled = false
    getWornTodayIdsForUserAction({ userId: viewerId, today: wornDate })
      .then((ids) => {
        if (cancelled) return
        const set = new Set(ids)
        setWornOnDateIds(set)
        setWatchId((cur) => (set.has(cur) ? '' : cur))
      })
      .catch(() => {
        if (!cancelled) setWornOnDateIds(new Set())
      })
    return () => {
      cancelled = true
    }
  }, [open, wornDate, viewerId])

  const canSubmit =
    !pending &&
    watchId !== '' &&
    !wornOnDateIds.has(watchId) &&
    wornDate !== '' &&
    wornDate <= maxDate

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await logBackfillWear({
        watchId,
        wornDate,
        today: todayLocalISO(),
        note: note.trim() ? note.trim() : null,
        visibility,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setOpen(false)
    })
  }

  const counterAt200 = note.length >= 200

  return (
    <>
      <Button variant="default" className={className} onClick={handleOpen}>
        <Plus className="mr-1 size-4" />
        Log a wear
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log a wear</DialogTitle>
          </DialogHeader>
          {watches.length === 0 ? (
            <>
              <DialogDescription className="text-base">
                <span className="block font-semibold text-foreground">
                  Add a watch first
                </span>
                You don&apos;t have any watches yet. Add one to log your wear.
              </DialogDescription>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Link
                  href={addWatchHref}
                  className="inline-flex items-center justify-center h-8 px-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
                >
                  Add watch
                </Link>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                <div>
                  <p
                    id="log-wear-watch-label"
                    className="text-sm font-semibold"
                  >
                    Which watch?
                  </p>
                  <ul
                    role="listbox"
                    aria-labelledby="log-wear-watch-label"
                    className="max-h-56 overflow-y-auto rounded-lg border"
                  >
                    {watches.map((w) => {
                      const isLogged = wornOnDateIds.has(w.id)
                      const isSelected = watchId === w.id
                      return (
                        <li key={w.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            aria-disabled={isLogged}
                            disabled={isLogged || pending}
                            onClick={() => {
                              if (!isLogged) setWatchId(w.id)
                            }}
                            className={`flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left transition ${
                              isLogged
                                ? 'opacity-50 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-accent text-accent-foreground'
                                  : 'hover:bg-muted/40'
                            }`}
                          >
                            <span className="text-sm font-semibold">
                              {w.brand}
                            </span>
                            <span className="text-sm">{w.model}</span>
                            {isLogged && (
                              <span className="ml-auto text-xs text-muted-foreground">
                                {wornDate === maxDate
                                  ? 'Worn today'
                                  : 'Already logged'}
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="log-wear-date">Date</Label>
                  <Input
                    id="log-wear-date"
                    type="date"
                    value={wornDate}
                    max={maxDate}
                    onChange={(e) => {
                      setWornDate(e.target.value)
                      setError(null)
                    }}
                    disabled={pending}
                  />
                </div>

                <div>
                  {noteOpen ? (
                    <div>
                      <Textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={200}
                        placeholder="Add a note…"
                        aria-label="Wear note"
                        className="resize-none"
                        disabled={pending}
                      />
                      <p
                        className={`mt-1 text-right text-xs ${
                          counterAt200
                            ? 'text-destructive font-semibold'
                            : 'text-muted-foreground font-normal'
                        }`}
                      >
                        {note.length}/200
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNoteOpen(true)}
                      disabled={pending}
                      className="self-start text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      + Add a note
                    </button>
                  )}
                </div>

                <VisibilitySegmentedControl
                  value={visibility}
                  onChange={setVisibility}
                  disabled={pending}
                />

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
                <Button onClick={handleSubmit} disabled={!canSubmit}>
                  {pending ? 'Logging…' : 'Log wear'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
