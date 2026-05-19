// src/components/explore/BrowseModule.tsx
//
// Browse the Catalog entry module — Phase 46 EXPL-03.
//
// 3 entry tiles linking to the full Browse index pages (/explore/brands,
// /explore/eras, /explore/genres). No 4th Price-bands tile (D-08 deferred).
//
// Viewer-independent: globally cached, no per-viewer data. Tiles are static
// links — no DB call in this component (counts live on the index pages per D-06).
// Returns null only when there is truly no catalog content (theoretical — catalog
// always has brands, eras, and genres in production).
//
// Pattern: TrendingWatches 'use cache' + null-hide + section/h2 skeleton.

import { cacheLife, cacheTag } from 'next/cache'
import Link from 'next/link'
import { Building2, Clock, Tag } from 'lucide-react'

export async function BrowseModule() {
  'use cache'
  cacheTag('explore', 'explore:browse')
  cacheLife('hours')

  // Tiles are static — this module always has content.
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold leading-tight text-foreground">
        Browse the Catalog
      </h2>
      <div className="grid grid-cols-3 gap-3">
        <Link href="/explore/brands">
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-card border border-border p-4 min-h-12 hover:bg-muted transition-colors text-center">
            <Building2 className="size-5 text-muted-foreground" aria-hidden />
            <span className="text-sm font-semibold text-foreground">Brands</span>
          </div>
        </Link>
        <Link href="/explore/eras">
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-card border border-border p-4 min-h-12 hover:bg-muted transition-colors text-center">
            <Clock className="size-5 text-muted-foreground" aria-hidden />
            <span className="text-sm font-semibold text-foreground">Eras</span>
          </div>
        </Link>
        <Link href="/explore/genres">
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-card border border-border p-4 min-h-12 hover:bg-muted transition-colors text-center">
            <Tag className="size-5 text-muted-foreground" aria-hidden />
            <span className="text-sm font-semibold text-foreground">Genres</span>
          </div>
        </Link>
      </div>
    </section>
  )
}
