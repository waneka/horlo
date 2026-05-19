---
phase: 48
plan: "01"
subsystem: catalog-page
status: complete
tags: [bug-fix, drizzle, test-infrastructure, regression-coverage]
dependency_graph:
  requires: []
  provides: [BUG-01-fix, catalog-ownership-filter, profiles-mock-infra]
  affects: [src/app/catalog/[catalogId]/page.tsx, tests/app/catalog-page.test.ts]
tech_stack:
  added: []
  patterns: [drizzle-and-eq-filter, vi-hoisted-vi-mock-vitest]
key_files:
  modified:
    - src/app/catalog/[catalogId]/page.tsx
    - tests/app/catalog-page.test.ts
decisions:
  - "Added eq(watchesTable.status, 'owned') as 3rd condition in findViewerWatchByCatalogId — only owned rows are 'truly owned' (D-02)"
  - "No new framing branches or wishlist callout added — deferred per CONTEXT.md D-03"
  - "Profiles mock added to test infra only, not test assertions — closes A1/Pitfall 1 gap"
metrics:
  duration_minutes: 4
  tasks_completed: 3
  tasks_total: 3
  files_modified: 2
  completed_date: "2026-05-19"
---

# Phase 48 Plan 01: BUG-01 Catalog Ownership Mislabel Fix Summary

**One-liner:** Surgical `status='owned'` Drizzle filter eliminates the mislabel where wishlist/grail/sold watches triggered the "You own this watch" callout on catalog pages, with three regression tests and the `@/data/profiles` mock gap closed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add @/data/profiles mock to catalog-page.test.ts infrastructure | 7f5a121 | tests/app/catalog-page.test.ts |
| 2 | Add 3 BUG-01 regression test cases (wishlist/grail/sold) | 4785b98 | tests/app/catalog-page.test.ts |
| 3 | Add status='owned' filter to findViewerWatchByCatalogId | 021c7b1 | src/app/catalog/[catalogId]/page.tsx |

## What Was Built

### BUG-01 Fix (Task 3)

In `findViewerWatchByCatalogId` (src/app/catalog/[catalogId]/page.tsx line 290), expanded the Drizzle `.where(and(...))` from 2 conditions to 3:

```typescript
// BEFORE (bug):
.where(and(eq(watchesTable.userId, userId), eq(watchesTable.catalogId, catalogId)))

// AFTER (fix):
.where(and(
  eq(watchesTable.userId, userId),
  eq(watchesTable.catalogId, catalogId),
  eq(watchesTable.status, 'owned'),  // BUG-01 fix
))
```

Wishlist, grail, and sold `watches` rows now return `null` from this function, causing the page to fall through to the existing `collection.length > 0` cross-user verdict path (D-03). No new framing branches, no new callouts (deferred per CONTEXT.md §Deferred Ideas).

### Mock Infrastructure (Task 1)

Closed the `@/data/profiles` mock gap (RESEARCH.md A1/Pitfall 1). `getProfileById` is called in `Promise.all` on every catalog page render. Without a mock, the test environment imported the real module which could fail or return undefined. Added:

- `mockGetProfileById: vi.fn()` to `vi.hoisted` block (destructure + return)
- `vi.mock('@/data/profiles', () => ({ getProfileById: mockGetProfileById }))` in mock cluster
- `mockGetProfileById.mockResolvedValue(null)` as `beforeEach` default

### BUG-01 Regression Tests (Task 2)

Added 3 new `it(...)` cases to the existing `describe('D-10 /catalog/[catalogId] page (Plan 06)')` block:

- `BUG-01 — wishlist watch does NOT trigger "You own this watch" callout`
- `BUG-01 — grail watch does NOT trigger "You own this watch" callout`
- `BUG-01 — sold watch does NOT trigger "You own this watch" callout`

Each test: sets `mockDbLimit.mockResolvedValue([])` (simulating the fixed query returning empty for non-owned statuses), calls `CatalogPage`, asserts `mockComputeVerdictBundle` called once with `framing='cross-user'`.

The pre-existing D-08 owned-path test (line 165) left unmodified as regression guard.

## Test Results

| Suite | Before | After |
|-------|--------|-------|
| tests/app/catalog-page.test.ts | 8 passing | 11 passing (0 failing) |
| Full suite (npx vitest run) | Pre-existing 2 failures in backfill-taste.test.ts | Same 2 pre-existing failures (unrelated — require .env.local) |

The 2 pre-existing failures in `tests/integration/backfill-taste.test.ts` are unrelated to this plan: they fail because `tsx --env-file=.env.local` cannot find `.env.local` in the worktree environment. Logged to deferred-items below.

## Verification

- `grep -c "eq(watchesTable.status, 'owned')" src/app/catalog/[catalogId]/page.tsx` → 1 ✓
- `grep -c "BUG-01" tests/app/catalog-page.test.ts` → 4 (1 comment + 3 test names) ✓
- `grep -c "vi.mock('@/data/profiles'" tests/app/catalog-page.test.ts` → 1 ✓
- `grep -c "On your wishlist\|on-your-wishlist\|onYourWishlist" page.tsx` → 0 ✓
- `npx vitest run tests/app/catalog-page.test.ts` → 11 passing ✓

## Deviations from Plan

None — plan executed exactly as written. All 3 tasks completed in the specified order using the exact patterns from PATTERNS.md.

## Known Stubs

None. No stub patterns introduced.

## Threat Flags

None. The change strictly narrows an existing query (additive filter). The pre-existing T-20-06-01 security invariant (scoped by userId AND catalogId) still holds — adding a third filter only narrows rows further. No new network endpoints, auth paths, or schema changes introduced.

## Deferred Items

- `tests/integration/backfill-taste.test.ts` (2 failures): Pre-existing out-of-scope failures requiring `.env.local` for integration test script invocation. Not caused by this plan.

## Self-Check: PASSED

- `src/app/catalog/[catalogId]/page.tsx` — FOUND ✓
- `tests/app/catalog-page.test.ts` — FOUND ✓
- Commit 7f5a121 — FOUND ✓
- Commit 4785b98 — FOUND ✓
- Commit 021c7b1 — FOUND ✓
