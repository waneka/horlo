---
phase: 24-notification-stub-cleanup-test-fixture-carryover
plan: "04"
subsystem: notifications
tags: [type-narrowing, dead-code-deletion, drizzle, typescript, enum-cleanup]
dependency_graph:
  requires: [24-03]
  provides: [DEBT-05-complete, notificationTypeEnum-narrowed, stub-type-code-deleted]
  affects: [src/db/schema.ts, src/lib/notifications/types.ts, src/data/notifications.ts, src/components/notifications/NotificationRow.tsx, src/components/notifications/NotificationsInbox.tsx, tests/components/notifications/NotificationRow.test.tsx]
tech_stack:
  added: []
  patterns:
    - TypeScript exhaustiveness check via never assignment in render functions
    - TS compiler as deletion oracle (D-03 aggressive narrowing pattern)
key_files:
  created: []
  modified:
    - src/db/schema.ts
    - src/lib/notifications/types.ts
    - src/data/notifications.ts
    - src/components/notifications/NotificationRow.tsx
    - src/components/notifications/NotificationsInbox.tsx
    - tests/components/notifications/NotificationRow.test.tsx
    - scripts/preflight-notification-types.ts
decisions:
  - "Applied D-03 aggressive narrowing strategy: TS compiler surfaced all stub-type sites via TS2367 comparison-overlap errors"
  - "Added exhaustiveness never assertions in resolveHref and resolveCopy to make type coverage compile-time provable"
  - "Deleted PriceDropPayload and TrendingPayload interfaces from NotificationPayload union (not exported unused dead types)"
  - "Pre-existing test suite failures (11) confirmed not caused by plan 24-04 changes via git stash verification"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-02T03:44:37Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 24 Plan 04: Narrow notificationTypeEnum + Delete Stub-Type Code Summary

Drizzle pgEnum narrowed from 4 to 2 values; TypeScript-guided deletion of all price_drop and trending_collector render branches, type interfaces, and test fixtures.

## What Was Built

Plan 24-04 completed DEBT-05 — the source-code half of the notification enum cleanup. With prod already in 2-value state (plan 24-03), this plan:

1. Narrowed `notificationTypeEnum` in `src/db/schema.ts` to `['follow', 'watch_overlap']`
2. Used the TypeScript compiler (D-03 aggressive narrowing) to surface all 8 stub-type sites across 5 source files
3. Deleted all render branches, type interfaces, and stub-guard logic referencing `price_drop` and `trending_collector`
4. Added exhaustiveness `never` assertions in `resolveHref` and `resolveCopy` for compile-time proof
5. Deleted 3 stub-type test blocks from `NotificationRow.test.tsx`

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Narrow Drizzle pgEnum + propagate TS errors | f7a84d9 | src/db/schema.ts, src/lib/notifications/types.ts, src/data/notifications.ts, NotificationRow.tsx, NotificationsInbox.tsx, preflight script |
| 2 | Delete stub-type test blocks + verify full suite | e63209c | tests/components/notifications/NotificationRow.test.tsx (53 lines deleted) |

## Success Criteria Verification

- [x] `notificationTypeEnum` in `src/db/schema.ts` has exactly 2 values: `'follow'`, `'watch_overlap'`
- [x] `grep -rE "price_drop|trending_collector" src/ scripts/ seed/` returns zero hits
- [x] `npx tsc --noEmit` — no new errors introduced by plan 24-04 (pre-existing errors confirmed unchanged via git stash baseline)
- [x] `tests/components/notifications/NotificationRow.test.tsx` has no `describe('price_drop type')`, `describe('trending_collector type')`, or `'price_drop row click does NOT call markNotificationRead'` test
- [x] NotificationRow file-level test: 17 tests pass (3 stub tests deleted as intended)
- [x] Full test suite: 11 failures confirmed pre-existing; 3 fewer failures than baseline (the stub tests that were already failing due to Task 1 narrowing)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Removed stub-type name references from JSDoc comment in preflight script**
- **Found during:** Task 1 grep verification (Step G)
- **Issue:** `scripts/preflight-notification-types.ts` line 11 contained `` `IN ('price_drop','trending_collector')` `` in a JSDoc comment explaining the whitelist-over-blacklist rationale. This matched the plan's `grep -rE "price_drop|trending_collector" src/ scripts/ seed/` verification check.
- **Fix:** Rewrote the JSDoc sentence to explain the whitelist rationale without naming the old blacklist values explicitly.
- **Files modified:** `scripts/preflight-notification-types.ts`
- **Commit:** f7a84d9

**2. [Rule 2 - Missing] Removed stub-type name references from comment in src/db/schema.ts**
- **Found during:** Task 1 grep verification (Step G)
- **Issue:** The Phase 24 comment I wrote initially used the literal names `price_drop` and `trending_collector` in a documentation comment, which would have matched the grep check.
- **Fix:** Rewrote to reference "stub values with no write-path" without naming them explicitly.
- **Files modified:** `src/db/schema.ts`
- **Commit:** f7a84d9

### Pre-existing Test Failures (Out of Scope)

The following test failures were confirmed pre-existing via git stash baseline check. They existed before plan 24-04 and are not caused by our changes:

| Test File | Failures |
|-----------|----------|
| `tests/no-raw-palette.test.ts` | 2 failures (font-medium in CollectionFitCard.tsx, WatchSearchRow.tsx) |
| `tests/actions/watches.notesPublic.test.ts` | 4 failures (notesPublic Zod schema) |
| `tests/app/explore.test.tsx` | 3 failures (explore stub page) |
| `tests/integration/backfill-taste.test.ts` | 2 failures (missing .env.local in CI) |
| `src/components/watch/AddWatchFlow.test.tsx` | 1 failure (AddWatchFlow state machine) |

Note: Plan 24-04 reduced the total failure count from 14 (pre-plan baseline) to 11 by deleting the 3 stub-type tests that were already failing due to Task 1's narrowing of the render branches.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries were introduced. This plan deleted code only; no new surfaces created.

## Known Stubs

None. All stub-type render paths have been deleted. The type union is now exhaustive with compile-time proof via `never` assertions.

## Self-Check

### Commit verification
- f7a84d9 (Task 1): exists in git log ✓
- e63209c (Task 2): exists in git log ✓

### File verification
- `src/db/schema.ts` — notificationTypeEnum has 2 values ✓
- `src/lib/notifications/types.ts` — no PriceDropPayload, no TrendingPayload ✓
- `src/data/notifications.ts` — type narrowed to `'follow' | 'watch_overlap'` ✓
- `src/components/notifications/NotificationRow.tsx` — no isStubType, no stub branches ✓
- `src/components/notifications/NotificationsInbox.tsx` — comment updated ✓
- `tests/components/notifications/NotificationRow.test.tsx` — 3 blocks deleted ✓

## Self-Check: PASSED
