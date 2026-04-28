---
phase: 18-explore-discovery-surface
plan: 04
subsystem: navigation
tags: [bottom-nav, mobile, slot-rewrite, search-slot, d-01, d-02, d-03, d-04]
dependency_graph:
  requires:
    - "Phase 14 BottomNav contract (typography/spacing/safe-area)"
    - "NavWearButton appearance=bottom-nav (Phase 14)"
    - "isPublicPath shared predicate (Phase 14)"
  provides:
    - "Final v4.0 5-slot mobile BottomNav: Home / Search / Wear / Explore / Profile"
    - "isSearch predicate matching /search and /search/*"
    - "Add slot dropped (D-02) — no Plus import, no isAdd, no /watch/new tap target in BottomNav"
  affects:
    - "Phase 25 (NAV-14 amendment) — original Profile-in-hamburger wording is now superseded"
    - "Phase 25 (DISC-08 amendment) — Notifications stays in TopNav bell, NOT BottomNav"
    - "Mobile users have NO bottom-tap path to /watch/new until contextual CTAs ship"
tech_stack:
  added: []
  patterns:
    - "Mock NavWearButton in BottomNav unit tests (data-testid + data-appearance) — avoids Phase 15 dialog dep tree"
key_files:
  created:
    - ".planning/phases/18-explore-discovery-surface/18-04-SUMMARY.md"
  modified:
    - "src/components/layout/BottomNav.tsx (slot rewrite + JSDoc update)"
    - "tests/components/layout/BottomNav.test.tsx (full rewrite to assert new contract)"
decisions:
  - "Implements D-01 (5-slot final shape: Home/Search/Wear/Explore/Profile)"
  - "Implements D-02 (Add slot dropped from BottomNav)"
  - "Implements D-03 (Profile permanent in BottomNav — supersedes NAV-14 wording)"
  - "Implements D-04 (Notifications stays in TopNav bell — supersedes original DISC-08 wording)"
metrics:
  duration_minutes: 7
  task_count: 1
  test_count: 11
  files_modified: 2
  files_created: 1
  completed_date: "2026-04-28"
requirements:
  - DISC-08
---

# Phase 18 Plan 04: BottomNav Slot Rewrite Summary

Rewrote the mobile BottomNav from the Phase 14 shape `Home / Explore / Wear / Add / Profile` to the v4.0 final shape `Home / Search / Wear / Explore / Profile` per Phase 18 D-01..D-04. Independent of the Wave 2 rails work; ships the slot contract that downstream phases consume.

## What Shipped

### Slot order changes

| Slot | Phase 14 (before)        | Phase 18 (after)         | Change         |
| ---- | ------------------------ | ------------------------ | -------------- |
| 1    | Home → `/`               | Home → `/`               | unchanged      |
| 2    | Explore → `/explore`     | **Search → `/search`**   | NEW            |
| 3    | Wear (NavWearButton)     | Wear (NavWearButton)     | unchanged      |
| 4    | Add → `/watch/new`       | **Explore → `/explore`** | moved from 2   |
| 5    | Profile → `/u/{u}/coll.` | Profile → `/u/{u}/coll.` | unchanged      |

Add slot is dropped entirely (D-02) — no `Plus` icon import, no `isAdd` predicate, no `/watch/new` link in the bottom nav. Mobile users still reach `/watch/new` via the WatchPicker dialog and direct URL until Phase 25 ships the contextual CTAs (UX-01..UX-04).

### Active-state predicate changes

Removed: `const isAdd = pathname === '/watch/new'`

Added: `const isSearch = pathname === '/search' || pathname.startsWith('/search/')`

Final predicate set: `isHome`, `isSearch`, `isExplore`, `isProfile`. Each non-Wear slot still flips `text-accent` + `strokeWidth=2.5` and emits `aria-current="page"` per the Phase 14 D-04 contract.

### Imports

```typescript
// BEFORE
import { Home, Compass, Plus, User } from 'lucide-react'

// AFTER
import { Home, Search, Compass, User } from 'lucide-react'
```

`Plus` removed; `Search` added. `Compass` and `User` retained (now driving slot 4 and slot 5 respectively).

### Test rewrite (`tests/components/layout/BottomNav.test.tsx`)

Replaced the 19-test Phase 14 suite with 11 tests asserting the new 5-slot contract:

1. Renders 5 slots in correct DOM order (Home / Search / Wear / Explore / Profile)
2. Search slot routes to `/search`
3. Explore slot routes to `/explore`
4. Profile slot routes to `/u/alice/collection`
5. No Add slot, no `/watch/new` link
6. Search active when pathname=`/search`; Explore is not
7. Explore active when pathname=`/explore`; Search is not
8. Search active for nested `/search/people` (startsWith match)
9. Returns null on PUBLIC_PATH (e.g. `/login`)
10. Returns null when `username` is null (unauthenticated)
11. Wear cradle present with `appearance="bottom-nav"`

Test file now mocks `NavWearButton` to a minimal `data-testid="wear-button"` stub, avoiding the Phase 15 dialog dep tree (WywtPostDialog → WatchPickerDialog → ComposeStep → PhotoUploader → heic worker chunk) in the unit test.

## What Stayed Unchanged from Phase 14

- Container classes: `fixed bottom-0 left-0 right-0 z-50 md:hidden flex items-stretch bg-background/95 backdrop-blur border-t border-border h-[calc(80px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] px-2`
- NavLink shape: `flex flex-1 flex-col items-center justify-end gap-1 pb-4 h-full min-h-11`
- Typography: `text-[12px] leading-[16px] font-semibold`
- Icon size + active rules: `size-6` with `text-accent` + `strokeWidth=2.5` on active
- `aria-current="page"` on the active Link
- `isPublicPath()` early-return (auth chrome leak guard, T-18-04-01 mitigation)
- `!username` early-return (ghost-nav flash guard)
- `NavWearButton` slot 3 contract (`appearance="bottom-nav"`, 56×56 cradle, natural overflow lift, no transform)
- `BottomNavServer.tsx` props contract — NOT modified

## Requirements Satisfied

- DISC-08 — BottomNav slot contract delivered for v4.0 (with the Notifications-stays-TopNav-bell amendment per D-04 baked into the JSDoc)

## Decisions Implemented

| Decision | Description | Effect |
|----------|-------------|--------|
| D-01 | Final 5-slot shape: Home / Search / Wear / Explore / Profile | Shipped — 11/11 tests assert order + routes + active states |
| D-02 | Add slot dropped from BottomNav | Shipped — no `Plus` import, no `isAdd`, no `/watch/new` link in BottomNav |
| D-03 | Profile permanent in BottomNav | Shipped — slot 5 unchanged; supersedes NAV-14 wording |
| D-04 | Notifications stays in TopNav bell | Shipped (by omission) — no Notifications slot added; JSDoc cites D-04 |

## Phase 25 Amendment Required

The original NAV-14 wording (Profile in hamburger) and original DISC-08 wording (Notifications surface decision) are now superseded by D-03 and D-04 respectively. Phase 25 will need an amendment via `/gsd-discuss-phase 25` per CONTEXT.md Deferred Ideas before its plans run.

## Threat Model Status

| Threat ID | Disposition | Outcome |
|-----------|-------------|---------|
| T-18-04-01 | mitigate | Phase 14 `isPublicPath()` early-return preserved verbatim. Test 9 (`/login`) asserts null render. |
| T-18-04-02 | mitigate | Full grep clean: 0 `isAdd` references in `src/`, `tests/`, `scripts/`. Test rewrite covers all 5 slots. TypeScript compiler would have flagged any orphan `isAdd` symbol. |
| T-18-04-03 | accept | D-02 explicitly accepts interim friction between Phase 18 ship and Phase 25 ship. Mobile users still reach `/watch/new` via WatchPicker dialog and direct URL. UX risk, not security. |

## Deviations from Plan

None — plan executed exactly as written. Test 11 used the recommended NavWearButton mock pattern (rather than the alternative test-id locator on the real component); the plan listed both approaches as acceptable.

## Pre-existing Issues Out of Scope

The following pre-existing TypeScript and lint errors exist in the repo and are unrelated to this plan's changes — left untouched per scope boundary rule:

- `tests/components/layout/DesktopTopNav.test.tsx` — TS2300 duplicate `href` identifier (Phase 16 test debt)
- `tests/components/preferences/PreferencesClient.debt01.test.tsx` — TS2322 undefined→UserPreferences (carried v3.0 test debt)
- `tests/components/search/useSearchState.test.tsx` — TS2578 unused @ts-expect-error
- `tests/integration/phase17-extract-route-wiring.test.ts` — TS2322 null→string (Phase 17 test debt)
- `tests/proxy.test.ts` — `@typescript-eslint/no-explicit-any` errors (carried test debt)

`BottomNav.tsx` itself: 0 TS errors, 0 lint errors.

## Verification

| Check | Command | Result |
|-------|---------|--------|
| All BottomNav tests pass | `npx vitest run tests/components/layout/BottomNav.test.tsx` | 11/11 passed |
| New import line correct | `grep "import { Home, Search, Compass, User } from 'lucide-react'" src/components/layout/BottomNav.tsx` | 1 match |
| No `Plus` import | `grep 'Plus' src/components/layout/BottomNav.tsx` | 0 matches |
| No `isAdd` predicate | `grep 'isAdd' src/components/layout/BottomNav.tsx` | 0 matches |
| `isSearch` wired | `grep 'isSearch' src/components/layout/BottomNav.tsx` | 2 matches (predicate + slot) |
| `/search` link present | `grep 'href="/search"' src/components/layout/BottomNav.tsx` | 1 match |
| No `/watch/new` link | `grep 'href="/watch/new"' src/components/layout/BottomNav.tsx` | 0 matches |
| Search label | `grep 'label="Search"' src/components/layout/BottomNav.tsx` | 1 match |
| Explore label | `grep 'label="Explore"' src/components/layout/BottomNav.tsx` | 1 match |
| No Add label | `grep 'label="Add"' src/components/layout/BottomNav.tsx` | 0 matches |
| No `isAdd` repo-wide | `grep -rn 'isAdd' src/ tests/ scripts/` | 0 matches |

## Commits

| Phase | Type | Hash | Message |
|-------|------|------|---------|
| RED   | test | 5bee600 | test(18-04): add failing tests for new 5-slot BottomNav contract |
| GREEN | feat | 5e1087a | feat(18-04): rewrite BottomNav slot order to v4.0 final shape |

REFACTOR phase skipped — the GREEN edit is already at the minimum surgical-diff target specified by the plan.

## Self-Check: PASSED

- [x] `src/components/layout/BottomNav.tsx` exists and reflects v4.0 contract (verified via Read tool)
- [x] `tests/components/layout/BottomNav.test.tsx` exists and contains 11 tests (verified via vitest run)
- [x] Commit `5bee600` exists in git log
- [x] Commit `5e1087a` exists in git log
- [x] No `isAdd` references repo-wide (grep confirmed)
- [x] No `Plus` import in `BottomNav.tsx` (grep confirmed)
- [x] All 11 tests pass under vitest
