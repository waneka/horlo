---
phase: 46-explore-shell-browse-archetypes
plan: "05"
subsystem: search
tags: [bug-fix, soft-nav, facet-state, useSearchState, G5, EXPL-05]
dependency_graph:
  requires: []
  provides: [G5-soft-nav-facet-fixed]
  affects: [src/components/search/useSearchState.ts, tests/components/search/useSearchState.test.tsx]
tech_stack:
  added: []
  patterns: [reconciliation-effect, no-op-guard, url-as-source-of-truth]
key_files:
  created: []
  modified:
    - src/components/search/useSearchState.ts
    - tests/components/search/useSearchState.test.tsx
decisions:
  - Reconciliation effect (useEffect keyed on searchParams) preferred over reading searchParams directly in render — keeps state as single reactive source for sub-effects
  - No-op guard (skip router.replace when searchParams has a param absent from built URL) selected over searchParams.toString() equality check — equality check cannot prevent the transitional strip during the one render before reconciliation settles
  - searchParams added to URL-sync dep array so the effect re-fires after soft nav and emits the correct URL on the second render (after reconciliation settled state)
metrics:
  duration: "~12 minutes"
  completed: "2026-05-19"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 46 Plan 05: Soft-Nav Facet Re-Seed (G5) Summary

JWT auth with refresh rotation — no; this plan: URL→state reconciliation in useSearchState so archetype facet state re-seeds on App Router soft nav.

## What Was Built

Fixed the G5 UAT gap: selecting a new archetype chip from `/explore` now correctly applies the new facet on `/search` on every client-side navigation, not just on hard page refreshes. Two compounding faults in `useSearchState` were fixed.

**Fault 1 (missing re-seed):** Facet state was only seeded from URL params at first mount via `useState` initializers. App Router soft nav does not remount the `/search` page, so `searchParams.get('archetype')` on a subsequent navigation was never consulted to update in-memory state.

**Fix 1:** Added a reconciliation `useEffect` (effect 1a) keyed on the `searchParams` object (which App Router provides as a new object reference per navigation). When the effect fires, it compares each URL facet value against in-memory state and calls the corresponding setter only when they differ, making URL the true source of truth for facets on every navigation.

**Fault 2 (URL-sync effect clobbers incoming param):** The URL-sync effect built a query string from stale in-memory state and called `router.replace`, stripping the just-arrived `archetype=B` from the URL before reconciliation could settle state.

**Fix 2:** Added a no-op guard in the URL-sync effect that checks whether any key present in `searchParams` would be absent from the URL about to be written. If so, the replace is skipped — the reconciliation effect will `setState` → trigger a re-render → the URL-sync re-fires with correct state. Also added `searchParams` to the URL-sync dep array so it re-fires after soft nav.

## Tasks

| Task | Type | Commit | Description |
|------|------|--------|-------------|
| 1 | TDD RED | 6c64ca5 | Add failing soft-nav regression tests (Tests 20 + 21) |
| 2 | TDD GREEN | 555c362 | Implement reconciliation effect + Fault 2 no-op guard |

## TDD Gate Compliance

- RED gate: `test(46-05): add failing soft-nav facet re-seed regression test` (6c64ca5)
- GREEN gate: `fix(46-05): reconcile facet state from URL on soft nav — G5` (555c362)
- Both gates present and in correct order.

## Verification Results

- `npx vitest run tests/components/search/useSearchState.test.tsx` — **21 tests passed** (19 prior + 2 new G5 tests)
- `npx vitest run tests/components/search/` — **80 tests passed** across 8 test files; no SearchPageClient regression
- `npx tsc --noEmit` — no new type errors in useSearchState.ts (pre-existing errors in unrelated test files unchanged)

## Deviations from Plan

### Auto-fixed Issues

None.

### Design Decision: No-Op Guard Over toString() Equality

The plan suggested `skip the replace when the freshly-built query string equals the current searchParams.toString()`. This equality check cannot prevent the transitional strip: during the render where searchParams changes to `?archetype=B` but in-memory state is still `archetype=null`, the sync effect builds `?tab=watches` (no archetype). These strings are not equal, so the guard would not fire. Instead, a "does searchParams have a param my built URL omits?" guard was used — this catches exactly the transitional case. The result: Test 21 passes.

## Known Stubs

None.

## Threat Flags

No new security surface introduced. The reconciliation effect copies URL param strings into state; those strings already flow to `searchWatchesAction` which is Zod-enum-validated for era/genre/archetype (per T-46-05-01 in threat model). No new input surface was added.

## Self-Check: PASSED

- `src/components/search/useSearchState.ts` — FOUND (modified)
- `tests/components/search/useSearchState.test.tsx` — FOUND (modified)
- Commit 6c64ca5 — FOUND (Task 1 RED)
- Commit 555c362 — FOUND (Task 2 GREEN)
- All 21 tests pass — VERIFIED
