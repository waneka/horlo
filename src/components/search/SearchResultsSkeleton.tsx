import { Skeleton } from '@/components/ui/skeleton'

/**
 * Phase 16 D-09 loading state.
 *
 * Renders 4 skeleton rows that visually approximate <PeopleSearchRow>'s
 * footprint: avatar circle + two stacked text bars (name + overlap line) +
 * right-side chip (FollowButton placeholder). Mirrors the shimmer pattern
 * used by NetworkActivityFeed and SuggestedCollectors so the loading
 * transition reads as continuous chrome, not "search-specific spinner".
 *
 * Pure render component (no client interactivity) — Server-Component-safe.
 *
 * The data-testid hooks let Plan 01 RTL tests assert "skeleton is visible
 * during fetch" without coupling to internal class names.
 */
export function SearchResultsSkeleton() {
  return (
    <div className="space-y-2" data-testid="search-skeleton">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 min-h-16 md:min-h-20 bg-card px-4 py-3 rounded-md"
          data-testid="search-skeleton-row"
        >
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
      ))}
    </div>
  )
}
