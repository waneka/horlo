---
status: diagnosed
trigger: "G5-soft-nav-facet-not-applied — Selecting a new archetype chip from /explore does not apply the new facet on /search when navigation happens client-side (soft nav) — only a full page refresh applies it."
created: 2026-05-18
updated: 2026-05-18
---

## Current Focus

hypothesis: CONFIRMED — see Resolution.root_cause
test: Static trace of useSearchState.ts state init + URL-sync effect against Next.js App Router soft-nav semantics
expecting: N/A — root cause confirmed
next_action: Return diagnosis (goal: find_root_cause_only)

## Symptoms

expected: Clicking an archetype chip on /explore navigates to /search?tab=watches&archetype={value} and the new archetype facet is applied to the Watches results — every time, including when the user has already visited /search earlier in the session.
actual: Two related failures, both fixed by a hard page refresh:
  (1) After applying a first archetype, navigating back to /explore and clicking a DIFFERENT archetype chip does not apply the new filter — the ORIGINAL archetype stays applied on /search.
  (2) After removing the archetype facet via the X chip (URL param correctly removed), clicking a NEW archetype chip from /explore still does not apply it. User observes the new archetype URL param briefly appear, then it is stripped almost immediately.
errors: None reported.
reproduction: Open /explore, click archetype chip A → lands on /search filtered by A (correct). Navigate back to /explore, click archetype chip B → /search still shows A. Test 3 in 46-HUMAN-UAT.md.
started: Discovered during Phase 46 UAT (Test 3). Facet wiring built in plan 46-02.

## Eliminated

(none — root cause confirmed on first hypothesis from code trace)

## Evidence

- timestamp: 2026-05-18
  checked: useSearchState.ts lines 107-111 — brand/era/genre/archetype state initialization
  found: All four facets initialized via `useState(searchParams.get('X') ?? null)`. The initializer is a plain value (not a lazy function), but either way useState only reads the initial value on FIRST mount. There is NO useEffect that re-reads searchParams and re-seeds state when the params change on a subsequent soft navigation.
  implication: On a soft nav to /search?archetype=B, the component is NOT remounted (App Router keeps the page mounted), so `archetype` state stays at its previous value 'A' (or null). Incoming URL param B is never copied into state.

- timestamp: 2026-05-18
  checked: useSearchState.ts lines 134-149 — URL-sync useEffect
  found: This effect builds a URLSearchParams from CURRENT IN-MEMORY STATE (q, tab, movement, size, styleArr, brand, era, genre, archetype) and calls `router.replace(...)`. Its dependency array includes all those state values plus `router`. It does NOT depend on `searchParams`. It runs on mount and on every state change.
  implication: After a soft nav lands on /search?archetype=B, this effect fires (it runs on mount of the consuming render cycle, and React re-runs effects when the component re-renders post-navigation). Because in-memory `archetype` is still 'A' (or null), the effect writes the STALE value back into the URL via router.replace — overwriting the freshly-arrived `archetype=B`. This is exactly the observed symptom "the new archetype URL param briefly appears, then is stripped almost immediately."

- timestamp: 2026-05-18
  checked: SearchPageClient.tsx line 107 + app/search/page.tsx
  found: SearchPageClient calls useSearchState() once. The /search route is a single App Router page wrapped in <Suspense>. There is no `key` prop on SearchPageClient tied to the URL/searchParams that would force a remount on param change.
  implication: Confirms the page component (and therefore useSearchState) persists across soft navigations to different /search?... URLs. State is sticky; only a hard refresh tears down and rebuilds the component tree, which is why a hard refresh "fixes" it.

- timestamp: 2026-05-18
  checked: Watches sub-effect (lines 199-255) — the consumer of facet state
  found: The Watches fetch depends on `[debouncedQ, tab, movement, size, styleArr, brand, era, genre, archetype]` — all IN-MEMORY state, never `searchParams` directly.
  implication: Because the fetch reads in-memory facet state and that state is never re-seeded on soft nav, the results query uses the stale archetype. The UI shows archetype A's results even though the URL (briefly) said B. After the URL-sync effect strips B, URL and stale state agree on A again — fully self-consistent stale state.

## Resolution

root_cause: |
  `useSearchState` treats in-memory React state as the source of truth for facets and only seeds that state from URL params at FIRST MOUNT (`useState(searchParams.get('archetype') ?? null)` at useSearchState.ts:108-111). Next.js App Router soft navigation does NOT remount the /search page component, so navigating from /explore to a new /search?archetype=B URL never re-runs those initializers — the `archetype` state stays stale at its prior value.

  Two compounding faults produce the two observed symptoms:

  (1) MISSING RE-SEED: There is no effect that watches `useSearchParams()` and copies changed facet params back INTO state on navigation. On a soft nav, incoming `archetype=B` is ignored; the stale in-memory value (A) drives the Watches fetch (lines 199-255 depend only on in-memory state). → Symptom 1: old archetype stays applied.

  (2) URL-SYNC EFFECT OVERWRITES THE INCOMING PARAM: The URL-sync effect (useSearchState.ts:134-149) writes current in-memory state back to the URL via `router.replace`, and its dependency array contains only state values + `router` — NOT `searchParams`. After a soft nav lands on /search?archetype=B, this effect runs and rebuilds the query string from stale state (archetype A, or null after an X-chip removal), then `router.replace`s it — stripping the just-arrived `archetype=B` from the URL. → Symptom 2: the new param "appears then is stripped almost immediately."

  A hard refresh works because it fully remounts the component tree, so the `useState` initializers run fresh against the new URL.

  The architectural defect: URL is documented in comments as "the single source of truth" (SearchPageClient.tsx:308) but the implementation makes in-memory state the source of truth and only one-way-syncs state → URL. There is no URL → state sync, and the one-way sync actively clobbers externally-driven URL changes.

fix: |
  (empty — diagnose-only mode)
verification: ""
files_changed: []
