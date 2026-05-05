'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ProfileWatchCard } from './ProfileWatchCard'
import { FilterChips } from './FilterChips'
import { AddWatchCard } from './AddWatchCard'
import type { Watch } from '@/lib/types'

interface CollectionTabContentProps {
  watches: Watch[]
  wearDates: Record<string, string> // watchId -> YYYY-MM-DD
  isOwner: boolean
  /** Phase 25 D-09: when false (ANTHROPIC_API_KEY unset), the owner empty state
   *  shows a two-button fallback (disabled "Add by URL" + tooltip + "Add manually")
   *  instead of the standard AddWatchCard. Server-derived in [tab]/page.tsx. */
  hasUrlExtract: boolean
}

export function CollectionTabContent({
  watches,
  wearDates,
  isOwner,
  hasUrlExtract,
}: CollectionTabContentProps) {
  const pathname = usePathname() ?? ''
  // Phase 28 D-08 — capture entry pathname so the Add-Watch flow can
  // route the user back to /u/{username}/collection on commit.
  const returnTo = pathname ? encodeURIComponent(pathname) : ''
  const manualHref = returnTo
    ? `/watch/new?manual=1&returnTo=${returnTo}`
    : '/watch/new?manual=1'

  // Derive role-tag chips dynamically (D-07): "All" + each unique role tag in collection,
  // capped at the most common 6 to keep the bar readable.
  const chipOptions = useMemo(() => {
    const counts: Record<string, number> = {}
    watches.forEach((w) =>
      (w.roleTags ?? []).forEach((r) => {
        const norm = r.charAt(0).toUpperCase() + r.slice(1).toLowerCase()
        counts[norm] = (counts[norm] ?? 0) + 1
      }),
    )
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([r]) => r)
    return ['All', ...sorted]
  }, [watches])

  const [activeChip, setActiveChip] = useState('All')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return watches.filter((w) => {
      if (activeChip !== 'All') {
        const hasTag = (w.roleTags ?? []).some(
          (r) => r.toLowerCase() === activeChip.toLowerCase(),
        )
        if (!hasTag) return false
      }
      if (!s) return true
      return (
        w.brand.toLowerCase().includes(s) ||
        w.model.toLowerCase().includes(s)
      )
    })
  }, [watches, activeChip, search])

  if (watches.length === 0) {
    if (isOwner) {
      // Phase 25 D-09 branch: when ANTHROPIC_API_KEY is unset, show two
      // side-by-side primary buttons (disabled "Add by URL" + enabled "Add
      // manually") instead of the existing AddWatchCard. Both buttons stay
      // primary-weighted (NOT outline) per CONTEXT §specifics — disabled
      // state alone signals the unavailable path. The <span> wrapper around
      // the disabled Button is required for Safari (Anti-Pattern #14 / FG-3:
      // disabled buttons swallow pointer events; the span lets the tooltip
      // still trigger on hover).
      if (!hasUrlExtract) {
        return (
          <div className="rounded-xl border bg-card p-12 text-center">
            <p className="text-base font-semibold">Nothing here yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your first watch to start building your collection.
            </p>
            <div className="mx-auto mt-6 grid max-w-md gap-3 sm:grid-cols-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="inline-block">
                        <Button
                          variant="default"
                          disabled
                          className="w-full cursor-not-allowed opacity-60"
                          aria-label="Add by URL (unavailable)"
                        >
                          Add by URL
                        </Button>
                      </span>
                    }
                  />
                  <TooltipContent>
                    URL extraction unavailable — ANTHROPIC_API_KEY not set
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button variant="default" render={<Link href={manualHref} />}>
                Add manually
              </Button>
            </div>
          </div>
        )
      }
      // Default owner branch: ANTHROPIC_API_KEY present, use the existing
      // AddWatchCard inside the standard mx-auto mt-6 max-w-xs wrapper.
      return (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-base font-semibold">Nothing here yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first watch to start building your collection.
          </p>
          <div className="mx-auto mt-6 max-w-xs">
            <AddWatchCard returnTo={pathname || null} />
          </div>
        </div>
      )
    }
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <p className="text-base font-semibold">Nothing here yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This collector hasn&apos;t added any watches yet.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <FilterChips
          options={chipOptions}
          active={activeChip}
          onChange={setActiveChip}
        />
        <div className="relative ml-auto w-48 shrink-0">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search watches..."
            className="pl-8 text-sm"
            aria-label="Search watches"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((watch) => (
          <ProfileWatchCard
            key={watch.id}
            watch={watch}
            lastWornDate={wearDates[watch.id] ?? null}
          />
        ))}
        {isOwner && <AddWatchCard returnTo={pathname || null} />}
      </div>
    </>
  )
}
