import { cacheLife, cacheTag } from 'next/cache'
import Link from 'next/link'
import { TrendingUp } from 'lucide-react'

import { getGainingTractionCatalogWatches } from '@/data/discovery'
import { DiscoveryWatchCard } from '@/components/explore/DiscoveryWatchCard'

/**
 * GainingTractionWatches — 7-day-delta rail (DISC-06 / D-12 / D-13).
 *
 * Always renders the rail header (D-12). Body branches on result.window:
 *   window === 0  → "Not enough data yet" empty-state copy (deploy day, no snapshots)
 *   window 1-6    → partial-window strip with sublabel "↑ +{delta} in {N} day(s)"
 *   window === 7  → full-week strip with sublabel "↑ +{delta} this week"
 *
 * Cache: global 24h (UI-SPEC § Component Inventory) — aligns with the pg_cron
 * 03:00 UTC daily snapshot cadence.
 */
export async function GainingTractionWatches() {
  'use cache'
  cacheTag('explore', 'explore:gaining-traction')
  cacheLife({ revalidate: 86400 })

  const result = await getGainingTractionCatalogWatches({ limit: 5 })
  const showStrip = result.window >= 1 && result.watches.length > 0

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-tight text-foreground flex items-center gap-2">
          <TrendingUp className="size-5 text-accent" aria-hidden />
          Gaining traction
        </h2>
        {showStrip && (
          <Link
            href="/explore/watches"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            See all
          </Link>
        )}
      </header>
      {showStrip ? (
        <div className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2">
          {result.watches.map((w) => {
            let sublabel: string
            if (result.window === 7) {
              sublabel = `↑ +${w.delta} this week`
            } else {
              const dayWord = result.window === 1 ? 'day' : 'days'
              sublabel = `↑ +${w.delta} in ${result.window} ${dayWord}`
            }
            return (
              <div key={w.id} className="snap-start">
                <DiscoveryWatchCard
                  watch={{ id: w.id, brand: w.brand, model: w.model, imageUrl: w.imageUrl }}
                  sublabel={sublabel}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Not enough data yet — check back in a few days.
        </p>
      )}
    </section>
  )
}
