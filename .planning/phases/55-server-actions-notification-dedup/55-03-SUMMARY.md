---
phase: 55-server-actions-notification-dedup
plan: 03
subsystem: notifications
tags: [notifications, dedup, raw-sql, tdd, types, logger]

requires:
  - phase: 55-server-actions-notification-dedup
    plan: 02
    provides: notifications_watch_like_dedup and notifications_wear_like_dedup partial UNIQUE indexes (payload->>'watch_id', payload->>'wear_event_id')

provides:
  - WatchLikePayload, WearLikePayload, WatchCommentPayload, WearCommentPayload interfaces
  - Widened LogNotificationInput union (4 new branches)
  - Raw-SQL ON CONFLICT DO NOTHING dedup for watch_like and wear_like notification types
  - Standard Drizzle insert path for watch_comment and wear_comment notification types
  - notifyOnLike / notifyOnComment opt-out enforcement in logger

affects:
  - src/lib/notifications/types.ts
  - src/lib/notifications/logger.ts
  - tests/unit/notifications/logger.test.ts

tech_stack:
  added: []
  patterns:
    - "Raw-SQL tagged template db.execute with bare ON CONFLICT DO NOTHING (not .onConflictDoNothing()) for partial UNIQUE dedup indexes"
    - "Discriminated union widening on LogNotificationInput — each branch typed to specific payload interface"
    - "Opt-out read extended with notifyOnLike/notifyOnComment at write-time from profileSettings"

key_files:
  modified:
    - path: src/lib/notifications/types.ts
      role: "Added WatchLikePayload, WearLikePayload, WatchCommentPayload, WearCommentPayload; widened NotificationPayload union"
    - path: src/lib/notifications/logger.ts
      role: "Widened LogNotificationInput union, extended opt-out SELECT, added raw-SQL dedup branches for like types, generalized insert for comment types"
    - path: tests/unit/notifications/logger.test.ts
      role: "Rule 1 fix: added toString() to sql mock so String(callArg) exposes SQL text for NOTIF-14 assertions"

decisions:
  - "Raw-SQL ON CONFLICT DO NOTHING (bare, no constraint target) is load-bearing for like dedup — Drizzle's .onConflictDoNothing() targets the PK and silently never fires partial UNIQUE constraints"
  - "Comment types (watch_comment/wear_comment) route to standard Drizzle insert — each comment is a distinct event with no dedup index"
  - "Follow insert generalized to cover comment types (same path: db.insert with type: input.type)"
  - "sql mock toString() fix applied — TemplateStringsArray join exposes static SQL text fragments for test assertions"

metrics:
  duration_seconds: 256
  completed_date: "2026-05-22"
  tasks_completed: 2
  files_modified: 3
---

# Phase 55 Plan 03: Notification Logger Extension (NOTIF-11/12/13/14) Summary

Widened the notification payload type system and logger to handle four new social event types — `watch_like`, `wear_like`, `watch_comment`, `wear_comment`. Like types use raw-SQL `ON CONFLICT DO NOTHING` to hit the plan-02 partial UNIQUE dedup indexes; comment types use the standard Drizzle insert path. All 17 logger unit tests pass GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add four notification payload interfaces to types.ts (NOTIF-13) | 2938360 | src/lib/notifications/types.ts |
| 2 | Widen logger union, add opt-out reads, add raw-SQL like branches (NOTIF-11/12/14) | ec1e7dd | src/lib/notifications/logger.ts, tests/unit/notifications/logger.test.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed sql mock missing toString() method in logger.test.ts**
- **Found during:** Task 2 — running `npm test -- logger.test.ts` after implementing the raw-SQL branches
- **Issue:** The drizzle-orm `sql` mock in logger.test.ts returned a plain object `{ _tag: 'sql', strings, values }` without a `toString()` method. The NOTIF-14 test assertions call `String(callArg)` expecting the SQL text to be present (to check for `ON CONFLICT DO NOTHING`), but `String()` on a plain object returns `[object Object]`.
- **Fix:** Added a `toString()` method to the mock's sql tagged template return value that joins the `strings` TemplateStringsArray segments with `'?'`. This exposes the static SQL text fragments (which contain `ON CONFLICT DO NOTHING`) to the `String()` call.
- **Files modified:** `tests/unit/notifications/logger.test.ts` (lines 41-48)
- **Commit:** ec1e7dd

## Verification

- `npm test -- logger.test.ts` exits 0: 17/17 tests pass GREEN
- `npm run build` compiled successfully (no TypeScript errors)
- `grep -q "WearLikePayload" src/lib/notifications/types.ts` PASS
- `grep -q "wear_event_id" src/lib/notifications/types.ts` PASS
- `! grep -q "wear_id:" src/lib/notifications/types.ts` PASS (naming landmine avoided)

## Threat Surface Scan

No new network endpoints, auth paths, or file-access patterns introduced. This plan adds pure write-path logic to an existing internal utility — all inserts go through the existing `notifications` table with the same trust boundary as the prior logger implementation.

## Known Stubs

None. All four new event types are fully wired with correct payload shapes, opt-out enforcement, and insert paths.

## Self-Check: PASSED

- src/lib/notifications/types.ts exists and contains all four new interfaces
- src/lib/notifications/logger.ts exists and contains raw-SQL watch_like/wear_like branches
- Commits 2938360 and ec1e7dd both present in git log
- Build passes, 17/17 tests GREEN
