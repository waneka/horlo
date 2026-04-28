import { Skeleton } from '@/components/ui/skeleton'

/**
 * Phase 19 Watches tab loading skeleton.
 *
 * Mirrors SearchResultsSkeleton rhythm with watch-thumbnail shape (size-10
 * rounded-full mobile / size-12 md+) and a right-side chip placeholder
 * representing the Evaluate button. Pure render component — Server-Component-safe.
 *
 * The data-testid hooks let Plan 05 RTL tests assert "skeleton is visible
 * during fetch" without coupling to internal class names.
 */
export function WatchSearchResultsSkeleton() {
  return (
    <div className="space-y-2" data-testid="watch-search-skeleton">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 min-h-16 md:min-h-20 bg-card px-4 py-3 rounded-md"
          data-testid="watch-search-skeleton-row"
        >
          <Skeleton className="size-10 md:size-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
      ))}
    </div>
  )
}
