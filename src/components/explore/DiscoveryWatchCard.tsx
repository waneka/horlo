import Link from 'next/link'
import type { ReactNode } from 'react'

interface DiscoveryWatchCardWatch {
  id: string                  // watches_catalog.id (catalog UUID)
  brand: string
  model: string
  imageUrl: string | null
}

/**
 * DiscoveryWatchCard — shared card body for Trending + Gaining Traction (D-13).
 *
 * Phase 20 D-10: wrapped in <Link href="/catalog/[catalogId]"> per the new
 * catalog detail route. The watch.id field is `watches_catalog.id` (NOT a
 * per-user watches.id) — the route looks up by catalog UUID.
 *
 * Width: w-44 mobile / w-52 desktop — fits 5+ cards on a desktop scroll strip
 * per 18-UI-SPEC.md § Component Inventory.
 */
export function DiscoveryWatchCard({
  watch,
  sublabel,
}: {
  watch: DiscoveryWatchCardWatch
  sublabel: ReactNode
}) {
  return (
    <Link
      href={`/catalog/${watch.id}`}
      className="block w-44 md:w-52 space-y-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${watch.brand} ${watch.model} — view details`}
    >
      <div className="aspect-square rounded-md bg-muted overflow-hidden">
        {watch.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={watch.imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : null}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground truncate">{watch.brand}</p>
        <p className="text-sm text-muted-foreground truncate">{watch.model}</p>
        <p className="text-sm text-muted-foreground">{sublabel}</p>
      </div>
    </Link>
  )
}
