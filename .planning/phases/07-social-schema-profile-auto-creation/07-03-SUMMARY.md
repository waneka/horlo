---
phase: 07-social-schema-profile-auto-creation
plan: "03"
subsystem: database
tags: [activity-logging, dal, server-action, drizzle, wear-events]
dependency_graph:
  requires: [07-02]
  provides: [activities-dal, activity-logging-in-server-actions]
  affects: [src/data/activities.ts, src/app/actions/watches.ts, src/app/actions/wearEvents.ts]
tech_stack:
  added: []
  patterns: [fire-and-forget-activity-logging, server-only-dal, logActivity-DAL]
key_files:
  created:
    - src/data/activities.ts
  modified:
    - src/app/actions/watches.ts
    - src/app/actions/wearEvents.ts
key-decisions:
  - "logActivity is fire-and-forget: wrapped in try/catch inside addWatch/markAsWorn so activity failures never block the watch mutation"
  - "addWatch determines activity type from watch.status at write time: wishlist/grail -> wishlist_added, owned/sold -> watch_added"
  - "markAsWorn fetches the watch via DAL to build the metadata snapshot rather than trusting client-supplied data (T-07-10)"
  - "logActivity is NOT called in editWatch or removeWatch — only creation and wear events per D-05 spec"
requirements-completed: [DATA-04]
duration: ~15 minutes
completed: "2026-04-20"
---

# Phase 07 Plan 03: Activity Logging DAL Summary

**`logActivity` DAL created and integrated into `addWatch` (watch_added/wishlist_added) and `markAsWorn` (watch_worn) with fire-and-forget error handling; column-drop migration awaiting user `drizzle-kit push`.**

## Performance

- **Duration:** ~15 minutes
- **Started:** 2026-04-20
- **Completed:** 2026-04-20
- **Tasks:** 1 of 2 (Task 2 is human-action checkpoint)
- **Files modified:** 3

## Accomplishments

- Created `src/data/activities.ts` with `logActivity` function and `ActivityType` union type, guarded by `import 'server-only'`
- Integrated activity logging into `addWatch` — determines `watch_added` vs `wishlist_added` from `watch.status` at write time
- Integrated activity logging into `markAsWorn` — logs `watch_worn` after successful `logWearEvent`, fetches watch via DAL for metadata snapshot
- All activity logging is fire-and-forget: wrapped in nested try/catch, failures log to console but never propagate or block the parent mutation

## Task Commits

1. **Task 1: Create activity DAL and integrate into watch Server Actions** - `6652ee3` (feat)
2. **Task 2: Apply lastWornDate column-drop migration** - PENDING (human-action checkpoint)

## Files Created/Modified

- `src/data/activities.ts` — New activity logging DAL: `logActivity(userId, type, watchId, metadata)` with `server-only` guard and `ActivityType` union export
- `src/app/actions/watches.ts` — `addWatch` now calls `logActivity` after `createWatch`; type resolved from `watch.status`; editWatch and removeWatch untouched
- `src/app/actions/wearEvents.ts` — `markAsWorn` now calls `logActivity('watch_worn', ...)` after `logWearEvent`, fetching watch data from DAL for metadata

## Decisions Made

- Activity type in `addWatch` is derived from the created watch's `status` field (server-side, not client-supplied) so wishlist and grail watches both produce `wishlist_added`
- `markAsWorn` fetches the watch from the DAL to build the metadata snapshot — avoids trusting any client-supplied watch data (threat T-07-10)
- `logActivity` is NOT added to `editWatch` or `removeWatch` — D-05 specifies only creation and wear events are logged

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

No new security surface beyond the plan's threat model.

- T-07-09 mitigated: `logActivity` is called from Server Actions that read `userId` from `getCurrentUser()` session — client cannot supply userId
- T-07-10 mitigated: metadata snapshot in `markAsWorn` is built from DAL-fetched watch object, not client input

## User Setup Required

**Task 2 (column-drop migration) requires manual action:**

Apply the column-drop migration to production:

```bash
npx drizzle-kit push
```

This drops `watches.last_worn_date` from the database (generated in Plan 02 as `drizzle/0001_robust_dormammu.sql`).

After applying, verify the app still works:
1. Collection page loads without errors
2. Watch detail page shows "Last Worn: Never" or a date (no crash)
3. "Mark as Worn" on an owned watch succeeds and shows today's date
4. `/insights` — sleeping beauties section loads without errors

If `drizzle-kit push` prompts for confirmation about dropping a column, confirm yes.

## Next Phase Readiness

- Activity events will now accumulate in the `activities` table on every `addWatch` and `markAsWorn` call
- Phase 10 feed query can JOIN `activities` to assemble a personalized event stream with real historical data
- Column-drop migration (Task 2) must be applied before production is fully clean — column exists but is unused; app functions correctly without it

---
*Phase: 07-social-schema-profile-auto-creation*
*Completed: 2026-04-20*
