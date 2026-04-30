import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Phase 20 D-06: structural skeleton for the FIT-04 search-row inline expand.
 *
 * Mirrors <CollectionFitCard> shape so the swap from skeleton → real card is
 * dimensionally stable (no layout shift).
 *
 * Heights and widths from UI-SPEC § "Component Inventory" → "Loading state":
 *   - Title: h-4 w-24
 *   - Badge: h-5 w-16 rounded-4xl
 *   - Headline: h-4 w-full
 *   - Context lines: h-3.5 w-3/4 + h-3.5 w-2/3
 *   - Most-similar heading: h-3.5 w-32
 *   - List rows: h-3.5 w-1/2 left + h-3.5 w-12 right per row
 */
export function VerdictSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16 rounded-4xl" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <div className="space-y-1">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3.5 w-12" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3.5 w-12" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
