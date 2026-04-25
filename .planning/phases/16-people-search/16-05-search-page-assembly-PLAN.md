---
phase: 16-people-search
plan: 05
type: execute
wave: 3
depends_on:
  - 16-02
  - 16-03
  - 16-04
files_modified:
  - src/components/search/SearchPageClient.tsx
  - src/app/search/page.tsx
  - .planning/phases/16-people-search/16-VERIFICATION.md
autonomous: false
requirements:
  - SRCH-01
  - SRCH-02
  - SRCH-03
  - SRCH-04
  - SRCH-05
  - SRCH-06
  - SRCH-07

must_haves:
  truths:
    - "/search renders 4 tabs: All · Watches · People · Collections (SRCH-01)"
    - "Default tab is 'all' on landing; ?tab= omitted from URL when active (D-05, D-12)"
    - "Watches and Collections tabs render coming-soon UI and never fire searchPeopleAction (SRCH-02)"
    - "All tab pre-query: shows suggested-collectors children + 2 compact coming-soon footer cards (D-06, D-11)"
    - "All tab with results: shows result list + same 2 compact coming-soon footer cards (D-06)"
    - "People tab pre-query: same suggested-collectors header but NO coming-soon footers (D-07)"
    - "No-results state (q.length>=2 + 0 matches) renders 'No collectors match \"{q}\"' + sub-header + suggested-collectors children (D-10)"
    - "Pre-query state on All/People renders 'Collectors you might like' header + suggested-collectors children (D-11)"
    - "Page-level Server Component resolves viewerId via getCurrentUser() and passes <SuggestedCollectors viewerId={user.id} /> as children to <SearchPageClient> (D-29)"
    - "<SearchPageClient> wrapped in <Suspense> at page level so useSearchParams() doesn't cause prerender bailout (Pitfall 4)"
    - "Suggested-collectors empty/no-results render limit = 8 with NO LoadMore button (Open Question 3 resolution)"
    - "EXPLAIN ANALYZE on a representative ILIKE query shows Bitmap Index Scan on profiles_username_trgm_idx (Pitfall C-1)"
    - "16-VERIFICATION.md records EXPLAIN ANALYZE output under '## Pitfall C-1 Evidence' heading"
    - "Plan 01 Task 5 RED tests for SearchPageClient go GREEN"
    - "Full suite GREEN end-of-phase"
  artifacts:
    - path: "src/components/search/SearchPageClient.tsx"
      provides: "Page-level Client Component — tabs, input, results, empty/no-results states, footer cards"
      exports: ["SearchPageClient"]
    - path: "src/app/search/page.tsx"
      provides: "Server Component wrapper — resolves viewerId, renders SuggestedCollectors as children, wraps in Suspense"
    - path: ".planning/phases/16-people-search/16-VERIFICATION.md"
      provides: "EXPLAIN ANALYZE output evidence + UAT sign-off"
      contains: "Bitmap Index Scan"
  key_links:
    - from: "src/app/search/page.tsx"
      to: "src/components/search/SearchPageClient.tsx"
      via: "renders <SearchPageClient viewerId={user.id}><SuggestedCollectors viewerId={user.id} /></SearchPageClient>"
      pattern: "<SearchPageClient"
    - from: "src/components/search/SearchPageClient.tsx"
      to: "src/components/search/useSearchState.ts"
      via: "const { q, setQ, debouncedQ, tab, setTab, results, isLoading, hasError } = useSearchState()"
      pattern: "useSearchState()"
    - from: "src/components/search/SearchPageClient.tsx"
      to: "src/components/search/PeopleSearchRow.tsx"
      via: "results.map(r => <PeopleSearchRow ... />)"
      pattern: "<PeopleSearchRow"
    - from: "src/components/search/SearchPageClient.tsx"
      to: "src/components/search/SearchResultsSkeleton.tsx"
      via: "renders during isLoading"
      pattern: "<SearchResultsSkeleton"
    - from: "src/components/search/SearchPageClient.tsx"
      to: "src/components/search/ComingSoonCard.tsx"
      via: "All-tab footers (compact) + Watches/Collections tab content (full-page)"
      pattern: "<ComingSoonCard"
---

<objective>
Assemble the /search page from the primitives shipped in Plans 02, 03, 04. Land the EXPLAIN ANALYZE manual checkpoint that closes Pitfall C-1 and proves the pg_trgm index is used.

Purpose: This is the final wiring + the production gate. Every locked CONTEXT.md decision (D-01..D-29) must be visible end-user behavior after this plan. The manual checkpoint is the only non-automated step in the phase, recorded in VERIFICATION.md per VALIDATION.md row 16-MANUAL-01.

Output: 2 source files + 1 verification doc. After this plan, all 7 SRCH requirements ship, all Plan 01 RED tests are GREEN, and Phase 16 is ready for `/gsd-verify-work`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/16-people-search/16-CONTEXT.md
@.planning/phases/16-people-search/16-RESEARCH.md
@.planning/phases/16-people-search/16-VALIDATION.md

@src/lib/searchTypes.ts
@src/data/search.ts
@src/app/actions/search.ts
@src/components/search/useSearchState.ts
@src/components/search/HighlightedText.tsx
@src/components/search/PeopleSearchRow.tsx
@src/components/search/SearchResultsSkeleton.tsx
@src/components/search/ComingSoonCard.tsx
@src/components/home/SuggestedCollectors.tsx
@src/data/suggestions.ts
@src/app/explore/page.tsx
@src/lib/auth.ts

<interfaces>
<!-- Everything this assembly plan composes -->

From src/components/search/useSearchState.ts (Plan 03):
```ts
export function useSearchState(): {
  q: string
  setQ: (next: string) => void
  debouncedQ: string
  tab: SearchTab
  setTab: (next: SearchTab) => void
  results: SearchProfileResult[]
  isLoading: boolean
  hasError: boolean
}
```

From src/components/search/PeopleSearchRow.tsx (Plan 03):
```ts
export function PeopleSearchRow(props: { result: SearchProfileResult; q: string; viewerId: string })
```

From src/components/search/SearchResultsSkeleton.tsx (Plan 03):
```ts
export function SearchResultsSkeleton()  // renders 4 skeleton rows
```

From src/components/search/ComingSoonCard.tsx (Plan 03):
```ts
export function ComingSoonCard(props: { icon: LucideIcon; heading: string; copy: string; compact?: boolean })
// compact=true: All-tab footer (small horizontal); compact=false: Watches/Collections full-page
```

From src/components/home/SuggestedCollectors.tsx (existing):
```ts
export async function SuggestedCollectors({ viewerId }: { viewerId: string }): Promise<JSX>
// Server Component — awaits getSuggestedCollectors with default limit 5; renders header + rows + LoadMore
```

From src/data/suggestions.ts:
```ts
export async function getSuggestedCollectors(
  viewerId: string,
  opts?: { limit?: number; cursor?: SuggestionCursor | null },
): Promise<{ collectors: SuggestedCollector[]; nextCursor: SuggestionCursor | null }>
```

From src/components/ui/tabs.tsx (verified shadcn shape):
```tsx
<Tabs value={tab} onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="all">All</TabsTrigger>
    ...
  </TabsList>
  <TabsContent value="all">...</TabsContent>
</Tabs>
```

From src/lib/auth.ts:
```ts
export async function getCurrentUser(): Promise<{ id: string; email: string }>
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create src/components/search/SearchPageClient.tsx</name>
  <files>src/components/search/SearchPageClient.tsx</files>
  <read_first>
    - src/components/search/useSearchState.ts (Plan 03 — public API)
    - src/components/search/PeopleSearchRow.tsx (Plan 03)
    - src/components/search/SearchResultsSkeleton.tsx (Plan 03)
    - src/components/search/ComingSoonCard.tsx (Plan 03)
    - src/components/ui/tabs.tsx (existing primitive)
    - src/components/ui/input.tsx
    - tests/app/search/SearchPageClient.test.tsx (Plan 01 — every assertion must pass)
    - .planning/phases/16-people-search/16-CONTEXT.md (D-02, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-25, D-29)
    - .planning/phases/16-people-search/16-RESEARCH.md Pattern 3 (Server Component child via children prop)
    - .planning/phases/16-people-search/16-RESEARCH.md Open Question 2 (Watches/Collections coming-soon copy guidance)
  </read_first>
  <behavior>
    - Renders 4-tab Tabs control: All · Watches · People · Collections
    - Default tab = 'all' (D-05); active tab and q both come from useSearchState (URL is the source of truth indirectly via the hook)
    - Page-level input: <Input> autofocused on mount (D-02), pre-filled from useSearchState.q, onChange fires setQ
    - Tab content rendering:
      * tab='all' OR tab='people': search-active branch
      * tab='watches': <ComingSoonCard variant="full" icon={WatchIcon} heading="Watches search is on its way" copy="..." />
      * tab='collections': <ComingSoonCard variant="full" icon={Layers} heading="Collections coming soon" copy="..." />
    - Search-active branch (tab='all' or 'people'):
      * isLoading → <SearchResultsSkeleton>
      * hasError → minimal error message
      * debouncedQ.trim().length < 2 → pre-query state: <h2>Collectors you might like</h2> + {children}
      * results.length === 0 (and !isLoading) → no-results: <h2>No collectors match "{debouncedQ}"</h2> + sub-header "Try someone you'd like to follow" + {children}
      * results.length > 0 → result list: results.map(r => <PeopleSearchRow result={r} q={debouncedQ} viewerId={viewerId} />)
    - All-tab only: append two <ComingSoonCard variant="compact" /> footer cards beneath whatever the search-active branch renders (D-06)
    - People tab: NO compact footer cards (D-07)
  </behavior>
  <action>
Create `src/components/search/SearchPageClient.tsx`:

```tsx
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

const CLIENT_MIN_CHARS = 2  // matches D-20 server gate

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
  // component without forwardRef, so an imperative `useRef` + `.focus()`
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
            heading="Watches search is on its way"
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
            heading="Collections coming soon"
            copy="Collections are a separate product surface — coming after the watch catalog lands."
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
            No collectors match &ldquo;{trimmed}&rdquo;
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
```

NOTES:
- Tab gate is enforced inside `useSearchState` (Plan 03) — when tab='watches' or 'collections', the fetch effect short-circuits. Plan 01 Test 4/5 verify this.
- The `children` prop pattern (D-29) means SuggestedCollectors renders server-side; this Client Component just decides WHEN to show it. Pitfall 4 (useSearchParams + Suspense) is handled at the page.tsx level (Task 2).
- `children` is passed verbatim to BOTH the pre-query and no-results states. Both states render the SAME suggested-collectors block — it's the same DAL with the same viewerId, so reuse is correct.
- D-12 URL sync (omit `?tab=all`) is handled inside `useSearchState`. This component just calls `setTab(next as SearchTab)`.
  </action>
  <verify>
    <automated>npm run test -- tests/app/search/SearchPageClient.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/components/search/SearchPageClient.tsx` returns 0
    - `grep -q "'use client'" src/components/search/SearchPageClient.tsx` matches
    - `grep -q 'export function SearchPageClient' src/components/search/SearchPageClient.tsx` matches
    - `grep -q 'useSearchState()' src/components/search/SearchPageClient.tsx` matches
    - `grep -q 'TabsTrigger value="all"' src/components/search/SearchPageClient.tsx` matches (SRCH-01)
    - `grep -q 'TabsTrigger value="watches"' src/components/search/SearchPageClient.tsx` matches
    - `grep -q 'TabsTrigger value="people"' src/components/search/SearchPageClient.tsx` matches
    - `grep -q 'TabsTrigger value="collections"' src/components/search/SearchPageClient.tsx` matches
    - `grep -q 'Collectors you might like' src/components/search/SearchPageClient.tsx` matches (D-11 literal copy)
    - `grep -q 'No collectors match' src/components/search/SearchPageClient.tsx` matches (D-10 literal copy)
    - `grep -q "Try someone you" src/components/search/SearchPageClient.tsx` matches (D-10 sub-header)
    - `grep -q '<SearchResultsSkeleton' src/components/search/SearchPageClient.tsx` matches (D-09)
    - `grep -q 'autoFocus' src/components/search/SearchPageClient.tsx` matches (D-02 declarative autofocus on the page-level input)
    - `! grep -q 'useRef' src/components/search/SearchPageClient.tsx` (no imperative ref-based focus — the shadcn Input wrapper does not forwardRef)
    - `grep -q 'variant="compact"' src/components/search/SearchPageClient.tsx` matches (D-06 footer cards — uses the differentiated testid variant from Plan 03 Task 5)
    - `grep -q 'variant="full"' src/components/search/SearchPageClient.tsx` matches (D-08 Watches/Collections full-page panels)
    - `grep -q '<PeopleSearchRow' src/components/search/SearchPageClient.tsx` matches
    - `npm run test -- tests/app/search/SearchPageClient.test.tsx` exits 0 (Plan 01 Task 5 RED → GREEN)
  </acceptance_criteria>
  <done>SearchPageClient renders all 12 Plan 01 test scenarios correctly.</done>
</task>

<task type="auto">
  <name>Task 2: Replace src/app/search/page.tsx with Server Component wrapper</name>
  <files>src/app/search/page.tsx</files>
  <read_first>
    - src/app/search/page.tsx (current Phase 14 stub — entire body replaced)
    - src/components/search/SearchPageClient.tsx (just created in Task 1)
    - src/components/home/SuggestedCollectors.tsx (existing — used as children)
    - src/data/suggestions.ts (existing DAL)
    - src/lib/auth.ts (getCurrentUser)
    - .planning/phases/16-people-search/16-CONTEXT.md (D-29)
    - .planning/phases/16-people-search/16-RESEARCH.md Pattern 3 (Server Component child via children prop) + Pitfall 4 (Suspense + useSearchParams)
    - .planning/phases/16-people-search/16-RESEARCH.md Open Question 3 (limit 8, no LoadMore — resolution)
  </read_first>
  <behavior>
    - Server Component (no 'use client')
    - Awaits getCurrentUser() to resolve viewerId
    - Renders <SearchPageClient> wrapped in <Suspense> so useSearchParams() inside the Client tree doesn't bailout prerender (Pitfall 4)
    - Passes a SuggestedCollectors Server Component as children to <SearchPageClient> with limit 8 and no LoadMore (Open Question 3)
    - The existing SuggestedCollectors component supports limit override but always renders LoadMore — for /search context, render a custom inline pre-paginated block using getSuggestedCollectors directly (with limit 8) and render rows with SuggestedCollectorRow, NO LoadMoreSuggestionsButton
  </behavior>
  <action>
Replace the entire body of `src/app/search/page.tsx`:

```tsx
import { Suspense } from 'react'

import { getCurrentUser } from '@/lib/auth'
import { getSuggestedCollectors } from '@/data/suggestions'
import { SuggestedCollectorRow } from '@/components/home/SuggestedCollectorRow'
import { SearchPageClient } from '@/components/search/SearchPageClient'

/**
 * Phase 16 /search route (SRCH-01..SRCH-07).
 *
 * Server Component wrapper that:
 *   1. Resolves viewerId via getCurrentUser() (proxy.ts redirects unauth
 *      users to /login before reaching here — auth gate already in place
 *      from Phase 14 D-21/D-22).
 *   2. Renders SuggestedCollectorsForSearch as a Server Component child
 *      passed via the `children` prop into <SearchPageClient> (D-29).
 *      The Client Component decides WHEN to show the children
 *      (pre-query state — D-11; no-results state — D-10).
 *   3. Wraps the Client Component in <Suspense> so useSearchParams() does
 *      not cause prerender bailout (Pitfall 4 — verified in Next 16 docs).
 *
 * Per Open Question 3 in research, the suggested-collectors block on
 * /search renders a fixed limit of 8 with NO LoadMore button — the empty
 * state should feel light, not feed-like. (SuggestedCollectors home
 * component renders limit 5 + LoadMore; we deliberately fork here.)
 */
export default async function SearchPage() {
  const user = await getCurrentUser()
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-3xl px-4 py-8" />}>
      <SearchPageClient viewerId={user.id}>
        {/* D-29 Server Component child — renders inside Client Component's
            pre-query (D-11) and no-results (D-10) states. */}
        <SuggestedCollectorsForSearch viewerId={user.id} />
      </SearchPageClient>
    </Suspense>
  )
}

/**
 * Server Component variant of SuggestedCollectors specifically for /search:
 *   - Fixed limit of 8 (vs home's 5 + LoadMore — Open Question 3 resolution)
 *   - NO LoadMoreSuggestionsButton (Open Question 3)
 *   - Same DAL (getSuggestedCollectors) so the home and search empty states
 *     stay visually consistent
 */
async function SuggestedCollectorsForSearch({ viewerId }: { viewerId: string }) {
  const { collectors } = await getSuggestedCollectors(viewerId, { limit: 8 })

  if (collectors.length === 0) {
    return (
      <div className="py-8 text-center space-y-2">
        <p className="text-base font-semibold">
          You&apos;re already following everyone we can suggest
        </p>
        <p className="text-sm text-muted-foreground">
          Check back as more collectors join.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {collectors.map((c) => (
        <SuggestedCollectorRow key={c.userId} collector={c} viewerId={viewerId} />
      ))}
    </div>
  )
}
```

NOTES:
- The route does NOT add `'use cache'` — `/search` is dynamic interactive (RESEARCH.md §Anti-Patterns).
- `proxy.ts` (Phase 14 D-21) redirects unauthenticated users to `/login` before this page renders — `getCurrentUser()` is safe to call without try/catch here. (If session expires mid-session, the `getCurrentUser` UnauthorizedError will surface as a Next.js error boundary; current pattern matches `/notifications` route from Phase 13.)
- `SuggestedCollectorsForSearch` is intentionally local to this file — it diverges from the home `SuggestedCollectors` component only in the limit and LoadMore omission. Lifting it to a shared module is premature (single caller).
  </action>
  <verify>
    <automated>npm run test 2&gt;&amp;1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - `! grep -q "Search is coming" src/app/search/page.tsx` (Phase 14 stub copy gone)
    - `grep -q '<Suspense' src/app/search/page.tsx` matches (Pitfall 4)
    - `grep -q '<SearchPageClient' src/app/search/page.tsx` matches
    - `grep -q 'getCurrentUser' src/app/search/page.tsx` matches
    - `grep -q 'getSuggestedCollectors' src/app/search/page.tsx` matches
    - `grep -qE "limit:\\s*8" src/app/search/page.tsx` matches (Open Question 3 — fixed count of 8)
    - `! grep -q 'LoadMoreSuggestionsButton' src/app/search/page.tsx` (Open Question 3 — no LoadMore on search)
    - `! grep -q "'use cache'" src/app/search/page.tsx` (anti-pattern check)
    - `npm run test` exits 0 (full suite GREEN — SRCH-01..SRCH-07 covered)
    - `npx tsc --noEmit` exits 0
    - `npm run lint` exits 0
  </acceptance_criteria>
  <done>/search route renders the production People search experience; suggested-collectors block fixed at 8 with no LoadMore.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3 [MANUAL]: EXPLAIN ANALYZE pg_trgm verification + UAT smoke</name>
  <files>.planning/phases/16-people-search/16-VERIFICATION.md</files>
  <read_first>
    - .planning/phases/16-people-search/16-VALIDATION.md (Manual-Only Verifications table — exact psql command)
    - .planning/phases/16-people-search/16-RESEARCH.md Pitfall 1 (pg_trgm Bitmap Index Scan expectation)
    - .planning/phases/16-people-search/16-CONTEXT.md (D-25 two-search-input architecture for UAT step 2)
  </read_first>
  <what-built>
Phase 16 People Search shipped end-to-end:
- searchProfiles DAL with two-layer privacy + compound predicate + batched isFollowing (Plan 02)
- useSearchState hook + HighlightedText + PeopleSearchRow + SearchResultsSkeleton + ComingSoonCard (Plan 03)
- DesktopTopNav restyle + HeaderNav deletion (Plan 04)
- /search page assembly with 4 tabs, Suspense wrap, server-rendered suggested-collectors children (Tasks 1-2 of this plan)

Two manual verifications remain before declaring Phase 16 complete: the pg_trgm EXPLAIN ANALYZE checkpoint (Pitfall C-1) and a visual + behavioral smoke test of the nav restyle and two-input architecture (D-24, D-25).
  </what-built>
  <how-to-verify>
**Step 1 — pg_trgm EXPLAIN ANALYZE checkpoint (Pitfall C-1, VALIDATION.md row 16-MANUAL-01):**

1. Ensure local Supabase is running: `supabase status` shows DB at `localhost:54322`. If not: `supabase start`.
2. Open psql:
   ```bash
   psql "postgresql://postgres:postgres@localhost:54322/postgres"
   ```
3. Seed at least 5 public profiles (if local DB is empty) so the planner has enough rows to consider the index. If you already have seed data, skip this step. Quick seed:
   ```sql
   -- Only if needed; skip if profiles table already has rows
   INSERT INTO profiles (id, username, display_name, bio) VALUES
     (gen_random_uuid(), 'alice', 'Alice', 'Loves vintage chronographs'),
     (gen_random_uuid(), 'bob', 'Bob', 'Dive watches forever'),
     (gen_random_uuid(), 'liam', 'Liam', 'Above all else, dress watches'),
     (gen_random_uuid(), 'maya', 'Maya', 'Field watches for hiking'),
     (gen_random_uuid(), 'noah', 'Noah', 'Mid-century modern brutalism');
   ```
4. Run the username ILIKE EXPLAIN:
   ```sql
   EXPLAIN ANALYZE SELECT id FROM profiles WHERE username ILIKE '%bo%';
   ```
5. **Expected:** Output contains `Bitmap Index Scan on profiles_username_trgm_idx` (or whatever the GIN trigram index name is — `\d+ profiles` confirms). MUST NOT contain `Seq Scan on profiles`.
6. Run the bio ILIKE EXPLAIN:
   ```sql
   EXPLAIN ANALYZE SELECT id FROM profiles WHERE bio ILIKE '%bob%';
   ```
7. **Expected:** Output contains `Bitmap Index Scan on profiles_bio_trgm_idx` (or equivalent).
8. **If Seq Scan appears:** the GIN trigram index is either missing or not being chosen — STOP and investigate (could indicate a Phase 11 migration regression or insufficient row count for the planner to prefer the index).

**Step 2 — Paste evidence into VERIFICATION.md:**

Create `.planning/phases/16-people-search/16-VERIFICATION.md` with this content:

```md
# Phase 16 Verification

## Pitfall C-1 Evidence — pg_trgm Bitmap Index Scan

Captured: {YYYY-MM-DD HH:MM}
Database: local Supabase ({version})

### Username ILIKE
Command: `EXPLAIN ANALYZE SELECT id FROM profiles WHERE username ILIKE '%bo%';`

```
{paste full EXPLAIN ANALYZE output here — should include line "Bitmap Index Scan on profiles_username_trgm_idx"}
```

### Bio ILIKE
Command: `EXPLAIN ANALYZE SELECT id FROM profiles WHERE bio ILIKE '%bob%';`

```
{paste full EXPLAIN ANALYZE output here — should include line "Bitmap Index Scan on profiles_bio_trgm_idx"}
```

**Verdict:** ☐ GREEN — both queries use Bitmap Index Scan / ☐ RED — at least one falls back to Seq Scan (file blocker)

## Visual + Behavioral UAT (D-24 + D-25)

Captured: {YYYY-MM-DD HH:MM}

### Nav search input restyle (D-24)
1. `npm run dev` (development server up)
2. Open `http://localhost:3000/` in desktop viewport (≥768px), authenticated
3. Confirm:
   - ☐ Persistent nav search input has muted-fill background
   - ☐ Leading lucide Search icon visible inside the input on the left
   - ☐ Input width feels balanced — does not dominate the strip, does not look cramped
   - ☐ HeaderNav inline links (Collection / Profile / Settings) are GONE from the left cluster — only logo + Explore visible
   - ☐ Profile + Settings still reachable via UserMenu dropdown (right side)
4. Type "bob" in nav input and press Enter
5. Confirm: page navigates to `/search?q=bob` and the page-level input is pre-filled with "bob"
6. Confirm: results render after the 250ms debounce

### Two-input architecture (D-25)
1. From `/`, type "bob" in nav input + press Enter → arrive at `/search?q=bob` with results
2. From `/search`, type a new query (e.g., "alice") into the NAV input + press Enter
3. Confirm: URL updates to `/search?q=alice` and the page-level results update
4. Confirm: NO layout shift in the nav input across these transitions

### Phase 16 acceptance signals
- ☐ `npm run test` GREEN (full suite)
- ☐ `npm run lint` GREEN
- ☐ `npx tsc --noEmit` GREEN
- ☐ Pitfall C-1 EXPLAIN ANALYZE evidence pasted above
- ☐ All 7 SRCH requirements (SRCH-01..SRCH-07) ship live behavior

**Verdict:** ☐ APPROVED — Phase 16 ships / ☐ BLOCKED — list issues:
```
{enumerate any issues}
```
```

Replace each `{...}` placeholder with actual values; check each ☐ box.

**Step 3 — Resume signal:** type "approved" once both EXPLAIN ANALYZE checkpoints are GREEN and the visual UAT checks all pass; or describe issues blocking acceptance.
  </how-to-verify>
  <resume-signal>Type "approved" or describe blocking issues</resume-signal>
  <action>Manual checkpoint — see &lt;how-to-verify&gt; above for the full psql + UAT runbook. The executor runs the EXPLAIN ANALYZE commands locally, pastes output into 16-VERIFICATION.md, performs the visual + behavioral smoke test, and types the resume signal.</action>
  <verify>
    <automated>test -f .planning/phases/16-people-search/16-VERIFICATION.md &amp;&amp; grep -q 'Bitmap Index Scan' .planning/phases/16-people-search/16-VERIFICATION.md &amp;&amp; grep -q 'APPROVED' .planning/phases/16-people-search/16-VERIFICATION.md</automated>
  </verify>
  <done>16-VERIFICATION.md exists with EXPLAIN ANALYZE evidence (Bitmap Index Scan on both username + bio trigram indexes) and UAT verdict APPROVED. User has typed "approved" or resolved any blocking issues.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Page Server Component → Client Component | viewerId resolved via getCurrentUser() server-side; flows into Client Component as a prop (not derived client-side). |
| Suspense boundary | Client Component (uses useSearchParams) is wrapped in Suspense so prerender doesn't bail (Pitfall 4). |
| children prop (Server → Client) | SuggestedCollectorsForSearch is a Server Component; it's rendered server-side and passed as React node tree to the Client Component, which decides when to display it. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-16-03 | Information Disclosure (privacy leak via private profile in suggested-collectors fallback) | src/app/search/page.tsx → getSuggestedCollectors | mitigate | getSuggestedCollectors enforces `eq(profileSettings.profilePublic, true)` (verified in src/data/suggestions.ts L98-103). Same two-layer privacy as the search query. |
| T-16-04 | DoS (page-level autofocus triggers fetch storm via accidental re-render) | src/components/search/SearchPageClient.tsx | mitigate | autofocus is a one-shot useEffect with empty deps array; cannot retrigger. fetch effect is debounced 250ms in useSearchState. |
| T-16-08 | Tampering (CSRF on Server Action invoked from this page) | src/components/search/SearchPageClient.tsx → searchPeopleAction | mitigate | Built-in Next.js 16 origin-header CSRF protection on all Server Actions (verified RESEARCH.md). |
| T-16-render | Information Disclosure (prerender bailout exposes server data via leaked render shell) | src/app/search/page.tsx | mitigate | <Suspense> wraps the Client Component per Pitfall 4. Prerender produces only the fallback `<div />` placeholder; the dynamic Client subtree streams in. No data leakage in static HTML. |
| T-16-MANUAL-01 | Performance (Seq Scan instead of Bitmap Index Scan — DoS at scale) | Pitfall C-1 manual checkpoint | mitigate | Manual EXPLAIN ANALYZE in Task 3 produces evidence in 16-VERIFICATION.md before phase ships. Block on Seq Scan. |
</threat_model>

<verification>
End-of-phase checklist:

1. `npm run test` — full suite GREEN. Phase 16 added 5 new test files; all GREEN end-of-phase.
2. `npm run lint` — exits 0
3. `npx tsc --noEmit` — exits 0
4. Manual EXPLAIN ANALYZE evidence pasted into 16-VERIFICATION.md showing Bitmap Index Scan on both username and bio trigram indexes (Pitfall C-1)
5. Visual UAT in 16-VERIFICATION.md confirms D-23 (no HeaderNav links) + D-24 (nav search restyle) + D-25 (two-input architecture)
6. All 7 SRCH requirements (SRCH-01..SRCH-07) demonstrably live in the running app
</verification>

<success_criteria>
Plan 05 succeeds when:
- /search renders the production People search experience
- All Plan 01 RED tests are GREEN
- 16-VERIFICATION.md exists with EXPLAIN ANALYZE evidence + UAT sign-off
- User has typed "approved" on the manual checkpoint
- No regressions in pre-Phase 16 test files
- Single commit per task: `feat(16): SearchPageClient assembly + 4-tab control`, `feat(16): /search Server Component wrapper with Suspense + SuggestedCollectorsForSearch`
</success_criteria>

<output>
After completion, create `.planning/phases/16-people-search/16-05-SUMMARY.md` recording:
- 2 source files created/replaced (paths + line counts)
- 16-VERIFICATION.md content snapshot (EXPLAIN ANALYZE excerpt + UAT verdict)
- Plan 01 Task 5 RED → GREEN snapshot for tests/app/search/SearchPageClient.test.tsx
- End-of-phase test counts (full suite delta)
- Any UAT issues observed during the manual checkpoint
- Note that Phase 16 is ready for `/gsd-verify-work`
</output>
