import Link from 'next/link'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Watch } from '@/lib/types'

/**
 * SleepingBeautyCard — Personal Insights "Alert" card (I-01 / I-03).
 *
 * When `lastWornDate === null` the watch has never been worn; render the
 * literal string "Never worn" instead of fabricating a day count. The
 * ordering decision ("which watch is the most neglected?") is made in the
 * parent grid via an `effectiveDays` key — this component only renders
 * what the parent selected.
 *
 * Accent badge (`bg-accent text-accent-foreground`) per UI-SPEC §Accent
 * reserved for (item 3).
 */
export function SleepingBeautyCard({
  watch,
  daysUnworn,
  lastWornDate,
}: {
  watch: Watch
  daysUnworn: number | null
  lastWornDate: string | null
}) {
  const detailText =
    lastWornDate === null ? 'Never worn' : `${daysUnworn ?? 0} days unworn`

  return (
    <Link
      href={`/watch/${watch.id}`}
      aria-label={`View ${watch.brand} ${watch.model}`}
      className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="transition hover:shadow-md">
        <CardContent className="space-y-3">
          <Badge
            className="bg-accent text-accent-foreground"
            aria-label="Alert"
          >
            Alert
          </Badge>
          <p className="text-sm font-semibold">
            {watch.brand} {watch.model}
          </p>
          <p className="text-sm text-muted-foreground">{detailText}</p>
        </CardContent>
      </Card>
    </Link>
  )
}
