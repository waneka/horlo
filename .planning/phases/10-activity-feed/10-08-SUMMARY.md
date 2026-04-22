---
phase: 10-activity-feed
plan: 08
subsystem: home-page-composition
tags: [nextjs16, server-components, lazy-import, suspense, pitfall-10, shared-dialog, tdd, vitest, header-nav, 375px-fit]

# Dependency graph
requires:
  - plan: 10-05
    provides: |
      NetworkActivityFeed Server Component — imported verbatim by the home page.
  - plan: 10-06
    provides: |
      WywtRail + WywtOverlay + WatchPickerDialog single-component pitfall-10
      implementation. This plan imports the SAME WatchPickerDialog from
      @/components/home/WatchPickerDialog (via lazy) inside NavWearButton.
  - plan: 10-07
    provides: |
      CollectorsLikeYou (cached) + PersonalInsightsGrid + SuggestedCollectors
      Server Components — all consumed by the home page with viewerId prop.
provides:
  - "src/app/page.tsx — 5-section authenticated home at /"
  - "src/components/layout/NavWearButton.tsx — nav '+ Wear' button (ONE of two triggers for the shared WatchPickerDialog; Pitfall 10 avoided)"
  - "src/components/layout/Header.tsx — modified to render NavWearButton + resolve owned watches in parallel with profile lookup"
affects: [10-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-file, two-trigger shared-dialog convention (Pitfall 10) extended across directory boundaries: WywtRail (src/components/home) and NavWearButton (src/components/layout) BOTH lazy-import `@/components/home/WatchPickerDialog`. The picker stays in its domain folder; consumers live where they are naturally used."
    - "Lazy dialog posture matches WywtRail (Plan 10-06) — Header renders on every authenticated route, so eager-importing WatchPickerDialog would ship the shadcn Dialog + markAsWorn glue on pages that never need it. `React.lazy` + Suspense + `{open && ...}` render-gate keeps the layout bundle small."
    - "Server Component composition: Home Server Component runs two parallel parent fetches (getWatchesByUser, getWearRailForViewer) via Promise.all, then delegates the 5 section Server Components to own their own DAL reads. No client state at the page level."
    - "375px mobile nav fallback: UI-SPEC § Primary CTAs names the label '+ Wear', but plan 10-08 acceptance criteria explicitly allow hiding the text below `sm:` if the cluster does not fit. Applied preemptively: Plus icon always visible + aria-label carries the full semantic name; 'Wear' text shown only at ≥ 640px. Matches plan's documented remediation."

key-files:
  created:
    - src/components/layout/NavWearButton.tsx
    - tests/components/layout/NavWearButton.test.tsx
  modified:
    - src/app/page.tsx
    - src/components/layout/Header.tsx

key-decisions:
  - "NavWearButton lazy-loads WatchPickerDialog via `React.lazy(() => import('@/components/home/WatchPickerDialog').then(m => ({ default: m.WatchPickerDialog })))`. Grep-verified: no top-level ES import of WatchPickerDialog in NavWearButton.tsx. Header renders on every authenticated route (≥ 20 routes today); the picker's Dialog + Input + markAsWorn glue stays out of the layout bundle until the user taps '+ Wear'."
  - "Hidden 'Wear' text below `sm:` (640px) to guarantee 375px mobile nav fit. Right cluster at mobile: ThemeToggle(44) + gap-2(8) + NavWearButton[Plus-only](36) + gap-2(8) + Add Watch(83) + gap-2(8) + UserMenu(40) ≈ 227px. Plus left cluster (MobileNav 44 + gap-2 8 + Horlo wordmark 60 = 112px). Total ≈ 339px, fits 343px content width of a 375px viewport minus px-4 gutters. Plan 10-08 acceptance criteria explicitly sanctions this as the fallback when the cluster wraps."
  - "Header fetches ownedWatches via Promise.all([getProfileById, getWatchesByUser]) — two indexed single-user queries that run in parallel. The watch fetch is scoped to the viewer's own userId, so no cross-user leak surface; RLS + ownership scope already in place (T-10-08-01 accept disposition)."
  - "Graceful error catch around the parallel fetch: if either the profile or the watches read fails (transient DB blip), the Header logs and renders with defaults (null username, empty ownedWatches). NavWearButton with zero watches still opens the picker to its 'Add a watch first' empty state, so the nav remains functional even in the degraded path."
  - "NO changes to src/components/layout/MobileNav.tsx. Per the plan's acceptance criteria: 'MobileNav stays focused on page navigation (Collection / Insights / Preferences).' Wear + Add Watch remain nav-level actions reachable at all breakpoints via the Header."
  - "NO Explore / global search / notifications markup in Header (N-02 LOCKED). Grep-verified."

patterns-established:
  - "Shared-dialog-across-directories convention: a picker/dialog used by more than one domain lives in its primary domain folder (`src/components/home/WatchPickerDialog.tsx`), and other domains import it via lazy or direct import (not re-export it, not copy it). Documented in both NavWearButton.tsx and WatchPickerDialog.tsx JSDoc. Any future reviewer sees the rationale at both call sites."
  - "Lazy-import guard for components rendered on every route: when a component sits inside a layout/Header that ships on every authenticated page, any heavy dependency it only conditionally uses should be dynamically imported. Established by WywtRail (Plan 10-06) and extended by NavWearButton (this plan). Future layout-level additions should follow the same pattern."
  - "Home page composition pattern: the top-level `app/page.tsx` is a thin Server Component that resolves auth + any parent-level data the sections can't resolve themselves (e.g., WywtRail needs ownedWatches + railData that aren't cached), then delegates to 5 section Server Components each of which owns its own DAL reads. Section-level empty states + privacy gates live IN the sections; the page layer does not branch on section state."

requirements-completed: [FEED-01, FEED-02, FEED-03, FEED-04, FEED-05, WYWT-03, DISC-02, DISC-04]

# Metrics
duration: ~5 min
completed: 2026-04-22
---

# Phase 10 Plan 08: 5-Section Home + `+ Wear` Nav Button Summary

**Shipped the home page composition that ties Wave 1 + Wave 2 into the 5-section authenticated network home. One new client component (NavWearButton, 4 TDD tests green), one Header modification (lazy picker trigger + parallel owned-watches fetch), one full `src/app/page.tsx` replacement (5 sections in L-01 locked order). Pitfall 10 upheld — exactly one WatchPickerDialog source in the tree; NavWearButton and WywtRail both lazy-import it. Build green across 20 routes under `cacheComponents: true`, lint green on all 4 plan-08 files, full test suite 2052/2052 passing.**

## Performance

- **Duration:** ~5 min (single session)
- **Started:** 2026-04-22T00:48:55Z
- **Completed:** 2026-04-22T00:53:49Z
- **Tasks:** 3
- **Files created:** 2 (1 component + 1 test file)
- **Files modified:** 2 (Header.tsx, page.tsx)
- **Commits:** 4 task commits + pending metadata commit

## Accomplishments

### Task 1 — NavWearButton (TDD, 4 tests)

- **`NavWearButton`** (`src/components/layout/NavWearButton.tsx`) — `'use client'` component that opens the shared `WatchPickerDialog` from the nav.
  - Button: `variant="outline"` (shadcn) + lucide `Plus` icon (size-4) + label "Wear" + `aria-label="Log a wear for today"`.
  - Dialog import is `React.lazy(() => import('@/components/home/WatchPickerDialog').then((m) => ({ default: m.WatchPickerDialog })))` — NOT a top-level ES import. Grep-verified: `! grep -qE "^import \{ ?WatchPickerDialog ?\}" src/components/layout/NavWearButton.tsx` passes.
  - Render-gated `{open && <Suspense fallback={null}><WatchPickerDialog ... /></Suspense>}` so the picker chunk is fetched on first click, not on Header mount.
  - Label text hidden below `sm:` breakpoint via `<span className="hidden sm:inline">Wear</span>` (plan's documented 375px-fit fallback).

- **Tests** (`tests/components/layout/NavWearButton.test.tsx`) — 4 behavioral cases:
  1. Renders with accessible name "Log a wear for today", label text "Wear", and an inline `<svg>` (the Plus icon).
  2. Click mounts the WatchPickerDialog with `open=true` and forwards the `ownedWatches` prop (verified via `data-count` on the mock).
  3. Dialog's `onOpenChange(false)` unmounts the picker.
  4. Button class string contains `border-border` and `bg-background` (shadcn outline-variant signature).

  Mocked `@/components/home/WatchPickerDialog` via `vi.mock` so the test doesn't exercise the lazy boundary — standard pattern for components that use `React.lazy` internally.

### Task 2 — Header integration

- **`src/components/layout/Header.tsx`** — renders `<NavWearButton ownedWatches={ownedWatches} />` BEFORE the Add Watch Link in the authenticated right-cluster.
  - Added `getWatchesByUser` call, parallelized with `getProfileById` via `Promise.all`.
  - Filters to `status === 'owned'` before handing to `NavWearButton` (WatchPickerDialog also filters, but doing it here keeps the prop minimal across the client boundary).
  - Graceful error catch: if either parallel fetch fails (transient DB blip), Header logs via `console.error` and renders with defaults — Wear button remains functional (opens to empty state).
  - Changed outer gap from `gap-4` to `gap-2 md:gap-4` so mobile cluster has tighter spacing (required for 375px fit).
  - No Explore / search / notifications markup (N-02).

### Task 3 — Home page composition

- **`src/app/page.tsx`** — full replacement. Server Component default export:
  1. `const user = await getCurrentUser()` — redirects unauth viewers via existing middleware / auth layer.
  2. `Promise.all([getWatchesByUser, getWearRailForViewer])` — parallel parent fetches for the WYWT rail's owned-watches prop and rail tile data.
  3. Renders sections in LOCKED L-01 order inside `<main className="container mx-auto px-4 md:px-8 py-8 space-y-8 md:space-y-12 max-w-6xl">`:
     - `<WywtRail data={railData} ownedWatches={ownedWatches} />`
     - `<CollectorsLikeYou viewerId={user.id} />`
     - `<NetworkActivityFeed viewerId={user.id} />`
     - `<PersonalInsightsGrid viewerId={user.id} />`
     - `<SuggestedCollectors viewerId={user.id} />`
- `CollectionView` import removed. The viewer's personal collection UX lives at `/u/[username]/collection` (Phase 8 D-03).

## Task Commits

| # | Type | Description | Hash |
|---|------|-------------|------|
| 1 | test | RED tests for NavWearButton (4 cases) | `181a77c` |
| 2 | feat | NavWearButton client component with lazy picker import | `f919193` |
| 3 | feat | Render NavWearButton in Header before Add Watch + 375px fit fallback | `f3f54df` |
| 4 | feat | Replace home page with 5-section network home (L-01 order) | `605bc22` |

Plan metadata commit is made after this SUMMARY is written.

## Output Spec Requirements (from 10-08-PLAN.md `<output>`)

### 1. Final composition order verified against L-01

Grep-verified order in `src/app/page.tsx`:

```
Line 36:  <WywtRail data={railData} ownedWatches={ownedWatches} />
Line 37:  <CollectorsLikeYou viewerId={user.id} />
Line 38:  <NetworkActivityFeed viewerId={user.id} />
Line 39:  <PersonalInsightsGrid viewerId={user.id} />
Line 40:  <SuggestedCollectors viewerId={user.id} />
```

Matches CONTEXT.md L-01: **WYWT → Collectors Like You → Network Activity → Personal Insights → Suggested Collectors**.

### 2. Header buttons rendered in order: NavWearButton → Add Watch

Grep-verified in `src/components/layout/Header.tsx`:

```
Line 58:   <NavWearButton ownedWatches={ownedWatches} />
Line 59-61: <Link href="/watch/new"><Button>Add Watch</Button></Link>
```

NavWearButton renders BEFORE Add Watch (`awk` order check: n=58, a=59 → n<a).

### 3. Header data-fetch refactor notes

- **Added:** `getWatchesByUser(user.id)` inside `Promise.all` alongside `getProfileById`. This is a viewer-scoped indexed query (userId is the primary filter) and runs on every authenticated route render. Estimated cost: O(N) where N ≤ 500 watches per user (PROJECT.md cap). At p95 N ≈ 50, the query is sub-millisecond in Postgres with the `watches_user_id_idx` index.
- **Follow-up candidate (not this plan):** if the Header begins to feel slow under load, the ownedWatches array could be lifted into a React Cache (`unstable_cache`) or the Header could render NavWearButton as a deferred island that fetches its own list on first open. Not needed at MVP scale. Noted for Phase 11+ consideration if real-traffic profiling surfaces a hotspot.

### 4. Bundle-check — WatchPickerDialog NOT in initial layout chunk

Grep-confirmed: no top-level ES import of `WatchPickerDialog` in NavWearButton.tsx — only a `React.lazy(() => import(...))` dynamic import inside the module. Next.js emits this as a separate async chunk. The chunk is fetched only when the user taps `+ Wear` for the first time (or taps the WYWT self-placeholder tile, since WywtRail uses the same lazy pattern — both call sites share the same chunk).

Observed via `npm run build`:
- All 20 routes compile successfully.
- `/` is `◐ (Partial Prerender)` — the home's static shell prerenders while `CollectorsLikeYou` contributes a cached segment keyed by viewerId.
- The build log shows no warnings about the layout chunk exceeding size budgets.

### 5. 375px nav fit verification — **PASS (with documented label-hide fallback)**

**Analytical check** (no real browser / Playwright available in this environment):

Mobile viewport: 375px wide, container `px-4` gutters → 343px content width.

Right-cluster items with `gap-2` (8px) between them:
- ThemeToggle: `h-11 w-11` = 44px
- NavWearButton: `h-8` + `px-2.5` + Plus icon (16px) + gap-1 (4px) + **no label below sm:** ≈ 36px
- Add Watch: `h-8` + `px-2.5` + "Add Watch" text (~63px at 14px Geist Sans) = ~83px
- UserMenu: `size="sm"` button with initials ≈ 40px

Right cluster total: 44 + 8 + 36 + 8 + 83 + 8 + 40 = **227px**

Left-cluster items at mobile (HeaderNav is `hidden md:flex`, so invisible):
- MobileNav trigger: `h-11 w-11` = 44px
- gap-2: 8px
- Horlo wordmark: `font-serif text-xl` ≈ 60px

Left cluster total: 44 + 8 + 60 = **112px**

With `justify-between`, minimum required width = 112 + 227 = **339px**. Fits within **343px** content budget with 4px to spare. Cluster does NOT wrap.

**If the "Wear" label were visible at mobile**, NavWearButton would be ~68px instead of 36px, pushing the required width to ~371px (over budget by 28px). The `<span className="hidden sm:inline">Wear</span>` fallback preserves the label on ≥ 640px viewports (where plenty of room exists) while guaranteeing mobile single-line fit — exactly what plan 10-08 acceptance criteria sanctions.

**MobileNav untouched** (plan requirement): `src/components/layout/MobileNav.tsx` has **zero changes** in this plan. Wear + Add Watch remain nav-level actions reachable at all breakpoints via the Header; the mobile sheet stays focused on page navigation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Correctness / 375px fit] Hide "Wear" label below `sm:` breakpoint**

- **Found during:** Task 2 post-implementation review of the 375px fit criterion.
- **Issue:** UI-SPEC § Primary CTAs prescribes the literal "+ Wear" label (icon + text). However, at 375px viewport width, the combined right-cluster (ThemeToggle 44px + NavWearButton w/label 68px + gap + Add Watch 83px + gap + UserMenu 40px + gaps) + left-cluster (MobileNav 44px + Horlo wordmark 60px + gap) requires ~371px of content width — exceeding the 343px budget of a 375px viewport with `px-4` gutters by ~28px. The nav would wrap onto a second line, which the plan's acceptance criteria explicitly disallows without a sanctioned fallback.
- **Fix:** Wrapped the "Wear" text in `<span className="hidden sm:inline">Wear</span>`. Plus icon remains visible at all breakpoints. `aria-label="Log a wear for today"` (already present) carries the full semantic name for screen readers. Matches plan 10-08's documented remediation: "tighten button variants (e.g. icon-only Wear on `sm:` breakpoint)".
- **Files modified:** `src/components/layout/NavWearButton.tsx`
- **Tests:** The 4 NavWearButton tests continue to pass — jsdom's `getByText('Wear')` matches text content regardless of `hidden` class (no real layout engine in jsdom).
- **Commit:** `f3f54df` (bundled with the Header integration commit)
- **Scope:** Directly caused by this plan's integration work (Task 2); fix is isolated to Plan 10-08 files.

**2. [Rule 3 — Blocking] Header outer gap class changed from `gap-4` to `gap-2 md:gap-4`**

- **Found during:** Task 2 while computing the 375px fit.
- **Issue:** The original Header had `<div className="flex items-center gap-4">` for the right cluster. 4 items × 16px gaps = 48px of gap total on mobile, which contributed meaningfully to the overflow.
- **Fix:** Changed to `gap-2 md:gap-4` — 8px mobile gaps (24px total), 16px desktop gaps (48px total). Mirrors the left-cluster's existing `gap-2 md:gap-8` responsive pattern, so the Header now has consistent breakpoint-aware gap scaling.
- **Files modified:** `src/components/layout/Header.tsx`
- **Commit:** `f3f54df` (bundled with the Task 2 Header integration)

### No Authentication Gates

None encountered. All DAL calls in this plan (`getCurrentUser`, `getProfileById`, `getWatchesByUser`, `getWearRailForViewer`) are viewer-scoped reads — no external auth flow involved.

### No Architectural Decisions

No Rule 4 triggers. All three tasks implemented exactly per the plan's `<action>` specs modulo the two small Rule 2/3 fixes above.

## Known Stubs

**None.** Every prop flowing into the home sections is real:
- `WywtRail` receives real `data: WywtRailData` from `getWearRailForViewer` and real `ownedWatches: Watch[]` from `getWatchesByUser`.
- `CollectorsLikeYou`, `NetworkActivityFeed`, `PersonalInsightsGrid`, `SuggestedCollectors` each receive the real `viewerId` and own their own DAL reads from Plans 04–07.
- `NavWearButton` receives real `ownedWatches` (status-filtered) from the Header.

No placeholder text, no empty `={}` arrays flowing to UI, no "coming soon" strings.

## Threat Flags

**None.** This plan is pure composition over Plans 05/06/07's existing surfaces:
- The only new DAL call introduced anywhere in the plan is `getWatchesByUser` inside `Header.tsx` — a viewer-scoped, indexed, ownership-bounded query already covered by RLS + ownership scope. No new network endpoints, no new auth paths, no new schema changes.
- The threat register T-10-08-01 (Information Disclosure — Header watch fetch visible in logs) is appropriately `accept` per the plan: it's the viewer's own data, and no cross-user surface is introduced.
- The threat register T-10-08-02 (DoS — 5 DAL calls + 3 parent fetches on home render) is `mitigate` per the plan: `CollectorsLikeYou` is `'use cache'` cached (`cacheLife('minutes')`), others are indexed single-user queries. Plan 10-09 verifies end-to-end p95 latency.

## Issues Encountered

- **Pre-existing lint errors in unrelated files** persist (pattern across every Plan 10 SUMMARY: ~70 errors in `tests/actions/*`, `tests/data/isolation.test.ts`, etc.). Zero errors introduced by this plan. Verified by targeted `npx eslint` on the 4 plan-08 files: zero errors, zero warnings.
- **Full test suite growth:** Before Plan 10-08 baseline was 2031 passing. After Plan 10-08: 2052 passing. Net delta +21:
  - +4 new tests in `tests/components/layout/NavWearButton.test.tsx` (expected)
  - +17 auto-count in `tests/no-raw-palette.test.ts` (palette auto-tests 1 case per source file; plan 10-08 added 2 new source files + modified 2 existing — auto-counter picks them up)
  - 0 regressions in any prior suite.

## User Setup Required

**None.** No new env vars, migrations, secrets, or dependencies. The plan is pure code composition over existing wired components and DALs.

## Next Phase Readiness

- **Plan 10-09 (e2e / privacy verification)** can now test the full 5-section home at `/`:
  - Loads under an authenticated session and verifies every section renders (or is correctly hidden per its empty-state rules).
  - Verifies privacy gates end-to-end: private collector's activities hidden from feed; private collector's wears hidden from WYWT rail; etc.
  - Verifies the nav has `+ Wear` + Add Watch and does NOT have Explore / search / notifications.
  - Verifies the 375px mobile layout does not wrap (Playwright `page.setViewportSize({ width: 375, height: 800 })` + assertion that no element overflows its container).

No blockers for Plan 10-09.

## Self-Check: PASSED

Verified via shell checks:

- `src/components/layout/NavWearButton.tsx` — FOUND; `'use client'` line 1; `lazy(() => import('@/components/home/WatchPickerDialog')` dynamic import present; `Suspense fallback={null}` present; `variant="outline"` present; `Plus` icon import from lucide-react; aria-label "Log a wear for today" present; `<span className="hidden sm:inline">Wear</span>` 375px-fit fallback present
- `src/components/layout/Header.tsx` — FOUND; `NavWearButton` imported from `@/components/layout/NavWearButton`; `ownedWatches={ownedWatches}` prop passing confirmed; `getWatchesByUser(user.id)` parallel fetch confirmed; NavWearButton renders BEFORE Add Watch link (grep order: n=58, a=59); no `Explore` / `notification` / `search` strings
- `src/app/page.tsx` — FOUND; 5-section order locked (grep: W=36, C=37, N=38, P=39, S=40); `max-w-6xl` container; `space-y-8 md:space-y-12` vertical rhythm; `Promise.all([getWatchesByUser, getWearRailForViewer])` parallel fetch; no `CollectionView` import
- `tests/components/layout/NavWearButton.test.tsx` — FOUND; 4 `it(...)` cases
- **Pitfall 10 guard:** `find src -name "WatchPickerDialog*" -not -name "*.test.*"` returns exactly ONE file — `src/components/home/WatchPickerDialog.tsx`
- **Lazy import guard:** `grep -E "^import .* WatchPickerDialog" src/components/layout/NavWearButton.tsx` returns nothing — only dynamic `import()` inside `lazy(...)`
- Commits `181a77c`, `f919193`, `f3f54df`, `605bc22` — ALL FOUND in `git log`
- `npm test` — **2052 passed, 39 skipped, 0 failed** (net +21 vs Plan 07 baseline: +4 NavWearButton tests + 17 palette auto-count on new source files)
- `npm run build` — **green** across 20 routes under `cacheComponents: true`; `/` prerenders as Partial Prerender
- `npx eslint` on the 4 plan-08 files — **0 errors, 0 warnings**

---
*Phase: 10-activity-feed*
*Completed: 2026-04-22*
