import type { ReactNode } from 'react'

interface DiscoveryWatchCardWatch {
  id: string
  brand: string
  model: string
  imageUrl: string | null
}

/**
 * DiscoveryWatchCard — shared card body for Trending + Gaining Traction (D-13).
 *
 * Non-clickable in Phase 18 (Claude's Discretion default; Phase 20 lights up
 * /evaluate?catalogId={uuid}). Card body is identical across rails; only the
 * sublabel slot differs (caller controls via the `sublabel` prop).
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
    <div className="w-44 md:w-52 space-y-2">
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
    </div>
  )
}
