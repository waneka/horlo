---
phase: 84-wear-history-depth
plan: 02
subsystem: server-actions
tags: [nextjs, server-actions, zod, wear-events, backfill, cache-invalidation]

# Dependency graph
requires:
  - phase: 15 (WYWT photo flow)
    provides: logWearWithPhoto structural pattern (explicit insert + 23505 catch, IDOR check, cache invalidation shape)
  - phase: 39c
    provides: profile cache invalidation pattern (revalidateTag/updateTag on owner's `profile:<username>` tag)
provides:
  - "logBackfillWear Server Action — photo-less past-or-today wear logging with note + visibility"
affects: [84-04, worn-tab, wear-log-form]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "updateTag(tag) for read-your-own-writes cache invalidation in a Server Action (Next 16), matching src/app/actions/profile.ts precedent — first wearEvents.ts action to use updateTag instead of revalidateTag(tag, 'max')"
    - "isoCalendarDate zod schema: regex shape check + refine() round-trip through Date/toISOString to reject regex-valid-but-non-existent dates like 2026-02-30, without ever reading the current clock"
    - "Dedicated Server Action (not an extension of markAsWorn/logWearWithPhoto) to avoid onConflictDoNothing's duplicate-swallows-but-still-logs-activity bug (RESEARCH Pitfall 6)"

key-files:
  created:
    - tests/actions/wearEventsBackfill.test.ts
  modified:
    - src/app/actions/wearEvents.ts

key-decisions:
  - "updateTag (not revalidateTag(tag,'max')) for logBackfillWear's cache invalidation — this is a read-your-own-writes case (caller IS the owner viewing their own Worn tab immediately after logging), matching src/app/actions/profile.ts's updateProfile precedent rather than markAsWorn/logWearWithPhoto's cross-user SWR revalidateTag(tag,'max') form."

patterns-established:
  - "logBackfillWear pipeline order: auth -> zod -> IDOR ownership check -> D-02 future-date reject -> insert (catch 23505) -> D-06 activity gate -> revalidatePath + updateTag. IDOR check runs BEFORE the future-date check so a cross-user watchId never leaks via a different error path."

requirements-completed: []

# Metrics
duration: ~20min
completed: 2026-09-13
---

# Phase 84 Plan 02: Wear history depth — backfill server action Summary

**A dedicated `logBackfillWear` Server Action logs a photo-less wear on any past-or-today date with note and visibility, rejecting future dates and duplicates server-side and gating feed activity to today-only wears.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed (TDD RED -> GREEN)
- **Files modified:** 2 (1 test file created, 1 action file modified)

## Accomplishments
- `tests/actions/wearEventsBackfill.test.ts` — 11-test contract suite covering auth, zod validation (7 malformed-field sub-cases including the `2026-02-30` non-existent-date case), D-02 future-date rejection, IDOR cross-user watchId, D-03/D-04 photo-less success with note trimming, D-06 today-only activity gating, D-05 duplicate-day 23505 backstop, generic DB-error fallback, whitespace-note normalization, non-fatal activity-log failure, and missing-profile updateTag skip.
- `logBackfillWear` exported from `src/app/actions/wearEvents.ts`: auth -> zod (`.strict()` schema with a calendar-validity-refined `isoCalendarDate` type) -> IDOR ownership check -> D-02 future-date reject (`wornDate > today` lexical compare on zero-padded ISO strings) -> server-generated `crypto.randomUUID()` id -> explicit `logWearEventWithPhoto` insert with `photoUrl: null` (23505 caught explicitly, not `onConflictDoNothing`) -> D-06 activity gate (`wornDate === today` only) -> `revalidatePath('/')` + `updateTag(`profile:${username}`)` for read-your-own-writes.
- No DAL file was touched — `logWearEventWithPhoto` (built in Phase 15) was already the correct explicit-insert primitive; this plan only adds a new Server Action call site around it.

## Task Commits

Each task was committed atomically (TDD RED -> GREEN):

1. **Task 1: RED — logBackfillWear contract suite**
   - `018ab172` (test) — 11 failing tests; `logBackfillWear is not a function` at every callsite, no syntax or mock-factory errors.
2. **Task 2: GREEN — implement logBackfillWear**
   - `99297694` (feat) — exported `logBackfillWear`; all 11 new tests + all 9 pre-existing `wearEventsVideo.test.ts` tests pass (20/20); `npm run build` exits 0.

## Files Created/Modified
- `tests/actions/wearEventsBackfill.test.ts` - new 11-test contract suite (RED then GREEN against the Task 2 implementation)
- `src/app/actions/wearEvents.ts` - added `isoCalendarDate` schema, `logBackfillWearSchema` (`.strict()`), and the exported `logBackfillWear` function; widened the `next/cache` import to include `updateTag`. `markAsWorn`, `logWearWithPhoto`, `logWearWithVideo`, `getWornTodayIdsForUserAction`, and `hideWearPicAction`/`unhideWearPicAction` are all byte-for-byte unchanged.

## Decisions Made
- **updateTag over revalidateTag(tag, 'max') for this action's cache invalidation.** Every prior wear action (`markAsWorn`, `logWearWithPhoto`, `logWearWithVideo`) uses `revalidateTag(tag, 'max')` because those are same-day "post to the feed" actions where cross-user stale-while-revalidate is the primary concern. `logBackfillWear` is framed by 84-CONTEXT.md D-07 as a fast personal catch-up tool the owner uses on their own Worn tab — the interface spec in `84-02-PLAN.md` explicitly names `updateTag` and cites `src/app/actions/profile.ts` (an owner-only read-your-own-writes case) as the precedent, not the wear-action siblings. Followed the plan's spec verbatim; documented here because it is the first `wearEvents.ts` action to diverge from the sibling actions' cache-invalidation shape.
- **IDOR check placed before the D-02 future-date check** (plan's explicit step order (c) then (d)). This means a future-dated wear for a cross-user watch returns 'Watch not found', not the future-date error — preserving the uniform IDOR non-disclosure property even when multiple validation failures could apply simultaneously.

## Deviations from Plan

None — plan executed exactly as written. All acceptance-criteria greps matched on the first pass (`export async function logBackfillWear` = 1, `next/cache` import line = 1, both error-string literals = 1 each, `parsed.data.wornDate === parsed.data.today` = 1, `todayLocalISO` = 0, `git diff src/data/` empty).

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Per this plan's `<verification>` section, no prod push happens until the 84-07 local-dev walk; this plan's commits stay local/unpushed like the rest of Phase 84's in-flight work.

## Next Phase Readiness
- `logBackfillWear` is fully implemented and tested server-side. WEAR-02 is intentionally left unchecked in `.planning/REQUIREMENTS.md` — this plan is the server half only; 84-04 (the unified "Log a wear" form UI) delivers the client half and will mark WEAR-02 complete.
- `npm run build` exits 0; `npx vitest run tests/actions/wearEventsBackfill.test.ts tests/actions/wearEventsVideo.test.ts` — 20/20 pass.
- No blockers introduced for 84-03/84-04.

---
*Phase: 84-wear-history-depth*
*Completed: 2026-09-13*

## Self-Check: PASSED

All modified/created files verified present on disk (`src/app/actions/wearEvents.ts`, `tests/actions/wearEventsBackfill.test.ts`); both task commits (`018ab172`, `99297694`) verified in `git log`.
