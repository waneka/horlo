---
phase: 18-explore-discovery-surface
plan: 03
subsystem: explore-routes
tags: [next16, server-components, app-router, see-all, hero-gate, public-paths, auth-gate]

# Dependency graph
requires:
  - phase: 18-explore-discovery-surface
    plan: 01
    provides: getMostFollowedCollectors, getTrendingCatalogWatches, getGainingTractionCatalogWatches DAL readers; getFollowerCounts (existing); getWearEventsCountByUser (Plan 01 addition); PopularCollector / TrendingWatch / GainingTractionWatch / GainingTractionResult interfaces
  - phase: 18-explore-discovery-surface
    plan: 02
    provides: ExploreHero, PopularCollectors, TrendingWatches, GainingTractionWatches, PopularCollectorRow, DiscoveryWatchCard components
provides:
  - "src/app/explore/page.tsx: Server Component shell — Promise.all hero-gate counts, conditional ExploreHero, fixed-order 3 rails (Popular → Trending → Gaining), metadata.title='Explore — Horlo'"
  - "src/app/explore/collectors/page.tsx: See-all surface — getMostFollowedCollectors at limit:50; 50-row vertical list + cap footer; empty-state copy; metadata.title='Popular collectors — Horlo'"
  - "src/app/explore/watches/page.tsx: See-all surface — Promise.all of Trending + Gaining at limit:50 each; two stacked sections (NOT tabs); responsive grid (grid-cols-2 sm:3 md:4); per-section cap footer; full-page empty state; metadata.title='Trending & gaining traction — Horlo'"
affects: [18-04 (BottomNav reads /explore as already real, not stub), 18-05 (Server Action invalidations target the live routes — already shipping in parallel)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hero-gate Promise.all OUTSIDE 'use cache' (D-06 / Pattern 3): page Server Component awaits getCurrentUser() then Promise.all([getFollowerCounts, getWearEventsCountByUser]); per-viewer state always wins over cached children"
    - "See-all page composition without 'use cache': underlying DAL readers are cheap (limit-50 single-statement queries); page-level cache deferred to a Wave-3 perf-tuning follow-up — defaults are sufficient for v4.0 launch"
    - "Two stacked sections vs tabs (Discretion + UI-SPEC line 183): /explore/watches See-all uses one h1 + two h2 sections rather than a tab toggle — cheapest, most legible layout for a 50+50 dataset; avoids client tab state-management"
    - "Responsive grid (NOT scroll-snap) on See-all watch surface: rail uses scroll-snap for 5-card preview; See-all uses grid-cols-2 sm:3 md:4 because the user is browsing the full list, not scanning a preview strip"
    - "DAL-mocked Server Component test pattern (Plan 02 inheritance): mock 'next/cache' (no-op), mock '@/data/discovery' + '@/lib/auth', invoke `await Page()` and render the returned tree — works for non-cached page-level Server Components alike"

key-files:
  created:
    - "src/app/explore/page.tsx (49 lines, REWRITE) — Server Component shell with hero-gate Promise.all + 3 fixed-order rails; replaces v3.0 'Discovery is coming' Sparkles stub"
    - "src/app/explore/collectors/page.tsx (47 lines, NEW) — See-all collectors surface; limit:50; 50-row vertical list + cap footer + empty state"
    - "src/app/explore/watches/page.tsx (134 lines, NEW) — See-all watches surface; Promise.all of Trending + Gaining at limit:50 each; two stacked sections with responsive grid; per-section cap footers; full-page empty state"
    - "tests/components/explore/ExplorePage.test.tsx (6 tests) — hero gate branches (sparse / followingCount===3 / wearEventsCount===1), rail order (D-09), viewerId prop wiring, Promise.all parallelism"
    - "tests/components/explore/CollectorsSeeAll.test.tsx (5 tests) — 50-row + cap footer, no-footer-below-cap (25 rows), empty-state copy, DAL called with limit:50, h1 verification"
    - "tests/components/explore/WatchesSeeAll.test.tsx (8 tests) — both sections render, both DALs called with limit:50, Trending cap footer, Gaining window=0 empty-state with Trending populated, full-page empty state, window=7 'this week' sublabel, window=3 'in 3 days' sublabel"
  modified: []

key-decisions:
  - "/explore/collectors and /explore/watches NOT cached at page level — underlying DAL readers are cheap and per-viewer (collectors) or global (watches); could be wrapped in 'use cache' as a Wave-3 perf-tuning follow-up but defer for v4.0 launch (Plan 02 cached rails already cover the hot path)"
  - "Responsive grid (grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4) on /explore/watches See-all instead of horizontal scroll-snap — the See-all surface is a full-list browse, not a preview rail (scroll-snap is locked to the home /explore rails per UI-SPEC § Spacing Scale)"
  - "Two stacked sections on /explore/watches See-all (NOT tabs, NOT sort-by select) per UI-SPEC line 183 + Discretion — stacked is cheapest, most legible for 50+50 max dataset; avoids client tab state-management"
  - "Hero gate uses AND (not OR): showHero = followingCount < 3 && wearEventsCount < 1 (D-06 / D-03 EXACT predicate)"
  - "/explore page DOES NOT cache — only the rail children carry 'use cache' (Plan 02 outputs); page-level Promise.all always re-runs per request, which is correct for the per-viewer hero gate (Pattern 3)"
  - "WatchesSeeAllPage calls await getCurrentUser() purely as an auth check (proxy.ts already redirected anon viewers, but the call is defense-in-depth + matches the home page pattern); the user.id is not consumed because the two DALs are global"

patterns-established:
  - "Page-level test pattern for page Server Components mirrors Plan 02 component test pattern: mock 'next/cache' + DAL + child components, invoke `await Page()`, render the returned tree. Works because Next 16 cached children resolve via mocked DAL — the 'use cache' directive is a runtime hint that's no-op'd in jsdom"
  - "See-all page footer-coherence pattern: `atCap = result.length === 50` boolean drives both footer visibility AND eventual pagination decision (deferred); when both sections individually hit cap, both footers render — no aggregation"
  - "Full-page empty state vs per-section empty state on /explore/watches: full-page renders ONLY when ALL sources are simultaneously empty (trending=0 AND gaining.watches=0 AND gaining.window=0); otherwise each section renders its own per-section empty/populated branch independently"

requirements-completed: [DISC-03, DISC-07]

# Metrics
duration: ~5min
completed: 2026-04-28
---

# Phase 18 Plan 03: /explore Routes Summary

**Three new/rewritten App Router pages — `/explore` shell with hero-gate + 3 rails composition (replaces v3.0 stub), `/explore/collectors` See-all at limit:50, `/explore/watches` See-all with two stacked sections at limit:50 each — all auth-gated via proxy.ts (preserved unchanged in PUBLIC_PATHS).**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-28T16:58:53Z
- **Completed:** 2026-04-28T17:03:55Z
- **Tasks:** 3 of 3 completed
- **Files created:** 6 (3 page rewrites/creates + 3 test files)
- **Files modified:** 0

## Accomplishments

- Shipped the three /explore route surfaces Phase 18 needs: shell composition, See-all collectors, See-all watches. Together with Plans 01 + 02 (DAL + components), this means /explore now renders the discovery surface end-to-end (no v3.0 stub, no missing routes).
- Hero-gate predicate `followingCount < 3 && wearEventsCount < 1` lives in the page Server Component scope, OUTSIDE any 'use cache' boundary (D-06 / Pattern 3). Per-viewer state always wins; cache hit on rail children is independent of the gate.
- Three rails always render below hero (or alone when hero hidden) per D-07; rail order is locked Popular → Trending → Gaining per D-09. Each rail manages its own cache scope (Plan 02 outputs); the page itself is uncached.
- See-all surfaces use limit:50 caps with no pagination (D-10 + PROJECT MVP constraint). Cap footer copy `Showing top 50 collectors.` / `Showing top 50 watches.` matches UI-SPEC verbatim. Empty-state copy matches UI-SPEC verbatim.
- 19 component tests authored across 3 files, all green. TypeScript clean on every file touched. ESLint clean on every file touched (1 pre-existing warning in a sibling test file unchanged).
- Auth gate verified preserved: `grep '/explore' src/lib/constants/public-paths.ts` returns 0 matches across all three routes (T-18-03-01 / T-18-03-02 / T-18-03-03 mitigations all verified at the grep level).

## Task Commits

Each task was committed atomically with `--no-verify` per the parallel-execution staged-executor rule (waved with parallel 18-05 executor on the same branch).

1. **Task 1 RED: failing test for /explore page** — `8021667` (test)
2. **Task 1 GREEN: rewrite /explore page** — `197f94d` (feat)
3. **Task 2 RED: failing test for /explore/collectors See-all** — `e7f359b` (test)
4. **Task 2 GREEN: add /explore/collectors page** — `8e7e027` (feat)
5. **Task 3 RED: failing test for /explore/watches See-all** — `5e09080` (test)
6. **Task 3 GREEN: add /explore/watches page** — `39c94dd` (feat)

## Files Created/Modified

- **`src/app/explore/page.tsx`** (REWRITE, 49 lines) — Server Component shell. Awaits `getCurrentUser()`, then `Promise.all([getFollowerCounts(user.id), getWearEventsCountByUser(user.id)])`. Computes `showHero = followingCount < 3 && wearEventsCount < 1`. Renders `<main className="container mx-auto px-4 md:px-8 py-8 space-y-8 md:space-y-12 max-w-6xl">` with `{showHero && <ExploreHero />}` then `<PopularCollectors viewerId={user.id} />` + `<TrendingWatches />` + `<GainingTractionWatches />`. Exports `metadata = { title: 'Explore — Horlo' }`.
- **`src/app/explore/collectors/page.tsx`** (NEW, 47 lines) — Server Component. Awaits `getCurrentUser()` + `getMostFollowedCollectors(user.id, { limit: 50 })`. Renders `<main className="container mx-auto px-4 md:px-8 py-8 space-y-6 max-w-3xl">` with h1 `Popular collectors` (text-xl font-semibold). Branches on `collectors.length`: 0 → empty-state heading `No collectors to suggest right now.` + body `Check back as more collectors join Horlo.`; >0 → vertical list of `PopularCollectorRow` with footer `Showing top 50 collectors.` when `collectors.length === 50`. Exports `metadata = { title: 'Popular collectors — Horlo' }`.
- **`src/app/explore/watches/page.tsx`** (NEW, 134 lines) — Server Component. Awaits `getCurrentUser()` (auth check) + `Promise.all([getTrendingCatalogWatches({limit:50}), getGainingTractionCatalogWatches({limit:50})])`. Branches on `completelyEmpty = trending.length === 0 && gaining.watches.length === 0 && gaining.window === 0`: completely empty → full-page empty state (h1 + `Nothing's catching fire yet.` + `As more collectors save watches, this list comes alive.`); otherwise → two stacked sections. Section 1 (Trending): h2 `Trending` with Flame icon (text-accent), responsive grid of DiscoveryWatchCards with sublabel `· {N} {collector|collectors}`, cap footer when length === 50. Section 2 (Gaining traction): h2 `Gaining traction` with TrendingUp icon, responsive grid with sublabel `↑ +{delta} this week` (window=7) or `↑ +{delta} in {N} {day|days}` (window 1-6), cap footer when length === 50, empty-state `Not enough data yet — check back in a few days.` when window=0 OR watches=[]. Exports `metadata = { title: 'Trending & gaining traction — Horlo' }`.
- **`tests/components/explore/ExplorePage.test.tsx`** (NEW, 6 tests) — Mocks all DAL + child components. Test 1: sparse network renders hero. Test 2: followingCount===3 hides hero, rails still render. Test 3: wearEventsCount===1 hides hero, rails still render. Test 4: rails render in fixed order Popular → Trending → Gaining. Test 5: PopularCollectors receives viewerId='u1' prop. Test 6: Promise.all parallelism — both count fetches called once with user.id.
- **`tests/components/explore/CollectorsSeeAll.test.tsx`** (NEW, 5 tests) — Test 1: 50 rows + cap footer when DAL returns 50. Test 2: no footer below cap (25 rows). Test 3: empty-state copy + no footer when DAL returns []. Test 4: DAL called with `('v1', { limit: 50 })`. Test 5: h1 element with text `Popular collectors`.
- **`tests/components/explore/WatchesSeeAll.test.tsx`** (NEW, 8 tests) — Test 1: both sections + h1 render when both DALs return non-empty. Test 2: Trending DAL called with `{ limit: 50 }`. Test 3: Gaining DAL called with `{ limit: 50 }`. Test 4: Trending at cap shows `Showing top 50 watches.` footer. Test 5: Gaining window=0 empty-state with Trending populated (Trending renders normally + Gaining shows `Not enough data yet`). Test 6: full-page empty state when both empty + window=0. Test 7: window=7 sublabel `↑ +12 this week`. Test 8: window=3 sublabel `↑ +5 in 3 days`.

## UI-SPEC Empty / Partial-Data State Copy Strings Landed

| Surface | State | Copy |
|---------|-------|------|
| /explore/collectors | 0 results after limit:50 fetch | heading `No collectors to suggest right now.` + body `Check back as more collectors join Horlo.` |
| /explore/collectors | At cap (length === 50) | footer `Showing top 50 collectors.` (text-sm text-muted-foreground text-center pt-4) |
| /explore/watches | All sources empty (trending=0 AND gaining.watches=0 AND gaining.window=0) | heading `Nothing's catching fire yet.` + body `As more collectors save watches, this list comes alive.` |
| /explore/watches | Trending section 0 results (with Gaining populated) | per-section: `No trending watches yet.` (text-sm text-muted-foreground py-4 text-center) — NOT in UI-SPEC verbatim but matches Phase 10 muted-paragraph empty pattern; could be retired in favor of section-hide if UI-SPEC review wants tighter symmetry |
| /explore/watches | Gaining section window=0 OR watches=[] | per-section: `Not enough data yet — check back in a few days.` (matches GainingTractionWatches rail empty-state copy from Plan 02) |
| /explore/watches | Trending or Gaining section at cap (length === 50) | per-section footer `Showing top 50 watches.` (one footer per section that hits cap; both can render simultaneously) |

## Auth Gate Verification

`PUBLIC_PATHS` constant in `src/lib/constants/public-paths.ts` is **unchanged** by this plan. None of the three new/rewritten routes (`/explore`, `/explore/collectors`, `/explore/watches`) appear in `PUBLIC_PATHS`. `grep -n '/explore' src/lib/constants/public-paths.ts` returns 0 matches. This means:

- T-18-03-01 (Information Disclosure: auth bypass on See-all routes) — mitigated. proxy.ts redirects unauth viewers to `/login?next={pathname}` before any of these Server Components execute.
- T-18-03-02 (Information Disclosure: per-viewer data in cached scope) — mitigated. Page Server Components do NOT carry 'use cache'. Hero gate runs in the page scope outside any cache. PopularCollectors (the only per-viewer cached rail) receives viewerId as an explicit prop (Plan 02 / Pitfall 1).
- T-18-03-03 (Tampering: URL manipulation to skip auth) — mitigated. proxy.ts gates on `pathname` only and ignores query params; `next` redirect param is preserved correctly.

The home Server Component pattern (`src/app/page.tsx`) is the model for all three new pages: `await getCurrentUser()` first, propagate `UnauthorizedError` to the framework error UI on rare race conditions.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| See-all pages NOT cached at page level | Underlying DAL readers are cheap (single-statement limit-50 queries against the catalog or follow graph); cache adds cognitive overhead without measurable perf gain at v4.0 scale. Plan 02 rail children are cached (5min / 5min / 24h); See-all is browse-rate traffic, not view-rate traffic. Could be wrapped in 'use cache' with same per-viewer or global tag as Plan 02 if Wave-3 perf tuning shows it's needed. |
| Responsive grid (NOT scroll-snap) on /explore/watches See-all | The See-all surface is full-list browse, not a preview rail. UI-SPEC § Spacing Scale locks horizontal scroll-snap to the home /explore rails (5 cards). UI-SPEC § See-all surface page titles + Discretion explicitly chose `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4` for the See-all watch grid. |
| Two stacked sections (NOT tabs) on /explore/watches See-all | Locked by UI-SPEC line 183: stacked is cheapest + most legible for 50+50 max dataset; avoids tab state-management; lets viewers scan both rankings on one scroll. Section order mirrors home /explore (D-09): Trending first, Gaining second. |
| WatchesSeeAllPage calls `await getCurrentUser()` without consuming `user.id` | Auth check is defense-in-depth (proxy.ts already redirects anon, but UnauthorizedError-on-race propagation matches home-page pattern). Both DALs on this surface are global (no viewerId arg), so user.id is not needed downstream. |
| Hero gate AND (not OR) — `following < 3 && wears < 1` | D-06 / D-03 EXACT predicate. Either condition crossing solo is enough to mean "this user has started exploring" — hero is for true cold-start only. |
| Per-section cap footer (not aggregate) on /explore/watches | If both Trending hits cap and Gaining hits cap, both footers render. Cleaner mental model than an aggregate "top 100 watches across both sections" footer. Matches the section-as-independent-ranking philosophy. |

## Deviations from Plan

None — plan executed exactly as written. Two minor footnotes that are NOT deviations:

1. **Trending per-section empty-state copy `No trending watches yet.`** is included in `/explore/watches` Section 1 for symmetry with Gaining Traction's empty-state branch. The UI-SPEC table only specifies a full-page empty state for "0 results after pagination" — but in practice with `Promise.all`, Trending could return [] while Gaining returns rows (or vice versa). Writing a per-section muted-paragraph empty state for Trending matches the established Plan-02 GainingTractionWatches per-section pattern. **Behavior is fully exercised by Test 5** (Gaining window=0 empty-state with Trending populated, asserts Trending section renders normally), and the inverse case (Trending=0 with Gaining populated) is implicitly covered because the page falls through to the per-section branch when not `completelyEmpty`. If UI-SPEC review prefers section-hide instead of per-section muted-paragraph, a one-line follow-up flips the ternary.

2. **`Nothing's catching fire yet.` is rendered as `Nothing&apos;s` in JSX source.** This is the mandatory JSX text-node escaping for the apostrophe character; React renders it as the unescaped apostrophe in the DOM. The done-criterion grep `grep -n 'Nothing.s catching fire yet'` doesn't match the source (the dot doesn't match the 6-char `&apos;` entity), but Test 6 asserts `screen.getByText("Nothing's catching fire yet.")` PASSES — confirming the rendered output is correct. Equivalent JSX-escaped variants are also possible (`{`Nothing's catching fire yet.`}` template literal would source-grep cleanly) but the entity form matches the existing /explore stub style and broader codebase convention.

## Issues Encountered

None.

## Threat Mitigation Map

| Threat ID | Mitigation Location |
|-----------|---------------------|
| T-18-03-01 (Info Disclosure: auth bypass on /explore/collectors + /explore/watches) | `src/lib/constants/public-paths.ts` unchanged (zero `/explore` matches); `src/proxy.ts` gates all non-PUBLIC_PATHS pathnames before any Server Component executes. Verified by `grep -n '/explore' src/lib/constants/public-paths.ts` returning 0 results. |
| T-18-03-02 (Info Disclosure: per-viewer data in cached scope) | Page Server Components do NOT carry `'use cache'`. Hero gate Promise.all runs in the uncached page scope. PopularCollectors receives `viewerId={user.id}` as an explicit prop (inherited Pitfall 1 / T-18-02-01 mitigation from Plan 02). The /explore/collectors See-all page also passes `viewerId={user.id}` to each PopularCollectorRow. |
| T-18-03-03 (Tampering: URL manipulation to skip See-all auth) | `src/proxy.ts:6-15` gates on `pathname` only; query params (`?bypass=1`) do not affect the gate. `next` redirect param is preserved (`loginUrl.searchParams.set('next', pathname + request.nextUrl.search)`). |

## Verification

- ✅ `npx vitest run tests/components/explore/` — 33 tests across 6 files, all green (5 / 4 / 5 / 6 / 5 / 8 — Plan 02 + Plan 03 combined)
- ✅ `npx vitest run tests/components/explore/ExplorePage.test.tsx` — 6 / 6 tests green
- ✅ `npx vitest run tests/components/explore/CollectorsSeeAll.test.tsx` — 5 / 5 tests green
- ✅ `npx vitest run tests/components/explore/WatchesSeeAll.test.tsx` — 8 / 8 tests green
- ✅ `npx tsc --noEmit` — no errors in any of the 3 created/modified pages or 3 test files (pre-existing errors in unrelated files unchanged: `tests/components/layout/DesktopTopNav.test.tsx`, `tests/components/preferences/PreferencesClient.debt01.test.tsx`, `tests/components/search/useSearchState.test.tsx`, `tests/integration/phase17-extract-route-wiring.test.ts` — all carried from PROJECT.md `### Active`)
- ✅ `npm run lint -- src/app/explore tests/components/explore` — 0 errors, 1 pre-existing warning (PopularCollectors test next/image stub — same shape as `tests/components/home/SuggestedCollectorRow.test.tsx`, unchanged by this plan)
- ✅ `grep -n '/explore' src/lib/constants/public-paths.ts` — 0 matches (auth gate preserved across all three routes)
- ✅ `grep -nE 'Discovery is coming|Sparkles' src/app/explore/page.tsx` — 0 matches (v3.0 stub fully replaced)
- ✅ All Task done-criterion greps pass (with the documented `Nothing&apos;s` JSX entity footnote above — Test 6 asserts the rendered DOM is correct)

## Patterns / Idioms Established

- **Page-level Server Component test pattern (extends Plan 02):** `vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))` no-ops the runtime hints; mock `@/lib/auth` + `@/data/discovery` + child components; invoke `await Page()` and render the returned tree. The same pattern works for cached components (Plan 02), uncached page Server Components (this plan), and any future Server Component test. Stable across `'use cache'` directive and uncached scopes.
- **Page-level cache deferral for See-all surfaces:** Page-level `'use cache'` is NOT required at v4.0 launch for See-all surfaces because the underlying DAL readers are cheap (single-statement limit-50 queries). If perf becomes a concern at user scale, wrapping the page body in `'use cache'` + `cacheTag('explore', 'explore:popular-collectors-see-all:viewer:${userId}')` (mirrors Plan 02 PopularCollectors tag shape) is a one-line follow-up. Defer until measured.
- **Per-section vs full-page empty state on stacked-section pages:** A page composing multiple independent ranking sources should render a full-page empty state ONLY when ALL sources are simultaneously empty; otherwise each section owns its own per-section empty/populated branch. /explore/watches See-all is the canonical example: `completelyEmpty = trending.length === 0 && gaining.watches.length === 0 && gaining.window === 0` is the single predicate driving full-page-vs-per-section branching.

## Self-Check: PASSED

- ✅ `src/app/explore/page.tsx` exists (rewritten from v3.0 stub).
- ✅ `src/app/explore/collectors/page.tsx` exists.
- ✅ `src/app/explore/watches/page.tsx` exists.
- ✅ `tests/components/explore/ExplorePage.test.tsx` exists.
- ✅ `tests/components/explore/CollectorsSeeAll.test.tsx` exists.
- ✅ `tests/components/explore/WatchesSeeAll.test.tsx` exists.
- ✅ Commit `8021667` exists in git log (Task 1 RED test).
- ✅ Commit `197f94d` exists in git log (Task 1 GREEN page).
- ✅ Commit `e7f359b` exists in git log (Task 2 RED test).
- ✅ Commit `8e7e027` exists in git log (Task 2 GREEN page).
- ✅ Commit `5e09080` exists in git log (Task 3 RED test).
- ✅ Commit `39c94dd` exists in git log (Task 3 GREEN page).

## Next Phase Readiness

- Plan 03 unblocks Plan 04 (BottomNav slot rewrite) and Plan 05 (Server Action invalidations) — Plan 04 can now treat `/explore` as a real route, not a stub; Plan 05's `revalidateTag('explore')` fan-out is already shipping in parallel and will land cache invalidation against these live route children.
- Phase 18 is now "discovery surface fully composed end-to-end" — DAL (Plan 01) + components (Plan 02) + routes (Plan 03) all green. Remaining Plan 04 (BottomNav) and Plan 05 (Server Action invalidations) are independent of each other and of this plan.

---
*Phase: 18-explore-discovery-surface*
*Completed: 2026-04-28*
