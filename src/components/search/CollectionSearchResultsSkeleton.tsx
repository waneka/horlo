import { Skeleton } from '@/components/ui/skeleton'

/**
 * Phase 19 Collections tab loading skeleton.
 *
 * Same row dimensions as WatchSearchResultsSkeleton (UI-SPEC line 142-144 —
 * "no visual differences needed; use the same skeleton shape"). Separate
 * component for semantic data-testid isolation in Plan 05 wiring tests.
 */
export function CollectionSearchResultsSkeleton() {
  return (
    <div className="space-y-2" data-testid="collection-search-skeleton">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 min-h-16 md:min-h-20 bg-card px-4 py-3 rounded-md"
          data-testid="collection-search-skeleton-row"
        >
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}
