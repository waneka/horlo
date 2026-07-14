---
phase: 83-polish-sweep
plan: "01"
subsystem: layout
tags:
  - ui
  - nav
  - polish
dependency_graph:
  requires: []
  provides:
    - POLISH-01 (desktop top nav without + add-watch button)
  affects:
    - src/components/layout/DesktopTopNav.tsx
tech_stack:
  added: []
  patterns:
    - lucide-react import trimmed when icon removed
key_files:
  modified:
    - src/components/layout/DesktopTopNav.tsx
    - tests/components/layout/DesktopTopNav.test.tsx
decisions:
  - "D-01: Remove the + Link/Button/Plus block at lines 98-105; no substitute affordance"
  - "D-02: AddWatchCard on Collection/Wishlist tabs is the canonical add-flow entry point"
  - "D-12: No new tests; existing assertions updated to reflect new composition"
metrics:
  duration: ~5min
  completed: "2026-07-14"
  tasks: 2
  commits: 2
  files_modified: 2
---

# Phase 83 Plan 01: Desktop Nav Plus Removal Summary

**One-liner:** Remove the redundant `+` add-watch icon-button from `DesktopTopNav.tsx` and align the test suite to match (POLISH-01).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove + add-watch button and Plus import from DesktopTopNav.tsx | 7a4c4532 | src/components/layout/DesktopTopNav.tsx |
| 2 | Update DesktopTopNav.test.tsx assertions for removed + button | f11c7b23 | tests/components/layout/DesktopTopNav.test.tsx |

## What Was Done

**Task 1 — DesktopTopNav.tsx:**
- Removed `Plus` from the `lucide-react` import (line 5); `Search` kept (still used by the search input)
- Deleted the 8-line `<Link href="/watch/new?returnTo=...">/<Button>/<Plus>` block (former lines 98-105)
- `NavWearButton` and `{bell}` siblings preserved in their original sibling order
- Updated JSDoc composition comment: removed `· Add icon` fragment from the "Composition (left → right)" line
- All other chrome untouched: wordmark, Explore link, search form, `NavWearButton`, bell, `UserMenu`, `isPublicPath` guard

**Task 2 — DesktopTopNav.test.tsx:**
- Test 9: removed `getByRole('link', { name: /add watch/i }).toBeInTheDocument()` assertion; renamed test to drop "Add icon"
- Test 10: deleted entire `it(...)` block (add-watch href/returnTo assertions — behavior no longer exists)
- Test 15: removed `queryByRole('link', { name: /add watch/i }).toBeNull()` assertion; renamed test to drop "Add link"
- Test count: 13 → 12 (exactly -1 per D-12)
- All other 9 tests untouched

## Verification

- `grep -c 'Plus' src/components/layout/DesktopTopNav.tsx` = 0 (no import, no JSX)
- `grep -c 'aria-label="Add watch"' src/components/layout/DesktopTopNav.tsx` = 0
- `grep -c '/watch/new?returnTo=' src/components/layout/DesktopTopNav.tsx` = 0
- `grep -c 'name: /add watch/i' tests/components/layout/DesktopTopNav.test.tsx` = 0
- `grep -c "'Test 10 —" tests/components/layout/DesktopTopNav.test.tsx` = 0
- `grep -c 'Add icon' tests/components/layout/DesktopTopNav.test.tsx` = 0
- `npx vitest run tests/components/layout/DesktopTopNav.test.tsx` — 12 passed, 0 failed
- `npm run build` — ✓ Compiled successfully

## Deviations from Plan

None — plan executed exactly as written.

The acceptance criteria noted `grep -c 'NavWearButton' src/components/layout/DesktopTopNav.tsx` should return 2 (1 import + 1 JSX). It returns 3 because the JSDoc comment in the component also contains the string `NavWearButton`. This is not a bug — the JSDoc is informational prose and the functional code (import + JSX) is exactly 2 occurrences as intended.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- src/components/layout/DesktopTopNav.tsx — FOUND (modified)
- tests/components/layout/DesktopTopNav.test.tsx — FOUND (modified)
- Commit 7a4c4532 — FOUND in git log
- Commit f11c7b23 — FOUND in git log
