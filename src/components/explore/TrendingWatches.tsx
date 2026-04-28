import { cacheLife, cacheTag } from 'next/cache'
import Link from 'next/link'
import { Flame } from 'lucide-react'

import { getTrendingCatalogWatches } from '@/data/discovery'
import { DiscoveryWatchCard } from '@/components/explore/DiscoveryWatchCard'

/**
 * TrendingWatches — denormalized signal score rail (DISC-05 / D-13).
 *
 * Score: owners_count + 0.5 * wishlist_count (CAT-09 denormalized counts).
 * Cache: global 5min (UI-SPEC § Component Inventory) — global because the
 * ranking is identical for every viewer (no per-viewer filtering).
 *
 * Hide-on-empty per UI-SPEC § Empty States.
 */
export async function TrendingWatches() {
  'use cache'
  cacheTag('explore', 'explore:trending-watches')
  cacheLife({ revalidate: 300 })

  const watches = await getTrendingCatalogWatches({ limit: 5 })
  if (watches.length === 0) return null

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-tight text-foreground flex items-center gap-2">
          <Flame className="size-5 text-accent" aria-hidden />
          Trending
        </h2>
        <Link
          href="/explore/watches"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          See all
        </Link>
      </header>
      <div className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2">
        {watches.map((w) => {
          const sublabel =
            w.ownersCount === 1 ? '· 1 collector' : `· ${w.ownersCount} collectors`
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
    </section>
  )
}
