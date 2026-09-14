'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Eye, EyeOff } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { Watch } from '@/lib/types'

interface CollectionTabContentProps {
  watches: Watch[]
  wearDates: Record<string, string> // watchId -> YYYY-MM-DD
  isOwner: boolean
  /** Phase 25 D-09: when false (ANTHROPIC_API_KEY unset), the owner empty state
   *  shows a two-button fallback (disabled "Add by URL" + tooltip + "Add manually")
   *  instead of the standard AddWatchCard. Server-derived in [tab]/page.tsx. */
  hasUrlExtract: boolean
  /** DISP-01: batched like + comment counts resolved once per grid in ProfileTabContent.
   *  Key: watchId. Values passed per card to ProfileWatchCard. */
  counts?: Record<string, { likeCount: number; commentCount: number; liked: boolean; canComment: boolean }>
  /** D-03/D-04: viewer's own id for chip gate + anon-bounce; threaded from page.tsx RSC. */
  viewerId?: string | null
  /** Phase 85 D-13/LIFE-05 — owner-only; page.tsx passes [] for visitors. */
  previouslyOwnedWatches?: Watch[]
}

export function CollectionTabContent({
  watches,
  wearDates,
  isOwner,
  hasUrlExtract,
  counts,
  viewerId,
  previouslyOwnedWatches = [],
}: CollectionTabContentProps) {
  // Phase 85 D-13 — defense in depth: never treat previously-owned rows as
  // visible when !isOwner, even if a caller mistakenly passes them.
  const disposed = isOwner ? previouslyOwnedWatches : []
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
  // D-15 — not persisted; resets to off on a fresh mount.
  const [showPreviouslyOwned, setShowPreviouslyOwned] = useState(false)

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    function matches(w: Watch) {
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
    }
    return [
      ...watches.filter(matches),
      ...(showPreviouslyOwned ? disposed.filter(matches) : []),
    ]
  }, [watches, disposed, showPreviouslyOwned, activeChip, search])

  if (watches.length === 0 && disposed.length === 0) {
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
        {isOwner && (
          <button
            type="button"
            aria-pressed={showPreviouslyOwned}
            onClick={() => setShowPreviouslyOwned((v) => !v)}
            className={cn(
              'ml-2 inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-normal uppercase tracking-wide transition-colors',
              showPreviouslyOwned
                ? 'bg-accent text-accent-foreground border-accent'
                : 'bg-background text-muted-foreground border-border hover:text-foreground',
            )}
          >
            {showPreviouslyOwned ? (
              <EyeOff className="size-3.5" aria-hidden />
            ) : (
              <Eye className="size-3.5" aria-hidden />
            )}
            {disposed.length > 0
              ? `Show previously owned (${disposed.length})`
              : 'Show previously owned'}
          </button>
        )}
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
        {isOwner && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 min-h-[44px]"
            render={<Link href={returnTo ? `/watch/new?returnTo=${returnTo}` : '/watch/new'} />}
          >
            Add to Collection
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((watch) => (
          <ProfileWatchCard
            key={watch.id}
            watch={watch}
            lastWornDate={wearDates[watch.id] ?? null}
            isOwner={isOwner}
            viewerId={viewerId}
            likeCount={counts?.[watch.id]?.likeCount}
            commentCount={counts?.[watch.id]?.commentCount}
            liked={counts?.[watch.id]?.liked}
            canComment={counts?.[watch.id]?.canComment}
          />
        ))}
        {/* AddWatchCard removed from grid end — button above the grid owns the CTA (D-06, PLSH-05) */}
      </div>
    </>
  )
}
