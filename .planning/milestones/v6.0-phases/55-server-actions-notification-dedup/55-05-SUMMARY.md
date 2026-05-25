---
phase: 55-server-actions-notification-dedup
plan: 05
subsystem: api
tags: [server-actions, comments, notifications, zod, drizzle, zustand, next-cache]

requires:
  - phase: 55-02
    provides: "ActionResult<T> with optional code field (D-09 gate discriminant)"
  - phase: 55-03
    provides: "logNotification with watch_comment/wear_comment types and WatchCommentPayload/WearCommentPayload"
  - phase: 54
    provides: "createComment/editComment/deleteComment DAL + CommentGateError"

provides:
  - "addCommentAction: auth-first, Zod .strict(), gate-catch code:'gate', INSERT-only notification, profile-tag invalidation"
  - "editCommentAction: auth-first, server-derived authorId, no notification, profile-tag invalidation"
  - "deleteCommentAction: auth-first, server-derived authorId, no notification, returns { id }"

affects: [phase-57, comment-ui, gate-03-locked-state]

tech-stack:
  added: []
  patterns:
    - "CommentGateError caught instanceof BEFORE generic catch — D-09 structural discriminant without string-matching"
    - "Inner try/catch for DAL call + outer try/catch for infra errors"
    - "authorId always getCurrentUser().id — never client input; .strict() schema rejects extra keys"
    - "NOTIF-12 INSERT-only: logNotification only in addCommentAction, never in edit/delete"
    - "D-06 profile-only cache invalidation: revalidateTag('profile:{username}','max') only — no comments:* tag"

key-files:
  created:
    - src/app/actions/comments.ts
  modified: []

key-decisions:
  - "Inner try/catch for createComment wraps only the DAL call so CommentGateError is caught specifically before the outer generic catch (D-09)"
  - "deleteCommentAction returns { id: parsed.data.commentId } since DAL deleteComment returns void — no need to fetch the comment row before deletion"
  - "For edit/delete profile tag invalidation, resolve owner via returned comment.watchId/wearEventId — avoids a pre-fetch before the DAL write"

requirements-completed: [SEC-03, SEC-05, NOTIF-12]

duration: 12min
completed: 2026-05-22
---

# Phase 55 Plan 05: Comment Server Actions Summary

**Three comment Server Actions (add/edit/delete) with auth-first, Zod .strict(), CommentGateError → code:'gate' discriminant, INSERT-only notification, and profile-only cache invalidation**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-22T13:38:00Z
- **Completed:** 2026-05-22T13:50:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- `addCommentAction` implements full auth-first → Zod → gate-catch → DAL → notification → cache flow matching the `follows.ts` house pattern
- `editCommentAction` and `deleteCommentAction` reject client-supplied authorId via `.strict()` and pass `getCurrentUser().id` to DAL; neither fires a notification (NOTIF-12)
- All 8 `tests/actions/comments.test.ts` cases GREEN; full suite (5290 tests) passes

## Task Commits

1. **Task 1: addCommentAction (auth + Zod + gate-catch + INSERT notification + profile tag)** - `4fa30a8` (feat)
2. **Task 2: editCommentAction and deleteCommentAction (no notification, no client authorId)** - `4fa30a8` (feat, bundled into same commit — both tasks create the same file)

## Files Created/Modified
- `src/app/actions/comments.ts` — Three comment Server Actions; 269 lines; begins with `'use server'`

## Decisions Made
- Inner try/catch for the `createComment` call isolates the `CommentGateError` catch before the outer generic handler. This is D-09's load-bearing design: Phase 57 branches to GATE-03 locked-state CTA using `code === 'gate'` without string-matching the error message.
- `deleteCommentAction` uses `parsed.data.commentId` for the return `{ id }` because the DAL `deleteComment` returns `void`. This avoids an extra DB read to re-fetch the comment row.
- Profile tag invalidation on edit/delete resolves the owner via `comment.watchId`/`comment.wearEventId` returned from the DAL — these fields are in the `Comment` type, so no pre-fetch is needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 57 comment UI can call `addCommentAction`, `editCommentAction`, `deleteCommentAction`
- `code === 'gate'` on the action result drives the GATE-03 locked-state compose-box CTA
- Profile grid count badge is invalidated on every comment mutation via `revalidateTag('profile:{username}', 'max')`

## Self-Check
- `src/app/actions/comments.ts` exists: FOUND
- Commit `4fa30a8` exists: verified above

## Self-Check: PASSED

---
*Phase: 55-server-actions-notification-dedup*
*Completed: 2026-05-22*
