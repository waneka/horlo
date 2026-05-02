'use client'

import { useMemo, useState } from 'react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { WywtPostDialog } from '@/components/wywt/WywtPostDialog'
import { ViewTogglePill } from './ViewTogglePill'
import { WornTimeline } from './WornTimeline'
import { WornCalendar } from './WornCalendar'
import { LogTodaysWearButton } from './LogTodaysWearButton'
import type { Watch } from '@/lib/types'

interface WatchSummary {
  id: string
  brand: string
  model: string
  imageUrl: string | null
}

interface WearEventLite {
  id: string
  watchId: string
  wornDate: string
  note: string | null
}

interface WornTabContentProps {
  events: WearEventLite[]
  watchMap: Record<string, WatchSummary>
  isOwner: boolean
  /** Phase 25 D-10: non-owner empty-state copy "{username} hasn't logged any
   *  wears yet." Threaded from [tab]/page.tsx (profile.username). */
  username: string
  /** Phase 25 D-06: passed to WywtPostDialog mounted in the owner empty state.
   *  null when viewer is anonymous (the dialog only renders inside the
   *  isOwner && viewerId branch — non-owner branch never reads this). */
  viewerId: string | null
  /** Phase 25 D-06: WywtPostDialog needs the owner's owned-status watches for
   *  the picker step. Server-derived in [tab]/page.tsx. */
  ownedWatches: Watch[]
}

const VIEW_OPTIONS = [
  { value: 'timeline', label: 'Timeline' },
  { value: 'calendar', label: 'Calendar' },
] as const

export function WornTabContent({
  events,
  watchMap,
  isOwner,
  username,
  viewerId,
  ownedWatches,
}: WornTabContentProps) {
  const [view, setView] = useState<'timeline' | 'calendar'>('timeline')
  const [filterWatchId, setFilterWatchId] = useState<string>('all')
  // Phase 25 D-06: local state for WywtPostDialog mounted in the owner empty
  // state. Declared before the early return to comply with the Rules of Hooks
  // (the file already places hooks before the early return).
  const [wywtOpen, setWywtOpen] = useState(false)

  const watchOptions = useMemo(
    () =>
      Object.values(watchMap).sort(
        (a, b) =>
          a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model),
      ),
    [watchMap],
  )

  const filtered = useMemo(
    () =>
      filterWatchId === 'all'
        ? events
        : events.filter((e) => e.watchId === filterWatchId),
    [events, filterWatchId],
  )

  // Phase 25 D-06/D-10: replaces the old border-dashed shape with the locked
  // empty-state Card shape. Owner branch (with viewerId) gets the "Log a wear"
  // CTA which opens WywtPostDialog. Non-owner branch (and anonymous viewers,
  // since viewerId is null then) sees owner-aware copy with NO CTA.
  // Note: this check is placed after hooks to comply with React's Rules of Hooks.
  if (events.length === 0) {
    if (isOwner && viewerId) {
      return (
        <>
          <div className="rounded-xl border bg-card p-12 text-center">
            <p className="text-base font-semibold">No wears logged yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Track which watch you wore on which day.
            </p>
            <div className="mx-auto mt-6 max-w-xs">
              <Button
                variant="default"
                className="w-full"
                onClick={() => setWywtOpen(true)}
              >
                Log a wear
              </Button>
            </div>
          </div>
          <WywtPostDialog
            open={wywtOpen}
            onOpenChange={setWywtOpen}
            ownedWatches={ownedWatches}
            viewerId={viewerId}
          />
        </>
      )
    }
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <p className="text-base font-semibold">Nothing here yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {username} hasn&apos;t logged any wears yet.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <ViewTogglePill
            options={VIEW_OPTIONS}
            value={view}
            onChange={setView}
            ariaLabel="Worn view"
          />
          <Select
            value={filterWatchId}
            onValueChange={(v) => setFilterWatchId(v ?? 'all')}
          >
            <SelectTrigger className="w-44 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All watches</SelectItem>
              {watchOptions.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.brand} {w.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isOwner && <LogTodaysWearButton watches={watchOptions} />}
      </div>
      {view === 'timeline' ? (
        <WornTimeline events={filtered} watchMap={watchMap} />
      ) : (
        <WornCalendar events={filtered} watchMap={watchMap} />
      )}
    </div>
  )
}
