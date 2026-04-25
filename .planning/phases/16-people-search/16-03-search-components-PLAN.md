---
phase: 16-people-search
plan: 03
type: execute
wave: 2
depends_on:
  - 16-01
  - 16-02
files_modified:
  - src/components/search/useSearchState.ts
  - src/components/search/HighlightedText.tsx
  - src/components/search/PeopleSearchRow.tsx
  - src/components/search/SearchResultsSkeleton.tsx
  - src/components/search/ComingSoonCard.tsx
autonomous: true
requirements:
  - SRCH-03
  - SRCH-05

must_haves:
  truths:
    - "useSearchState hook owns q + debouncedQ + tab + URL sync + AbortController + fetch state in one place (D-28)"
    - "Debounce is exactly 250ms (D-03)"
    - "URL sync uses router.replace with { scroll: false } and omits ?tab= when tab='all' (D-04, D-12)"
    - "Tab gate: only 'all' and 'people' fire searchPeopleAction (SRCH-02 contract)"
    - "AbortController fires on cleanup; signal.aborted checked after each await (D-03 / Pitfall 2)"
    - "HighlightedText renders matched substrings as <strong> with font-semibold; never uses dangerouslySetInnerHTML (D-15 / Pitfall T-16-02)"
    - "Regex metacharacters in q are escaped before constructing the highlight regex (Pitfall T-16-05)"
    - "PeopleSearchRow visually mirrors SuggestedCollectorRow with bio snippet between overlap and shared cluster (D-13, D-14)"
    - "FollowButton initial state honored from result.isFollowing (D-19)"
    - "Mini-thumb cluster hidden on mobile via hidden sm:flex (D-17)"
    - "SearchResultsSkeleton renders 3-5 skeleton rows (D-09)"
    - "ComingSoonCard accepts a required variant: 'compact' | 'full' prop and renders differentiated testids (data-testid=\"coming-soon-card-compact\" vs data-testid=\"coming-soon-card-full\") so Plan 01 SearchPageClient tests can count footer vs full-page cards without collision (D-06, D-08)"
    - "Plan 01 RED tests for useSearchState and PeopleSearchRow go GREEN"
  artifacts:
    - path: "src/components/search/useSearchState.ts"
      provides: "Single source of truth for q ↔ URL ↔ fetch trifecta"
      exports: ["useSearchState"]
    - path: "src/components/search/HighlightedText.tsx"
      provides: "XSS-safe match-highlighting helper"
      exports: ["HighlightedText"]
    - path: "src/components/search/PeopleSearchRow.tsx"
      provides: "Result row component"
      exports: ["PeopleSearchRow"]
    - path: "src/components/search/SearchResultsSkeleton.tsx"
      provides: "Loading state placeholder"
      exports: ["SearchResultsSkeleton"]
    - path: "src/components/search/ComingSoonCard.tsx"
      provides: "Reusable coming-soon card (icon + heading + copy slot)"
      exports: ["ComingSoonCard"]
  key_links:
    - from: "src/components/search/useSearchState.ts"
      to: "src/app/actions/search.ts"
      via: "import searchPeopleAction (typed via @/lib/searchTypes)"
      pattern: "from '@/app/actions/search'"
    - from: "src/components/search/useSearchState.ts"
      to: "next/navigation"
      via: "useRouter + useSearchParams"
      pattern: "router.replace"
    - from: "src/components/search/PeopleSearchRow.tsx"
      to: "src/components/search/HighlightedText.tsx"
      via: "import HighlightedText"
      pattern: "<HighlightedText"
    - from: "src/components/search/PeopleSearchRow.tsx"
      to: "src/components/profile/FollowButton.tsx"
      via: "inline FollowButton with initialIsFollowing from result"
      pattern: "variant=\"inline\""
---

<objective>
Build the five client-side search primitives the page assembly will use in Plan 05.

Purpose: Compose the interactive surface and visual building blocks. None of these components owns routing; they are pure UI / pure-state. The hook centralizes the q ↔ URL ↔ fetch trifecta so the rest of the codebase doesn't reinvent debounce or stale-cancel semantics.

Output: 5 new files. After this plan, Plan 01's RED tests for `useSearchState` and `PeopleSearchRow` pass.
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

@src/components/home/SuggestedCollectorRow.tsx
@src/components/profile/FollowButton.tsx
@src/components/profile/AvatarDisplay.tsx
@src/components/ui/skeleton.tsx
@src/lib/searchTypes.ts
@src/lib/utils.ts
@src/app/explore/page.tsx

<interfaces>
<!-- Existing types and components this plan builds on -->

From src/lib/searchTypes.ts (Plan 01):
```ts
export interface SearchProfileResult {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  bioSnippet: string | null
  overlap: number  // 0..1
  sharedCount: number
  sharedWatches: Array<{ watchId: string; brand: string; model: string; imageUrl: string | null }>
  isFollowing: boolean
}
export type SearchTab = 'all' | 'people' | 'watches' | 'collections'
```

From src/app/actions/search.ts (Plan 02):
```ts
export async function searchPeopleAction(
  data: unknown,
): Promise<ActionResult<SearchProfileResult[]>>
```

From src/components/profile/FollowButton.tsx:
```tsx
export interface FollowButtonProps {
  viewerId: string | null
  targetUserId: string
  targetDisplayName: string
  initialIsFollowing: boolean
  variant?: 'primary' | 'locked' | 'inline'  // use 'inline' here
}
```

From src/components/home/SuggestedCollectorRow.tsx (canonical row layout to mirror):
```tsx
// Layout: avatar(40) · name + "X% taste overlap" · mini-thumb cluster · FollowButton
// Whole-row Link absolute-inset overlay; FollowButton raised with relative z-10
// Mini-thumb cluster wrapped in `hidden sm:flex` for D-17 mobile responsiveness
```

From src/components/ui/skeleton.tsx:
```tsx
// Standard shadcn Skeleton primitive — animate-pulse rounded-md bg-muted
// Use as building blocks for SearchResultsSkeleton (3-5 rows)
```

From next/navigation (Next 16 verified docs):
```ts
useRouter().replace(href: string, options?: { scroll?: boolean })  // scroll: false preserves position
useSearchParams() returns ReadonlyURLSearchParams
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create src/components/search/useSearchState.ts hook</name>
  <files>src/components/search/useSearchState.ts</files>
  <read_first>
    - tests/components/search/useSearchState.test.tsx (Plan 01 RED test — every assertion must pass)
    - .planning/phases/16-people-search/16-CONTEXT.md (D-03, D-04, D-12, D-28)
    - .planning/phases/16-people-search/16-RESEARCH.md Pattern 2 (full hook sketch — adapt verbatim)
    - src/lib/searchTypes.ts (SearchTab + SearchProfileResult)
    - src/app/actions/search.ts (Plan 02 — searchPeopleAction signature)
  </read_first>
  <behavior>
    Public API: `{ q, setQ, debouncedQ, tab, setTab, results, isLoading, hasError }`
    - Initial state: q = searchParams.get('q') ?? ''; tab = (searchParams.get('tab') as SearchTab) ?? 'all'
    - Debounce: q → debouncedQ via setTimeout(250) cleanup
    - URL sync effect: on debouncedQ or tab change, build URLSearchParams (omit q if length<2, omit tab if 'all'), call router.replace(qs ? `/search?${qs}` : '/search', { scroll: false })
    - Fetch effect: tab gate (only 'all' and 'people' fire); q.trim().length < 2 short-circuits; AbortController per fetch; signal.aborted check after await; cleanup calls controller.abort()
    - Result handling: { success: true, data } → setResults(data); { success: false } → setHasError(true) + setResults([])
  </behavior>
  <action>
Create `src/components/search/useSearchState.ts` per RESEARCH.md Pattern 2. Verbatim implementation:

```ts
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { searchPeopleAction } from '@/app/actions/search'
import type { SearchProfileResult, SearchTab } from '@/lib/searchTypes'

const DEBOUNCE_MS = 250          // D-03
const CLIENT_MIN_CHARS = 2       // D-03 client-side defense (DAL also gates per D-20)

export interface UseSearchState {
  q: string
  setQ: (next: string) => void
  debouncedQ: string
  tab: SearchTab
  setTab: (next: SearchTab) => void
  results: SearchProfileResult[]
  isLoading: boolean
  hasError: boolean
}

/**
 * Phase 16 People Search — single source of truth for the q ↔ URL ↔ fetch
 * trifecta (D-28). Owns:
 *
 *   - q (current input, immediate)
 *   - debouncedQ (250ms-debounced derivation)
 *   - tab (SearchTab; defaults to 'all', omitted from URL when active per D-12)
 *   - URL sync via router.replace({ scroll: false }) (D-04 — single history entry)
 *   - Fetch effect with AbortController + cleanup (D-03 — stale-cancel)
 *   - Tab gate: only 'all' and 'people' fire searchPeopleAction (SRCH-02)
 *   - 2-char client minimum (D-20 server-side is the authoritative gate)
 *
 * Cleanup ordering: when q changes, the debounce timer cleanup runs FIRST
 * (clearing the pending timer), then on the next debouncedQ change the fetch
 * effect cleanup aborts the prior controller. This ordering keeps stale fetches
 * out of the UI without flicker.
 *
 * AbortController on Server Actions (Assumption A1 in RESEARCH.md): the browser
 * fetch transport honors abort; server-side execution may continue but the
 * response is dropped. The `signal.aborted` check after each `await` ensures
 * stale results never land in component state.
 */
export function useSearchState(): UseSearchState {
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

  // 1. Debounce q → debouncedQ (D-03 250ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [q])

  // 2. URL sync (D-04 router.replace, scroll: false; D-12 omit tab=all)
  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedQ.trim().length >= CLIENT_MIN_CHARS) params.set('q', debouncedQ)
    if (tab !== 'all') params.set('tab', tab)
    const qs = params.toString()
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false })
  }, [debouncedQ, tab, router])

  // 3. Fetch effect with AbortController (D-03 / SRCH-02 tab gate)
  useEffect(() => {
    // Tab gate: only People + All fire (SRCH-02 — Watches/Collections render coming-soon only)
    if (tab !== 'all' && tab !== 'people') {
      setResults([])
      setIsLoading(false)
      setHasError(false)
      return
    }
    // 2-char client minimum (D-20 server-side is authoritative)
    if (debouncedQ.trim().length < CLIENT_MIN_CHARS) {
      setResults([])
      setIsLoading(false)
      setHasError(false)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setHasError(false)

    void (async () => {
      try {
        const result = await searchPeopleAction({ q: debouncedQ })
        if (controller.signal.aborted) return  // Pitfall 2 stale-result guard
        if (!result.success) {
          setHasError(true)
          setResults([])
        } else {
          setResults(result.data)
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        if (controller.signal.aborted) return
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
  </action>
  <verify>
    <automated>npm run test -- tests/components/search/useSearchState.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/components/search/useSearchState.ts` returns 0
    - `grep -q "'use client'" src/components/search/useSearchState.ts` matches
    - `grep -q '250' src/components/search/useSearchState.ts` matches (D-03 debounce ms)
    - `grep -q 'router.replace' src/components/search/useSearchState.ts` matches (D-04)
    - `grep -q 'scroll: false' src/components/search/useSearchState.ts` matches (D-04)
    - `grep -q 'AbortController' src/components/search/useSearchState.ts` matches (D-03)
    - `grep -q 'controller.signal.aborted' src/components/search/useSearchState.ts` matches (Pitfall 2)
    - `grep -q "tab !== 'all' &amp;&amp; tab !== 'people'" src/components/search/useSearchState.ts` matches (SRCH-02 tab gate)
    - `grep -qE "trim\\(\\)\\.length < (CLIENT_MIN_CHARS|2)" src/components/search/useSearchState.ts` matches (D-03 client gate)
    - `grep -q "tab !== 'all'" src/components/search/useSearchState.ts` matches (D-12 omit-tab-when-all)
    - `npm run test -- tests/components/search/useSearchState.test.tsx` exits 0 (Plan 01 RED → GREEN)
  </acceptance_criteria>
  <done>useSearchState hook live; all 10 Plan 01 tests pass; debounce + abort + URL sync + tab gate verifiable.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create src/components/search/HighlightedText.tsx (XSS-safe match highlighting)</name>
  <files>src/components/search/HighlightedText.tsx</files>
  <read_first>
    - .planning/phases/16-people-search/16-CONTEXT.md (D-15)
    - .planning/phases/16-people-search/16-RESEARCH.md Pattern 4 (full sketch including regex metachar escape)
    - tests/components/search/PeopleSearchRow.test.tsx (XSS test fixture + regex safety test)
  </read_first>
  <behavior>
    - Empty q → returns text as-is (no work)
    - Match found → matched substring wrapped in <strong className="font-semibold text-foreground">
    - Case-insensitive: q="LI" + text="liam" → "li" wrapped (original casing of text preserved)
    - XSS-safe: text="<script>alert(1)</script>nice" rendered as text nodes; no actual <script> in DOM
    - Regex metachar safe: q="(.*)" or "$" or "\" does not throw
  </behavior>
  <action>
Create `src/components/search/HighlightedText.tsx`:

```tsx
'use client'

import { Fragment } from 'react'

/**
 * Phase 16 D-15 match highlighting.
 *
 * XSS-safe: bio is user-controlled untrusted text (Pitfall T-16-02 stored XSS).
 * NEVER uses dangerouslySetInnerHTML. Builds React node array via String.split
 * with a case-insensitive regex; matched substrings wrapped in <strong>, others
 * emitted as plain text Fragments (so `<script>...` in bio appears as TEXT,
 * not parsed HTML).
 *
 * Regex metachar escape (Pitfall T-16-05): user query may contain regex
 * metacharacters like `(`, `.`, `*`, `\`. Escape before constructing the regex
 * to prevent both runtime errors and ReDoS-style pathological patterns.
 *
 * Highlight style: <strong className="font-semibold text-foreground">. Per
 * Pitfall 7 in research, <mark> is rejected because its UA-default yellow
 * background fights theme tokens; <strong> with font-weight bump is the
 * lightest-touch visual signal that respects light/dark mode.
 */
export function HighlightedText({ text, q }: { text: string; q: string }) {
  const trimmedQ = q.trim()
  if (!trimmedQ) return <>{text}</>

  // Pitfall T-16-05: escape regex metacharacters before constructing the regex
  const escapedQ = trimmedQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(${escapedQ})`, 'gi')

  const parts = text.split(re)
  const lowerQ = trimmedQ.toLowerCase()
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === lowerQ ? (
          <strong key={i} className="font-semibold text-foreground">
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}
```
  </action>
  <verify>
    <automated>npm run test -- tests/components/search/PeopleSearchRow.test.tsx 2&gt;&amp;1 | grep -E 'highlight|XSS|metachar|regex' || npm run test -- tests/components/search/PeopleSearchRow.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/components/search/HighlightedText.tsx` returns 0
    - `grep -q "'use client'" src/components/search/HighlightedText.tsx` matches
    - `grep -q 'export function HighlightedText' src/components/search/HighlightedText.tsx` matches
    - `grep -q 'escapedQ\\|.replace(/' src/components/search/HighlightedText.tsx` matches (regex metachar escape)
    - `! grep -q 'dangerouslySetInnerHTML' src/components/search/HighlightedText.tsx` (XSS-safe)
    - `grep -q '<strong' src/components/search/HighlightedText.tsx` matches
    - `grep -q "font-semibold" src/components/search/HighlightedText.tsx` matches
    - `grep -q 'gi' src/components/search/HighlightedText.tsx` matches (case-insensitive flag)
  </acceptance_criteria>
  <done>HighlightedText helper exists and is XSS- + ReDoS-safe.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create src/components/search/PeopleSearchRow.tsx</name>
  <files>src/components/search/PeopleSearchRow.tsx</files>
  <read_first>
    - src/components/home/SuggestedCollectorRow.tsx (visual pattern — copy structure, add bio snippet between name/overlap and shared cluster)
    - src/components/profile/FollowButton.tsx (initialIsFollowing prop)
    - src/lib/searchTypes.ts (SearchProfileResult)
    - src/components/search/HighlightedText.tsx (Task 2 — used for username + bio highlighting)
    - tests/components/search/PeopleSearchRow.test.tsx (Plan 01 — every assertion must pass)
    - .planning/phases/16-people-search/16-CONTEXT.md (D-13, D-14, D-15, D-16, D-17)
  </read_first>
  <behavior>
    - Layout: avatar(40) · [name (HighlightedText) + "{N}% taste overlap" + bio snippet (HighlightedText, line-clamp-1)] · mini-thumb cluster (hidden sm:flex) · FollowButton variant="inline" with initialIsFollowing from result.isFollowing
    - Whole-row absolute-inset Link to /u/{username}/collection
    - FollowButton wrapped in relative z-10 div (so click doesn't bubble through)
    - Mini-thumbs render up to 3, with `{N} shared` count when sharedWatches.length > 0
    - Match highlighting on both username and bio snippet
  </behavior>
  <action>
Create `src/components/search/PeopleSearchRow.tsx` adapting `SuggestedCollectorRow.tsx`:

```tsx
import Link from 'next/link'
import Image from 'next/image'
import { Watch as WatchIcon } from 'lucide-react'

import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import { FollowButton } from '@/components/profile/FollowButton'
import { HighlightedText } from '@/components/search/HighlightedText'
import type { SearchProfileResult } from '@/lib/searchTypes'

/**
 * Phase 16 People Search result row (SRCH-05).
 *
 * Mirrors src/components/home/SuggestedCollectorRow.tsx visual pattern (D-13)
 * with three differences:
 *   1. Adds a 1-line bio snippet between the overlap line and the shared-watch
 *      cluster (D-14, line-clamp-1 truncation).
 *   2. Username and bio snippet are wrapped in <HighlightedText> for D-15
 *      match highlighting against the active query.
 *   3. FollowButton.initialIsFollowing is hydrated from result.isFollowing
 *      (D-19 — search may surface already-followed collectors; the inline
 *      FollowButton renders the correct "Following" state without a roundtrip).
 *
 * Click semantics (mirrors SuggestedCollectorRow):
 *   - Whole-row absolute-inset Link → /u/{username}/collection
 *   - FollowButton raised with relative z-10 so click does not bubble
 *
 * Mini-thumb cluster hidden on mobile via `hidden sm:flex` (D-17) — keeps row
 * scannable on narrow viewports.
 *
 * Privacy: this row is rendered by /search; the DAL (Plan 02) enforces
 * profile_public = true upstream — private profiles never reach this component.
 */
export function PeopleSearchRow({
  result,
  q,
  viewerId,
}: {
  result: SearchProfileResult
  q: string
  viewerId: string
}) {
  const name = result.displayName ?? result.username
  const overlapPct = Math.round(result.overlap * 100)

  return (
    <div className="group relative flex items-center gap-4 min-h-16 md:min-h-20 bg-card px-4 py-3 rounded-md transition-colors hover:bg-muted/40">
      <Link
        href={`/u/${result.username}/collection`}
        aria-label={`${name}'s profile`}
        className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <AvatarDisplay
        avatarUrl={result.avatarUrl}
        displayName={result.displayName}
        username={result.username}
        size={40}
      />
      <div className="relative flex-1 min-w-0 pointer-events-none">
        <p className="text-sm font-semibold truncate">
          <HighlightedText text={name} q={q} />
        </p>
        <p className="text-sm text-muted-foreground">
          {overlapPct}% taste overlap
        </p>
        {result.bioSnippet && (
          <p className="text-sm text-muted-foreground line-clamp-1">
            <HighlightedText text={result.bioSnippet} q={q} />
          </p>
        )}
      </div>
      {result.sharedWatches.length > 0 && (
        <div className="relative hidden sm:flex items-center pointer-events-none">
          {result.sharedWatches.map((w, i) => (
            <div
              key={w.watchId}
              className="size-10 md:size-12 rounded-full bg-muted ring-2 ring-card overflow-hidden flex items-center justify-center"
              style={{ marginLeft: i === 0 ? 0 : '-0.5rem' }}
            >
              {w.imageUrl ? (
                <Image
                  src={w.imageUrl}
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
          ))}
          <span
            className="text-sm text-muted-foreground ml-3"
            aria-label={`${result.sharedCount} shared watches with you`}
          >
            {result.sharedCount} shared
          </span>
        </div>
      )}
      <div className="relative z-10">
        <FollowButton
          viewerId={viewerId}
          targetUserId={result.userId}
          targetDisplayName={name}
          initialIsFollowing={result.isFollowing}
          variant="inline"
        />
      </div>
    </div>
  )
}
```
  </action>
  <verify>
    <automated>npm run test -- tests/components/search/PeopleSearchRow.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/components/search/PeopleSearchRow.tsx` returns 0
    - `grep -q 'export function PeopleSearchRow' src/components/search/PeopleSearchRow.tsx` matches
    - `grep -q 'HighlightedText' src/components/search/PeopleSearchRow.tsx` matches (D-15)
    - `grep -q 'line-clamp-1' src/components/search/PeopleSearchRow.tsx` matches (D-14)
    - `grep -q 'hidden sm:flex' src/components/search/PeopleSearchRow.tsx` matches (D-17)
    - `grep -q 'initialIsFollowing={result.isFollowing}' src/components/search/PeopleSearchRow.tsx` matches (D-19)
    - `grep -q 'variant="inline"' src/components/search/PeopleSearchRow.tsx` matches (D-13)
    - `grep -q 'taste overlap' src/components/search/PeopleSearchRow.tsx` matches (D-16 copy)
    - `grep -q 'absolute inset-0' src/components/search/PeopleSearchRow.tsx` matches (whole-row link)
    - `grep -q 'relative z-10' src/components/search/PeopleSearchRow.tsx` matches (FollowButton raise)
    - `npm run test -- tests/components/search/PeopleSearchRow.test.tsx` exits 0 (Plan 01 RED → GREEN)
  </acceptance_criteria>
  <done>Result row component live; all 10 Plan 01 tests pass.</done>
</task>

<task type="auto">
  <name>Task 4: Create src/components/search/SearchResultsSkeleton.tsx</name>
  <files>src/components/search/SearchResultsSkeleton.tsx</files>
  <read_first>
    - src/components/ui/skeleton.tsx (Skeleton primitive)
    - .planning/phases/16-people-search/16-CONTEXT.md (D-09)
  </read_first>
  <action>
Create `src/components/search/SearchResultsSkeleton.tsx`:

```tsx
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Phase 16 D-09 loading state.
 *
 * Renders 4 skeleton rows that visually approximate <PeopleSearchRow>'s
 * footprint: avatar circle + two stacked text bars (name + overlap line) +
 * right-side chip (FollowButton placeholder). Mirrors the shimmer pattern
 * used by NetworkActivityFeed and SuggestedCollectors so the loading
 * transition reads as continuous chrome, not "search-specific spinner".
 *
 * Pure render component (no client interactivity) — Server-Component-safe.
 *
 * The data-testid hooks let Plan 01 RTL tests assert "skeleton is visible
 * during fetch" without coupling to internal class names.
 */
export function SearchResultsSkeleton() {
  return (
    <div className="space-y-2" data-testid="search-skeleton">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 min-h-16 md:min-h-20 bg-card px-4 py-3 rounded-md"
          data-testid="search-skeleton-row"
        >
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
      ))}
    </div>
  )
}
```
  </action>
  <verify>
    <automated>test -f src/components/search/SearchResultsSkeleton.tsx &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/components/search/SearchResultsSkeleton.tsx` returns 0
    - `grep -q 'export function SearchResultsSkeleton' src/components/search/SearchResultsSkeleton.tsx` matches
    - `grep -q "data-testid=\"search-skeleton\"" src/components/search/SearchResultsSkeleton.tsx` matches
    - `grep -q "data-testid=\"search-skeleton-row\"" src/components/search/SearchResultsSkeleton.tsx` matches
    - `grep -qE "length: [4-5]" src/components/search/SearchResultsSkeleton.tsx` matches (3-5 rows per D-09)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Skeleton renders 4 rows shaped like PeopleSearchRow.</done>
</task>

<task type="auto">
  <name>Task 5: Create src/components/search/ComingSoonCard.tsx (reusable for D-06 + D-08)</name>
  <files>src/components/search/ComingSoonCard.tsx</files>
  <read_first>
    - src/app/explore/page.tsx (visual pattern — muted accent-bg circle + lucide icon + serif heading + muted-foreground p)
    - .planning/phases/16-people-search/16-CONTEXT.md (D-06, D-08, Open Question 2 in research recommendation)
    - .planning/phases/16-people-search/16-RESEARCH.md Open Question 2 (visual pattern guidance)
  </read_first>
  <behavior>
    Two visual variants driven by a required `variant: 'compact' | 'full'` prop with DIFFERENTIATED testids so Plan 01 SearchPageClient tests can count the All-tab footer cards (D-06: 2 `coming-soon-card-compact`) without colliding with the full-page Watches/Collections panels (D-08: 1 `coming-soon-card-full`):
    - variant='compact' (D-06 All-tab footer cards): inline horizontal layout, smaller — suitable for two side-by-side or stacked beneath the result list. Renders `data-testid="coming-soon-card-compact"`.
    - variant='full' (D-08 Watches/Collections tab full-page state): centered, full-page like /explore stub. Renders `data-testid="coming-soon-card-full"`.
  </behavior>
  <action>
Create `src/components/search/ComingSoonCard.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Phase 16 reusable coming-soon card.
 *
 * Two visual variants:
 *
 *   compact = false (D-08 default, full-page tab state for Watches/Collections):
 *     Centered, generous vertical padding, mirrors /explore stub pattern —
 *     muted accent-bg circle + lucide icon + serif h1 + muted-foreground p.
 *
 *   compact = true (D-06 All-tab footer card, two cards side-by-side):
 *     Smaller horizontal layout — leading icon in muted circle, heading +
 *     copy in a row. Lower visual weight so the result list above stays
 *     primary.
 *
 * Tagged with differentiated data-testids so Plan 01 SearchPageClient tests
 * can count footer cards without colliding with full-page panels:
 *   - variant='compact' → data-testid="coming-soon-card-compact"
 *   - variant='full'    → data-testid="coming-soon-card-full"
 * (D-06 All tab: 2 compact; D-07 People tab: 0 compact; D-08 Watches/Collections tab: 1 full)
 *
 * Copy is decided per call site (D-08 Claude's discretion):
 *   - Watches tab full-page: "Watches search is on its way. We'll surface
 *     models once we normalize the watch catalog across collectors."
 *   - Collections tab full-page: "Collections are a separate product surface —
 *     coming after the watch catalog lands."
 *   - All-tab footer (compact, Watches): "Watch search coming soon"
 *   - All-tab footer (compact, Collections): "Collection search coming soon"
 *
 * Plan 05 supplies the exact copy; this component is purely structural.
 */
export function ComingSoonCard({
  icon: Icon,
  heading,
  copy,
  variant,
}: {
  icon: LucideIcon
  heading: string
  copy: string
  variant: 'compact' | 'full'
}) {
  if (variant === 'compact') {
    return (
      <div
        data-testid="coming-soon-card-compact"
        className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3"
      >
        <div className="flex size-9 flex-none items-center justify-center rounded-full bg-accent/10">
          <Icon className="size-4 text-accent" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{heading}</p>
          <p className="text-sm text-muted-foreground">{copy}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="coming-soon-card-full"
      className={cn(
        'mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-24 text-center',
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent/10">
        <Icon className="size-6 text-accent" aria-hidden />
      </div>
      <h2 className="font-serif text-3xl md:text-4xl text-foreground">
        {heading}
      </h2>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">{copy}</p>
    </div>
  )
}
```
  </action>
  <verify>
    <automated>test -f src/components/search/ComingSoonCard.tsx &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/components/search/ComingSoonCard.tsx` returns 0
    - `grep -q 'export function ComingSoonCard' src/components/search/ComingSoonCard.tsx` matches
    - `grep -q 'data-testid="coming-soon-card-compact"' src/components/search/ComingSoonCard.tsx` matches (D-06 footer testid)
    - `grep -q 'data-testid="coming-soon-card-full"' src/components/search/ComingSoonCard.tsx` matches (D-08 full-page testid)
    - `grep -q "variant: 'compact' | 'full'" src/components/search/ComingSoonCard.tsx` matches (typed required prop, no boolean shortcut)
    - `! grep -q 'compact?: boolean' src/components/search/ComingSoonCard.tsx` (the legacy boolean prop is gone — required `variant` only)
    - `grep -q 'font-serif' src/components/search/ComingSoonCard.tsx` matches (full-page variant matches /explore pattern)
    - `grep -q 'bg-accent/10' src/components/search/ComingSoonCard.tsx` matches (icon circle pattern)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Two-variant coming-soon card ready for Plan 05 to instantiate with concrete copy.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User input → search regex | q is user-typed; flows into HighlightedText regex construction |
| User-supplied bio → DOM render | bio is stored user input; renders inside PeopleSearchRow via HighlightedText |
| Server Action result → component state | searchPeopleAction returns ActionResult<>; setResults/setHasError on success/failure branches |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-16-02 | Tampering / Info Disclosure (stored XSS via bio) | src/components/search/HighlightedText.tsx + PeopleSearchRow.tsx | mitigate | HighlightedText splits the input string with a regex and emits React Fragment + <strong> nodes. NEVER uses dangerouslySetInnerHTML — verified by zero-match grep gate in acceptance criteria. Bio renders as text nodes; `<script>` in bio appears as visible text, never as a parsed DOM element. |
| T-16-04 | DoS (search-driven request flood) | src/components/search/useSearchState.ts | mitigate | 250ms debounce, 2-char client gate, AbortController cancels stale fetches. Tab gate prevents Watches/Collections tabs from firing the action. |
| T-16-05 | DoS (regex DoS / catastrophic backtracking) | src/components/search/HighlightedText.tsx | mitigate | `q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` escapes regex metachars before constructing the highlight regex — the constructed pattern is `(literal-q)` only, no quantifiers or alternation in user-controlled space. |
| T-16-04b | DoS (effect storm via React 19 Strict Mode double-effect) | src/components/search/useSearchState.ts | accept | Documented in research Pitfall 3. Cleanup runs before next effect; AbortController behavior is well-defined under double-effect. Treated as a feature, not a vulnerability. |
| T-16-08 | Tampering (CSRF on Server Action) | src/components/search/useSearchState.ts (calls searchPeopleAction) | mitigate | Built-in Next.js 16 Server Action origin-header CSRF protection (verified in research). The hook is purely client-side and adds no new attack surface. |
</threat_model>

<verification>
After all 5 tasks complete:

1. `npm run test -- tests/components/search/useSearchState.test.tsx` exits 0 — Plan 01 hook tests GREEN
2. `npm run test -- tests/components/search/PeopleSearchRow.test.tsx` exits 0 — Plan 01 row tests GREEN
3. `npm run test` — full suite GREEN. (DesktopTopNav RED tests from Plan 01 Task 6 remain RED until Plan 04 — that's expected.)
4. `npm run lint` exits 0
5. `npx tsc --noEmit` exits 0
6. No `dangerouslySetInnerHTML` anywhere in `src/components/search/`: `! grep -rn 'dangerouslySetInnerHTML' src/components/search/`
</verification>

<success_criteria>
Plan 03 succeeds when:
- 5 component files exist in src/components/search/
- useSearchState + PeopleSearchRow tests are GREEN
- Zero dangerouslySetInnerHTML in src/components/search/
- Full-suite TypeScript + ESLint clean
- Single commit `feat(16): add useSearchState hook + PeopleSearchRow + supporting search components`
</success_criteria>

<output>
After completion, create `.planning/phases/16-people-search/16-03-SUMMARY.md` recording:
- 5 files created (paths + line counts)
- 2 RED → GREEN transitions (useSearchState, PeopleSearchRow tests)
- Note: SearchPageClient and DesktopTopNav RED tests remain RED until Plans 04 + 05
</output>
