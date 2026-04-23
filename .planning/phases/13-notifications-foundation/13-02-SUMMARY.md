---
phase: 13
plan: 02
subsystem: notifications
tags: [notifications, logger, dal, server-actions, wave-1]
dependency_graph:
  requires: [13-01]
  provides: [logNotification, getNotificationsForViewer, getNotificationsUnreadState, markAllReadForUser, touchLastSeenAt, findOverlapRecipients, markAllNotificationsRead]
  affects: [src/app/actions/profile.ts, src/data/notifications.ts, src/lib/notifications/]
tech_stack:
  added: []
  patterns: [fire-and-forget-logger, explicit-viewerid-dal, two-layer-defense, next16-revalidateTag-two-arg]
key_files:
  created:
    - src/lib/notifications/types.ts
    - src/lib/notifications/logger.ts
    - src/data/notifications.ts
    - src/app/actions/notifications.ts
    - tests/unit/notifications/logger.test.ts
    - tests/data/getNotificationsUnreadState.test.ts
    - tests/data/getNotificationsForViewer.test.ts
    - tests/actions/notifications.test.ts
  modified:
    - src/app/actions/profile.ts
decisions:
  - "logNotification uses internal try/catch (diverges from logActivity) so non-awaited callers never get unhandled-rejection warnings (D-27/D-28)"
  - "watch_overlap insert uses raw SQL execute() not db.insert() to hit the partial UNIQUE dedup index (D-22)"
  - "viewerId is explicit argument on all DAL read functions — never closures over getCurrentUser (D-25, Pitfall 5)"
  - "revalidateTag uses two-arg 'max' form per Next 16 pinned docs (Pitfall 4 prevention)"
metrics:
  duration: ~10 min
  completed: "2026-04-23"
  tasks_completed: 3
  files_changed: 9
---

# Phase 13 Plan 02: Notifications Server Primitives Summary

**One-liner:** Fire-and-forget logger with opt-out + self-guard, 5-function notifications DAL with explicit viewerId args, markAllNotificationsRead SA with Next 16 two-arg revalidateTag, and VISIBILITY_FIELDS widened to accept notification opt-out fields.

## Files Created

| File | Role |
|------|------|
| `src/lib/notifications/types.ts` | FollowPayload, WatchOverlapPayload, PriceDropPayload, TrendingPayload discriminated union |
| `src/lib/notifications/logger.ts` | Fire-and-forget logNotification with D-24 self-guard + D-18 opt-out + D-27 internal try/catch |
| `src/data/notifications.ts` | DAL: getNotificationsForViewer, getNotificationsUnreadState, markAllReadForUser, touchLastSeenAt, findOverlapRecipients |
| `src/app/actions/notifications.ts` | markAllNotificationsRead SA; returns ActionResult; Next 16 two-arg revalidateTag |

## Files Modified

| File | Change |
|------|--------|
| `src/app/actions/profile.ts` | VISIBILITY_FIELDS widened from 3 to 5 entries to include notifyOnFollow + notifyOnWatchOverlap |

## DAL Function Signatures

```ts
// src/data/notifications.ts
getNotificationsForViewer(viewerId: string, limit?: number): Promise<NotificationRow[]>
getNotificationsUnreadState(viewerId: string): Promise<{ hasUnread: boolean }>
markAllReadForUser(viewerId: string): Promise<void>
touchLastSeenAt(viewerId: string): Promise<void>
findOverlapRecipients(input: { brand: string; model: string; actorUserId: string }): Promise<Array<{ userId: string }>>
```

## Logger Semantic Divergence from logActivity

The existing `logActivity` (src/data/activities.ts) does NOT internally try/catch — the caller wraps it. `logNotification` deliberately FLIPS this: it wraps the entire body in try/catch and calls `console.error` on any thrown error, then resolves normally.

**Reason (D-27/D-28):** Both call sites for logNotification (`followUser` and `addWatch` in Plan 04) invoke it without `await` — as fire-and-forget. A non-awaited async function that rejects produces an unhandled-rejection warning in Node.js. The internal catch prevents that while preserving the fire-and-forget contract: the caller's primary mutation (the follow or watch add) is never blocked or rolled back by a logger failure.

## Test Transitions

| Test File | Status | Notes |
|-----------|--------|-------|
| `tests/unit/notifications/logger.test.ts` | PASS (8/8) | Created by this plan; unit mocks db |
| `tests/data/getNotificationsUnreadState.test.ts` | SKIP (no local DB) | Integration; skips cleanly in CI |
| `tests/data/getNotificationsForViewer.test.ts` | SKIP (no local DB) | Integration; skips cleanly in CI |
| `tests/actions/notifications.test.ts` | PASS (5/5) | Created by this plan; unit mocks auth + DAL |
| `tests/actions/follows.test.ts` | PASS (13/13) | No regression |
| Full suite | PASS (2172/2172 + 108 skipped) | No regression |

## Security Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-13-02-01 Cache leak | viewerId explicit arg on all DAL read fns; grep gate passes (0 getCurrentUser occurrences in DAL) |
| T-13-02-02 Mark-all-read scope escape | markAllReadForUser WHERE user_id = viewerId AND read_at IS NULL server-side |
| T-13-02-03 Cross-user inbox read | Two-layer: RLS + explicit WHERE user_id = viewerId in getNotificationsForViewer |
| T-13-02-04 Mass-assignment | VISIBILITY_FIELDS Zod enum whitelist now 5 entries; .strict() rejects unknown keys |
| T-13-02-05 Cross-user write via logger | D-24 self-guard (recipientUserId === actorUserId) + DB CHECK constraint |
| T-13-02-06 Opt-out evasion | D-18: logger reads notify_on_* before insert; skips insert when off |
| T-13-02-07 revalidateTag deprecation | Uses two-arg 'max' form per Next 16 pinned docs |

## Deviations from Plan

None — plan executed exactly as written. Tests created alongside implementation (Plan 01 runs in parallel so test files were created by this plan rather than pre-existing as RED tests).

## Known Stubs

None — all exported functions have full implementations.

## Self-Check: PASSED

- `src/lib/notifications/types.ts` — exists, contains FollowPayload, WatchOverlapPayload, watch_brand_normalized
- `src/lib/notifications/logger.ts` — exists, contains logNotification, ON CONFLICT DO NOTHING, internal try/catch
- `src/data/notifications.ts` — exists, contains all 5 functions, 0 getCurrentUser occurrences
- `src/app/actions/notifications.ts` — exists, contains markAllNotificationsRead, revalidateTag two-arg form
- `src/app/actions/profile.ts` — modified, VISIBILITY_FIELDS has 5 entries including notifyOnFollow + notifyOnWatchOverlap
- Commits: ab433f4 (Task 1), 897f2cd (Task 2), bc9efee (Task 3) — all present in git log
