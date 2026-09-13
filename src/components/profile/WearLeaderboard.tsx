'use client'

import { useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Watch as WatchIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { getSafeImageUrl } from '@/lib/images'
import { filterEventsByWindow, buildLeaderboard } from '@/lib/stats'
import { todayLocalISO, DEFAULT_WEAR_WINDOW } from '@/lib/wear'
import type { WearWindowKey } from '@/lib/wear'

interface LeaderboardWatch {
  id: string
  brand: string
  model: string
  imageUrl?: string | null
}

interface WearLeaderboardProps {
  events: Array<{ watchId: string; wornDate: string }>
  watches: LeaderboardWatch[]
  /** 84-REVIEW WR-04: whether rows link to `/w/{id}`. `/w/[ref]` only
   *  resolves a per-user watch for the owner or when the collection is
   *  public, so for a non-owner viewer of a private collection every link
   *  would 404 — rows render as plain (unlinked) rows instead. Callers
   *  derive this as `isOwner || collectionPublic`. */
  linkable?: boolean
  /** 84-REVIEW WR-05: the "log a wear" call to action in the empty-window
   *  note is owner-only — a non-owner can't log wears on this profile. */
  isOwner?: boolean
}

const ROW_CLASS = 'flex min-h-11 items-center gap-3 rounded-lg p-2'

const WINDOW_OPTIONS: ReadonlyArray<{ value: WearWindowKey; label: string }> = [
  { value: '1mo', label: '1 mo' },
  { value: '3mo', label: '3 mo' },
  { value: '6mo', label: '6 mo' },
  { value: '12mo', label: '12 mo' },
  { value: 'all', label: 'All time' },
]

const TOP_N = 5

// useSyncExternalStore never actually subscribes to anything here — "today"
// only changes across a full page load, never mid-session. The referentially
// stable no-op subscribe avoids a render loop while the client snapshot
// (todayLocalISO()) resolves after the null server snapshot (React #418 guard
// — SSR and hydration must never disagree on window counts).
function subscribeNoop() {
  return () => {}
}

export function WearLeaderboard({
  events,
  watches,
  linkable = true,
  isOwner = false,
}: WearLeaderboardProps) {
  const todayISO = useSyncExternalStore(
    subscribeNoop,
    () => todayLocalISO(),
    () => null,
  )

  const [windowKey, setWindowKey] = useState<WearWindowKey>(DEFAULT_WEAR_WINDOW)
  const [expanded, setExpanded] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const rows = useMemo(
    () =>
      todayISO === null
        ? []
        : buildLeaderboard(watches, filterEventsByWindow(events, windowKey, todayISO)),
    [watches, events, windowKey, todayISO],
  )

  if (watches.length === 0) return null

  const topCount = rows[0]?.count ?? 0
  const allZero = rows.every((r) => r.count === 0)
  const visibleRows = expanded ? rows : rows.slice(0, TOP_N)

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const values = WINDOW_OPTIONS.map((o) => o.value)
    const idx = values.indexOf(windowKey)
    let next: WearWindowKey | null = null

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      next = values[(idx + 1) % values.length]
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      next = values[(idx + values.length - 1) % values.length]
    } else if (e.key === 'Home') {
      e.preventDefault()
      next = values[0]
    } else if (e.key === 'End') {
      e.preventDefault()
      next = values[values.length - 1]
    }

    if (next !== null) {
      setWindowKey(next)
      const nextValue = next
      requestAnimationFrame(() => {
        listRef.current
          ?.querySelector<HTMLButtonElement>(`[data-value="${nextValue}"]`)
          ?.focus()
      })
    }
  }

  return (
    <section aria-labelledby="wear-leaderboard-heading" className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="wear-leaderboard-heading" className="text-base font-semibold">
          Wear leaderboard
        </h2>
        <div
          ref={listRef}
          role="tablist"
          aria-label="Leaderboard window"
          onKeyDown={handleKeyDown}
          className="flex w-full items-center rounded-full border bg-background p-1 sm:w-auto"
        >
          {WINDOW_OPTIONS.map((opt) => {
            const active = opt.value === windowKey
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                data-value={opt.value}
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => setWindowKey(opt.value)}
                className={cn(
                  'flex min-h-11 flex-1 items-center justify-center rounded-full px-3 text-xs transition-colors sm:flex-none',
                  active
                    ? 'bg-accent text-accent-foreground font-semibold'
                    : 'font-normal text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {todayISO === null ? (
        <div aria-hidden="true" className="flex flex-col gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <>
          {allZero && (
            <div className="mb-2 rounded-lg bg-muted p-3">
              <p className="text-sm font-semibold">No wears in this window.</p>
              <p className="text-xs text-muted-foreground">
                {isOwner
                  ? 'Try a longer window, or log a wear to get started.'
                  : 'Try a longer window.'}
              </p>
            </div>
          )}
          <ol className="flex flex-col gap-1">
            {visibleRows.map((row, i) => {
              const safe = getSafeImageUrl(row.watch.imageUrl ?? null)
              const width = topCount > 0 ? Math.round((row.count / topCount) * 100) : 0
              const rowContent = (
                <>
                  <span
                    data-slot="leaderboard-rank"
                    className="w-5 shrink-0 text-sm font-semibold tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <div className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">
                    {safe ? (
                      <Image src={safe} alt="" fill sizes="40px" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <WatchIcon className="size-4 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {row.watch.brand} {row.watch.model}
                      </span>
                      <span className="shrink-0 text-xs font-normal text-muted-foreground">
                        {row.count} wear{row.count === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        data-slot="leaderboard-bar-fill"
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                </>
              )
              return (
                <li key={row.watch.id}>
                  {linkable ? (
                    <Link
                      href={`/w/${row.watch.id}`}
                      className={cn(
                        ROW_CLASS,
                        'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      )}
                    >
                      {rowContent}
                    </Link>
                  ) : (
                    <div data-slot="leaderboard-row" className={ROW_CLASS}>
                      {rowContent}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
          {rows.length > TOP_N && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-sm text-muted-foreground hover:text-foreground"
            >
              {expanded ? 'Show less' : 'Show all'}
            </button>
          )}
        </>
      )}
    </section>
  )
}
