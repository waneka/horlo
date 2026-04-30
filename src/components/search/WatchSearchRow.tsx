import Image from 'next/image'
import { Watch as WatchIcon, ChevronDown } from 'lucide-react'

import { HighlightedText } from '@/components/search/HighlightedText'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'

/**
 * Phase 20 FIT-04 — modified row.
 *
 * The dangling `/evaluate?catalogId=` Link is removed. The whole-row click
 * affordance is now provided by <Accordion.Trigger> in the parent
 * <WatchSearchRowsAccordion>. The right-edge "Evaluate"/"Hide" element is a
 * static <span> styled like a button — visual affordance only, not a separate
 * click target.
 *
 * Pitfall 6: trigger element is supplied by the parent. This row component
 * is now a pure presentational shell.
 *
 * Phase 19 D-07/D-08 contract is preserved (Owned/Wishlist pill rendering).
 *
 * isOpen: passed from WatchSearchRowsAccordion to toggle "Evaluate"/"Hide" label
 * and rotate the ChevronDown icon.
 */
export function WatchSearchRow({
  result,
  q,
  isOpen = false,
}: {
  result: SearchCatalogWatchResult
  q: string
  isOpen?: boolean
}) {
  return (
    <div className="group relative flex items-center gap-4 min-h-16 md:min-h-20 bg-card px-4 py-3 rounded-md transition-colors hover:bg-muted/40">
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
      {/* UAT gap 5 fix: chevron-led "Tap to evaluate" affordance — no longer
          styled like a button (the previous outline-button styling was removed).
          pointer-events-none kept so the click bubbles to the Accordion.Trigger
          ancestor (the entire row is the click target). aria-hidden on the
          wrapping span — the Trigger button already exposes
          aria-label="Evaluate {brand} {model}" to screen readers. */}
      <span
        className="relative inline-flex items-center gap-1 text-sm text-muted-foreground pointer-events-none"
        aria-hidden="true"
      >
        {isOpen ? 'Hide' : 'Tap to evaluate'}
        <ChevronDown
          className={`size-4 transition-transform${isOpen ? ' rotate-180' : ''}`}
          aria-hidden="true"
        />
      </span>
    </div>
  )
}
