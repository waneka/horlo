---
phase: 62-public-wear-pics-on-watch-detail
plan: 02
subsystem: dal
tags: [wear-events, hide-wear-pic, server-actions, security, tdd]
dependency_graph:
  requires: [62-01]
  provides: [getPublicWearPicsForWatch, hideWearPic, unhideWearPic, hideWearPicAction, unhideWearPicAction]
  affects: [src/data/wearEvents.ts, src/app/actions/wearEvents.ts]
tech_stack:
  added: []
  patterns:
    - Drizzle UPDATE with ownership subquery via sql`` template
    - ActionResult<void> server action pattern with try/catch error boundary
    - .strict() Zod mass-assignment guard
key_files:
  created: []
  modified:
    - src/data/wearEvents.ts
    - src/app/actions/wearEvents.ts
decisions:
  - "hideWearPic/unhideWearPic use a sql`` ownership subquery in the WHERE clause (defense in depth — server action already re-checks ownership but DAL adds a second layer via watch_id IN (SELECT id FROM watches WHERE user_id = ?))"
  - "setWearPicHidden stub removed and replaced with separate hideWearPic/unhideWearPic with userId scoping"
  - "ActionResult<void> return type (consistent with other wearEvents.ts actions) instead of raw {success, error?}"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-27"
  tasks_completed: 2
  files_modified: 2
---

# Phase 62 Plan 02: DAL Union + Server Actions Summary

**One-liner:** `hideWearPic`/`unhideWearPic` DAL with dual-layer ownership subquery + `hideWearPicAction`/`unhideWearPicAction` with `.strict()` validation wired to the real DAL.

## What Was Built

### Task 1: getPublicWearPicsForWatch + hideWearPic/unhideWearPic DAL

`getPublicWearPicsForWatch` was already fully implemented in Plan 01 (the Wave 0 scaffold was a complete implementation, not a true stub). Plan 02 added the missing `hideWearPic`/`unhideWearPic` DAL functions replacing the `setWearPicHidden` stub:

- `hideWearPic(userId, watchId, wearEventId)` — single `db.update(wearEvents).set({ hiddenFromDetail: true })` with ownership subquery in WHERE clause
- `unhideWearPic(userId, watchId, wearEventId)` — mirrors hideWearPic but sets `hiddenFromDetail: false`
- Ownership scoped via: `wearEvents.watchId IN (SELECT id FROM watches WHERE user_id = userId)` (T-62-04 defense in depth)
- Neither function touches `visibility` (D-11 constraint a / T-62-07)

### Task 2: hideWearPicAction + unhideWearPicAction server actions

Replaced the `setWearPicHidden` stub calls with the real `wearEventDAL.hideWearPic`/`unhideWearPic`:

- Flow: `getCurrentUser()` try/catch → `.strict()` Zod safeParse → `watchDAL.getWatchById(user.id, watchId)` ownership re-check → DAL call → `revalidatePath('/w/[ref]', 'page')` → `ActionResult<void>`
- DAL call wrapped in try/catch returning `"Couldn't update. Try again."` (copy from PATTERNS.md)
- No sonner import (H-2 pitfall avoided)
- Return type changed from `{success, error?}` to `ActionResult<void>` (consistent with file)

## Test Results

- `tests/unit/getPublicWearPicsForWatch.test.ts` — 5/5 PASS (WPIC-01/05)
- `tests/unit/hideWearPic.test.ts` — 5/5 PASS (WPIC-02)
- `tests/unit/wearRail.test.ts` — 6/6 PASS (D-17 guardrail intact)
- `npm run build` — exit 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] setWearPicHidden stub was incomplete for Plan 02 requirements**
- **Found during:** Task 1 acceptance check (grep for all three DAL exports only returned one match — `getPublicWearPicsForWatch`)
- **Issue:** Plan 01 left `setWearPicHidden(wearEventId, hidden)` as the write stub, but Plan 02 required separate `hideWearPic(userId, watchId, wearEventId)` and `unhideWearPic(...)` with ownership subquery scoping
- **Fix:** Replaced `setWearPicHidden` with `hideWearPic`/`unhideWearPic` using `sql\`\`` ownership subquery; updated server actions to call the new DAL functions
- **Files modified:** `src/data/wearEvents.ts`, `src/app/actions/wearEvents.ts`
- **Commits:** e247ee8, 73024d0

## Acceptance Criteria Verification

- [x] `getPublicWearPicsForWatch` + `hideWearPic` + `unhideWearPic` all exported from `src/data/wearEvents.ts`
- [x] `hideWearPicAction` + `unhideWearPicAction` exported from `src/app/actions/wearEvents.ts`
- [x] `.strict()` schema in server actions (line 301)
- [x] `revalidatePath('/w/[ref]', 'page')` in both actions
- [x] No `.set()` touches `visibility` in DAL
- [x] No sonner import in `src/app/actions/wearEvents.ts`
- [x] All 16 unit tests GREEN
- [x] Build exits 0

## Self-Check: PASSED
