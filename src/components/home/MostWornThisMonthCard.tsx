import Link from 'next/link'

import { Card, CardContent } from '@/components/ui/card'
import type { Watch } from '@/lib/types'

/**
 * MostWornThisMonthCard — Personal Insights card (I-01).
 *
 * Selected upstream as the watch with the most wear events in the current
 * calendar month. Click target: `/watch/{id}` per I-03.
 */
export function MostWornThisMonthCard({
  watch,
  wearCount,
}: {
  watch: Watch
  wearCount: number
}) {
  return (
    <Link
      href={`/watch/${watch.id}`}
      aria-label={`View ${watch.brand} ${watch.model}`}
      className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="transition hover:shadow-md">
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Most worn this month
          </p>
          <p className="text-sm font-semibold">
            {watch.brand} {watch.model}
          </p>
          <p className="text-sm text-muted-foreground">
            {wearCount} wear{wearCount === 1 ? '' : 's'}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
