import Link from 'next/link'
import Image from 'next/image'
import { Watch as WatchIcon } from 'lucide-react'

import { HighlightedText } from '@/components/search/HighlightedText'
import { buttonVariants } from '@/components/ui/button'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'

/**
 * Phase 19 Watches Search row (SRCH-09).
 *
 * Mirrors PeopleSearchRow + SuggestedCollectorRow click semantics:
 *   - Whole row is an absolute-inset <Link> → /evaluate?catalogId={uuid} (D-07 + D-08).
 *   - Inline 'Evaluate' button raised with `relative z-10` so its click does
 *     not bubble; both targets resolve to the same URL so right-click → Open
 *     in New Tab works on either affordance.
 *
 * Single contextual pill (D-05):
 *   - viewerState === 'owned'    → "Owned" pill (bg-primary text-primary-foreground)
 *   - viewerState === 'wishlist' → "Wishlist" pill (bg-muted text-muted-foreground)
 *   - viewerState === null       → no pill rendered
 *
 * Already-owned watches are NOT filtered out (D-06) — they stay in results
 * and are badged inline.
 *
 * SRCH-15: brand+model and reference are wrapped in <HighlightedText> for
 * XSS-safe match highlighting. The component is reused unchanged from Phase 16.
 *
 * Implementation note (deviation from plan template — Rule 3 blocking issue):
 * The plan template used `<Button asChild>` to wrap a Next Link. The codebase
 * Button is base-ui (not radix), and `asChild` is not in its API. Pattern in
 * this codebase (e.g., src/components/explore/TrendingWatches.tsx) is to render
 * a `<Link>` with `buttonVariants(...)` for outline-button styling, which
 * preserves the same DOM (`<a>` element) the test asserts.
 */
export function WatchSearchRow({
  result,
  q,
}: {
  result: SearchCatalogWatchResult
  q: string
}) {
  const href = `/evaluate?catalogId=${result.catalogId}`
  return (
    <div className="group relative flex items-center gap-4 min-h-16 md:min-h-20 bg-card px-4 py-3 rounded-md transition-colors hover:bg-muted/40">
      <Link
        href={href}
        aria-label={`Evaluate ${result.brand} ${result.model}`}
        className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
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
      <div className="relative flex-1 min-w-0 pointer-events-none">
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
        <span className="relative bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full pointer-events-none">
          Owned
        </span>
      )}
      {result.viewerState === 'wishlist' && (
        <span className="relative bg-muted text-muted-foreground text-xs font-medium px-2 py-0.5 rounded-full pointer-events-none">
          Wishlist
        </span>
      )}
      <div className="relative z-10">
        <Link
          href={href}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Evaluate
        </Link>
      </div>
    </div>
  )
}
