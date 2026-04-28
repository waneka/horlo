import { Flame, TrendingUp } from 'lucide-react'

import { getCurrentUser } from '@/lib/auth'
import {
  getTrendingCatalogWatches,
  getGainingTractionCatalogWatches,
} from '@/data/discovery'
import { DiscoveryWatchCard } from '@/components/explore/DiscoveryWatchCard'

export const metadata = {
  title: 'Trending & gaining traction — Horlo',
}

/**
 * /explore/watches — See-all overflow surface for Trending + Gaining Traction (DISC-07).
 *
 * Two stacked sections (NOT tabs, NOT a sort-by select) — UI-SPEC line 183
 * locked: stacked is the cheapest, most legible layout for a small dataset
 * (50 + 50 max), avoids tab state-management, lets viewers scan both rankings
 * on one scroll. Section order mirrors home /explore order (D-09):
 * Trending first, Gaining Traction second.
 *
 * LIMIT 50 cap per section, no pagination (D-10 + PROJECT MVP constraint).
 * Card layout on this page: responsive grid (NOT horizontal scroll — this is
 * a full list, not a rail preview).
 *
 * Auth-gated by src/proxy.ts (NOT in PUBLIC_PATHS).
 */
export default async function WatchesSeeAllPage() {
  await getCurrentUser() // auth check; proxy.ts already redirects anon
  const [trending, gaining] = await Promise.all([
    getTrendingCatalogWatches({ limit: 50 }),
    getGainingTractionCatalogWatches({ limit: 50 }),
  ])
  const trendingAtCap = trending.length === 50
  const gainingAtCap = gaining.watches.length === 50
  const completelyEmpty =
    trending.length === 0 && gaining.watches.length === 0 && gaining.window === 0

  if (completelyEmpty) {
    return (
      <main className="container mx-auto px-4 md:px-8 py-8 space-y-6 max-w-6xl">
        <h1 className="text-xl font-semibold leading-tight text-foreground">
          Trending &amp; gaining traction
        </h1>
        <div className="py-8 text-center space-y-2">
          <p className="text-base font-semibold">Nothing&apos;s catching fire yet.</p>
          <p className="text-sm text-muted-foreground">
            As more collectors save watches, this list comes alive.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 md:px-8 py-8 space-y-8 md:space-y-12 max-w-6xl">
      <h1 className="text-xl font-semibold leading-tight text-foreground">
        Trending &amp; gaining traction
      </h1>

      {/* Section 1: Trending */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold leading-tight text-foreground flex items-center gap-2">
          <Flame className="size-5 text-accent" aria-hidden />
          Trending
        </h2>
        {trending.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No trending watches yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {trending.map((w) => {
              const sublabel =
                w.ownersCount === 1 ? '· 1 collector' : `· ${w.ownersCount} collectors`
              return (
                <DiscoveryWatchCard
                  key={w.id}
                  watch={{ id: w.id, brand: w.brand, model: w.model, imageUrl: w.imageUrl }}
                  sublabel={sublabel}
                />
              )
            })}
          </div>
        )}
        {trendingAtCap && (
          <p className="text-sm text-muted-foreground text-center pt-4">
            Showing top 50 watches.
          </p>
        )}
      </section>

      {/* Section 2: Gaining traction */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold leading-tight text-foreground flex items-center gap-2">
          <TrendingUp className="size-5 text-accent" aria-hidden />
          Gaining traction
        </h2>
        {gaining.window === 0 || gaining.watches.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Not enough data yet — check back in a few days.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {gaining.watches.map((w) => {
                let sublabel: string
                if (gaining.window === 7) {
                  sublabel = `↑ +${w.delta} this week`
                } else {
                  const dayWord = gaining.window === 1 ? 'day' : 'days'
                  sublabel = `↑ +${w.delta} in ${gaining.window} ${dayWord}`
                }
                return (
                  <DiscoveryWatchCard
                    key={w.id}
                    watch={{ id: w.id, brand: w.brand, model: w.model, imageUrl: w.imageUrl }}
                    sublabel={sublabel}
                  />
                )
              })}
            </div>
            {gainingAtCap && (
              <p className="text-sm text-muted-foreground text-center pt-4">
                Showing top 50 watches.
              </p>
            )}
          </>
        )}
      </section>
    </main>
  )
}
