---
phase: 14-nav-shell-explore-stub
plan: 06
subsystem: routing
tags: [stub, coming-soon, nav-targets]
requires:
  - Plan 01 (proxy.ts auth redirect — D-20 precondition)
provides:
  - route: /explore (stub)
  - route: /search (stub)
affects:
  - Plan 03 BottomNav (Explore tab href now resolves)
  - Plan 04 SlimTopNav / DesktopTopNav (Search icon href now resolves)
tech_stack:
  added: []
  patterns:
    - Static Server Component (no 'use client', no data fetches)
    - UI-SPEC Copywriting Contract as single source of truth for copy
    - NotificationsEmptyState visual-density mirror (centered icon chip + heading + body)
key_files:
  created:
    - src/app/explore/page.tsx
    - src/app/search/page.tsx
    - tests/app/explore.test.tsx
    - tests/app/search.test.tsx
  modified: []
decisions:
  - Both stubs render inside the authenticated shell (D-20) — proxy.ts gates public access with no additional changes required
  - No Card / shadcn wrapper — matches NotificationsEmptyState density rather than a full Card surface
  - TDD executed in strict RED → GREEN order; REFACTOR skipped (no duplication to extract — /search deliberately mirrors /explore inline per plan)
metrics:
  duration: 1min
  completed_date: 2026-04-23
  tasks_total: 2
  tasks_complete: 2
  files_touched: 4
  tests_added: 8
---

# Phase 14 Plan 06: Explore + Search Stubs Summary

Ships two coming-soon placeholder pages (`/explore`, `/search`) as static Server Components so the Phase 14 nav links from BottomNav (Plan 03) and SlimTopNav/DesktopTopNav (Plan 04) do not 404. Copy and icons are locked by UI-SPEC §Copywriting Contract; rendering is authenticated-only via the existing proxy.ts redirect.

## Requirements Closed

| ID | Description | Evidence |
|----|-------------|----------|
| NAV-11 | `/explore` and `/search` stub routes rendered inside authenticated shell | `src/app/explore/page.tsx`, `src/app/search/page.tsx`; build emits `◐ /explore` and `◐ /search` partial-prerender routes |

## Tasks

### Task 1: /explore stub page (TDD)

- Files: `src/app/explore/page.tsx`, `tests/app/explore.test.tsx`
- Commits:
  - `8c6fcf5` — test (RED): 4 failing tests — heading, body copy, svg presence, default export is function
  - `7932c50` — feat (GREEN): Server Component with Sparkles icon chip, heading "Discovery is coming.", locked body copy
- Verification: `npm test -- --run tests/app/explore.test.tsx` → 4 passed
- Acceptance:
  - `grep -c "Discovery is coming" src/app/explore/page.tsx` = 1 (matches spec)
  - `grep -c "Sparkles" src/app/explore/page.tsx` = 2 (import + JSX)
  - `grep -c "Check back soon" src/app/explore/page.tsx` = 1

### Task 2: /search stub page (TDD)

- Files: `src/app/search/page.tsx`, `tests/app/search.test.tsx`
- Commits:
  - `c283a03` — test (RED): 4 failing tests — heading, body copy, svg presence, default export is function
  - `5b2e7a0` — feat (GREEN): Server Component with Search icon chip, heading "Search is coming.", locked body copy
- Verification: `npm test -- --run tests/app/search.test.tsx` → 4 passed
- Acceptance:
  - `grep -c "Search is coming" src/app/search/page.tsx` = 1
  - `grep -c "import { Search }" src/app/search/page.tsx` = 1
  - `grep -c "who wear what you love" src/app/search/page.tsx` = 1

## Verification

- Unit: `npm test -- --run tests/app/explore.test.tsx tests/app/search.test.tsx` → 8 passed / 0 failed
- Build: `npm run build` → success; `/explore` and `/search` emitted as partial-prerender routes (`◐`)
- Type check: `npx tsc --noEmit` → one pre-existing error in `src/app/u/[username]/layout.tsx:21` (`Cannot find name 'LayoutProps'`). This error is unrelated to Plan 06 (no files touched by this plan reference `LayoutProps`), was present on the base commit `ed1dc1d`, and is out of scope per the executor SCOPE BOUNDARY rule. Logged below.

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed via strict TDD (RED → GREEN with no REFACTOR step needed), copy/icons match UI-SPEC Copywriting Contract verbatim, all acceptance grep counts satisfied.

## Known Stubs

Both `/explore` and `/search` are intentional stubs documented in the plan itself:

- `/explore` — Discovery is a **future milestone beyond v3.0**; this file's sole purpose is "no nav 404s." No follow-up plan in the current ROADMAP.
- `/search` — Phase 16 (People Search) replaces this file with live `pg_trgm` ILIKE + taste-overlap results. Intentional stub with a named owner.

Neither stub fronts data that is supposed to render — they explicitly signal "coming soon," so Rule 2 (auto-add missing functionality) does not apply.

## Threat Flags

None. Plan 06 introduces no new trust boundaries; both routes render static text + an icon, zero data fetches, zero user input.

## Deferred Issues

- `src/app/u/[username]/layout.tsx:21` — pre-existing TS error (`Cannot find name 'LayoutProps'`) present on base commit `ed1dc1d` before this plan executed. Not caused by Plan 06 and not in `files_modified`. Carry forward to next phase's quick-fix backlog.

## Self-Check: PASSED

Verified artifacts:

- `src/app/explore/page.tsx` — FOUND
- `src/app/search/page.tsx` — FOUND
- `tests/app/explore.test.tsx` — FOUND
- `tests/app/search.test.tsx` — FOUND

Verified commits (all present in `git log`):

- `8c6fcf5` — FOUND (RED test — /explore)
- `7932c50` — FOUND (GREEN — /explore)
- `c283a03` — FOUND (RED test — /search)
- `5b2e7a0` — FOUND (GREEN — /search)
