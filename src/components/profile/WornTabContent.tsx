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
}

const VIEW_OPTIONS = [
  { value: 'timeline', label: 'Timeline' },
  { value: 'calendar', label: 'Calendar' },
] as const

export function WornTabContent({
  events,
  watchMap,
  isOwner,
}: WornTabContentProps) {
  const [view, setView] = useState<'timeline' | 'calendar'>('timeline')
  const [filterWatchId, setFilterWatchId] = useState<string>('all')

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
