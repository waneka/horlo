---
phase: 14-nav-shell-explore-stub
plan: 03
subsystem: layout/nav
tags: [nav, mobile, bottom-nav, safe-area, cache-components, suspense, nextjs16, tailwind4, tdd]

requires:
  - phase: 14-nav-shell-explore-stub
    plan: 01
    provides: PUBLIC_PATHS + isPublicPath predicate
  - phase: 14-nav-shell-explore-stub
    plan: 02
    provides: IBM Plex Sans body font + viewport-fit=cover
provides:
  - Sticky 5-item mobile bottom nav (Home · Explore · Wear · Add · Profile)
  - Elevated 56x56 accent Wear circle with two-layer Figma shadow
  - BottomNavServer Suspense-leaf container (3rd Suspense under layout)
  - NavWearButton appearance prop ('header' | 'bottom-nav') — no fork
affects:
  - src/app/layout.tsx (3rd Suspense leaf, main padding)
  - Plan 14-04 DesktopTopNav will reuse NavWearButton in default appearance
  - Plan 14-05 SlimTopNav will reuse the isPublicPath gate the same way

tech-stack:
  added: []
  patterns:
    - Client Component for usePathname() active-state resolution
    - Server Component container for auth/DAL fetches kept in own Suspense
    - Shared appearance prop pattern (instead of forking NavWearButton)
    - strokeWidth={active ? 2.5 : 2} active-state treatment (lucide 1.8 has no filled variants)
    - Tailwind arbitrary values for env(safe-area-inset-bottom) math

key-files:
  created:
    - src/components/layout/BottomNav.tsx
    - src/components/layout/BottomNavServer.tsx
    - tests/components/layout/BottomNav.test.tsx
  modified:
    - src/components/layout/NavWearButton.tsx
    - src/app/layout.tsx
    - tests/components/layout/NavWearButton.test.tsx
    - tests/app/layout.test.tsx

key-decisions:
  - "Applied font-semibold in place of plan-specified font-medium — project-wide no-raw-palette invariant bans font-medium; UI-SPEC Typography row specifies 600 (Semibold) for nav labels, so font-semibold aligns with UI-SPEC while satisfying the invariant (Rule 1 deviation)"
  - "NavWearButton kept as single component with appearance prop (Pitfall I-2) — both header and bottom-nav variants open the SAME lazy-loaded WatchPickerDialog; WatchPickerDialog imports locked to 2 files (NavWearButton + WywtRail)"
  - "BottomNavServer as separate Server Component container so client pathname read (BottomNav) doesn't block the auth/DAL fetch under cacheComponents (Pitfall A-1); 3rd Suspense leaf in layout"
  - "Active state via strokeWidth={2.5} + text-accent (not filled-variant icons) — lucide-react 1.8.0 ships no filled variants (RESEARCH §Pattern 2)"
  - "Profile active on any /u/{username} prefix so collection/worn/stats/common-ground/insights tabs all keep the Profile link highlighted"

patterns-established:
  - "Shared-component appearance-prop pattern — use on future nav surfaces instead of forking"
  - "Suspense-leaf discipline: every server fetch gets its own <Suspense fallback> sibling inside layout's ThemeProvider"
  - "Main padding pattern: pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 so mobile scroll clears the nav and desktop pays no penalty"

requirements-completed: [NAV-01, NAV-02, NAV-03, NAV-04, NAV-05, NAV-09, NAV-10]

duration: ~9 min
completed: 2026-04-23
---

# Phase 14 Plan 03: Sticky Mobile Bottom Nav Summary

Built the production mobile bottom navigation: 5 items, Figma-spec elevated Wear circle, safe-area handling, and auth-route gating — all mounted as a sibling Suspense leaf to the existing Header + main tree without breaking `cacheComponents: true`.

## Performance

- Duration: ~9 minutes end-to-end
- Started: 2026-04-23T23:03Z
- Completed: 2026-04-23T23:12Z
- Tasks: 2/2 complete
- Files created: 3 (BottomNav.tsx, BottomNavServer.tsx, BottomNav.test.tsx)
- Files modified: 4 (NavWearButton.tsx, layout.tsx, NavWearButton.test.tsx, layout.test.tsx)

## Accomplishments

- 5-item sticky bottom nav renders on every authenticated mobile route (<768px)
- Wear circle: 56x56, `bg-accent`, two-layer Figma shadow, `Watch` icon 28x28, elevated ~20px above the bar via `-translate-y-5` on the column wrapper (D-01/D-02/D-03)
- Active state: `text-accent` on the tapped item's icon + label, `strokeWidth={2.5}` on icon, `aria-current="page"` on the `<Link>`
- Inactive state: `text-muted-foreground` + `strokeWidth={2}` (lucide-react 1.8.0 does not ship filled variants — RESEARCH §Pattern 2)
- Profile active on any `/u/{username}` prefix so collection/worn/stats/common-ground tabs all keep the Profile indicator highlighted
- Auth-route gate uses the shared `isPublicPath(pathname)` predicate — single source of truth with `src/proxy.ts` (D-21/D-22); nav renders `null` on `/login`, `/signup`, `/forgot-password`, `/reset-password`, and any `/auth/*`
- Nav renders `null` when `username` is null so unauthenticated ghost-nav never flashes
- Safe-area: container `h-[calc(60px+env(safe-area-inset-bottom))]` + `pb-[env(safe-area-inset-bottom)]`; `<main>` padded `pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0` (NAV-03, D-06)
- `BottomNavServer` mounted under its own `<Suspense fallback={null}>` leaf — 3rd Suspense boundary in `layout.tsx`, preserving the Pitfall A-1 / P-01 cacheComponents invariant
- `NavWearButton` kept as a SINGLE component with a new `appearance` prop (`'header' | 'bottom-nav'`); both variants open the SAME lazy-loaded `WatchPickerDialog`. `WatchPickerDialog` imports remain at exactly 2 files (NavWearButton + WywtRail) — Pitfall I-2 honored
- Reverse-locked layout contract test: `expect(suspenses.length).toBeGreaterThanOrEqual(3)` replaces the Plan 02 `>= 2` assertion

## Task Commits

| Task | Type | Hash | Description |
|---|---|---|---|
| 1 (RED) | test | `627c73f` | Failing tests for NavWearButton bottom-nav appearance variant |
| 1 (GREEN) | feat | `6b4ceab` | NavWearButton `appearance` prop (no fork — Pitfall I-2) |
| 2 (RED) | test | `ccc72f0` | Failing BottomNav tests + raised layout Suspense lock to >=3 |
| 2 (GREEN) | feat | `146812b` | BottomNav + BottomNavServer + layout mount + main padding |

Every task committed atomically with a conventional `type(phase-plan):` prefix.

## Files Created / Modified

### Created

- `src/components/layout/BottomNav.tsx` — 'use client' 5-item nav (Home · Explore · Wear · Add · Profile). Resolves active state via `usePathname()`, gates via `isPublicPath`, hides on `username === null`, reuses `NavWearButton` with `appearance="bottom-nav"`.
- `src/components/layout/BottomNavServer.tsx` — Server Component container: awaits `getCurrentUser`, parallel-fetches `getProfileById` + `getWatchesByUser`, filters owned watches, forwards `(username, ownedWatches)` to `BottomNav`. Handles `UnauthorizedError` as a null-render (auth gate) and non-auth errors as rethrows.
- `tests/components/layout/BottomNav.test.tsx` — 18 tests covering Render (5 items), per-route active state for Home/Explore/Add/Profile, `/u/{username}` prefix match, all 5 PUBLIC_PATHS null-renders, unauthenticated null, href correctness, Wear trigger click, container classes, safe-area env() reference, active/inactive color split (D-04).

### Modified

- `src/components/layout/NavWearButton.tsx` — Added optional `appearance` prop. Default ('header') preserves the existing outline Button + Plus icon behavior (existing tests stay green). New 'bottom-nav' renders elevated `size-14 rounded-full bg-accent` with two-layer Figma shadow, 28x28 `Watch` icon, underline label "Wear" in `text-accent`. Shared `WatchPickerDialog` state preserved — no fork.
- `src/app/layout.tsx` — Added `BottomNavServer` import, mounted under 3rd `<Suspense fallback={null}>` sibling to Header + main, bumped `<main>` className to `pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0` so scroll content clears the nav on mobile without penalizing desktop.
- `tests/components/layout/NavWearButton.test.tsx` — Added 6 new tests under `Phase 14-03 Task 1 — bottom-nav appearance variant` subgroup (covers circle geometry, shadow, bg-accent, aria-label "Log a wear", shared dialog reuse, 28x28 icon). 4 existing header-variant tests preserved as regression guard.
- `tests/app/layout.test.tsx` — Raised Suspense-count assertion from `>= 2` to `>= 3` to lock BottomNavServer presence.

## Threat Mitigations Delivered

| Threat ID | Status |
|---|---|
| T-14-03-01 (BottomNav visible on /login leaks URL structure) | Mitigated — `isPublicPath` gate at top of `BottomNav`, locked by Tests 6-10. Shared constant with `src/proxy.ts` prevents drift. |
| T-14-03-02 (BottomNav outside Suspense breaks cacheComponents) | Mitigated — BottomNavServer mounted under its own Suspense leaf. Test locks `>= 3` Suspense count; `npm run build` exits 0. |
| T-14-03-03 (Forking NavWearButton / WatchPickerDialog) | Mitigated — appearance prop on NavWearButton, lazy imports locked to 2 files (`import\('@/components/home/WatchPickerDialog'` grep returns exactly 2). |
| T-14-03-04 (Wrong username in Profile link) | Mitigated — `username` resolved in `BottomNavServer` via `getCurrentUser()` + `getProfileById(user.id)`; never user-supplied. |

## Deviations from Plan

### Rule 1 (Bug / Conflict) — font-medium → font-semibold

- **Found during:** Task 2 full-suite run
- **Issue:** The plan's `<action>` specifies `font-medium` for the nav labels, but the project-wide `tests/no-raw-palette.test.ts` invariant forbids `font-medium` (along with `font-bold` and `font-light`). Running the full suite failed 2 tests after the initial Task 2 GREEN.
- **Reconciliation:** The UI-SPEC typography table lists nav labels as `600 (Semibold)` (line 62 of `14-UI-SPEC.md`), which maps to `font-semibold` — a non-forbidden utility. CONTEXT.md D-09 said `font-medium` (weight 500), but that contradicts the same phase's UI-SPEC typography row. Choosing `font-semibold` satisfies the visible spec (UI-SPEC is the visual contract) and the project invariant simultaneously.
- **Fix:** Changed `font-medium` → `font-semibold` in both `src/components/layout/BottomNav.tsx` (NavLink label span) and `src/components/layout/NavWearButton.tsx` (bottom-nav "Wear" label).
- **Files modified:** `src/components/layout/BottomNav.tsx`, `src/components/layout/NavWearButton.tsx`
- **Commit:** `146812b` (rolled into Task 2 GREEN commit)
- **Impact:** Visual weight bumps from 500 (Medium) to 600 (Semibold) — still inside the two-weight set loaded by `IBM_Plex_Sans` in `src/app/layout.tsx` (weights `['400','500','600','700']` are all preloaded by Plan 02). No additional font-file request introduced.

### Test 2 assertion adjustment (test-infrastructure only)

- **Found during:** First GREEN run of Task 2
- **Issue:** Initial Test 2 asserted `exploreLink.className` contained `text-accent`, but my implementation applies `text-accent` to the inner `<Icon>` and `<span>` — the `<Link>` wrapper only carries layout classes so that the non-active Link inherits current-color cleanly.
- **Fix:** Rewrote Test 2 to assert on the label span (which already existed as the second half of the same test). Also added a negative assertion on the Home label to lock the muted-foreground branch.
- **Commit:** `146812b` (rolled into Task 2 GREEN commit)
- **Classification:** Test-correctness adjustment; no production behavior change.

No Rule 2, 3, or 4 deviations occurred.

## Verification Results

| Check | Result |
|-------|--------|
| `npm test -- --run tests/components/layout/NavWearButton.test.tsx` | 10/10 passed (4 existing regression + 6 new bottom-nav) |
| `npm test -- --run tests/components/layout/BottomNav.test.tsx` | 18/18 passed |
| `npm test -- --run tests/app/layout.test.tsx` | 7/7 passed (Suspense assertion raised to >=3) |
| `npm test -- --run tests/no-raw-palette.test.ts` | All passed after font-semibold swap |
| `npm test -- --run` (full suite) | 2441 passed / 119 skipped / 0 failed |
| `npx tsc --noEmit` on plan-touched files | Clean (2 pre-existing errors in `tests/components/preferences/PreferencesClient.debt01.test.tsx` unrelated — verified on base e356531) |
| `npm run build` | Compiled successfully; 23 routes prerendered; cacheComponents + Viewport compatible |
| Acceptance greps (Task 1 + Task 2) | All pass (appearance prop, size-14, rounded-full, bg-accent, shadow, size-7, aria-label variants, 'use client' split, md:hidden, fixed bottom-0, env(safe-area-inset-bottom), -translate-y-5, aria-current, strokeWidth, BottomNavServer mount, pb-[calc(...)], Suspense >=3) |

## Deferred Issues

- Pre-existing TS errors in `tests/components/preferences/PreferencesClient.debt01.test.tsx` (lines 86, 129: `Type 'undefined' is not assignable to type 'UserPreferences'`). Verified pre-existing on base commit `e356531` before Plan 14-03 edits. Out of scope for this plan. Captured in Plan 14-01 `deferred-items.md` as well.

## Downstream Consumers

- **Plan 14-04 DesktopTopNav:** Reuses `NavWearButton` in its default `appearance="header"` (or omit — both resolve to header). No additional API surface needed.
- **Plan 14-05 SlimTopNav:** Reuses the same `isPublicPath()` gate pattern as `BottomNav`. Shared predicate keeps the two nav surfaces in lock-step.
- **Plan 14-07 /insights retirement:** Profile tab link becomes active on `/u/{username}/insights` path naturally because `BottomNav.isProfile = pathname.startsWith('/u/{username}')`.
- **Phase 15 WYWT photo flow:** Wear CTA opens the shared `WatchPickerDialog` on both desktop and mobile — no changes to dialog contract required.

## Self-Check: PASSED

- `src/components/layout/BottomNav.tsx` — FOUND
- `src/components/layout/BottomNavServer.tsx` — FOUND
- `tests/components/layout/BottomNav.test.tsx` — FOUND
- Commit `627c73f` (Task 1 RED) — FOUND
- Commit `6b4ceab` (Task 1 GREEN) — FOUND
- Commit `ccc72f0` (Task 2 RED) — FOUND
- Commit `146812b` (Task 2 GREEN) — FOUND
- No stubs, no TODO, no placeholder data introduced
- No new threat surface outside the plan's `<threat_model>` — nav is client-gated on PUBLIC_PATHS with server-side identity resolution, all trust boundaries already mapped in T-14-03-01..04
