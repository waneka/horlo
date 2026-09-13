'use client'

import { useMemo, useState } from 'react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
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
  photoUrl: string | null
}

interface WornTabContentProps {
  events: WearEventLite[]
  watchMap: Record<string, WatchSummary>
  isOwner: boolean
  /** Phase 25 D-10: non-owner empty-state copy "{username} hasn't logged any
   *  wears yet." Threaded from [tab]/page.tsx (profile.username). */
  username: string
  /** Phase 25 D-06 / Phase 84 D-01: passed to LogTodaysWearButton (both the
   *  header row and the zero-wear empty state). null when viewer is
   *  anonymous (LogTodaysWearButton only renders inside isOwner && viewerId
   *  branches — non-owner branch never reads this). */
  viewerId: string | null
  /** Phase 25 D-06 / Phase 83 POLISH-02: LogTodaysWearButton's owned-watch
   *  listbox derives from this (watchOptions below). Server-derived in
   *  [tab]/page.tsx. */
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

  const watchOptions = useMemo(
    () =>
      ownedWatches
        .map((w) => ({ id: w.id, brand: w.brand, model: w.model }))
        .sort(
          (a, b) =>
            a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model),
        ),
    [ownedWatches],
  )

  const filtered = useMemo(
    () =>
      filterWatchId === 'all'
        ? events
        : events.filter((e) => e.watchId === filterWatchId),
    [events, filterWatchId],
  )

  // Phase 25 D-06/D-10 / Phase 84 D-07: replaces the old border-dashed shape
  // with the locked empty-state Card shape. Owner branch (with viewerId) gets
  // the unified "Log a wear" form (same entry point as the header row — a
  // zero-wear owner must still be able to backfill, per D-07). Non-owner
  // branch (and anonymous viewers, since viewerId is null then) sees
  // owner-aware copy with NO CTA.
  // Note: this check is placed after hooks to comply with React's Rules of Hooks.
  if (events.length === 0) {
    if (isOwner && viewerId) {
      return (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-base font-semibold">No wears logged yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Track which watch you wore on which day.
          </p>
          <div className="mx-auto mt-6 max-w-xs">
            <LogTodaysWearButton
              watches={watchOptions}
              viewerId={viewerId}
              className="w-full"
            />
          </div>
        </div>
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
        {isOwner && viewerId && (
          <LogTodaysWearButton watches={watchOptions} viewerId={viewerId} />
        )}
      </div>
      {view === 'timeline' ? (
        <WornTimeline events={filtered} watchMap={watchMap} />
      ) : (
        <WornCalendar events={filtered} watchMap={watchMap} />
      )}
    </div>
  )
}
