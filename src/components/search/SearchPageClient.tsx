'use client'

import { Search, Layers, Watch as WatchIcon } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

import { useSearchState } from '@/components/search/useSearchState'
import { PeopleSearchRow } from '@/components/search/PeopleSearchRow'
import { SearchResultsSkeleton } from '@/components/search/SearchResultsSkeleton'
import { ComingSoonCard } from '@/components/search/ComingSoonCard'
import type { SearchTab } from '@/lib/searchTypes'

interface SearchPageClientProps {
  viewerId: string
  /** SuggestedCollectors Server Component, rendered into pre-query + no-results states (D-29). */
  children: React.ReactNode
}

const CLIENT_MIN_CHARS = 2 // matches D-20 server gate

/**
 * Phase 16 People Search page body (D-29 Client Component).
 *
 * Owns the 4-tab control and the people-search interactive surface; routes the
 * q ↔ URL ↔ fetch trifecta through `useSearchState`. The empty/no-results
 * suggested-collectors block is rendered by the Server Component parent and
 * passed as `children` (D-11, D-10) — keeps the heavy DAL work on the server.
 *
 * Tabs:
 *   - 'all' (default, D-05): mirrors People + 2 compact coming-soon footer
 *     cards for Watches/Collections (D-06)
 *   - 'people': same as All but without footer cards (D-07)
 *   - 'watches' / 'collections': render full-page ComingSoonCard only;
 *     tab gate inside useSearchState ensures searchPeopleAction is NOT
 *     called (SRCH-02)
 *
 * Page-level input (D-25): autofocused on mount (D-02), pre-filled from
 * useSearchState.q (which itself initializes from `?q=` searchParam).
 */
export function SearchPageClient({ viewerId, children }: SearchPageClientProps) {
  const { q, setQ, debouncedQ, tab, setTab, results, isLoading, hasError } =
    useSearchState()

  // D-02 autofocus uses the HTML `autoFocus` attribute below (declarative).
  // The shadcn <Input> wrapper (src/components/ui/input.tsx) is a function
  // component without forwardRef, so an imperative ref-based `.focus()`
  // call would silently no-op. `autoFocus` is forwarded as a plain DOM
  // attribute through the rest spread and works regardless of ref forwarding.

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
            placeholder="Search collectors…"
            aria-label="Search collectors"
            className="w-full bg-muted/50 border-transparent pl-9 rounded-md focus-visible:bg-background h-10 text-base"
          />
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(next) => setTab(next as SearchTab)}
      >
        <TabsList className="w-full">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="watches">Watches</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6 mt-6">
          <PeopleResultsBlock
            q={debouncedQ}
            results={results}
            isLoading={isLoading}
            hasError={hasError}
            viewerId={viewerId}
            childrenSlot={children}
          />
          {/* D-06: All-tab compact coming-soon footer cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            <ComingSoonCard
              icon={WatchIcon}
              heading="Watch search coming soon"
              copy="Search by brand and model once we normalize the watch catalog across collectors."
              variant="compact"
            />
            <ComingSoonCard
              icon={Layers}
              heading="Collection search coming soon"
              copy="Curated collection surfaces are next on the roadmap."
              variant="compact"
            />
          </div>
        </TabsContent>

        <TabsContent value="watches" className="mt-6">
          {/* D-08: Watches tab full-page coming-soon (no fetch fires — tab gate in useSearchState) */}
          <ComingSoonCard
            variant="full"
            icon={WatchIcon}
            heading="Watches search is coming"
            copy="We'll surface watches by brand and model once the catalog is normalized across collectors."
          />
        </TabsContent>

        <TabsContent value="people" className="mt-6">
          {/* D-07: People tab — no compact footer cards */}
          <PeopleResultsBlock
            q={debouncedQ}
            results={results}
            isLoading={isLoading}
            hasError={hasError}
            viewerId={viewerId}
            childrenSlot={children}
          />
        </TabsContent>

        <TabsContent value="collections" className="mt-6">
          {/* D-08: Collections tab full-page coming-soon */}
          <ComingSoonCard
            variant="full"
            icon={Layers}
            heading="Collections is coming"
            copy="A separate product surface that ships after the watch catalog lands."
          />
        </TabsContent>
      </Tabs>
    </main>
  )
}

/**
 * Inner block — same People search visuals across All and People tabs.
 * Distilled here to avoid duplicating the 5-state branch logic (loading,
 * error, pre-query, no-results, results) across two TabsContent panels.
 */
function PeopleResultsBlock({
  q,
  results,
  isLoading,
  hasError,
  viewerId,
  childrenSlot,
}: {
  q: string
  results: ReturnType<typeof useSearchState>['results']
  isLoading: boolean
  hasError: boolean
  viewerId: string
  childrenSlot: React.ReactNode
}) {
  // D-09 loading
  if (isLoading) return <SearchResultsSkeleton />

  if (hasError) {
    return (
      <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
        <p className="text-sm text-destructive">
          Couldn&apos;t run search. Try again.
        </p>
      </div>
    )
  }

  const trimmed = q.trim()

  // D-11 pre-query state — render suggested-collectors children below header
  if (trimmed.length < CLIENT_MIN_CHARS) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-semibold leading-tight text-foreground">
          Collectors you might like
        </h2>
        {childrenSlot}
      </section>
    )
  }

  // D-10 no-results — same children rendered below the recovery copy
  if (results.length === 0) {
    return (
      <section className="space-y-4">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold leading-tight text-foreground">
            {`No collectors match "${trimmed}"`}
          </h2>
          <p className="text-sm text-muted-foreground">
            Try someone you&apos;d like to follow
          </p>
        </header>
        {childrenSlot}
      </section>
    )
  }

  // Results list
  return (
    <section className="space-y-2">
      {results.map((r) => (
        <PeopleSearchRow
          key={r.userId}
          result={r}
          q={trimmed}
          viewerId={viewerId}
        />
      ))}
    </section>
  )
}
