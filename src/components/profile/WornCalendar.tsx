'use client'

import { useMemo, useState } from 'react'
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
}

interface WornCalendarProps {
  events: WearEventLite[]
  watchMap: Record<string, WatchSummary>
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}
function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
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

export function WornCalendar({ events, watchMap }: WornCalendarProps) {
  const today = new Date()
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  })

  const eventsByDay = useMemo(() => {
    const map: Record<string, WearEventLite[]> = {}
    for (const e of events) {
      if (!map[e.wornDate]) map[e.wornDate] = []
      map[e.wornDate].push(e)
    }
    return map
  }, [events])

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
          return (
            <div
              key={i}
              className={cn(
                'flex min-h-12 flex-col items-center justify-start rounded-md border p-1 text-xs',
                inMonth ? 'bg-background' : 'bg-muted/30 text-muted-foreground',
                isToday && 'ring-1 ring-accent',
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
    </div>
  )
}
