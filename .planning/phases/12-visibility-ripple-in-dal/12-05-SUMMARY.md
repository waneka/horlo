---
phase: 12-visibility-ripple-in-dal
plan: "05"
subsystem: settings-ui-dal-types
tags: [wornPublic-removal, settings, dal, types, WYWT-11]
dependency_graph:
  requires: [12-02, 12-03, 12-04]
  provides: [settings-ui-clean-of-wornPublic, dal-types-clean-of-wornPublic]
  affects: [12-06-column-drop]
tech_stack:
  added: []
  patterns: [type-driven-cleanup, zod-enum-whitelist]
key_files:
  modified:
    - src/data/profiles.ts
    - src/app/actions/profile.ts
    - src/app/settings/page.tsx
    - src/components/settings/SettingsClient.tsx
    - tests/data/profiles.test.ts
decisions:
  - "DB column still present until Plan 06; getProfileSettings no longer maps wornPublic into return type — Drizzle select() returns the column value but it is discarded. INSERT path omits wornPublic; schema default (true) handles the new row case until column drop."
  - "profiles.test.ts updated: expected shape drops wornPublic; mock row still includes wornPublic column to simulate the real DB state during the transition window."
metrics:
  duration: "~12 minutes"
  completed: "2026-04-22"
  tasks_completed: 4
  files_modified: 5
---

# Phase 12 Plan 05: Drop wornPublic from Settings UI + DAL Types Summary

Strip every `wornPublic` reference from application code so the database column can be dropped in Plan 06 without dangling readers — removing wornPublic from ProfileSettings type, VisibilityField union, DEFAULT_SETTINGS, getProfileSettings return mapping, updateProfileSettingsField insert path, VISIBILITY_FIELDS Zod enum, the Settings page prop, and the SettingsClient Worn History toggle row.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Strip wornPublic from src/data/profiles.ts | c58b2a7 | src/data/profiles.ts |
| 2 | Strip 'wornPublic' from VISIBILITY_FIELDS in src/app/actions/profile.ts | c58b2a7 | src/app/actions/profile.ts |
| 3 | Strip wornPublic from src/app/settings/page.tsx | c58b2a7 | src/app/settings/page.tsx |
| 4 | Strip 'Worn History' toggle row from SettingsClient.tsx + repo-wide invariant grep | c58b2a7 | src/components/settings/SettingsClient.tsx, tests/data/profiles.test.ts |

Note: all 4 tasks are committed together as a single atomic commit because the plan explicitly deferred commits until Task 4 (the build fails in the intermediate states between Tasks 1-3).

## Diff Summary

| File | Lines Before | Lines After | Delta |
|------|-------------|-------------|-------|
| src/data/profiles.ts | 128 lines | 123 lines | -5 (wornPublic from interface, union, defaults, return mapping, insert path) |
| src/app/actions/profile.ts | 86 lines | 85 lines | -1 (wornPublic from VISIBILITY_FIELDS array) |
| src/app/settings/page.tsx | 48 lines | 47 lines | -1 (wornPublic from SettingsClient prop) |
| src/components/settings/SettingsClient.tsx | 207 lines | 201 lines | -6 (wornPublic from interface + entire Worn History PrivacyToggleRow block) |
| tests/data/profiles.test.ts | 66 lines | 67 lines | +1 (expected shape updated; mock row comment added) |

## Repo-Wide Invariant Grep Output

```
$ grep -rn "wornPublic\|worn_public" src/ tests/ | grep -v "supabase/migrations" | grep -v ".planning/"
```

Remaining references (all intentional — not in the 4 plan files):

- `src/db/schema.ts:183` — `wornPublic: boolean('worn_public').notNull().default(true)` — column definition, dropped in Plan 06
- `src/app/watch/[id]/page.tsx:28` — comment only (mentions worn_public intent)
- `src/data/wearEvents.ts:84,167` — comments only (Phase 12 migration notes)
- `tests/integration/phase12-visibility-matrix.test.ts:98,102,188,228,316-324` — test fixture setup + WYWT-11 column-drop assertion SQL
- `tests/integration/home-privacy.test.ts:11,100-107` — integration test directly seeding profileSettings rows via Drizzle (column still in DB)
- `tests/components/home/PersonalInsightsGrid.test.tsx:101,409,460` — mock return values for getProfileSettings (extra key, not type-checked at runtime)
- `tests/actions/wishlist.test.ts:69,121-127,237-239` — mock join row data containing wornPublic field (DB column still present)
- `tests/data/getSuggestedCollectors.test.ts:176`, `tests/data/getWatchByIdForViewer.test.ts:286,294`, `tests/data/getRecommendationsForViewer.test.ts:52` — profileSettings seed rows
- `tests/data/getFeedForUser.test.ts` — multiple references in seed helpers and Phase 12 column-absence assertions
- `tests/data/getWearRailForViewer.test.ts` — multiple references in seed helpers and Phase 12 column-absence assertions
- `tests/data/profiles.test.ts:48` — mock DB row comment (column still in DB until Plan 06)

All remaining test references use `wornPublic` directly against the Drizzle schema (which still has the column) for DB seeding/mock rows — these are correct during the transition window. The 4 files listed in `files_modified` are clean.

## Build + Test Suite

- `npm run build`: PASSED (exit 0)
- `npm test`: 6 failed / 2070 passed / 101 skipped — identical to pre-Plan-05 baseline (no new failures introduced)

The 6 pre-existing failures are in:
- `tests/actions/wishlist.test.ts` (3 tests — pre-existing from Plan 12-04 three-tier gate changes)
- `tests/data/getFeedForUser.test.ts` (1 test — pre-existing Phase 12 gate assertion)
- `tests/data/getWearRailForViewer.test.ts` (2 tests — pre-existing Phase 12 gate assertions)

## Database Column Status

The `worn_public` column still exists in the `profile_settings` table. Plan 06 will issue the `DROP COLUMN` migration. After this plan, no application code reads or writes `wornPublic` — the column is inert from the app's perspective. New INSERT rows will use the schema default (`true`) for the transition period.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated tests/data/profiles.test.ts to match new ProfileSettings shape**
- **Found during:** Task 4 (full test run)
- **Issue:** `profiles.test.ts` expected `wornPublic` in `getProfileSettings` return value; after Task 1 removed it from the return mapping, 2 tests failed (new failures above baseline)
- **Fix:** Updated `toEqual` expectations to omit `wornPublic`; kept `wornPublic` in the mock DB row with a comment explaining the column is still in DB until Plan 06
- **Files modified:** tests/data/profiles.test.ts
- **Commit:** c58b2a7

## Known Stubs

None — all 4 files are fully wired. The settings page renders 3 privacy toggles (Profile, Collection, Wishlist). Per-wear visibility is deferred to Phase 15 (D-06 decision).

## Threat Flags

None — this plan removes a surface, it does not add one.

## Self-Check: PASSED

Files created/modified:
- FOUND: src/data/profiles.ts
- FOUND: src/app/actions/profile.ts
- FOUND: src/app/settings/page.tsx
- FOUND: src/components/settings/SettingsClient.tsx
- FOUND: tests/data/profiles.test.ts

Commit c58b2a7 exists in git log.
