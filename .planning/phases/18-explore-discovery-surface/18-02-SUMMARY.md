---
phase: 18-explore-discovery-surface
plan: 02
subsystem: explore-ui
tags: [next16, cache-components, use-cache, server-components, lucide-icons, scroll-snap, two-layer-privacy]

# Dependency graph
requires:
  - phase: 18-explore-discovery-surface
    plan: 01
    provides: getMostFollowedCollectors, getTrendingCatalogWatches, getGainingTractionCatalogWatches DAL readers + PopularCollector / TrendingWatch / GainingTractionWatch / GainingTractionResult interfaces
provides:
  - "src/components/explore/ExploreHero.tsx: pure-render Server Component (no DAL, no cache) — sparse-network welcome with Compass icon-circle + serif h1 + paragraph + CTA Link/Button"
  - "src/components/explore/PopularCollectors.tsx: 'use cache' + cacheTag('explore', 'explore:popular-collectors:viewer:${viewerId}') + cacheLife revalidate 300; per-viewer 5min cache"
  - "src/components/explore/PopularCollectorRow.tsx: avatar + name + followers/watches sublabel + inline FollowButton; mirrors SuggestedCollectorRow minus mini-thumb cluster"
  - "src/components/explore/TrendingWatches.tsx: 'use cache' + cacheTag('explore', 'explore:trending-watches') + cacheLife revalidate 300; global 5min cache; Flame heading + scroll-snap strip"
  - "src/components/explore/GainingTractionWatches.tsx: 'use cache' + cacheTag('explore', 'explore:gaining-traction') + cacheLife revalidate 86400; global 24h cache; D-12 three-window branched body"
  - "src/components/explore/DiscoveryWatchCard.tsx: shared non-clickable card body for Trending + Gaining Traction (image + brand + model + sublabel slot)"
affects: [18-03 (page route composes these six components), 18-05 (Server Actions invalidate 'explore' fan-out tag + per-viewer suffix)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pitfall 1 honored end-to-end: viewerId is an explicit Server Component prop on every cached scope; no getCurrentUser() resolution inside 'use cache' bodies (mirrors NotificationBell.tsx exactly)"
    - "Three-cache-scope matrix on a single fan-out tag: per-viewer ('explore:popular-collectors:viewer:${id}'), global short-TTL ('explore:trending-watches' @ 300s), global long-TTL ('explore:gaining-traction' @ 86400s) — all share the bare 'explore' tag for cross-cutting Plan-05 invalidation"
    - "D-12 three-window header-always-renders branched body: 0 = empty-state copy + no See-all link, 1-6 = '↑ +{delta} in {N} day(s)' with singular/plural switch, 7 = '↑ +{delta} this week'"
    - "DAL-mocked Server Component test pattern: mock 'next/cache' (no-op cacheLife/cacheTag), mock '@/data/discovery', invoke component as `await Component({ viewerId })`, then `render(tree as React.ReactElement)` — works on cached + non-cached components alike"

key-files:
  created:
    - "src/components/explore/ExploreHero.tsx (32 lines) — Compass icon-circle + serif h1 + paragraph + CTA Link/Button; pure render, no DAL, no cache"
    - "src/components/explore/DiscoveryWatchCard.tsx (44 lines) — shared card body; w-44 md:w-52; image + brand + model + sublabel slot; non-clickable per Phase-18 Discretion"
    - "src/components/explore/PopularCollectorRow.tsx (74 lines) — mirrors SuggestedCollectorRow minus mini-thumb cluster; followers/watches sublabel; inline FollowButton with initialIsFollowing=false"
    - "src/components/explore/PopularCollectors.tsx (51 lines) — 'use cache' + per-viewer tag + 5min revalidate; hide-on-empty"
    - "src/components/explore/TrendingWatches.tsx (54 lines) — 'use cache' + global tag + 5min revalidate; Flame heading + scroll-snap strip; hide-on-empty"
    - "src/components/explore/GainingTractionWatches.tsx (66 lines) — 'use cache' + global tag + 86400s revalidate; D-12 three-window branched body; header always renders"
    - "tests/components/explore/PopularCollectors.test.tsx (5 tests) — heading + See-all link, empty→null, follower singular/plural, watch tertiary stat"
    - "tests/components/explore/TrendingWatches.test.tsx (4 tests) — heading + See-all link, collector singular/plural, empty→null, snap-start cards"
    - "tests/components/explore/GainingTractionWatches.test.tsx (5 tests) — D-12 cases (window=0 empty + no See-all, window=7 'this week', window=3 plural, window=1 singular), TrendingUp icon presence"
  modified: []

key-decisions:
  - "PopularCollectorRow keeps the absolute-inset Link to /u/{username}/collection (Phase 10 SuggestedCollectorRow pattern) and z-10 FollowButton wrapper — the row is clickable end-to-end; the inline FollowButton is the only child that doesn't bubble to the row link"
  - "DiscoveryWatchCard ships non-clickable per Phase-18 Discretion default; Phase 20 will add the /evaluate?catalogId={id} Link wrapper + hover state"
  - "GainingTractionWatches consolidates the empty-state branch on `result.window === 0 || result.watches.length === 0` rather than two separate guards — the See-all link visibility uses the same `showStrip` predicate so empty body and absent See-all are always coherent"
  - "Used `<img>` with @next/next/no-img-element disable rather than `next/image` for the watch card image — UI-SPEC § Component Inventory specifies a plain img tag for the strip; revisit if Phase 20 adds the click target and image optimization becomes valuable"

requirements-completed: [DISC-03, DISC-04, DISC-05, DISC-06]

# Metrics
duration: ~4min
completed: 2026-04-28
---

# Phase 18 Plan 2: /Explore Discovery Surface UI Components Summary

**Six new Server Components in `src/components/explore/` plus three component test files — one pure-render hero, one shared non-clickable card, one per-row collector mirror, and three cached rails at three TTL/scope profiles all sharing the `explore` fan-out tag.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-28T16:51:08Z
- **Completed:** 2026-04-28T16:54:53Z
- **Tasks:** 2 of 2 completed
- **Files created:** 9 (6 components + 3 test files)
- **Files modified:** 0

## Accomplishments

- Shipped all six discovery-surface components Phase 18 needs (`ExploreHero`, `PopularCollectors`, `PopularCollectorRow`, `TrendingWatches`, `GainingTractionWatches`, `DiscoveryWatchCard`) plus a covering test suite (14 tests, 3 files, all green).
- Honored UI-SPEC.md verbatim: every copy string (hero h1, supporting paragraph, CTA label, See-all label, empty-state copy, sublabel formats), every Tailwind class string (container, scroll-snap strip, card width, heading typography), and every accent-token usage (Compass / Flame / TrendingUp icons in `text-accent` on `bg-accent/10` backdrops).
- Honored Pitfall 1 (cache key viewer leakage) on every cached scope — `viewerId` is always an explicit prop, never resolved inside `'use cache'`. Matches `NotificationBell.tsx` pattern verbatim.
- Honored D-12 three-window logic on Gaining Traction: header always renders, body branches on `result.window` with empty-state copy + suppressed See-all when 0, partial-window sublabel for 1-6 (with singular/plural day/days), and "this week" sublabel for 7.
- Honored D-13 sublabel formats with singular/plural switching: `1 follower` / `42 followers`, `1 watch` / `3 watches`, `· 1 collector` / `· 42 collectors`, `↑ +1 in 1 day` / `↑ +5 in 3 days` / `↑ +12 this week`.
- Established the DAL-mocked Server Component test pattern for Next 16 cached components: `vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))` to no-op the runtime hints, mock the DAL, invoke the component as a function (`await Component({ viewerId })`), and render the returned tree.

## Task Commits

Each task was committed atomically with `--no-verify` per the parallel-execution staged-executor rule:

1. **Task 1: ExploreHero + DiscoveryWatchCard + PopularCollectorRow** — `2f032e8` (feat)
2. **Task 2: Three cached rail Server Components + tests** — `86b8fab` (feat)

## Files Created

- **`src/components/explore/ExploreHero.tsx`** (NEW, 32 lines) — Pure-render Server Component. Compass icon (`size-6 text-accent`) inside `bg-accent/10` 48×48 rounded-full backdrop; serif h1 (`font-serif text-3xl md:text-4xl`); supporting paragraph (`text-sm text-muted-foreground max-w-md`); CTA `<Link href="/explore/collectors"><Button>Browse popular collectors</Button></Link>`. NO `'use cache'` directive; NO DAL imports.
- **`src/components/explore/DiscoveryWatchCard.tsx`** (NEW, 44 lines) — Shared card body for both watch rails. `w-44 md:w-52 space-y-2`; `aspect-square rounded-md bg-muted overflow-hidden` image wrapper; brand line (`text-sm font-semibold text-foreground truncate`); model line (`text-sm text-muted-foreground truncate`); sublabel line (`text-sm text-muted-foreground`). Accepts `watch: { id, brand, model, imageUrl }` and `sublabel: ReactNode`. **Non-clickable** in Phase 18.
- **`src/components/explore/PopularCollectorRow.tsx`** (NEW, 74 lines) — Mirrors `SuggestedCollectorRow` exactly minus the mini-thumb cluster. Absolute-inset Link to `/u/{username}/collection`; AvatarDisplay 40×40; meta column with displayName + `{N} {follower|followers}` + optional `· {N} {watch|watches}`; `relative z-10` wrapper around inline FollowButton with `initialIsFollowing={false}` (DAL-exclusion guarantees).
- **`src/components/explore/PopularCollectors.tsx`** (NEW, 51 lines) — `'use cache'` + `cacheTag('explore', \`explore:popular-collectors:viewer:${viewerId}\`)` + `cacheLife({ revalidate: 300 })`. Awaits `getMostFollowedCollectors(viewerId, { limit: 5 })`. Hide-on-empty (returns `null`). Renders header (`Popular collectors` h2 + See-all Link to `/explore/collectors`) + `space-y-2` list of 5 `PopularCollectorRow`s.
- **`src/components/explore/TrendingWatches.tsx`** (NEW, 54 lines) — `'use cache'` + `cacheTag('explore', 'explore:trending-watches')` + `cacheLife({ revalidate: 300 })`. Awaits `getTrendingCatalogWatches({ limit: 5 })`. Hide-on-empty. Renders header (`Trending` h2 with Flame icon + See-all Link to `/explore/watches`) + horizontal scroll-snap strip (`flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2`) of 5 `DiscoveryWatchCard`s wrapped in `<div className="snap-start">`. Sublabel format: `· {N} {collector|collectors}`.
- **`src/components/explore/GainingTractionWatches.tsx`** (NEW, 66 lines) — `'use cache'` + `cacheTag('explore', 'explore:gaining-traction')` + `cacheLife({ revalidate: 86400 })`. Awaits `getGainingTractionCatalogWatches({ limit: 5 })`. **Always renders header** (`Gaining traction` h2 with TrendingUp icon — D-12). Body branches on `result.window`: `0` → empty-state copy `Not enough data yet — check back in a few days.` + suppressed See-all; `1..6` → strip with sublabel `↑ +{delta} in {window} {day|days}`; `7` → strip with sublabel `↑ +{delta} this week`.
- **`tests/components/explore/PopularCollectors.test.tsx`** (NEW, 5 tests) — heading + See-all destination, empty→null, sublabel singular/plural, watch tertiary stat.
- **`tests/components/explore/TrendingWatches.test.tsx`** (NEW, 4 tests) — heading + See-all destination, sublabel singular/plural, empty→null, snap-start card count.
- **`tests/components/explore/GainingTractionWatches.test.tsx`** (NEW, 5 tests) — window=0 empty-state + no See-all, window=7 "this week" sublabel, window=3 plural "in 3 days", window=1 singular "in 1 day", TrendingUp icon presence + See-all visibility when window≥1.

## UI-SPEC Sections Honored

| UI-SPEC section | How honored |
|----------------|-------------|
| § Spacing Scale | Container shape `container mx-auto px-4 md:px-8 py-8 space-y-8 md:space-y-12 max-w-6xl` will be applied by Plan 03; rail strip class `flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2` mirrored verbatim on Trending + Gaining Traction; `space-y-4` between rail header and body; `space-y-2` between Popular Collector rows; hero `space-y-4` interior + `py-12 md:py-16` outer |
| § Typography | `text-xl font-semibold leading-tight text-foreground` on every rail h2; `text-sm text-muted-foreground` on every sublabel + See-all link + paragraph; `font-serif text-3xl md:text-4xl text-foreground` on hero h1 (the only display-typography element on the surface) |
| § Color | `text-accent` on Compass / Flame / TrendingUp icons only; `bg-accent/10` on the hero icon-circle backdrop only; `text-foreground` on h2 + h1 + name + brand; `text-muted-foreground` on every secondary string; no hex / oklch literals — all token names |
| § Copywriting Contract — Sparse-network hero | `Find collectors who share your taste.` + `Horlo gets richer when you follow people whose collections rhyme with yours. Start here — we'll surface watches and faces worth knowing.` + `Browse popular collectors` CTA → `/explore/collectors` |
| § Copywriting Contract — Rail headings | `Popular collectors` (no icon) / `Trending` (Flame) / `Gaining traction` (TrendingUp) |
| § Copywriting Contract — See-all link | `See all` text, `text-sm text-muted-foreground hover:text-foreground transition-colors`, destinations `/explore/collectors` for Popular Collectors, `/explore/watches` for both watch rails |
| § Copywriting Contract — Collector sublabels | `1 follower` / `{N} followers` + optional `· 1 watch` / `· {N} watches` (only when watchCount > 0) |
| § Copywriting Contract — Watch sublabels | Trending: `· 1 collector` / `· {N} collectors`; Gaining Traction: `↑ +{delta} this week` (window=7), `↑ +{delta} in 1 day` (window=1), `↑ +{delta} in {N} days` (window 2-6) |
| § Copywriting Contract — Empty states | `Not enough data yet — check back in a few days.` (window=0) wrapped in `text-sm text-muted-foreground py-4 text-center` |
| § Component Inventory — Cache profiles | Popular Collectors per-viewer + 5min; Trending global + 5min; Gaining Traction global + 24h |
| § Component Inventory — DiscoveryWatchCard non-clickable | No Link wrapper, no hover state — Phase 20 lights up `/evaluate?catalogId={id}` |
| § Interaction & Motion — Scroll-snap | `snap-x snap-mandatory scroll-smooth` on the strip; `snap-start` on each card wrapper |

## Decisions Implemented

- **D-05 (Hero = welcome + ONE CTA):** ExploreHero ships exactly one CTA (`Browse popular collectors`) — no secondary actions, no link list.
- **D-08 (Hero CTA destination):** `<Link href="/explore/collectors">` wrapping the `<Button>`.
- **D-11 (Popular Collectors layout + FollowButton):** vertical row list (`space-y-2`); each row uses inline FollowButton with `initialIsFollowing={false}` (DAL-exclusion guarantees the viewer doesn't follow this collector).
- **D-12 (Gaining Traction always renders header; partial-window logic):** header always renders; body branches on `result.window` with three explicit cases (0 / 1-6 / 7); See-all link is suppressed when no body strip is rendered.
- **D-13 (Same watch card both rails; rail-header iconography only):** DiscoveryWatchCard is shared verbatim; only the sublabel slot differs. Flame on Trending heading, TrendingUp on Gaining Traction heading — neither icon is repeated on the card body.

## Cache Strategy Notes

| Component | Tag(s) | TTL | Scope |
|-----------|--------|-----|-------|
| `PopularCollectors` | `explore` + `explore:popular-collectors:viewer:${viewerId}` | 300s (5min) | Per-viewer |
| `TrendingWatches` | `explore` + `explore:trending-watches` | 300s (5min) | Global |
| `GainingTractionWatches` | `explore` + `explore:gaining-traction` | 86400s (24h) | Global |

All three rails share the bare `explore` tag — Plan 05 will use it as a fan-out invalidation root after `addWatch` / `followUser` mutations. The per-rail tags target rail-specific recompute (e.g., the per-viewer Popular Collectors suffix lets a single user's just-followed-someone refresh fire without invalidating the global watch rails). The 24h Gaining Traction TTL aligns with the pg_cron 03:00 UTC daily snapshot cadence — no point recomputing more often than the underlying snapshot data changes.

`viewerId` is always a Server Component prop on the cached scope, never resolved inside (Pitfall 1 / T-18-02-01). Mirrors `NotificationBell.tsx` exactly.

## Deviations from Plan

None — plan executed exactly as written. All copy, class strings, cache tags, TTLs, sublabel formats, and component prop shapes match the plan verbatim.

The Task 2 plan-action snippet for GainingTractionWatches used a slightly different conditional shape (separate `result.window === 0 || result.watches.length === 0` ternary against the full strip) — I consolidated this into a single `showStrip` boolean used for both See-all link visibility and body rendering. Functionally identical to the planned behavior; just removes a duplicated predicate. Not flagged as a deviation because it doesn't change observable behavior (verified by the 5 GainingTractionWatches tests covering all D-12 cases).

## Threat Mitigation Map

| Threat ID | Mitigation Location |
|-----------|---------------------|
| T-18-02-01 (cross-user cache leak in PopularCollectors) | `src/components/explore/PopularCollectors.tsx:21,23` — `viewerId` is an explicit prop on the function signature; `cacheTag` includes `viewer:${viewerId}` suffix; no `getCurrentUser()` call inside `'use cache'` body |
| T-18-02-02 (cache scope collision across rails) | Tag matrix: per-viewer suffix on Popular Collectors only; global tags on Trending + Gaining Traction; bare `explore` tag is a fan-out root for Plan-05 invalidation only |
| T-18-02-03 (stored XSS via catalog brand/model/imageUrl) | React JSX text-node escaping (default) on every rendered string; `imageUrl` passed to plain `<img src>` is protocol-validated upstream by Phase 17 `sanitizeHttpUrl` (`src/data/catalog.ts:19-28`); no `dangerouslySetInnerHTML` in any component |
| T-18-02-04 (private profile leak via Popular Collectors) | Inherited from Plan 01 DAL two-layer-privacy gate (`profileSettings.profilePublic = true` + RLS); UI consumes the already-filtered list |

## Verification

- ✅ `npx vitest run tests/components/explore/` — 14 tests across 3 files, all green (5 / 4 / 5)
- ✅ `npx tsc --noEmit` — no errors in any of the 6 created components or 3 test files (pre-existing errors in unrelated files unchanged — documented in `.planning/PROJECT.md` `### Active`)
- ✅ `npm run lint -- src/components/explore tests/components/explore` — 0 errors; 1 pre-existing-pattern warning in test file (`@next/next/no-img-element` on the next/image stub — same warning shape as `tests/components/home/SuggestedCollectorRow.test.tsx`)
- ✅ All 6 components export named symbols matching their file name (`export function ExploreHero`, `export function PopularCollectorRow`, `export function DiscoveryWatchCard`, `export async function PopularCollectors`, `export async function TrendingWatches`, `export async function GainingTractionWatches`)
- ✅ No component imports `getCurrentUser` from `@/lib/auth` (the only `getCurrentUser` mention in `PopularCollectors.tsx` is in a JSDoc warning comment that explicitly forbids the call)
- ✅ Hero is NOT cached (no runtime `'use cache'` directive)
- ✅ Each cached rail has exactly one `'use cache'` directive at top of function body
- ✅ `grep -n 'sharedWatches' src/components/explore/PopularCollectorRow.tsx` returns 0 (mini-thumb cluster removed as planned)
- ✅ All `done` greps from both tasks pass

## Patterns / Idioms Established

- **DAL-mocked Next 16 Server Component test:** `vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))` plus `vi.mock('@/data/discovery', ...)` plus invoking the component as a function (`await Component({ viewerId })`) and rendering the returned tree. Works for both cached and non-cached Server Components. Phase 18 Plan 03 + Plan 05 + future cached-Server-Component tests should adopt this pattern verbatim.
- **Three-cache-scope matrix on a single fan-out tag:** the bare `explore` tag is the fan-out root for cross-cutting Plan-05 invalidation; per-rail specific tags (`explore:popular-collectors:viewer:${id}`, `explore:trending-watches`, `explore:gaining-traction`) isolate per-rail recompute. Future v4.0+ phases that need per-rail vs cross-rail invalidation can adopt this matrix shape.
- **D-12 three-window header-always-renders branched body:** `showStrip = result.window >= 1 && result.watches.length > 0` is the single predicate driving both See-all link visibility AND body strip rendering — keeps empty-state coherence trivially correct. Future seasonal / partial-window discovery rails can mirror this shape.

## Self-Check: PASSED

- ✅ `src/components/explore/ExploreHero.tsx` exists.
- ✅ `src/components/explore/DiscoveryWatchCard.tsx` exists.
- ✅ `src/components/explore/PopularCollectorRow.tsx` exists.
- ✅ `src/components/explore/PopularCollectors.tsx` exists.
- ✅ `src/components/explore/TrendingWatches.tsx` exists.
- ✅ `src/components/explore/GainingTractionWatches.tsx` exists.
- ✅ `tests/components/explore/PopularCollectors.test.tsx` exists.
- ✅ `tests/components/explore/TrendingWatches.test.tsx` exists.
- ✅ `tests/components/explore/GainingTractionWatches.test.tsx` exists.
- ✅ Commit `2f032e8` exists in git log (Task 1).
- ✅ Commit `86b8fab` exists in git log (Task 2).
