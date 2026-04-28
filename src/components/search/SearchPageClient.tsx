'use client'

import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

import { useSearchState } from '@/components/search/useSearchState'
import { PeopleSearchRow } from '@/components/search/PeopleSearchRow'
import { SearchResultsSkeleton } from '@/components/search/SearchResultsSkeleton'
import { WatchSearchRow } from '@/components/search/WatchSearchRow'
import { WatchSearchResultsSkeleton } from '@/components/search/WatchSearchResultsSkeleton'
import { CollectionSearchRow } from '@/components/search/CollectionSearchRow'
import { CollectionSearchResultsSkeleton } from '@/components/search/CollectionSearchResultsSkeleton'
import { AllTabResults } from '@/components/search/AllTabResults'
import type {
  SearchCatalogWatchResult,
  SearchCollectionResult,
  SearchProfileResult,
  SearchTab,
} from '@/lib/searchTypes'

interface SearchPageClientProps {
  viewerId: string
  /** SuggestedCollectors Server Component, rendered into pre-query + no-results states (D-29 carry-forward). */
  children: React.ReactNode
}

const CLIENT_MIN_CHARS = 2 // matches D-20 server gate

const PLACEHOLDER_BY_TAB: Record<SearchTab, string> = {
  all: 'Search everything…',
  people: 'Search collectors…',
  watches: 'Search watches…',
  collections: 'Search collections…',
}

const ARIA_BY_TAB: Record<SearchTab, string> = {
  all: 'Search everything',
  people: 'Search collectors',
  watches: 'Search watches',
  collections: 'Search collections',
}

/**
 * Phase 19 /search page body — 4-tab shell wired to per-tab DAL slices.
 *
 * Plan 06 rewrite:
 *   - Watches + Collections tabs replace the prior coming-soon placeholders
 *     with real result blocks (skeleton → error → empty → results | footer).
 *   - All tab composes 3 sections via <AllTabResults> (People → Watches →
 *     Collections, D-13). Each section shows its own per-section skeleton (D-15)
 *     and a 'See all' button that calls setTab() (D-14, not router.push).
 *   - Input placeholder updates per active tab (UI-SPEC lines 220-221).
 *   - Watches tab shows 'Showing top 20' footer when results.length === 20 (D-04).
 *   - People-tab pre-query state still renders the suggested-collectors `children`
 *     Server Component slot (D-29 carry-forward); All-tab pre-query also renders
 *     it below the empty-section composer for the same effect.
 *
 * The Phase 16 `results`/`isLoading`/`hasError` backward-compat aliases on the
 * hook contract are dropped here — this consumer reads per-tab slices directly.
 */
export function SearchPageClient({ viewerId, children }: SearchPageClientProps) {
  const {
    q,
    setQ,
    debouncedQ,
    tab,
    setTab,
    peopleResults,
    watchesResults,
    collectionsResults,
    peopleIsLoading,
    watchesIsLoading,
    collectionsIsLoading,
    peopleHasError,
    watchesHasError,
    collectionsHasError,
  } = useSearchState()

  const trimmed = debouncedQ.trim()

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-4">Search</h1>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            autoFocus
            type="search"
            name="q"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            placeholder={PLACEHOLDER_BY_TAB[tab]}
            aria-label={ARIA_BY_TAB[tab]}
            className="w-full bg-muted/50 border-transparent pl-9 rounded-md focus-visible:bg-background h-10 text-base"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(next) => setTab(next as SearchTab)}>
        <TabsList className="w-full">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="watches">Watches</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6 space-y-6">
          <AllTabResults
            q={trimmed}
            viewerId={viewerId}
            peopleResults={peopleResults}
            watchesResults={watchesResults}
            collectionsResults={collectionsResults}
            peopleIsLoading={peopleIsLoading}
            watchesIsLoading={watchesIsLoading}
            collectionsIsLoading={collectionsIsLoading}
            setTab={setTab}
          />
          {/* D-29 carry-forward: when query is empty, surface the suggested
              collectors Server Component below the empty-section composer. */}
          {trimmed.length < CLIENT_MIN_CHARS && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold leading-tight text-foreground">
                Collectors you might like
              </h2>
              {children}
            </section>
          )}
        </TabsContent>

        <TabsContent value="watches" className="mt-6">
          <WatchesPanel
            q={trimmed}
            results={watchesResults}
            isLoading={watchesIsLoading}
            hasError={watchesHasError}
          />
        </TabsContent>

        <TabsContent value="people" className="mt-6">
          <PeoplePanel
            q={trimmed}
            results={peopleResults}
            isLoading={peopleIsLoading}
            hasError={peopleHasError}
            viewerId={viewerId}
            childrenSlot={children}
          />
        </TabsContent>

        <TabsContent value="collections" className="mt-6">
          <CollectionsPanel
            q={trimmed}
            results={collectionsResults}
            isLoading={collectionsIsLoading}
            hasError={collectionsHasError}
          />
        </TabsContent>
      </Tabs>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/* Per-tab panels                                                              */
/* -------------------------------------------------------------------------- */

function PeoplePanel({
  q,
  results,
  isLoading,
  hasError,
  viewerId,
  childrenSlot,
}: {
  q: string
  results: SearchProfileResult[]
  isLoading: boolean
  hasError: boolean
  viewerId: string
  childrenSlot: React.ReactNode
}) {
  if (isLoading) return <SearchResultsSkeleton />
  if (hasError) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3"
      >
        <p className="text-sm text-destructive">
          Couldn&apos;t run search. Try again.
        </p>
      </div>
    )
  }
  if (q.length < CLIENT_MIN_CHARS) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-semibold leading-tight text-foreground">
          Collectors you might like
        </h2>
        {childrenSlot}
      </section>
    )
  }
  if (results.length === 0) {
    return (
      <section className="space-y-4">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold leading-tight text-foreground">
            {`No collectors match "${q}"`}
          </h2>
          <p className="text-sm text-muted-foreground">
            Try someone you&apos;d like to follow
          </p>
        </header>
        {childrenSlot}
      </section>
    )
  }
  return (
    <section className="space-y-2">
      {results.map((r) => (
        <PeopleSearchRow key={r.userId} result={r} q={q} viewerId={viewerId} />
      ))}
    </section>
  )
}

function WatchesPanel({
  q,
  results,
  isLoading,
  hasError,
}: {
  q: string
  results: SearchCatalogWatchResult[]
  isLoading: boolean
  hasError: boolean
}) {
  if (isLoading) return <WatchSearchResultsSkeleton />
  if (hasError) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3"
      >
        <p className="text-sm text-destructive">
          Couldn&apos;t run watch search. Try again.
        </p>
      </div>
    )
  }
  if (q.length < CLIENT_MIN_CHARS) {
    return (
      <section className="space-y-1">
        <h2 className="text-xl font-semibold leading-tight text-foreground">
          Watches
        </h2>
        <p className="text-sm text-muted-foreground">
          Search by brand, model, or reference number
        </p>
      </section>
    )
  }
  if (results.length === 0) {
    return (
      <section className="space-y-1">
        <h2 className="text-xl font-semibold leading-tight text-foreground">
          {`No watches match "${q}"`}
        </h2>
        <p className="text-sm text-muted-foreground">
          Try a brand name like &lsquo;Rolex&rsquo; or a model like
          &lsquo;Submariner&rsquo;
        </p>
      </section>
    )
  }
  return (
    <section className="space-y-2">
      {results.map((r) => (
        <WatchSearchRow key={r.catalogId} result={r} q={q} />
      ))}
      {results.length === 20 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Showing top 20
        </p>
      )}
    </section>
  )
}

function CollectionsPanel({
  q,
  results,
  isLoading,
  hasError,
}: {
  q: string
  results: SearchCollectionResult[]
  isLoading: boolean
  hasError: boolean
}) {
  if (isLoading) return <CollectionSearchResultsSkeleton />
  if (hasError) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3"
      >
        <p className="text-sm text-destructive">
          Couldn&apos;t run collection search. Try again.
        </p>
      </div>
    )
  }
  if (q.length < CLIENT_MIN_CHARS) {
    return (
      <section className="space-y-1">
        <h2 className="text-xl font-semibold leading-tight text-foreground">
          Collections
        </h2>
        <p className="text-sm text-muted-foreground">
          Find collectors by the watches they own or their collection style
        </p>
      </section>
    )
  }
  if (results.length === 0) {
    return (
      <section className="space-y-1">
        <h2 className="text-xl font-semibold leading-tight text-foreground">
          {`No collectors have "${q}" in their collection`}
        </h2>
        <p className="text-sm text-muted-foreground">
          Try a brand like &lsquo;Omega&rsquo; or a style tag like
          &lsquo;tool&rsquo;
        </p>
      </section>
    )
  }
  return (
    <section className="space-y-2">
      {results.map((r) => (
        <CollectionSearchRow key={r.userId} result={r} q={q} />
      ))}
    </section>
  )
}
