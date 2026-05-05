'use client'

import { ChevronRight } from 'lucide-react'

import { PeopleSearchRow } from '@/components/search/PeopleSearchRow'
import { WatchSearchRowsAccordion } from '@/components/search/WatchSearchRowsAccordion'
import { CollectionSearchRow } from '@/components/search/CollectionSearchRow'
import { SearchResultsSkeleton } from '@/components/search/SearchResultsSkeleton'
import { WatchSearchResultsSkeleton } from '@/components/search/WatchSearchResultsSkeleton'
import { CollectionSearchResultsSkeleton } from '@/components/search/CollectionSearchResultsSkeleton'
import type {
  SearchCatalogWatchResult,
  SearchCollectionResult,
  SearchProfileResult,
  SearchTab,
} from '@/lib/searchTypes'

const ALL_TAB_SECTION_CAP = 5

interface AllTabResultsProps {
  q: string
  viewerId: string
  collectionRevision: number
  /** Phase 28 D-02 / UX-09: viewer's profile username threaded to the
   *  WatchSearchRowsAccordion mount inside the Watches section. */
  viewerUsername: string | null
  peopleResults: SearchProfileResult[]
  watchesResults: SearchCatalogWatchResult[]
  collectionsResults: SearchCollectionResult[]
  peopleIsLoading: boolean
  watchesIsLoading: boolean
  collectionsIsLoading: boolean
  setTab: (next: SearchTab) => void
}

/**
 * Phase 19 All-tab composer (SRCH-13).
 *
 * Three sections in D-13 order: People → Watches → Collections.
 * Each section has its own header + 'See all' link + per-section skeleton.
 * 'See all' switches the active tab via setTab() — preserves debounce +
 * query state (D-14; snappier than a full route navigation).
 *
 * Empty section renders 'No matches' inline; section header is never hidden.
 * Per-section skeleton paints independently — D-15 "fast sections paint
 * immediately" semantics are honored because each section reads its own
 * loading slice.
 *
 * I-2 BLOCKER fix (defense-in-depth): the composer ALWAYS slice(0, 5) each
 * result array internally — even if the hook's per-section cap regresses
 * upstream and a 20-row payload is passed in. The See-all condition is
 * evaluated against the sliced length, NOT the raw payload, so a 20-row
 * over-cap payload still correctly shows See-all (because sliced.length
 * still equals the cap).
 */
export function AllTabResults({
  q,
  viewerId,
  collectionRevision,
  viewerUsername,
  peopleResults,
  watchesResults,
  collectionsResults,
  peopleIsLoading,
  watchesIsLoading,
  collectionsIsLoading,
  setTab,
}: AllTabResultsProps) {
  // Defensive cap (I-2): never trust the caller. Slice once, then derive
  // both the rendered rows and the See-all condition from the sliced array.
  const peopleCapped = peopleResults.slice(0, ALL_TAB_SECTION_CAP)
  const watchesCapped = watchesResults.slice(0, ALL_TAB_SECTION_CAP)
  const collectionsCapped = collectionsResults.slice(0, ALL_TAB_SECTION_CAP)

  return (
    <div className="space-y-6">
      <Section
        label="People"
        showSeeAll={peopleCapped.length === ALL_TAB_SECTION_CAP}
        onSeeAll={() => setTab('people')}
      >
        {peopleIsLoading ? (
          <SearchResultsSkeleton />
        ) : peopleCapped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches</p>
        ) : (
          <div className="space-y-2">
            {peopleCapped.map((r) => (
              <PeopleSearchRow
                key={r.userId}
                result={r}
                q={q}
                viewerId={viewerId}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        label="Watches"
        showSeeAll={watchesCapped.length === ALL_TAB_SECTION_CAP}
        onSeeAll={() => setTab('watches')}
      >
        {watchesIsLoading ? (
          <WatchSearchResultsSkeleton />
        ) : watchesCapped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches</p>
        ) : (
          <WatchSearchRowsAccordion
            results={watchesCapped}
            q={q}
            collectionRevision={collectionRevision}
            viewerUsername={viewerUsername}
          />
        )}
      </Section>

      <Section
        label="Collections"
        showSeeAll={collectionsCapped.length === ALL_TAB_SECTION_CAP}
        onSeeAll={() => setTab('collections')}
      >
        {collectionsIsLoading ? (
          <CollectionSearchResultsSkeleton />
        ) : collectionsCapped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches</p>
        ) : (
          <div className="space-y-2">
            {collectionsCapped.map((r) => (
              <CollectionSearchRow key={r.userId} result={r} q={q} />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function Section({
  label,
  showSeeAll,
  onSeeAll,
  children,
}: {
  label: string
  showSeeAll: boolean
  onSeeAll: () => void
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </h2>
        {showSeeAll && (
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            onClick={onSeeAll}
          >
            See all <ChevronRight className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      {children}
    </section>
  )
}
