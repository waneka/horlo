---
phase: 19-search-watches-collections
plan: 03
subsystem: search
tags: [search, ui, react, tailwind, xss-safe, highlighted-text-reuse]

# Dependency graph
requires:
  - phase: 19
    plan: 01
    provides: SearchCatalogWatchResult type contract (catalogId, brand, model, reference, imageUrl, ownersCount, wishlistCount, viewerState union)
  - phase: 16
    plan: ""
    provides: HighlightedText XSS-safe primitive (regex-escape + React text children only) — reused unchanged
  - phase: 17
    plan: ""
    provides: catalog imageUrl write-time sanitizer (sanitizeHttpUrl in src/data/catalog.ts) — http/https only
provides:
  - WatchSearchRow — Watches tab result row (whole-row absolute-inset Link → /evaluate?catalogId={uuid}; raised inline Evaluate CTA; single contextual pill — D-05/D-07/D-08)
  - WatchSearchResultsSkeleton — 4-row loading skeleton with watch-thumb shape + chip placeholder for Plan 05 wiring (data-testid="watch-search-skeleton")
affects: [19-05 unified-search-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Whole-row absolute-inset <Link> + raised inline-CTA <Link> with relative z-10 — same DOM grammar as PeopleSearchRow + SuggestedCollectorRow; right-click Open-in-New-Tab works on either affordance because both are <a>"
    - "Single contextual pill via inline conditional — <span> with bg-primary text-primary-foreground (Owned) | bg-muted text-muted-foreground (Wishlist) | nothing when viewerState===null"
    - "Outline-button styling on a <Link> via buttonVariants({variant:'outline', size:'sm'}) — matches codebase convention (e.g., src/components/explore/TrendingWatches.tsx) and avoids the missing radix-style asChild on base-ui Button"
    - "next/image with unoptimized + WatchIcon (lucide) fallback when imageUrl is null — same pattern as SuggestedCollectorRow shared-watch cluster"

key-files:
  created:
    - src/components/search/WatchSearchRow.tsx (Watches tab result row — 95 LOC; HighlightedText reuse on brand+model + reference; pill matrix; raised Evaluate CTA)
    - src/components/search/WatchSearchResultsSkeleton.tsx (4-row loading skeleton — watch-thumb shape; data-testid hooks for Plan 05 wiring)
    - tests/components/search/WatchSearchRow.test.tsx (11 RTL tests — Tests 1..11 each as a single explicitly numbered it() block)
  modified: []

key-decisions:
  - "Inline Evaluate CTA implemented as <Link className={buttonVariants({variant:'outline', size:'sm'})}> instead of plan template's <Button asChild>. base-ui Button has no asChild prop (asChild is a radix-slot pattern). Codebase convention (TrendingWatches See-all link) is Link+buttonVariants. Same DOM (<a>), same styling, no behavior change."
  - "Both affordances (whole-row absolute-inset Link + raised inline Evaluate CTA) point to the same href /evaluate?catalogId={uuid}. Two <a> elements expected and locked by Test 4."
  - "Wishlist pill class string (bg-muted text-muted-foreground) is independently greppable from Owned (bg-primary text-primary-foreground) — both class strings appear as literal substrings in the JSX."

patterns-established:
  - "Search result rows in Phase 19+ should use the absolute-inset Link + raised z-10 inline CTA pattern (PeopleSearchRow + SuggestedCollectorRow + WatchSearchRow all share this grammar). Plan 04 CollectionSearchRow will follow the same shape."
  - "When the codebase Button is base-ui (not radix), prefer <Link className={buttonVariants(...)}> over Button-asChild for outline-button-as-link styling. asChild is a radix-only pattern."

requirements-completed: [SRCH-09, SRCH-15]

# Metrics
duration: ~5 min
completed: 2026-04-28
---

# Phase 19 Plan 03: Watches Tab Result Row Summary

**Two pure-UI components — `WatchSearchRow` (Watches tab result row, whole-row absolute-inset Link + raised inline Evaluate CTA, single contextual pill, HighlightedText reuse on brand+model + reference) and `WatchSearchResultsSkeleton` (4-row loading skeleton with watch-thumb shape) — wired to the SearchCatalogWatchResult type contract from Plan 01, ready for Plan 05 to wire into SearchPageClient.**

## Performance

- **Duration:** ~5 minutes
- **Tasks:** 2 of 2 completed
- **Files created:** 3 (1 row component + 1 skeleton component + 1 test file)
- **Files modified:** 0
- **Tests added:** 11 RTL tests (each labeled `Test N`, N ∈ 1..11)
- **Test results:** 11/11 pass; 33/33 search-component tests pass (no regression in PeopleSearchRow or useSearchState)

## Accomplishments

- `WatchSearchRow` exported from `src/components/search/WatchSearchRow.tsx` — props `{ result: SearchCatalogWatchResult, q: string }`; renders a whole-row absolute-inset `<Link href="/evaluate?catalogId={uuid}">` overlaid on a `bg-card` row, plus a raised inline Evaluate CTA (`relative z-10`) that resolves to the same href so right-click → Open in New Tab works on either affordance. The Evaluate CTA is a `<Link>` styled with `buttonVariants({variant:'outline', size:'sm'})` (deviation note below).
- Single contextual pill (D-05) implemented as inline conditional `<span>`s with grep-stable class strings: `bg-primary text-primary-foreground` for `Owned`, `bg-muted text-muted-foreground` for `Wishlist`, nothing when `viewerState === null`. Already-owned watches stay in results and are badged inline (D-06).
- Brand+model and reference are wrapped in `<HighlightedText>` for D-15 / SRCH-15 match highlighting; `HighlightedText` is reused unchanged from Phase 16 (regex-escapes `q` and emits React text children only — never `dangerouslySetInnerHTML`). Test 7 in Phase 16's HighlightedText suite already locks the XSS surface, and grep confirms zero `dangerouslySetInnerHTML` references in the new file.
- `next/image` with `unoptimized` for the catalog thumbnail; falls back to `<WatchIcon>` (lucide) when `imageUrl` is null.
- `WatchSearchResultsSkeleton` exported from `src/components/search/WatchSearchResultsSkeleton.tsx` — pure render component (Server-Component-safe), 4 rows, `size-10 md:size-12 rounded-full` watch-thumb shape, `<Skeleton className="h-7 w-20 rounded-md" />` chip placeholder for the Evaluate button. `data-testid="watch-search-skeleton"` and `data-testid="watch-search-skeleton-row"` hooks let Plan 05 wiring tests assert "skeleton is visible during fetch" without coupling to internal class names.

## Task Commits

1. **Task 1 RED — failing tests for WatchSearchRow:** `175de93`
2. **Task 1 GREEN — WatchSearchRow implementation:** `2696be2`
3. **Task 2 — WatchSearchResultsSkeleton:** `db3b7c5`

(Commit `f1a0e3e` is the wave-1 base — Plan 01 SUMMARY/state docs — not part of this plan's work.)

## Files Created/Modified

### Created

- **`src/components/search/WatchSearchRow.tsx`** (95 LOC) — Watches tab result row component. Imports `Link` from `next/link`, `Image` from `next/image`, `Watch as WatchIcon` from `lucide-react`, `HighlightedText` from `@/components/search/HighlightedText`, `buttonVariants` from `@/components/ui/button`, and the `SearchCatalogWatchResult` type from `@/lib/searchTypes`. Exports a single function component named `WatchSearchRow`.
- **`src/components/search/WatchSearchResultsSkeleton.tsx`** (32 LOC) — 4-row loading skeleton mirroring `WatchSearchRow` layout. Imports only the `Skeleton` primitive. Exports a single function component named `WatchSearchResultsSkeleton`.
- **`tests/components/search/WatchSearchRow.test.tsx`** (154 LOC) — 11 RTL tests, each as a single explicitly numbered `it('Test N — ...')` block. Stubs `next/link` and `next/image` as plain `<a>` and `<img>` (mirrors `PeopleSearchRow.test.tsx` mock pattern). Locks: HighlightedText `<strong>` wrap on q="Sub", reference render-or-omit, both Link href targets, raised z-10 Evaluate CTA, three pill states (Owned class string + Wishlist class string + null), WatchIcon fallback, next/image render path.

### Modified

None.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Replaced `<Button asChild>` with `<Link className={buttonVariants(...)}>` for the inline Evaluate CTA**
- **Found during:** Task 1 GREEN (writing the implementation).
- **Issue:** The plan template (line 317 of `19-03-PLAN.md`) specified `<Button asChild variant="outline" size="sm"><Link href={href}>Evaluate</Link></Button>`. The codebase `Button` is from `@base-ui/react/button` (verified in `src/components/ui/button.tsx` line 1: `import { Button as ButtonPrimitive } from "@base-ui/react/button"`). base-ui's Button does NOT have an `asChild` prop — `asChild` is a radix-slot pattern, and base-ui uses `render` for slot composition (e.g., `src/components/ui/dialog.tsx:112` uses `<DialogPrimitive.Close render={<Button variant="outline" />}>`). Using `<Button asChild>` would have been a TypeScript error and a runtime no-op.
- **Fix:** Used the codebase's existing pattern for "render a `<Link>` with button styling" — `<Link href={href} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Evaluate</Link>`. This pattern is already in `src/components/explore/TrendingWatches.tsx` (line 33-37: See-all link styled as a button via `className`). Same DOM (`<a>`), same styling, and the test for "two `<a>` elements with the catalogId href" (Test 4) is satisfied because the inline Evaluate is now a real `<a>`.
- **Files modified:** `src/components/search/WatchSearchRow.tsx`.
- **Commit:** `2696be2` (Task 1 GREEN — commit message documents the deviation inline).

No other deviations. Threat model fully honored (HighlightedText reused unchanged; zero `dangerouslySetInnerHTML`; catalogId interpolation handled by Next Link encoding; pill rendering reads the DAL-hydrated `viewerState` so the Plan 01 viewer-keyed regression lock prevents cross-viewer leakage).

## Threat Model Coverage (Plan 03 scope)

All threats listed in `19-03-PLAN.md` `<threat_model>` are mitigated:

- **T-19-03-01** (Tampering — XSS via brand/model/reference rendered with highlight) — `<HighlightedText>` reused unchanged. It regex-escapes `q` and emits React text children only. Acceptance criterion `grep -n "dangerouslySetInnerHTML" src/components/search/WatchSearchRow.tsx` returns 0 matches. Phase 16's `PeopleSearchRow.test.tsx` Test 6 (line 161-182 in that file) already locks the XSS surface for crafted bio text.
- **T-19-03-02** (Tampering — Image src injection via catalog imageUrl) — Phase 17 catalog write-time sanitizer (`sanitizeHttpUrl` in `src/data/catalog.ts`) rejects non-http/https URLs at insert time. `next/image` is rendered with `unoptimized` (matches Phase 16/18 precedent for unknown remote hosts). `next.config.ts` `remotePatterns` is the project-level allowlist (SEC-02).
- **T-19-03-03** (Tampering — catalogId UUID injection into href) — `result.catalogId` is a server-side UUID returned by Plan 01's DAL; not user-controlled. Next `<Link>` handles URL encoding internally; no string concat into `dangerouslySetInnerHTML` (grep-confirmed 0 matches).
- **T-19-03-04** (Information Disclosure — pill leakage) — `viewerState` is hydrated by Plan 01's anti-N+1 single-batch `inArray(watches.catalogId, topIds)` query keyed by `viewerId`. The UI here just renders the value. Plan 01 has the integration test regression lock (`tests/integration/phase19-collections-privacy.test.ts`); this UI cannot leak across viewers without a DAL bug.
- **T-19-03-05** (DoS — ReDoS in HighlightedText regex) — Already mitigated in Phase 16 (regex-escape of `q`). `q` is bounded to 200 chars by Plan 02's Server Action Zod schema. No catastrophic backtracking pattern.

## Verification

- `npx vitest run tests/components/search/WatchSearchRow.test.tsx --reporter=verbose` → **11 passed (Tests 1..11)**
- `npx vitest run tests/components/search/ --reporter=default` → **33 passed (3 files: WatchSearchRow + PeopleSearchRow + useSearchState)** — no regression
- `npx tsc --noEmit 2>&1 | grep -E "WatchSearchRow|WatchSearchResultsSkeleton"` → **0 diagnostics** referencing the two new components or their test file (pre-existing TS errors in `DesktopTopNav.test.tsx`, `PreferencesClient.debt01.test.tsx`, `useSearchState.test.tsx:254`, and `phase17-extract-route-wiring.test.ts` are out of scope per Plan 03 SCOPE BOUNDARY)
- `npx eslint src/components/search/WatchSearchRow.tsx src/components/search/WatchSearchResultsSkeleton.tsx tests/components/search/WatchSearchRow.test.tsx` → **0 errors / 1 warning** (the warning is `@next/next/no-img-element` on the `next/image` mock in the test file — same warning already accepted in `PeopleSearchRow.test.tsx`, where `<img>` is the deliberate mock for jsdom rendering)
- Acceptance grep matrix:
  - `grep -n "export function WatchSearchRow" src/components/search/WatchSearchRow.tsx` → 1 match ✓
  - `grep -n "/evaluate?catalogId=" src/components/search/WatchSearchRow.tsx` → 2 matches (one each on the absolute-inset Link + the inline Evaluate Link, via the shared `href` const) ✓
  - `grep -n "<HighlightedText" src/components/search/WatchSearchRow.tsx` → 2 matches (brand+model + reference) ✓
  - `grep -n "absolute inset-0" src/components/search/WatchSearchRow.tsx` → 1 match ✓
  - `grep -n "relative z-10" src/components/search/WatchSearchRow.tsx` → 1 match (raised Evaluate CTA wrapper) ✓
  - `grep -n "viewerState === 'owned'" src/components/search/WatchSearchRow.tsx` → 1 match ✓
  - `grep -n "viewerState === 'wishlist'" src/components/search/WatchSearchRow.tsx` → 1 match ✓
  - `grep -n "bg-primary text-primary-foreground" src/components/search/WatchSearchRow.tsx` → 1 match in JSX (plus 1 in the JSDoc comment, which is harmless prose, not the rendered className) ✓
  - `grep -n "bg-muted text-muted-foreground" src/components/search/WatchSearchRow.tsx` → 1 match in JSX (plus 1 in the JSDoc comment) ✓
  - `grep -n "dangerouslySetInnerHTML" src/components/search/WatchSearchRow.tsx` → 0 matches ✓
  - `grep -nE "it\\('Test [0-9]+ — " tests/components/search/WatchSearchRow.test.tsx | wc -l` → exactly 11 ✓
  - `grep -n "data-testid=\"watch-search-skeleton\"" src/components/search/WatchSearchResultsSkeleton.tsx` → 1 match ✓
  - `grep -n "length: 4" src/components/search/WatchSearchResultsSkeleton.tsx` → 1 match ✓
  - `grep -n "size-10 md:size-12 rounded-full" src/components/search/WatchSearchResultsSkeleton.tsx` → 1 match ✓

## Wave 2 Handoff

Plan 05 (unified search page wave) consumes:

- `import { WatchSearchRow } from '@/components/search/WatchSearchRow'` — render in the Watches tab branch of `SearchPageClient`. Props: `<WatchSearchRow result={r} q={debouncedQ} />` for each row in the Watches results array.
- `import { WatchSearchResultsSkeleton } from '@/components/search/WatchSearchResultsSkeleton'` — render while `searchWatchesAction` is in flight. Wiring tests can assert `getByTestId('watch-search-skeleton')` to verify the skeleton appears during fetch.
- The `SearchCatalogWatchResult` type contract from `@/lib/searchTypes` — `searchCatalogWatchesAction` (Plan 02) returns `Promise<SearchCatalogWatchResult[]>` and the array is passed straight into the row component.

Plan 04 (CollectionSearchRow) is the parallel wave 2 component — independent file, independent tests, no shared code with this plan.

## Self-Check: PASSED

Created files exist:
- `src/components/search/WatchSearchRow.tsx` ✓
- `src/components/search/WatchSearchResultsSkeleton.tsx` ✓
- `tests/components/search/WatchSearchRow.test.tsx` ✓

Commits exist (verified via `git log --oneline`):
- `175de93` — Task 1 RED ✓
- `2696be2` — Task 1 GREEN ✓
- `db3b7c5` — Task 2 ✓
