---
phase: 55-server-actions-notification-dedup
plan: "04"
subsystem: server-actions
tags: [server-action, reactions, likes, notifications, cache, security]
status: complete

dependency_graph:
  requires:
    - 55-01  # test scaffolds (reactions.test.ts RED)
    - 55-03  # logNotification extended with watch_like/wear_like types
    - 54     # DAL: getLikesForTarget/createLike/deleteLike + LikeTarget
  provides:
    - toggleLikeAction  # Phase 56 LikeButton call site
  affects:
    - src/app/actions/reactions.ts

tech_stack:
  added: []
  patterns:
    - auth-first Server Action (follows.ts house pattern)
    - Zod .strict() mass-assignment guard (SEC-03)
    - server-side owner resolution via db.select (anti-IDOR)
    - toggle composition: read-state-then-branch (DAL forbids toggleLike helper)
    - awaited logNotification before bell revalidateTag (Next 16 workAsyncStorage)
    - D-07 two-tag cache discipline (revalidateTag cross-user + updateTag RYO)

key_files:
  created:
    - src/app/actions/reactions.ts
  modified: []

decisions:
  - "Owner resolved server-side via db.select on watches/wearEvents — never from client payload (SEC-03 IDOR)"
  - "getProfileById called twice: once for actor (pre-resolved for notification payload), once for owner (username for profile: cache tag); second call can return null safely"
  - "Cache tag uses DAL discriminator ('reactions:watch' / 'reactions:wear'), NOT wear_event — per 55-PATTERNS.md naming landmine"
  - "wear_like notification payload key is wear_event_id, NOT wear_id or wear_event — aligns with dedup index expression"
  - "logNotification awaited (not fire-and-forget) per Next 16 workAsyncStorage teardown invariant; bell revalidateTag runs after the await"

metrics:
  duration: "109s"
  completed_date: "2026-05-22"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Phase 55 Plan 04: toggleLikeAction Server Action Summary

**One-liner:** `toggleLikeAction` Server Action with Zod .strict(), server-side owner resolution, awaited like notification, and D-07 two-tag cache discipline; reactions.test.ts 6/6 GREEN.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Implement toggleLikeAction | 77cbdfb | src/app/actions/reactions.ts (+157 lines) |

## What Was Built

`src/app/actions/reactions.ts` exports the `toggleLikeAction` Server Action. It follows the `follows.ts` house pattern:

1. **Auth-first** — `getCurrentUser()` in a try/catch; any throw returns `{ success: false, error: 'Not authenticated' }` before any DAL call (SEC-03)
2. **Zod .strict() guard** — only `{ type: 'watch'|'wear', id: uuid }` accepted; extra keys (e.g. a forged `actorId`) fail the parse (SEC-03)
3. **Server-side owner resolution** — `db.select` on `watches.userId/brand/model` (for watch type) or `wearEvents.userId/watchId` → parent watch brand/model (for wear type); the `ownerId` is never trusted from client input (SEC-03 IDOR prevention)
4. **Toggle composition** — reads `getLikesForTarget` state, branches `createLike`/`deleteLike`; count arithmetic: `liked ? count+1 : count-1`
5. **D-07 cache invalidation** — `revalidateTag('reactions:{type}:{id}', 'max')` (cross-user count), `revalidateTag('profile:{username}', 'max')` (owner grid badge), `updateTag('viewer:{userId}:reactions')` (actor RYO)
6. **Awaited logNotification** — fires `watch_like`/`wear_like` ONLY when `liked===true` AND `ownerId !== user.id`; `watch_like` payload carries `watch_id`, `wear_like` payload carries `wear_event_id`; bell revalidateTag runs after the await
7. **Returns** `ActionResult<{ liked: boolean; count: number }>` (D-08)

## Test Results

- `npm test -- reactions.test.ts`: **6/6 GREEN** (all SEC-03, NOTIF-11, SEC-05 cases)
- `npm test` full suite: **5282/5282 tests pass** (1 pre-existing RED — `comments.test.ts` awaiting plan 05 `src/app/actions/comments.ts`)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Surface Scan

No new threat surface beyond what the plan's `<threat_model>` covers. All three threats (T-55-IDOR, T-55-LEAK, T-55-SPAM) are mitigated by the implementation and verified by the test suite.

## Self-Check: PASSED

- [x] `src/app/actions/reactions.ts` exists and exports `toggleLikeAction`
- [x] Commit `77cbdfb` exists in git log
- [x] File begins with `'use server'`
- [x] No `revalidatePath` import or call
- [x] `updateTag` and `revalidateTag` both present with correct tag patterns
- [x] `logNotification` guarded by `liked && ownerId !== user.id`
- [x] `wear_like` payload uses key `wear_event_id`
- [x] All 6 test assertions GREEN
