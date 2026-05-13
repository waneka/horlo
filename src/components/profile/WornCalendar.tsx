'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSafeImageUrl } from '@/lib/images'

interface WatchSummary {
  id: string
  brand: string
  model: string
  imageUrl: string | null
}

interface WearEventLite {
  id: string
  watchId: string
  wornDate: string // YYYY-MM-DD
  note: string | null // Phase 39b — parent (WornTabContent) passes from getAllWearEventsByUser
}

interface WornCalendarProps {
  events: WearEventLite[]
  watchMap: Record<string, WatchSummary>
  // Test-only override (W1 fix — Phase 39b). Defaults to undefined; when
  // undefined, production code path is unchanged (the mount-time useEffect
  // selects the first event day). When provided (incl. when null), useState is
  // initialized directly to this value AND the first-event-day mount effect is
  // skipped via early-return so the test-driven selection is preserved.
  // Used exclusively by tests/components/profile/WornCalendar.test.tsx test #3
  // to exercise the empty-day caption code path deterministically.
  initialSelectedDate?: string | null
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}
function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function formatDateLabel(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(y, m - 1, d))
}

function getCalendarGrid(year: number, month: number): Date[][] {
  const firstOfMonth = new Date(year, month, 1)
  const startDow = firstOfMonth.getDay()
  const lastOfMonth = new Date(year, month + 1, 0)
  const totalDays = lastOfMonth.getDate()
  const cells: Date[][] = []
  let row: Date[] = []

  // Leading blanks from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startDow; i > 0; i--) {
    row.push(new Date(year, month - 1, prevMonthLastDay - i + 1))
  }
  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    row.push(new Date(year, month, d))
    if (row.length === 7) {
      cells.push(row)
      row = []
    }
  }
  // Trailing blanks from next month
  let nextDay = 1
  while (row.length > 0 && row.length < 7) {
    row.push(new Date(year, month + 1, nextDay++))
  }
  if (row.length === 7) cells.push(row)
  return cells
}

export function WornCalendar({
  events,
  watchMap,
  initialSelectedDate,
}: WornCalendarProps) {
  const today = new Date()
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  })

  // Phase 39b D-39b-13 — selectedDate state + below-grid wear-detail panel.
  // W1 fix: when initialSelectedDate is provided (test-only usage), seed
  // useState directly to that value; otherwise null and the mount effect
  // below picks the first event-day in the current cursor month.
  const [selectedDate, setSelectedDate] = useState<string | null>(
    initialSelectedDate !== undefined ? initialSelectedDate : null,
  )

  const eventsByDay = useMemo(() => {
    const map: Record<string, WearEventLite[]> = {}
    for (const e of events) {
      if (!map[e.wornDate]) map[e.wornDate] = []
      map[e.wornDate].push(e)
    }
    return map
  }, [events])

  // Initial-mount selection: first day in cursor.month with events
  // (deterministic). W1 fix: when initialSelectedDate was provided (test-only),
  // skip this effect entirely so the test-driven state is preserved.
  useEffect(() => {
    if (initialSelectedDate !== undefined) return
    if (selectedDate !== null) return // user already selected
    const monthKeys = Object.keys(eventsByDay)
      .filter((k) => {
        const [y, m] = k.split('-')
        return Number(y) === cursor.year && Number(m) === cursor.month + 1
      })
      .sort()
    if (monthKeys.length > 0) setSelectedDate(monthKeys[0])
  }, [eventsByDay, cursor, selectedDate, initialSelectedDate])

  const grid = useMemo(
    () => getCalendarGrid(cursor.year, cursor.month),
    [cursor],
  )
  const monthLabel = new Date(
    cursor.year,
    cursor.month,
    1,
  ).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  function gotoMonth(delta: number) {
    setCursor((c) => {
      const m = c.month + delta
      if (m < 0) return { year: c.year - 1, month: 11 }
      if (m > 11) return { year: c.year + 1, month: 0 }
      return { year: c.year, month: m }
    })
  }

  const selectedEvents =
    selectedDate !== null ? eventsByDay[selectedDate] ?? [] : []

  return (
    <div className="rounded-xl border bg-card p-4">
      <header className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => gotoMonth(-1)}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-sm font-normal">{monthLabel}</p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => gotoMonth(1)}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      </header>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-center text-xs uppercase tracking-wide text-muted-foreground"
          >
            {w}
          </div>
        ))}
        {grid.flat().map((day, i) => {
          const inMonth = day.getMonth() === cursor.month
          const key = dateKey(day.getFullYear(), day.getMonth(), day.getDate())
          const dayEvents = eventsByDay[key] ?? []
          const isToday =
            key ===
            dateKey(
              today.getFullYear(),
              today.getMonth(),
              today.getDate(),
            )
          const firstWatch = dayEvents[0]
            ? watchMap[dayEvents[0].watchId]
            : null
          const safe = firstWatch ? getSafeImageUrl(firstWatch.imageUrl) : null
          const extra = dayEvents.length > 1 ? dayEvents.length - 1 : 0
          const interactive = dayEvents.length > 0
          const isSelected = selectedDate === key
          return (
            <div
              key={i}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={interactive ? () => setSelectedDate(key) : undefined}
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedDate(key)
                      }
                    }
                  : undefined
              }
              aria-label={
                interactive ? `View wear events for ${key}` : undefined
              }
              className={cn(
                'flex min-h-12 flex-col items-center justify-start rounded-md border p-1 text-xs',
                inMonth ? 'bg-background' : 'bg-muted/30 text-muted-foreground',
                isToday && 'ring-1 ring-accent',
                interactive && 'cursor-pointer hover:bg-muted/60',
                isSelected && 'ring-2 ring-foreground/20',
              )}
            >
              <span className={cn('text-[10px]', !inMonth && 'opacity-50')}>
                {day.getDate()}
              </span>
              {safe && (
                <div className="relative mt-1 size-6 overflow-hidden rounded-full">
                  <Image
                    src={safe}
                    alt=""
                    fill
                    sizes="24px"
                    className="object-cover"
                  />
                  {extra > 0 && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1 text-[9px] text-accent-foreground">
                      +{extra}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {selectedDate !== null && (
        <div className="mt-4 border-t pt-4">
          <p className="mb-3 text-sm font-medium text-foreground">
            {formatDateLabel(selectedDate)}
          </p>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No wear events on {formatDateLabel(selectedDate)}.
            </p>
          ) : (
            <ul className="space-y-3">
              {selectedEvents.map((event) => {
                const watch = watchMap[event.watchId]
                const safe = watch ? getSafeImageUrl(watch.imageUrl) : null
                return (
                  <li key={event.id} className="flex items-start gap-3">
                    <div className="relative size-12 shrink-0 overflow-hidden rounded bg-muted">
                      {safe && (
                        <Image
                          src={safe}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {watch?.brand} {watch?.model}
                      </p>
                      {event.note && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {event.note}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
