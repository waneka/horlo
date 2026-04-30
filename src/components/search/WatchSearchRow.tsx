import Image from 'next/image'
import Link from 'next/link'
import { Watch as WatchIcon } from 'lucide-react'

import { HighlightedText } from '@/components/search/HighlightedText'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'

/**
 * Phase 20.1 gap-5 follow-up — split affordances.
 *
 * Row body (image + brand/model) is a <Link> to /catalog/[catalogId] — primary
 * action is "go to detail page." Owned/Wishlist pill renders inside the Link so
 * the whole content area is a single navigation target.
 *
 * The right-edge chevron is owned by the parent (Accordion.Trigger slot, passed
 * via the `trigger` prop). When unused (e.g. an All-tab list that doesn't
 * accordion), the row is purely a link with no expand affordance.
 */
export function WatchSearchRow({
  result,
  q,
  trigger,
}: {
  result: SearchCatalogWatchResult
  q: string
  trigger?: React.ReactNode
}) {
  return (
    <div className="group relative flex items-center gap-2 min-h-16 md:min-h-20 bg-card pl-4 pr-2 py-3 rounded-md transition-colors hover:bg-muted/40">
      <Link
        href={`/catalog/${result.catalogId}`}
        className="flex flex-1 items-center gap-4 min-w-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="size-10 md:size-12 rounded-full bg-muted ring-2 ring-card overflow-hidden flex items-center justify-center shrink-0">
          {result.imageUrl ? (
            <Image
              src={result.imageUrl}
              alt=""
              width={48}
              height={48}
              className="object-cover"
              unoptimized
            />
          ) : (
            <WatchIcon className="size-4 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            <HighlightedText text={`${result.brand} ${result.model}`} q={q} />
          </p>
          {result.reference && (
            <p className="text-sm text-muted-foreground truncate">
              <HighlightedText text={result.reference} q={q} />
            </p>
          )}
        </div>
        {result.viewerState === 'owned' && (
          <span className="bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full shrink-0">
            Owned
          </span>
        )}
        {result.viewerState === 'wishlist' && (
          <span className="bg-muted text-muted-foreground text-xs font-medium px-2 py-0.5 rounded-full shrink-0">
            Wishlist
          </span>
        )}
      </Link>
      {trigger}
    </div>
  )
}
