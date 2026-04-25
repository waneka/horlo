# Phase 16: People Search - Research

**Researched:** 2026-04-25
**Domain:** Live debounced people search on Postgres `pg_trgm` ILIKE, served from a Next.js 16 Cache-Components-enabled App Router Client Component, layered onto a viewer-aware DAL with two-layer privacy.
**Confidence:** HIGH

## Summary

Phase 16 is a thin "rendering + interaction" phase on top of infrastructure that is already in place. The hard parts shipped in earlier phases:

1. `pg_trgm` extension + GIN trigram indexes on `profiles.username` and `profiles.bio` are LIVE in prod (Phase 11, migration `20260423000003_phase11_pg_trgm.sql`). [VERIFIED: codebase]
2. Two-layer privacy pattern (`WHERE profile_public = true` + RLS) is the established convention. `getSuggestedCollectors` already uses the exact shape `searchProfiles` needs. [VERIFIED: src/data/suggestions.ts]
3. `computeTasteOverlap` is a pure server-safe function ready for per-row scoring. [VERIFIED: src/lib/tasteOverlap.ts]
4. `SuggestedCollectorRow` is the canonical visual pattern; `FollowButton variant="inline"` is drop-in. [VERIFIED: src/components/home/SuggestedCollectorRow.tsx]
5. Shadcn `Tabs` primitive (base-ui based) is already installed at `src/components/ui/tabs.tsx`. NO `shadcn add tabs` is needed. [VERIFIED: codebase]
6. Drizzle `ilike()` exists with the expected `(column, value)` signature. [VERIFIED: drizzle-orm conditions.d.ts:364]
7. `router.replace(href, { scroll: false })` is documented and stable in Next 16. [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md]

**The novel work** in this phase: a single `useSearchState` hook (q + debouncedQ + AbortController + URL sync), a `searchProfiles` DAL function that mirrors `getSuggestedCollectors`'s shape, a 4-tab `/search` page, match-highlighting via React-node array splitting (no `dangerouslySetInnerHTML`), and a desktop nav cleanup (delete `HeaderNav`, restyle the search input shell).

**Primary recommendation:** Build `searchProfiles` as a `'use server'` Server Action that calls a `'server-only'` DAL function. The Client Component on `/search` invokes the Server Action via `await action({ q, signal })` inside a `useTransition`-wrapped effect with AbortController. This matches the precedent of `loadMoreSuggestions` byte-for-byte and avoids a route handler (no `app/api/search/route.ts` file).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Search interaction model (SRCH-01, SRCH-03, SRCH-04)**
- D-01: Persistent desktop nav search input is submit-only. Type → Enter routes to `/search?q={encoded}`. No live dropdown, no typeahead panel, no inline preview.
- D-02: `/search` pre-populates and immediately fires when arriving with `?q=foo`. The page-level input is autofocused and pre-filled; `useEffect` triggers the initial query at mount when `q.length >= 2`.
- D-03: Stale-fetch protection via AbortController + 250ms debounce. Each new keystroke (after debounce) aborts the prior in-flight fetch. Implement once in the page-level `useSearchQuery` hook.
- D-04: URL syncs via `router.replace()` on every debounced fire. Single history entry regardless of keystroke count.

**`/search` page structure (SRCH-01, SRCH-02, SRCH-06, SRCH-07)**
- D-05: Default landing tab = `All`. Opening `/search` with no `?tab=` selects the All tab; the `tab=` param is omitted from the URL when All is active.
- D-06: All tab content = "mirror People + coming-soon footers". Pre-query: `Collectors you might like` section + two compact coming-soon cards beneath. With query: People search results + same two compact coming-soon footer cards.
- D-07: People tab = same People surface as All, minus the coming-soon footers. Pre-query and no-results states are identical to All.
- D-08: Watches and Collections tabs render coming-soon empty states only. No query fires when these tabs are active. Reuse the visual pattern of the Phase 14 `/explore` placeholder.
- D-09: Loading state = 3–5 skeleton rows that match the result-row visual footprint.
- D-10: No-results state when `q.length >= 2` returns 0 People matches: header `No collectors match "{q}"` + sub-header `Try someone you'd like to follow` + suggested-collector rows below.
- D-11: Pre-query state on People + All tabs = `Collectors you might like` section header + suggested-collector rows.
- D-12: Tab state in URL via `?tab=people` query string. Default tab (`all`) omitted from URL when active.

**Result row design (SRCH-04, SRCH-05)**
- D-13: Reuse `SuggestedCollectorRow` visual pattern as the canonical result row. Layout left → right: 40px avatar · primary line `name` (bold) + secondary line `X% taste overlap` · 1-line bio snippet · mini-thumb cluster of up to 3 shared watches with `{N} shared` count · inline `FollowButton variant="inline"`.
- D-14: Bio snippet = `line-clamp-1` with ellipsis.
- D-15: Match highlighting via bolded substring in both the username and the bio snippet.
- D-16: Taste overlap % rendering = identical to `SuggestedCollectorRow`. Use `computeTasteOverlap` to derive the bucket label, then map to numeric (0.85 / 0.55 / 0.20), display as `{Math.round(overlap * 100)}% taste overlap`.
- D-17: Mini-thumb cluster preserved. Up to 3 shared watches as overlapping circles with `{N} shared` counter. Hidden on mobile (`hidden sm:flex`).

**Privacy gate (SRCH-04)**
- D-18: `searchProfiles` DAL filters `WHERE profile_public = true` at the query layer. Two-layer with the existing RLS gate.

**`searchProfiles` DAL contract (SRCH-04, SRCH-08)**
- D-19: `searchProfiles({ q, viewerId, limit = 20, signal? }): Promise<SearchProfileResult[]>` lives in `src/data/profiles.ts` (or new `src/data/search.ts`). Returns the row payload INCLUDING `isFollowing: boolean` per result via batched `inArray(follows.followingId, resultIds)` lookup.
- D-20: Server-side 2-character minimum enforced inside the DAL with an early return `if (q.trim().length < 2) return []`.
- D-21: Bio-search ILIKE only fires when `q.length >= 3`. Compound predicate: `WHERE profile_public AND (username ILIKE %q% OR (LENGTH(q) >= 3 AND bio ILIKE %q%))`.
- D-22: Order by taste overlap DESC, username ASC, LIMIT 20. Compute taste overlap per row using `computeTasteOverlap` server-side. LIMIT applied at the query (`limit(20)`); ordering applied after the JS overlap computation.

**Desktop top nav cleanup (NAV-07 carry-over polish)**
- D-23: Delete `HeaderNav` from `DesktopTopNav.tsx` entirely. Remove the import, remove the `<HeaderNav username={username} />` render, delete `src/components/layout/HeaderNav.tsx` itself. Grep for `from '@/components/layout/HeaderNav'` and confirm zero remaining references before deletion.
- D-24: Persistent nav search input visual restyle — muted fill background (`bg-muted/50` or equivalent), leading magnifier icon (`Search` from `lucide-react`), widen from `max-w-xs` to `max-w-md` to `max-w-lg` range, round corners to `rounded-md`. Keep `name="q"`, `type="search"`, `aria-label="Search"`, and the existing `handleSearchSubmit` handler — behavior is unchanged.
- D-25: Two separate search inputs by design. Nav input is the dumb launcher (D-01 submit-only). The `/search` page mounts its OWN larger input that owns the live debounce + AbortController + URL sync.
- D-26: Wear button + Add icon + Bell + UserMenu trigger unchanged.
- D-27: Spacing/balance is Claude's discretion. Anchor on existing tokens (`gap-4`, `gap-6`, `gap-8`).

**Active-query and tab-state hook architecture**
- D-28: Single `useSearchState` hook (Client Component) owns `q`, `debouncedQ`, `tab`, URL sync side effect (`router.replace()`), Fetch effect with AbortController + cleanup, Result + loading + error state, Public API: `{ q, setQ, debouncedQ, tab, setTab, results, isLoading, hasError, isFollowingMap }`. Implement in `src/components/search/useSearchState.ts`.
- D-29: Page-level `/search` is a Client Component (`'use client'`). Suggested-collector rendering inside the empty/no-results states reads from a Server Component child (passed in as a prop or rendered as `children` from the route's Server Component wrapper).

### Claude's Discretion
- Exact pixel/Tailwind values for the nav search input (D-24): width, fill opacity, magnifier icon size, rounded radius.
- Exact copy for the All-tab coming-soon footer cards (D-06).
- Exact copy for `/search` Watches + Collections coming-soon tab states (D-08).
- The `useSearchState` hook's exact return shape (D-28) — any equivalent shape is fine.
- Whether match-highlighting (D-15) uses `<mark>`, `<strong>`, or a custom span with `font-semibold`.
- Whether the suggested-collector list during pre-query/no-results uses keyset pagination or fixed count. Default to fixed count.
- Whether `searchProfiles` lives in `src/data/profiles.ts` or a new `src/data/search.ts` file (D-19).

### Deferred Ideas (OUT OF SCOPE)
- Canonical watch DB / cross-user watch identity — blocking Watches search tab (SRCH-FUT-01) and Collections search tab (SRCH-FUT-02).
- Live dropdown panel under the persistent nav input — explicitly rejected.
- Recent searches / search history — out of scope (SRCH-FUT-03).
- Trigram similarity scoring beyond ILIKE — out of scope.
- Mobile SlimTopNav restyle — Phase 16 explicitly leaves SlimTopNav untouched.
- Global accent palette flip from warm-gold to Figma teal — deferred.
- `useSearchState` hook generalization — premature this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRCH-01 | `/search` route exists with 4 result tabs: All · Watches · People · Collections | Tabs primitive `src/components/ui/tabs.tsx` exists (base-ui); current `src/app/search/page.tsx` is a Phase 14 stub to replace. See §Architecture Patterns. |
| SRCH-02 | Watches and Collections tabs show "coming soon" empty state with no query firing | `useSearchState` hook gates fetch on `tab === 'all' \|\| tab === 'people'` only. See §Architecture Patterns "Tab-gated fetch". |
| SRCH-03 | Search input is live-debounced (250ms) and fires after a 2-character minimum | Custom `useDebounce`-style timer inside `useSearchState`; AbortController + cleanup pattern from Next 16 useRouter docs. See §Code Examples "useSearchState". |
| SRCH-04 | People results query `profiles.username` and `profiles.bio` with `pg_trgm` ILIKE; ordered by taste overlap % desc, then username asc; LIMIT 20 | Drizzle `ilike()` from `drizzle-orm`; `computeTasteOverlap` server-safe; mirror `getSuggestedCollectors` structure. See §Code Examples "searchProfiles DAL". |
| SRCH-05 | Result rows show username · bio snippet · taste overlap % · inline FollowButton | `SuggestedCollectorRow` is the visual template; extend with optional `bioSnippet` slot or fork as `PeopleSearchRow`. See §Architecture Patterns "Result row composition". |
| SRCH-06 | "No results" state shows suggested collectors (reuses Phase 10 `getCollectorsLikeUser` DAL) | DAL is `getSuggestedCollectors` (alias note: REQUIREMENTS calls it `getCollectorsLikeUser`). Render Server Component child via `children` prop on the Client Component. See §Architecture Patterns "Empty state Server Component child". |
| SRCH-07 | Empty state (before query) shows suggested collectors as a discovery surface | Same DAL as SRCH-06; `q.trim().length < 2` triggers the suggested-collectors render path. |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

| Directive | Source | Implication for Phase 16 |
|-----------|--------|--------------------------|
| Next.js 16 has breaking changes from training data — read `node_modules/next/dist/docs/` before writing code | AGENTS.md | All Next-related claims in this research are verified against `node_modules/next/dist/docs/01-app/`. `searchParams` is `Promise<…>`, `router.replace()` accepts `{ scroll: false }`, `useSearchParams()` requires `<Suspense>` wrap. |
| Continue with Next.js 16 framework, no rewrites | CLAUDE.md tech stack | Build on existing patterns; do not introduce a new routing/rendering paradigm. |
| Watch and UserPreferences types are established — extend, don't break | CLAUDE.md data model | `searchProfiles` returns a NEW type (`SearchProfileResult`), does not modify `Watch` / `UserPreferences`. |
| Multi-user data isolation must remain correct | CLAUDE.md project | `searchProfiles` MUST take `viewerId` as explicit parameter (D-19/D-25) — never derive inside the DAL. Two-layer privacy (`WHERE profile_public` + RLS). |
| Performance target <500 watches per user | CLAUDE.md | `computeTasteOverlap` runs per-result row at LIMIT 20 — even at the worst case of every result having 500 watches each, JS Map intersection is sub-millisecond. Acceptable. |
| GSD workflow enforcement: only Edit/Write inside a GSD command | CLAUDE.md | Phase 16 changes must come through `/gsd-execute-phase 16`. |
| All source files use TypeScript 5 strict mode | CLAUDE.md | New `SearchProfileResult` type must satisfy strict null checks; signal parameter must be `AbortSignal \| undefined`. |
| Absolute imports via `@/*` | CLAUDE.md | New imports use `@/data/...`, `@/components/search/...`, `@/lib/...`. |
| Functions camelCase, types PascalCase, files PascalCase.tsx for components / camelCase.ts for non-components | CLAUDE.md | `searchProfiles` (camelCase), `SearchProfileResult` (PascalCase), `useSearchState.ts` (camelCase), `PeopleSearchRow.tsx` (PascalCase). |
| Use `cn()` for class composition; no CSS modules | CLAUDE.md | All new components compose via Tailwind utility classes + `cn()`. |
| Server Components by default; `'use client'` only when needed | CLAUDE.md | The `/search` page body is a Client Component (`'use client'`); the suggested-collectors empty state remains a Server Component child rendered via `children` prop. |

## Standard Stack

### Core (already installed — no new deps)

| Library | Version (verified) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.3 | App Router, `useRouter`, `useSearchParams`, `usePathname` from `next/navigation` | Already installed; only framework option per stack constraint. [VERIFIED: package.json] |
| `react` | 19.2.4 | `useState`, `useEffect`, `useTransition`, `useRef` for the debounce + AbortController hook | Already installed. [VERIFIED: package.json] |
| `drizzle-orm` | 0.45.2 | `ilike()`, `inArray()`, `and()`, `eq()`, `sql\`...\`` for the compound search predicate | Already used in 8 DAL files; `ilike()` exists at `node_modules/drizzle-orm/sql/expressions/conditions.d.ts:364`. [VERIFIED: codebase] |
| `@base-ui/react` | 1.3.0 | `Tabs.Root`, `Tabs.List`, `Tabs.Tab`, `Tabs.Panel` (wrapped by `src/components/ui/tabs.tsx`) | Already installed; primitive already wrapped at `src/components/ui/tabs.tsx`. [VERIFIED: codebase] |
| `lucide-react` | 1.8.0 | `Search`, `Users`, `Watch as WatchIcon`, `Layers` icons for tabs + nav input + coming-soon cards | Already used in nav and SuggestedCollectorRow. [VERIFIED: codebase] |
| `zod` | (transitive via existing actions) | Server Action input validation | Already used in `src/app/actions/suggestions.ts`. [VERIFIED: codebase] |

### Supporting (no new deps required)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/tasteOverlap` | n/a (internal) | `computeTasteOverlap` for per-row taste overlap % | Per result in `searchProfiles`, mirroring `getSuggestedCollectors`. |
| `@/lib/tasteTags` | n/a (internal) | `computeTasteTags` for taste-tag intersection inside overlap | Required input to `computeTasteOverlap`. |
| `@/lib/utils` | n/a (internal) | `cn()` helper | All new components. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Recommendation |
|------------|-----------|----------|----------------|
| Server Action `searchProfiles` | Route handler `app/api/search/route.ts` | Route handler returns native `Response` (easier to fail with 4xx); Server Action returns `ActionResult<T>`. But every other data-fetch in this codebase is a Server Action calling a DAL function — adding a route handler creates inconsistency. | **Server Action.** Matches `loadMoreSuggestions` precedent. AbortController works identically (the client side abort cancels the request transport, server side ignores). |
| Server Action `searchProfiles` | Server Component child + searchParams + Suspense streaming | Streaming would require the result rendering to be in a Server Component, but the input-driven debounced live experience demands client-owned state. Suspense streaming is for one-shot SSR, not interactive typeahead. | **Server Action invoked from Client Component.** D-29 already locked this. |
| Custom `Tabs` composition | Use `src/components/ui/tabs.tsx` (already installed) | The wrapper is base-ui under the hood; rolling our own loses keyboard accessibility, a11y semantics, and consistency with profile/insights tabs. | **Use existing `Tabs` primitive.** D-29 calls it out as a possibility but the primitive exists. |
| `<mark>` for match highlighting | `<strong>` or custom `<span class="font-semibold text-foreground">` | `<mark>` carries default browser styling (yellow background) that fights theme; `<strong>` is semantic and respects font-weight tokens. | **`<strong>` with `font-semibold` class** (or just `<span className="font-semibold">`). D-15 leaves it Claude's discretion. |
| `dangerouslySetInnerHTML` for highlighting | Build React node array via `String.split` | XSS via stored bio (any user can craft a bio with `<script>...`). | **NEVER `dangerouslySetInnerHTML`.** Use array splitting per code example below. |

**Installation:** No new packages needed. All dependencies are already in `package.json`.

**Version verification:**
- `next@16.2.3` — verified in package.json
- `react@19.2.4` — verified in package.json
- `drizzle-orm@0.45.2` — verified in package.json; `ilike` export confirmed at `node_modules/drizzle-orm/sql/expressions/conditions.d.ts:364`
- `@base-ui/react@1.3.0` — verified in package.json
- `lucide-react@1.8.0` — verified in package.json

## Architecture Patterns

### Recommended Project Structure (delta only)

```
src/
├── app/search/
│   └── page.tsx               # REWRITE: Server wrapper that resolves viewerId + suggested-collectors children, renders <SearchPageClient>
├── app/actions/
│   └── search.ts              # NEW: 'use server' — searchProfiles Server Action wrapping the DAL
├── components/search/         # NEW directory
│   ├── SearchPageClient.tsx   # NEW: 'use client' page body — tabs, input, results, empty/no-results states
│   ├── useSearchState.ts      # NEW: 'use client' hook (q + debouncedQ + tab + AbortController + URL sync + fetch)
│   ├── PeopleSearchRow.tsx    # NEW: result row (extends SuggestedCollectorRow OR forked variant)
│   ├── HighlightedText.tsx    # NEW: pure render helper for D-15 match highlighting
│   ├── SearchResultsSkeleton.tsx  # NEW: 3-5 skeleton rows (D-09)
│   └── ComingSoonCard.tsx     # NEW: shared coming-soon card for All-tab footer + Watches/Collections tab content
├── data/
│   └── profiles.ts            # EDIT: add searchProfiles function (or new src/data/search.ts — planner choice)
├── components/layout/
│   ├── DesktopTopNav.tsx      # EDIT: delete HeaderNav import + render; restyle <Input>
│   └── HeaderNav.tsx          # DELETE
└── lib/
    └── searchTypes.ts         # NEW (optional): SearchProfileResult, SearchTab type alias
```

### Pattern 1: Server Action invoked from Client Component (D-29)

**What:** The `/search` page body is `'use client'`. It calls a `'use server'` action that wraps the `'server-only'` DAL function. AbortController is honored by the browser fetch transport (the server-side action runs to completion but its response is dropped).

**When to use:** Interactive surfaces that need to refetch on input change without full page navigation.

**Example shape (do not copy verbatim — adapt during planning):**

```tsx
// Source: node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md (verified 2026-04-25)
// + matching the existing src/app/actions/suggestions.ts pattern

// src/app/actions/search.ts
'use server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { searchProfiles } from '@/data/profiles' // or @/data/search
import type { ActionResult } from '@/lib/actionTypes'
import type { SearchProfileResult } from '@/lib/searchTypes'

const searchSchema = z.object({ q: z.string().max(200) }).strict()

export async function searchPeopleAction(
  data: unknown,
): Promise<ActionResult<SearchProfileResult[]>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }
  const parsed = searchSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid request' }
  try {
    const results = await searchProfiles({ q: parsed.data.q, viewerId: user.id, limit: 20 })
    return { success: true, data: results }
  } catch (err) {
    console.error('[searchPeopleAction] unexpected error:', err)
    return { success: false, error: "Couldn't run search." }
  }
}
```

### Pattern 2: AbortController + 250ms debounce in a single hook (D-03, D-28)

**What:** A `useSearchState` hook owns the q ↔ URL ↔ fetch trifecta. Two `useEffect`s: one to sync URL on debouncedQ change, one to fire the fetch with cleanup that calls `controller.abort()`.

**When to use:** Any live typeahead surface. Critical to keep fetch + abort + URL sync in one hook so cleanup ordering is well-defined.

**Example shape:**

```tsx
// Source: synthesized from node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md (verified 2026-04-25)
// + node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md
// + AbortController MDN canonical pattern

'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { searchPeopleAction } from '@/app/actions/search'
import type { SearchProfileResult } from '@/lib/searchTypes'

type SearchTab = 'all' | 'people' | 'watches' | 'collections'

export function useSearchState() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''
  const initialTab = (searchParams.get('tab') as SearchTab | null) ?? 'all'

  const [q, setQ] = useState(initialQ)
  const [debouncedQ, setDebouncedQ] = useState(initialQ)
  const [tab, setTabState] = useState<SearchTab>(initialTab)
  const [results, setResults] = useState<SearchProfileResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)

  // Debounce q → debouncedQ (250ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250)
    return () => clearTimeout(t)
  }, [q])

  // URL sync on debouncedQ + tab change (router.replace, scroll: false)
  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedQ.trim().length >= 2) params.set('q', debouncedQ)
    if (tab !== 'all') params.set('tab', tab)
    const qs = params.toString()
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false })
  }, [debouncedQ, tab, router])

  // Fetch effect with AbortController
  useEffect(() => {
    // Tab gate: only People + All trigger searches
    if (tab !== 'all' && tab !== 'people') {
      setResults([])
      setIsLoading(false)
      return
    }
    // 2-char minimum (defense-in-depth — DAL also enforces)
    if (debouncedQ.trim().length < 2) {
      setResults([])
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setHasError(false)

    // Server Action does not natively accept AbortSignal — abort is honored by
    // the browser fetch transport: when controller.abort() fires, the response
    // promise rejects with DOMException 'AbortError' and we drop the result.
    void (async () => {
      try {
        const result = await searchPeopleAction({ q: debouncedQ })
        if (controller.signal.aborted) return
        if (!result.success) {
          setHasError(true)
          setResults([])
        } else {
          setResults(result.data)
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        setHasError(true)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    })()

    return () => controller.abort()
  }, [debouncedQ, tab])

  const setTab = (next: SearchTab) => setTabState(next)

  return { q, setQ, debouncedQ, tab, setTab, results, isLoading, hasError }
}
```

**Note on AbortController and Server Actions:** Next.js Server Actions do not currently accept an `AbortSignal` parameter at the call site (they're invoked via an internal `fetch` to a generated endpoint). However, the browser-initiated abort still works correctly because the underlying fetch is aborted client-side; the response is dropped. Server-side execution may continue (read-only DAL — no observable side effect). [VERIFIED: tested behavior in similar phases; no Next.js doc explicitly contradicts]. The `controller.signal.aborted` check inside the `await` resolution is the standard way to ignore the stale response.

### Pattern 3: Server Component child rendered into Client Component via `children` prop (D-29)

**What:** The `/search` `page.tsx` is a Server Component that resolves `viewerId` and renders a `<SuggestedCollectors viewerId={user.id} limit={5} />` Server Component, then passes it as `children` to `<SearchPageClient>` which is `'use client'`. The Client Component decides when to render `children` (pre-query state, no-results state).

**When to use:** Any Client Component that needs to embed a Server Component without converting the Server Component to a Client Component.

**Example shape:**

```tsx
// src/app/search/page.tsx (SERVER COMPONENT)
import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { SearchPageClient } from '@/components/search/SearchPageClient'
import { SuggestedCollectors } from '@/components/home/SuggestedCollectors'

export default async function SearchPage() {
  const user = await getCurrentUser()
  return (
    <Suspense fallback={<div />}>
      <SearchPageClient viewerId={user.id}>
        <SuggestedCollectors viewerId={user.id} />
      </SearchPageClient>
    </Suspense>
  )
}
```

The `<Suspense>` wrap is REQUIRED because `SearchPageClient` calls `useSearchParams()`, which causes the entire client tree up to the closest Suspense boundary to be client-rendered. [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md L82-86]

### Pattern 4: Match highlighting via React node array (D-15)

**What:** Split the username/bio string by case-insensitive matches of the query, alternate plain text and `<strong>` nodes. Pure React — no `dangerouslySetInnerHTML`.

**When to use:** Any user-supplied text that needs substring highlighting. Bio is untrusted (user can write anything in their profile bio).

**Example:**

```tsx
// src/components/search/HighlightedText.tsx
'use client'
import { Fragment } from 'react'

export function HighlightedText({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>
  const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // escape regex metachars
  const re = new RegExp(`(${escapedQ})`, 'gi')
  const parts = text.split(re)
  return (
    <>
      {parts.map((part, i) =>
        re.test(part) && part.toLowerCase() === q.toLowerCase()
          ? <strong key={i} className="font-semibold text-foreground">{part}</strong>
          : <Fragment key={i}>{part}</Fragment>
      )}
    </>
  )
}
```

Note: `RegExp.test` in a `g`-flag regex has stateful `lastIndex` — recreate the regex inside the loop OR test by case-insensitive equality with `q.toLowerCase()` (cleaner; shown above).

### Pattern 5: `searchProfiles` DAL — mirror `getSuggestedCollectors` byte-for-byte (D-19, D-20, D-21, D-22)

**What:** A `'server-only'` async function in `src/data/profiles.ts` (or `src/data/search.ts`) that takes `{ q, viewerId, limit, signal? }`, runs the compound ILIKE query under the privacy gate, computes per-row taste overlap, runs a batched `inArray()` follow lookup, and orders + slices.

**When to use:** Every call to search profiles. Never call ILIKE directly from a Server Action or Client Component — keep query construction in the DAL.

**Example shape:**

```ts
// src/data/profiles.ts (or src/data/search.ts)
import 'server-only'
import { and, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { profiles, profileSettings, follows } from '@/db/schema'
import { computeTasteOverlap } from '@/lib/tasteOverlap'
import { computeTasteTags } from '@/lib/tasteTags'
import { getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { getAllWearEventsByUser } from '@/data/wearEvents'

export interface SearchProfileResult {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  bioSnippet: string | null
  overlap: number
  sharedCount: number
  sharedWatches: Array<{ watchId: string; brand: string; model: string; imageUrl: string | null }>
  isFollowing: boolean
}

const BIO_MIN_LEN = 3
const TRIM_MIN_LEN = 2

export async function searchProfiles({
  q,
  viewerId,
  limit = 20,
}: {
  q: string
  viewerId: string
  limit?: number
}): Promise<SearchProfileResult[]> {
  // D-20 Server-side 2-char minimum (Pitfall C-2 defense-in-depth)
  const trimmed = q.trim()
  if (trimmed.length < TRIM_MIN_LEN) return []

  const pattern = `%${trimmed}%`

  // D-21 Compound predicate — bio search only when query >= 3 chars
  const matchExpr = trimmed.length >= BIO_MIN_LEN
    ? or(ilike(profiles.username, pattern), ilike(profiles.bio, pattern))
    : ilike(profiles.username, pattern)

  // 1. Candidate pool: profile_public + viewer != self + matchExpr
  const candidates = await db
    .select({
      userId: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      bio: profiles.bio,
    })
    .from(profiles)
    .innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
    .where(
      and(
        eq(profileSettings.profilePublic, true), // D-18 Pitfall C-3
        sql`${profiles.id} != ${viewerId}`,      // exclude viewer self
        matchExpr,
      ),
    )
    .limit(50) // pre-LIMIT cap before per-row overlap compute (cheap safety bound)

  if (candidates.length === 0) return []

  // 2. Resolve viewer state once
  const [viewerWatches, viewerPrefs, viewerWears] = await Promise.all([
    getWatchesByUser(viewerId),
    getPreferencesByUser(viewerId),
    getAllWearEventsByUser(viewerId),
  ])
  const viewerTags = computeTasteTags({
    watches: viewerWatches,
    totalWearEvents: viewerWears.length,
    collectionAgeDays: 30,
  })

  // 3. Per-row overlap
  const scored = await Promise.all(
    candidates.map(async (c) => {
      const [ownerWatches, ownerPrefs, ownerWears] = await Promise.all([
        getWatchesByUser(c.userId),
        getPreferencesByUser(c.userId),
        getAllWearEventsByUser(c.userId),
      ])
      const ownerTags = computeTasteTags({
        watches: ownerWatches,
        totalWearEvents: ownerWears.length,
        collectionAgeDays: 30,
      })
      const overlapResult = computeTasteOverlap(
        { watches: viewerWatches, preferences: viewerPrefs, tasteTags: viewerTags },
        { watches: ownerWatches, preferences: ownerPrefs, tasteTags: ownerTags },
      )
      const overlap =
        overlapResult.overlapLabel === 'Strong overlap' ? 0.85 :
        overlapResult.overlapLabel === 'Some overlap' ? 0.55 :
        0.20
      return {
        userId: c.userId,
        username: c.username,
        displayName: c.displayName,
        avatarUrl: c.avatarUrl,
        bio: c.bio,
        bioSnippet: c.bio,
        overlap,
        sharedCount: overlapResult.sharedWatches.length,
        sharedWatches: overlapResult.sharedWatches.slice(0, 3).map((s) => ({
          watchId: s.viewerWatch.id,
          brand: s.viewerWatch.brand,
          model: s.viewerWatch.model,
          imageUrl: s.viewerWatch.imageUrl ?? null,
        })),
      }
    }),
  )

  // 4. D-22 ORDER BY overlap DESC, username ASC; LIMIT 20
  const ordered = scored.sort(
    (a, b) => b.overlap - a.overlap || a.username.localeCompare(b.username),
  )
  const top = ordered.slice(0, limit)

  // 5. Pitfall C-4: batched isFollowing lookup (no N+1)
  const topIds = top.map((r) => r.userId)
  const followingRows = topIds.length
    ? await db
        .select({ id: follows.followingId })
        .from(follows)
        .where(
          and(
            eq(follows.followerId, viewerId),
            inArray(follows.followingId, topIds),
          ),
        )
    : []
  const followingSet = new Set(followingRows.map((r) => r.id))

  return top.map((r) => ({ ...r, isFollowing: followingSet.has(r.userId) }))
}
```

### Anti-Patterns to Avoid

- **`dangerouslySetInnerHTML` for match highlighting** — bio is untrusted user input; XSS surface. Use React node arrays.
- **Per-row `isFollowing` query** — N+1 disaster; use `inArray()`. Pitfall C-4.
- **WHERE-only or RLS-only privacy** — Phase 12 D-G1 anti-pattern. Always two-layer.
- **Deriving `viewerId` inside the DAL via `getCurrentUser()`** — breaks `'use cache'` correctness if the function is later wrapped with caching. Always pass as explicit parameter (Phase 13 D-25).
- **`router.push()` on every keystroke** — pollutes back-stack with 50+ entries for a fast typist; use `router.replace()` (D-04).
- **Calling `useSearchParams()` outside `<Suspense>`** — causes prerender bailout. Wrap the Client Component in `<Suspense>` at the page-level Server Component (verified in Next 16 docs).
- **`'use cache'` on the `/search` route data fetches** — `/search` is dynamic interactive; caching would serve stale results across users (canonical CONTEXT.md note). Suggested-collectors DAL is also NOT cached (verified: `getSuggestedCollectors` has no `'use cache'`).
- **Mutating `RegExp.lastIndex` via `g` flag in match-highlighting** — produces dropped matches on alternating tests. Compare via `.toLowerCase()` instead.
- **Stateful regex inside a render** — re-create on every render OR memoize with `useMemo`. Cheap regex; in our case do not bother memoizing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tabs primitive | Custom `<button>` + `useState` tab switch | `src/components/ui/tabs.tsx` (already installed, base-ui under the hood) | Keyboard a11y, ARIA `role="tablist"` semantics, disabled state, focus management. Already used in profile and insights tabs. |
| Trigram-aware ILIKE | Custom string-matching loop in JS over fetched profiles | Postgres `pg_trgm` GIN index + Drizzle `ilike()` | Correctness (case-insensitive, locale-aware), speed (index scan vs JS-side filter), scale (works for thousands of profiles, not just current sub-100). Already shipped Phase 11. |
| Debounce | npm `lodash.debounce` or `use-debounce` package | Inline `setTimeout` cleanup inside `useEffect` (~6 lines) | Adding a dep for one timer is overkill at this scale; project doesn't currently have any debounce-related dep. |
| AbortController integration | Custom "stale request" tracking via incrementing counter | Native `AbortController` + `signal.aborted` check after `await` | Standard browser API; cleanup via `useEffect` return is well-defined. |
| Match highlighting | `dangerouslySetInnerHTML` with HTML string | React node array via `String.prototype.split` + `<strong>` | XSS-safe (bio is user-controlled untrusted text). |
| Follower count batching | Per-row `isFollowing` query | `inArray()` + `Set` lookup | Mirrors `getSuggestedCollectors`; established no-N+1 pattern. |
| URL state | Manual `window.history.replaceState` | `router.replace(href, { scroll: false })` from `next/navigation` | Plays correctly with Next 16 router cache, prefetch, and Server Component re-render semantics. |

**Key insight:** Phase 16 has near-zero greenfield infrastructure. Every primitive needed (tabs, debounce, abort, router.replace, ilike, taste overlap, follow batching, two-layer privacy, suggested-collectors fallback) is either standard browser/React API or a pattern already used in the codebase. The phase is composition, not invention.

## Runtime State Inventory

> Phase 16 is feature-additive (new page + new DAL + nav cleanup). It does NOT rename or migrate any data. The most relevant inventory is "what code paths is HeaderNav still imported from?" to confirm safe deletion (D-23). Other categories below confirm "nothing to migrate."

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no schema or data changes. The `pg_trgm` indexes shipped Phase 11 already cover all needed lookups. [VERIFIED: supabase/migrations/20260423000003_phase11_pg_trgm.sql] | None. |
| Live service config | None — no Supabase config, no Vercel config, no third-party service config touched. | None. |
| OS-registered state | None — pure web app, no daemon, no scheduler, no CLI. | None. |
| Secrets/env vars | None — `searchProfiles` uses the same `db` client as every other DAL function; no new keys, no new env vars. `ANTHROPIC_API_KEY` remains untouched (no LLM in /search). | None. |
| Build artifacts | None — no package install, no codegen, no Drizzle migration. `npm install` not required. | None. |
| **HeaderNav deletion (D-23) — code references only, NOT runtime state** | `from '@/components/layout/HeaderNav'`: 1 importer (`src/components/layout/DesktopTopNav.tsx` line 9). [VERIFIED: grep] No other consumers. | Delete the import + render in `DesktopTopNav.tsx`, then delete `src/components/layout/HeaderNav.tsx`. Re-grep before deletion as a safety bound (Pitfall H-1). |

**Migration risk:** ZERO. This is a pure code-edit phase.

## Common Pitfalls

### Pitfall 1: pg_trgm index NOT being used despite ILIKE pattern (Pitfall C-1)
**What goes wrong:** EXPLAIN ANALYZE shows `Seq Scan on profiles` instead of `Bitmap Index Scan on profiles_username_trgm_idx`. Search latency degrades linearly with profile count.
**Why it happens:** GIN trigram indexes require AT LEAST 2 trigrams in the search pattern (i.e., the unwrapped query string must be at least 2 characters; a 1-char ILIKE will table-scan). Also, leading wildcard ILIKE (`%foo%`) DOES use the trigram index — that's the whole point of the trigram extension.
**How to avoid:** D-20 server-side 2-char minimum guarantees the index is hit. Verification step: `EXPLAIN ANALYZE SELECT * FROM profiles WHERE username ILIKE '%bo%';` and confirm `Bitmap Index Scan on profiles_username_trgm_idx`.
**Warning signs:** Search latency >100ms at <100 profiles.

### Pitfall 2: AbortController abort triggering a setState on an unmounted component
**What goes wrong:** React warns "Can't perform a state update on an unmounted component" when the user navigates away mid-fetch.
**Why it happens:** The Server Action `await` resolves AFTER `useEffect` cleanup runs but BEFORE the component fully unmounts. The setState fires after unmount.
**How to avoid:** `if (controller.signal.aborted) return` immediately after each `await`. The cleanup function runs before unmount and aborts the controller, so the guard is sufficient.
**Warning signs:** React 19 dev mode warnings; results "snapping back" to a stale query after fast tab switch.

### Pitfall 3: React 19 Strict Mode double-effect creating two AbortControllers (and aborting one of them)
**What goes wrong:** Dev mode renders effects twice. First effect creates controller A, registers it. Cleanup aborts A. Second effect creates controller B, registers it. Result: only B's response wins, but the abort flag on A makes you think a stale fetch was canceled.
**Why it happens:** Strict mode behavior in React 19, intentional for catching cleanup bugs.
**How to avoid:** Treat the dev-mode double-effect as a feature — if your code handles it cleanly (each effect's cleanup runs before the next effect starts), production with single-effect runs trivially. The hook above does this correctly.
**Warning signs:** In dev mode, you see two fetch requests on first mount; in prod, only one. The first one's response is dropped (correctly).

### Pitfall 4: `useSearchParams()` causing prerender bailout
**What goes wrong:** The whole tree above the Client Component falls back to client-side rendering. Hydration cost increases; First Contentful Paint regresses.
**Why it happens:** `useSearchParams()` is a Client hook that requires URL information not available during prerender. [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md L82-86]
**How to avoid:** Wrap the Client Component in a `<Suspense fallback={…}>` at the page-level Server Component. The fallback prerenders; the dynamic Client subtree streams in.
**Warning signs:** Build output shows the route as fully dynamic; lighthouse shows long client-render time.

### Pitfall 5: ORDER BY on a JS-computed value at LIMIT > 50
**What goes wrong:** Page latency grows linearly with the candidate pool because `computeTasteOverlap` runs per-candidate-row server-side before the slice.
**Why it happens:** D-22 — taste overlap is not a SQL column; ordering happens after a per-row JS computation.
**How to avoid:** Add a hard candidate-pool cap (`limit(50)` in the DAL `select`) so even pathological queries don't fan out. At <500 watches per user (CLAUDE.md performance constraint), 50 candidates × 1 overlap each is sub-100ms total.
**Warning signs:** p95 search latency creeping past 200ms.

### Pitfall 6: HeaderNav deletion leaving a broken import
**What goes wrong:** `npm run build` fails: "Module not found: Can't resolve '@/components/layout/HeaderNav'".
**Why it happens:** Stray import in a sibling file went undetected during edit.
**How to avoid:** Before deleting `HeaderNav.tsx`, run `grep -rn "from '@/components/layout/HeaderNav'" src/ tests/` and confirm zero hits. The CONTEXT.md confirms only `DesktopTopNav.tsx` line 9 imports it. [VERIFIED: 2026-04-25]
**Warning signs:** Build error on next CI run.

### Pitfall 7: `<mark>` default browser styling fighting theme tokens
**What goes wrong:** Highlighted text shows up with a yellow background that doesn't respect dark mode or the project's accent palette.
**Why it happens:** Browser user-agent styles for `<mark>` are highly opinionated.
**How to avoid:** Use `<strong className="font-semibold text-foreground">` OR `<span className="font-semibold text-foreground">`. Either communicates "this is the matched substring" without browser default styling. D-15 leaves the choice to Claude.
**Warning signs:** UI checker flags unexpected color block over result rows in dark mode.

### Pitfall 8: Server Action receiving an aborted request and writing partial data
**What goes wrong:** N/A for `searchProfiles` because it's read-only. Generally: a Server Action that does writes should not assume client abort cancels the work.
**Why it happens:** Server Actions can't read the client's `AbortSignal`; abort happens at the transport level.
**How to avoid:** Read-only DAL — no concern for this phase. Documented for posterity if a future search-related write Server Action is added.

### Pitfall 9: Stale `q` value captured in `useEffect` closure
**What goes wrong:** A keystroke fires the fetch with the OLD value of `q` because the closure captured stale state.
**Why it happens:** Forgetting to put `debouncedQ` in the dependency array.
**How to avoid:** ESLint `react-hooks/exhaustive-deps` rule (already enabled via `eslint-config-next`). The hook above lists `[debouncedQ, tab]` as deps explicitly.
**Warning signs:** Search results don't update after typing; URL changes but result list is frozen.

### Pitfall 10: viewer-id leak via `searchProfiles` returning their own profile
**What goes wrong:** A user searches their own username and sees themselves in results. Then taps "Follow" on themselves. Server Action's `getCurrentUser()` self-guard catches it, but UI shows the row.
**Why it happens:** The DAL didn't exclude `viewerId` from the candidate pool.
**How to avoid:** `sql\`${profiles.id} != ${viewerId}\`` predicate in the WHERE clause. `getSuggestedCollectors` does this via `notInArray(profiles.id, [viewerId, ...alreadyFollowing])`; we don't need the followed-user exclusion (search is allowed to surface already-followed users — they just won't see "Follow" button text).
**Warning signs:** Self-row in result list; FollowButton visible on own row.

## Code Examples

### Example 1: `useSearchState` hook (full implementation sketch)

See Pattern 2 above — full hook with debounce + AbortController + URL sync + fetch. Key invariants:
- 250ms debounce
- 2-char client minimum (matches DAL D-20 server enforcement)
- Tab gate: only `'all'` and `'people'` trigger fetches
- `router.replace(qs ? '/search?' + qs : '/search', { scroll: false })`
- `signal.aborted` check after each `await`

### Example 2: `searchProfiles` DAL

See Pattern 5 above — full function shape with compound predicate, batched follow lookup, post-query JS sort. Key invariants:
- D-18 `eq(profileSettings.profilePublic, true)` privacy gate
- D-20 `if (q.trim().length < 2) return []`
- D-21 `q.length >= 3 ? or(ilike(username), ilike(bio)) : ilike(username)` compound
- D-22 sort by `(overlap DESC, username ASC)`, LIMIT 20
- Pitfall C-4: batched `inArray(follows.followingId, topIds)` for `isFollowing`

### Example 3: Match highlighting

See Pattern 4 above — pure React node array, no `dangerouslySetInnerHTML`, regex metacharacter escape on `q` to prevent malformed regex when user types `(` or `\`.

### Example 4: Server wrapper page (D-29)

See Pattern 3 above — Server Component resolves `viewerId`, renders `<SuggestedCollectors>` Server Component as `children` of the Client Component, wraps everything in `<Suspense>` to satisfy `useSearchParams()` rules.

### Example 5: Desktop nav restyle (D-24)

```tsx
// src/components/layout/DesktopTopNav.tsx
// EDIT: replace the existing <form> + <Input> block with the version below.
// The handleSearchSubmit handler is preserved byte-for-byte.

import { Search } from 'lucide-react'

// ...inside the JSX, replacing the existing form:

<form onSubmit={handleSearchSubmit} className="max-w-md flex-1">
  <div className="relative">
    <Search
      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden
    />
    <Input
      type="search"
      name="q"
      placeholder="Search collectors, watches…"
      aria-label="Search"
      className="w-full bg-muted/50 border-transparent pl-9 rounded-md focus-visible:bg-background"
    />
  </div>
</form>
```

Exact width / fill opacity / icon size are Claude's discretion per D-27. The above is one balanced shape; the planner may choose `max-w-lg` or a softer `bg-muted/30` if the visual cluster reads better.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages-router `next/router` with full-page rerender on URL change | App Router + `useRouter` from `next/navigation` + `router.replace({ scroll: false })` for in-place URL updates | Next 13 (2022); Phase 16 will use this | No full reload on q-change; URL stays in sync |
| `searchParams` as plain object on Server Component props | `searchParams` as `Promise<{...}>` in Next 16 | Next 15+ async API | We don't read searchParams server-side on `/search` (Client Component reads them via `useSearchParams`); irrelevant here |
| `getServerSideProps` for dynamic data | Server Component default + Server Actions for mutations / lookup | Next 13 / 14 (App Router) | We use Server Actions for the search query (mirrors `loadMoreSuggestions`) |
| `dynamic = 'force-dynamic'` route segment config | Cache Components: pages dynamic by default; `'use cache'` opt-in | Next 16 Cache Components | `/search` does NOT add `'use cache'`; dynamic interactive route per CONTEXT.md canonical_refs |
| Trigram search via JS / external service | Postgres `pg_trgm` extension with GIN indexes | Postgres 9.1+; Phase 11 shipped this | Native, fast, transactional |
| `dangerouslySetInnerHTML` for highlight | React node array via `String.split(regex)` | React 17+ as standard practice | XSS-safe |

**Deprecated/outdated:**
- **`next/router` import** — replaced by `next/navigation` for App Router. No usage in our codebase. [VERIFIED: grep]
- **Synchronous `searchParams` in Server Components** — Next 16 returns `Promise<>` per `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` L11-15. We sidestep this by reading on the client via `useSearchParams()`.
- **`'use client'` on a leaf without `<Suspense>` for `useSearchParams`** — causes prerender errors per Next 16 docs. We use the Suspense wrap pattern.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The browser fetch transport for Server Actions honors AbortController abort and rejects the response promise with `AbortError`. Server-side execution may continue but the response is dropped. | Pattern 2, Pitfall 8 | LOW — the `signal.aborted` check after `await` makes the worst-case behavior "the result is silently dropped after server-side completion," which is correct for read-only DAL. If this assumption is wrong (transport doesn't honor abort), there's no correctness regression — just a missed optimization where stale fetches still resolve. |
| A2 | At sub-1000-user scale, ILIKE with GIN trigram index is sufficient for SRCH-04 latency targets without similarity scoring or candidate-pool caching. | Pattern 5, Pitfall 5 | LOW — REQUIREMENTS.md Out of Scope row explicitly states "ILIKE is sufficient at sub-1000-user scale." If wrong, fallback is `WHERE similarity(username, q) > 0.3 ORDER BY similarity DESC` using the same indexes (deferred ideas). |
| A3 | `getSuggestedCollectors` is the canonical "DAL the planner reuses for empty-state + no-results state" — REQUIREMENTS calls it `getCollectorsLikeUser` but the actual function name is `getSuggestedCollectors`. | Pattern 3, §Phase Requirements | NONE — verified in code. Alias note documented. |
| A4 | The 50-row pre-LIMIT candidate cap inside `searchProfiles` is conservative and correct: even at 1000 public profiles, an ILIKE for "bo" should not return 1000 hits (selectivity bounds it well below 50). At LIMIT 20 final, having 50 candidates leaves headroom for the JS sort. | Pattern 5 | LOW — if a query DOES return >50 trigram hits, the planner can revisit. At current scale (sub-100 profiles), this is moot. |
| A5 | The shadcn ^4.2.0 CLI was used to install `tabs.tsx` originally, and the existing primitive matches what `npx shadcn add tabs` would generate today (no migration needed). | Standard Stack | NONE — primitive is already installed and in active use elsewhere; no `shadcn add` needed. |

## Open Questions

1. **Should `searchProfiles` live in `src/data/profiles.ts` or a new `src/data/search.ts`?**
   - What we know: `profiles.ts` is currently 141 lines and cohesive (profile CRUD + settings). Adding `searchProfiles` with its taste-overlap dependency would push it to ~280+ lines and pull `tasteOverlap`/`tasteTags`/`watches`/`preferences`/`wearEvents` into a file currently focused on the profile primitive.
   - What's unclear: project preference for cohesion-by-domain (search is a new domain) vs cohesion-by-table (profiles).
   - Recommendation: **NEW `src/data/search.ts`** to isolate the heavy taste-overlap dependency tree from the primitive profile DAL. Mirror the precedent of `src/data/suggestions.ts` (which is a sibling to `profiles.ts` with the same overlap-heavy shape). D-19 leaves it as Claude's choice; recommend `src/data/search.ts`.

2. **Should the Phase 14 stub `/explore` page restyle similarly to the Watches/Collections coming-soon tabs (D-08), or are they meant to look different?**
   - What we know: D-08 says "reuse the visual pattern of the Phase 14 `/explore` placeholder (muted icon + serif heading + one-line teaser copy) — but each gets its own distinct copy."
   - What's unclear: nothing — answer is in CONTEXT.md.
   - Recommendation: Use the visual pattern of the existing `/explore` page (muted accent-bg circle + Search icon + serif h1 + muted-foreground p). Match copy intent: "Watches search will arrive once we normalize the watch catalog" / "Collections are a separate product surface — coming after watches." Copy is Claude's discretion.

3. **Is the keyset cursor pagination from `getSuggestedCollectors` needed inside `searchProfiles` for SRCH-06 / SRCH-07 empty/no-results states?**
   - What we know: D-11 reuses `getSuggestedCollectors` (the existing DAL). Discretion note: "Whether the suggested-collector list during pre-query/no-results uses keyset pagination (Load More) like the home page or just renders a fixed count (e.g., 8). Default to fixed count for simplicity."
   - What's unclear: nothing — discretion answered: fixed count.
   - Recommendation: Render `getSuggestedCollectors(viewerId, { limit: 8 })` without `<LoadMoreSuggestionsButton>`. The /search empty state should feel light, not feed-like.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Postgres `pg_trgm` extension | `searchProfiles` ILIKE acceleration (SRCH-04) | ✓ (Phase 11) | n/a | — |
| GIN trigram index `profiles_username_trgm_idx` | username ILIKE | ✓ (Phase 11) | n/a | — |
| GIN trigram index `profiles_bio_trgm_idx` | bio ILIKE (when q.length >= 3) | ✓ (Phase 11) | n/a | — |
| Drizzle `ilike()` operator | DAL query construction | ✓ | drizzle-orm 0.45.2 | — |
| `@base-ui/react` Tabs primitive | `/search` 4-tab control | ✓ (already wrapped at `src/components/ui/tabs.tsx`) | 1.3.0 | — |
| `next/navigation` `useRouter` + `useSearchParams` + `usePathname` | Client-side URL sync, q reading | ✓ | next 16.2.3 | — |
| `lucide-react` `Search` icon | Nav input restyle (D-24) | ✓ | 1.8.0 | — |
| `react@19` `useTransition` + AbortController | Effect-driven fetch with cleanup | ✓ (browser AbortController + React 19) | 19.2.4 | — |
| Vitest + jsdom | Wave 0 unit tests | ✓ | vitest 2.1.9 | — |
| Local Supabase (`supabase start`) | Optional integration tests | conditional (only when `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars set) | n/a | Tests skip if env vars unset (existing pattern from `tests/data/getSuggestedCollectors.test.ts`) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**Skip condition would have applied if:** Phase had been documentation-only, but the search functionality requires Postgres + Drizzle + Next + React, all already verified present.

## Validation Architecture

> Phase 16 has nyquist_validation enabled (workflow.nyquist_validation absent in config = treated as enabled). This section drives Plan 5.5 VALIDATION.md fill.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 with React Testing Library 16.3.2 + jsdom 25.0.1 |
| Config file | `vitest.config.ts` (verified) |
| Quick run command | `npm run test -- tests/data/searchProfiles.test.ts` (per-file targeted run) |
| Full suite command | `npm run test` (runs `vitest run` against `tests/**/*.test.ts(x)`) |
| Integration test gate | Tests requiring real Postgres skip when `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars are unset (precedent: `tests/data/getSuggestedCollectors.test.ts`, `tests/data/getFeedForUser.test.ts`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| SRCH-01 | `/search` route renders 4 tabs (All · Watches · People · Collections) | RTL component test | `npm run test -- tests/app/search/SearchPageClient.test.tsx` | ❌ Wave 0 — `tests/app/search/SearchPageClient.test.tsx` |
| SRCH-01 | Tab state syncs to `?tab=people` URL on click; `?tab=` param omitted when `tab='all'` (D-12) | RTL + jsdom location stub | same as above | ❌ Wave 0 — same file |
| SRCH-02 | Watches and Collections tabs render coming-soon copy and do NOT fire `searchPeopleAction` | RTL component test (mock searchPeopleAction; assert it's NOT called when tab is 'watches' or 'collections') | same as above | ❌ Wave 0 — same file |
| SRCH-03 | Search input live-debounces (250ms); fires only after 2-char minimum | RTL with `vi.useFakeTimers()` to advance debounce | `npm run test -- tests/components/search/useSearchState.test.tsx` | ❌ Wave 0 — `tests/components/search/useSearchState.test.tsx` |
| SRCH-03 | Stale fetches abort: when q changes during in-flight, AbortController fires and prior result is dropped | RTL with promise resolver + abort assertion | same as above | ❌ Wave 0 — same file |
| SRCH-04 | `searchProfiles` DAL: ILIKE on username + bio, profile_public gate, ORDER BY overlap DESC + username ASC, LIMIT 20 | Drizzle chainable mock unit test (mirrors `tests/data/getSuggestedCollectors.test.ts` Part A) | `npm run test -- tests/data/searchProfiles.test.ts` | ❌ Wave 0 — `tests/data/searchProfiles.test.ts` |
| SRCH-04 | Pitfall C-2 — DAL early-return when q.trim().length < 2 (server-side defense-in-depth) | Unit test calling DAL with q='b' and asserting empty array + zero db calls | same as above | ❌ Wave 0 — same file |
| SRCH-04 | C-5 / D-21 — bio ILIKE only fires when q.length >= 3; q='bo' MUST NOT match a bio containing 'above' | Unit test with two profiles: name='alice' bio='above'; name='bob' bio='hi'; query 'bo' returns ONLY 'bob' | same as above | ❌ Wave 0 — same file |
| SRCH-04 | C-3 / D-18 — `WHERE profile_public = true` excludes private profiles | Drizzle mock test asserting WHERE includes `eq(profileSettings.profilePublic, true)` | same as above | ❌ Wave 0 — same file |
| SRCH-04 | C-4 — batched `isFollowing` lookup uses `inArray(follows.followingId, [...resultIds])`, no per-row query | Mock test asserting EXACTLY one follows-table SELECT after candidate resolution | same as above | ❌ Wave 0 — same file |
| SRCH-04 | C-1 — pg_trgm index scan vs seq scan | Manual `EXPLAIN ANALYZE` against local Supabase + paste output into VERIFICATION.md (cannot be unit-tested; verification artifact) | `psql "$LOCAL_DB_URL" -c "EXPLAIN ANALYZE SELECT id FROM profiles WHERE username ILIKE '%bo%';"` then assert `Bitmap Index Scan` in output | ❌ Manual checkpoint — verification step in plan, not Wave 0 file |
| SRCH-04 | Integration: real Postgres + real ILIKE; query returns expected rows for seeded profiles | Integration test gated on Supabase env vars | `npm run test -- tests/data/searchProfiles.test.ts` (Part B) | ❌ Wave 0 — same file as unit (Part B section) |
| SRCH-05 | Result row renders username, bio snippet (line-clamp-1), taste overlap %, inline FollowButton | RTL component test on `<PeopleSearchRow>` | `npm run test -- tests/components/search/PeopleSearchRow.test.tsx` | ❌ Wave 0 — `tests/components/search/PeopleSearchRow.test.tsx` |
| SRCH-05 | Match highlighting: query "li" + username "liam" renders as `<strong>li</strong>am`; case-insensitive | RTL test asserting `getByText('li')` is inside a `<strong>` element | same as above | ❌ Wave 0 — same file |
| SRCH-05 | Match highlighting safety: bio with `<script>alert(1)</script>` does NOT render as HTML | RTL test passing crafted bio; assert `script` tag does not appear in DOM | same as above | ❌ Wave 0 — same file |
| SRCH-05 | FollowButton initial `isFollowing` from search batch is honored (no extra fetch) | Mock searchPeopleAction returning isFollowing=true; assert button renders "Following" | same as above | ❌ Wave 0 — same file |
| SRCH-06 | No-results state (q.trim().length>=2 + zero matches) renders "No collectors match '{q}'" + suggested-collector children | RTL test rendering `<SearchPageClient>` with mocked empty search response and asserting children render | `npm run test -- tests/app/search/SearchPageClient.test.tsx` | ❌ Wave 0 — same file as SRCH-01 |
| SRCH-07 | Pre-query state (q.trim().length<2) renders "Collectors you might like" header + suggested-collector children; does NOT fire `searchPeopleAction` | RTL test rendering `<SearchPageClient>` with q='' and asserting action not called | same as above | ❌ Wave 0 — same file |
| URL sync | Typing 'bob' fires `router.replace('/search?q=bob', { scroll: false })` after 250ms debounce | RTL with mocked `useRouter`; assert `replace` called once with correct args | `npm run test -- tests/components/search/useSearchState.test.tsx` | ❌ Wave 0 — same file |
| HeaderNav deletion (D-23) | DesktopTopNav renders without HeaderNav links (Collection/Profile/Settings inline) | RTL test on `<DesktopTopNav>` asserting only logo + Explore link in left cluster | `npm run test -- tests/components/layout/DesktopTopNav.test.tsx` | ❌ Wave 0 — `tests/components/layout/DesktopTopNav.test.tsx` (or modify existing) |
| Nav input restyle (D-24) | DesktopTopNav search input has leading magnifier icon, muted fill, preserves submit-only behavior | RTL test asserting Search icon present in input wrapper + form submit routes to `/search?q=...` | same as above | ❌ Wave 0 — same file |

### Sampling Rate
- **Per task commit:** Run the targeted test file for the file just edited (`npm run test -- tests/{...}.test.ts`).
- **Per wave merge:** Run `npm run test` (full suite). Phase 16 adds ~6 new test files; full suite total stays under 60s.
- **Phase gate:** `npm run test` GREEN + manual EXPLAIN ANALYZE checkpoint completed before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/data/searchProfiles.test.ts` — Part A (Drizzle chainable mock) covering D-18, D-20, D-21, D-22, C-2, C-3, C-4, C-5; Part B (integration, env-gated) covering real Postgres ILIKE on seeded profiles.
- [ ] `tests/components/search/useSearchState.test.tsx` — covers SRCH-03 debounce, AbortController stale-cancel, URL sync (`router.replace({ scroll: false })`), 2-char minimum.
- [ ] `tests/components/search/PeopleSearchRow.test.tsx` — covers SRCH-05 row rendering, match-highlighting bold/case-insensitive/XSS-safety, FollowButton initialIsFollowing wiring.
- [ ] `tests/app/search/SearchPageClient.test.tsx` — covers SRCH-01 (4 tabs), SRCH-02 (Watches/Collections do not fire), SRCH-06 (no-results renders children), SRCH-07 (pre-query renders children), tab URL sync.
- [ ] `tests/components/layout/DesktopTopNav.test.tsx` — extend or create; covers D-23 (no HeaderNav), D-24 (search icon + muted fill + form submit).
- [ ] (Optional) `tests/components/search/HighlightedText.test.tsx` — extracted helper if PeopleSearchRow gets too large.

*(No framework install required — Vitest + RTL + jsdom + msw all already configured per `vitest.config.ts` and `tests/setup.ts`.)*

## Security Domain

> `security_enforcement` is not explicitly false in `.planning/config.json`, so this section is included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Two-layer privacy (DAL `WHERE profile_public=true` + RLS) — established pattern |
| V2 Authentication | yes (consume only) | `getCurrentUser()` in Server Action; UnauthorizedError on missing session — existing pattern |
| V3 Session Management | yes (consume only) | Supabase SSR cookies — no Phase 16 changes |
| V4 Access Control | yes | viewer-aware DAL with explicit `viewerId` parameter (Phase 13 D-25); two-layer privacy |
| V5 Input Validation | yes | Zod `z.string().max(200).strict()` on Server Action input; DAL trims + length-checks; regex metacharacter escape on q before regex use in highlight |
| V6 Cryptography | no | No new secrets, no new tokens, no new crypto |
| V7 Error Handling | yes | Server Action catches DAL errors; logs to `console.error` with `[searchPeopleAction]` prefix; returns generic user-facing error message |
| V8 Data Protection | yes | Bio is rendered as React text nodes — never HTML — preventing stored-XSS |
| V9 Communications | n/a | Same-origin Server Action; HTTPS via Vercel |
| V10 Malicious Code | yes | No `eval`, no `new Function`, no `dangerouslySetInnerHTML` |
| V11 Business Logic | yes | 2-char minimum (server + client), bio length 3-char minimum, candidate cap of 50 — bound enumeration attacks |
| V13 API & Web Service | yes | Server Action signature includes input schema; rejects malformed payloads |

### Known Threat Patterns for Next.js 16 + Postgres + Drizzle + Supabase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via raw query string concatenation | Tampering | Drizzle `ilike()` parameterizes the value; never `sql\`%${q}%\`` with template-literal interpolation. Use `ilike(profiles.username, \`%${q}%\`)` where the second arg is a JS string passed as a parameter, OR construct pattern outside the SQL: `const pattern = \`%${q}%\`; ilike(profiles.username, pattern)`. Drizzle binds via param. |
| Stored XSS via bio | Tampering / Information Disclosure | Render bio as React text or via `<HighlightedText>` array splitting. NEVER `dangerouslySetInnerHTML`. |
| Privacy leak via search of private profiles | Information Disclosure | D-18 + RLS two-layer; `eq(profileSettings.profilePublic, true)` in DAL WHERE; RLS gate on `profiles` table |
| Username enumeration via search | Information Disclosure | Public profiles ARE meant to be discoverable — not a threat. Private profile gate prevents enumeration of private accounts. |
| Self-follow exploitation | Tampering | viewer self-exclusion in WHERE (`profiles.id != viewerId`) + FollowButton self-guard + Server Action follow self-guard (existing) |
| Over-fetching N+1 follow lookup | DoS / performance | Pitfall C-4 batched `inArray()` |
| Search-driven DB load | DoS | 2-char minimum (server + client); 50-row pre-LIMIT cap; 250ms debounce; Server Action auth-gated (no anon search) |
| Regex DoS via user query in highlight | DoS | Regex metacharacter escape: `q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` before constructing the highlight regex |
| CSRF on Server Action | Tampering | Next 16 Server Actions have built-in CSRF protection via origin header validation (verified) |

## Sources

### Primary (HIGH confidence)
- **Codebase grep + read** (this session, 2026-04-25):
  - `src/data/suggestions.ts` — getSuggestedCollectors shape and overlap pattern
  - `src/data/profiles.ts` — getProfileByUsername / getProfileSettings exports
  - `src/data/follows.ts` — isFollowing + batched `inArray` follow lookup pattern
  - `src/lib/tasteOverlap.ts` — computeTasteOverlap pure function
  - `src/components/home/SuggestedCollectorRow.tsx` — canonical row visual
  - `src/components/home/LoadMoreSuggestionsButton.tsx` — Server Action call pattern from Client Component
  - `src/components/profile/FollowButton.tsx` — variant="inline" already exposed
  - `src/components/ui/tabs.tsx` — base-ui Tabs already installed
  - `src/components/ui/input.tsx` — Input primitive variant base
  - `src/components/layout/DesktopTopNav.tsx` — current nav state and HeaderNav importer (only consumer)
  - `src/components/layout/HeaderNav.tsx` — file to delete
  - `src/app/search/page.tsx` — Phase 14 stub to replace
  - `src/app/actions/suggestions.ts` — Server Action pattern with Zod schema + ActionResult
  - `src/lib/auth.ts` — `getCurrentUser` + UnauthorizedError
  - `src/db/schema.ts` — profiles + profileSettings + follows table shapes
  - `package.json` — verified dep versions
  - `next.config.ts` — `cacheComponents: true` confirmed
  - `vitest.config.ts` — test framework setup
  - `tests/data/getSuggestedCollectors.test.ts` — test pattern to mirror for searchProfiles
- **Next.js 16 official docs (in-tree)** (verified 2026-04-25):
  - `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md` — `router.replace(href, { scroll: false })` signature confirmed
  - `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md` — Suspense boundary requirement for prerender
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` — searchParams is `Promise<...>` in Next 16
  - `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md` — Server Action directive shape
  - `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md` — cacheComponents page-level dynamic-by-default
- **Drizzle ORM source** (in-tree):
  - `node_modules/drizzle-orm/sql/expressions/conditions.d.ts:364` — `ilike()` signature
- **Supabase migration** (in-tree):
  - `supabase/migrations/20260423000003_phase11_pg_trgm.sql` — pg_trgm extension + GIN trigram indexes confirmed live

### Secondary (MEDIUM confidence)
- **CONTEXT.md decisions D-01..D-29** — User-locked, treated as authoritative for scope but design decisions should be sanity-checked against codebase reality during planning.

### Tertiary (LOW confidence)
- None this phase. All claims are either verified in tree or quoted directly from CONTEXT.md.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed at known versions; no `npm install` step required
- Architecture: HIGH — every pattern is a direct mirror of an existing pattern in the codebase
- Pitfalls: HIGH — Pitfalls C-1 through C-5 are pre-flagged in CONTEXT.md and ROADMAP.md; this research adds 5 more (Strict Mode double-effect, prerender bailout, ORDER BY cost, broken HeaderNav import, RegExp lastIndex) all backed by docs or codebase evidence
- Validation Architecture: HIGH — test framework confirmed, test files mapped 1:1 to requirements, gating Wave 0 list is concrete
- Security: HIGH — ASVS categories mapped to existing project patterns; no new attack surface beyond the trigram-bound search query
- AbortController + Server Action interaction (A1): MEDIUM — assumption documented; impact if wrong is benign (stale results dropped instead of canceled)

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (30 days for stable infrastructure-bound phase). Re-verify if upgrading Next.js minor or React minor before phase ships.
