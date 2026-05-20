'use client'

import { useState } from 'react'
import { Search, SlidersHorizontalIcon } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Chip } from '@/components/ui/chip'

import { useSearchState } from '@/components/search/useSearchState'
import { FilterDrawer } from '@/components/search/FilterDrawer'
import { PeopleSearchRow } from '@/components/search/PeopleSearchRow'
import { SearchResultsSkeleton } from '@/components/search/SearchResultsSkeleton'
import { WatchSearchResultsSkeleton } from '@/components/search/WatchSearchResultsSkeleton'
import { WatchSearchRowsAccordion } from '@/components/search/WatchSearchRowsAccordion'
import { CollectionSearchRow } from '@/components/search/CollectionSearchRow'
import { CollectionSearchResultsSkeleton } from '@/components/search/CollectionSearchResultsSkeleton'
import { AllTabResults } from '@/components/search/AllTabResults'
import type {
  SearchCatalogWatchResult,
  SearchCollectionResult,
  SearchProfileResult,
  SearchTab,
} from '@/lib/searchTypes'
// Phase 49.1 D-SCOPE-01d — the editorial header lookup and PrimaryArchetype
// type import are no longer needed at this surface; archetype editorial header
// + archetype/genre removable chips removed.

interface SearchPageClientProps {
  viewerId: string
  /** Plan 20 D-06: viewer collection length used as cache-invalidation key for verdict cache. */
  collectionRevision: number
  /** Phase 28 D-02 / UX-09: viewer's profile username for the inline Wishlist
   *  commit toast destination. Threaded down to every WatchSearchRowsAccordion
   *  mount (direct + via AllTabResults). Null is a soft alarm — toast still
   *  fires but the View action slot is omitted. */
  viewerUsername: string | null
  /** SuggestedCollectors Server Component, rendered into pre-query + no-results states (D-29 carry-forward). */
  children: React.ReactNode
  /** Phase 40 D-06 — top-8 style tags by frequency; threaded from /search Server Component. */
  styleVocab: string[]
  /** FU-01 (260519-ga9) — brand-facet { slug, name } list for the Filter drawer BrandChips control. */
  brandVocab: { slug: string; name: string }[]
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
export function SearchPageClient({ viewerId, collectionRevision, viewerUsername, children, styleVocab, brandVocab }: SearchPageClientProps) {
  const {
    q,
    setQ,
    debouncedQ,
    tab,
    setTab,
    movement,
    setMovement,
    size,
    setSize,
    styleArr,
    setStyleArr,
    brand,
    setBrand,
    era,
    setEra,
    // Phase 49.1 D-SCOPE-01d — archetype/genre are NO LONGER consumed by this
    // surface (no editorial header, no removable chips, no activeCount inclusion).
    // They remain on the useSearchState hook to keep parity with the FilterDrawer
    // sibling whose genre/archetype chip groups are removed in Plan 05.
    genre,
    setGenre,
    archetype,
    setArchetype,
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
  const [sheetOpen, setSheetOpen] = useState(false)
  // D-09: style chips count individually (style=tool,diver adds 2 to badge).
  // Phase 49.1 D-SCOPE-01d — genre/archetype dropped from the count.
  const activeCount = (movement ? 1 : 0) + (size ? 1 : 0) + styleArr.length
    + (brand ? 1 : 0) + (era ? 1 : 0)

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
            collectionRevision={collectionRevision}
            viewerUsername={viewerUsername}
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
          {/* D-09: Filter button inline above results; scrolls with page (not sticky) */}
          <div className="flex items-center gap-2 py-3">
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 gap-1.5"
              onClick={() => setSheetOpen(true)}
              aria-expanded={sheetOpen}
            >
              <SlidersHorizontalIcon className="size-3.5" aria-hidden />
              {activeCount > 0 ? `Filter (${activeCount})` : 'Filter'}
            </Button>
          </div>
          <WatchesPanel
            q={trimmed}
            results={watchesResults}
            isLoading={watchesIsLoading}
            hasError={watchesHasError}
            collectionRevision={collectionRevision}
            viewerUsername={viewerUsername}
            hasActiveFacet={activeCount > 0}
            brand={brand}
            era={era}
            onClearBrand={() => setBrand(null)}
            onClearEra={() => setEra(null)}
          />
          <FilterDrawer
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            movement={movement}
            size={size}
            styleArr={styleArr}
            onMovementChange={setMovement}
            onSizeChange={setSize}
            onStyleChange={setStyleArr}
            styleVocab={styleVocab}
            brand={brand}
            era={era}
            genre={genre}
            archetype={archetype}
            onBrandChange={setBrand}
            onEraChange={setEra}
            onGenreChange={setGenre}
            onArchetypeChange={setArchetype}
            brandVocab={brandVocab}
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

/** Display map for era facet chip labels (D-12). */
const ERA_DISPLAY_LABELS: Record<string, string> = {
  'vintage-leaning': 'Vintage Leaning',
  'modern': 'Modern',
  'contemporary': 'Contemporary',
}

function WatchesPanel({
  q,
  results,
  isLoading,
  hasError,
  collectionRevision,
  viewerUsername,
  hasActiveFacet,
  brand = null,
  era = null,
  onClearBrand,
  onClearEra,
}: {
  q: string
  results: SearchCatalogWatchResult[]
  isLoading: boolean
  hasError: boolean
  collectionRevision: number
  viewerUsername: string | null
  hasActiveFacet: boolean
  // Phase 49.1 D-SCOPE-01d — archetype and genre props removed at this surface.
  brand?: string | null
  era?: string | null
  // WR-03: required (not optional). WatchesPanel is an internal component used
  // in exactly one place (SearchPageClient.tsx) and there is no semantic case
  // for omitting a clear handler when the corresponding facet may be active —
  // doing so would render a removable chip whose dismiss affordance does nothing.
  // Pairs with chip.tsx WR-02 (discriminated union making `onClick` required on
  // `variant="removable"`) to catch the foot-gun at compile time at any future
  // call site or refactor.
  onClearBrand: () => void
  onClearEra: () => void
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
  // D-01: pre-query state (q empty AND no facets active) — show existing pre-query copy
  if (q.length < CLIENT_MIN_CHARS && !hasActiveFacet) {
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

  // Phase 49.1 D-SCOPE-01d — archetype editorial header + archetype/genre
  // removable chips deleted. Inline removable facet chips now cover brand/era only.
  const hasInlineFacets = !!(brand || era)

  // D-01: browse-mode empty state (q empty AND facets active AND 0 results)
  if (q.length < CLIENT_MIN_CHARS && hasActiveFacet && results.length === 0) {
    return (
      <>
        {hasInlineFacets && (
          <div className="flex flex-wrap gap-2 mb-4">
            {brand && (
              <Chip
                variant="removable"
                onClick={onClearBrand}
                removeLabel={`Remove ${brand} filter`}
              >
                {brand.charAt(0).toUpperCase() + brand.slice(1)}
              </Chip>
            )}
            {era && (
              <Chip
                variant="removable"
                onClick={onClearEra}
                removeLabel={`Remove ${ERA_DISPLAY_LABELS[era] ?? era} filter`}
              >
                {ERA_DISPLAY_LABELS[era] ?? era}
              </Chip>
            )}
          </div>
        )}
        <section className="space-y-1">
          <h2 className="text-xl font-semibold leading-tight text-foreground">
            No watches match these filters.
          </h2>
          <p className="text-sm text-muted-foreground">Try removing one.</p>
        </section>
      </>
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
      {/* Phase 49.1 D-SCOPE-01d — archetype editorial header deleted.
          Phase 46 D-10: Inline removable facet chips above results (brand/era only post-49.1). */}
      {hasInlineFacets && (
        <div className="flex flex-wrap gap-2 mb-4">
          {brand && (
            <Chip
              variant="removable"
              onClick={onClearBrand}
              removeLabel={`Remove ${brand} filter`}
            >
              {brand.charAt(0).toUpperCase() + brand.slice(1)}
            </Chip>
          )}
          {era && (
            <Chip
              variant="removable"
              onClick={onClearEra}
              removeLabel={`Remove ${ERA_DISPLAY_LABELS[era] ?? era} filter`}
            >
              {ERA_DISPLAY_LABELS[era] ?? era}
            </Chip>
          )}
        </div>
      )}
      {/* FIT-04 D-05/D-06: Accordion shell with lazy Server Action + verdict cache */}
      <WatchSearchRowsAccordion
        results={results}
        q={q}
        collectionRevision={collectionRevision}
        viewerUsername={viewerUsername}
      />
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
