import Link from 'next/link'
import Image from 'next/image'
import { Watch as WatchIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'
import type { Recommendation } from '@/lib/discoveryTypes'

/**
 * RecommendationCard — pure render of one Recommendation.
 *
 * No data fetching, no memoization. Shape per UI-SPEC § Spacing Scale:
 *   - outer link: w-40 (mobile) / md:w-44 (desktop), scroll-snap-start
 *   - image area: aspect-[4/5] with WatchIcon fallback on null imageUrl
 *   - caption: brand (semibold) over model (muted) over rationale (muted,
 *     line-clamp 2)
 *
 * Click target: `/watch/{representativeWatchId}` per CONTEXT.md C-05.
 */
export function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <Link
      href={`/watch/${rec.representativeWatchId}`}
      aria-label={`${rec.brand} ${rec.model}`}
      className="shrink-0 snap-start w-40 md:w-44 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="p-0 transition hover:shadow-lg">
        <div className="relative w-full aspect-[4/5] bg-muted">
          {rec.imageUrl ? (
            <Image
              src={rec.imageUrl}
              alt={`${rec.brand} ${rec.model}`}
              fill
              className="object-cover"
              sizes="176px"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <WatchIcon
                className="size-8 text-muted-foreground"
                aria-hidden
              />
            </div>
          )}
        </div>
        <div className="p-3 space-y-1">
          <p className="text-sm font-semibold text-foreground truncate">
            {rec.brand}
          </p>
          <p className="text-sm text-muted-foreground truncate">{rec.model}</p>
          <p className="text-sm text-muted-foreground line-clamp-2 pt-1">
            {rec.rationale}
          </p>
        </div>
      </Card>
    </Link>
  )
}
