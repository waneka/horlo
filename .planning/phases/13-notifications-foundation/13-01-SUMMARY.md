---
phase: 13
plan: 01
subsystem: notifications
tags: [schema, migration, tdd, wave-0, profile-settings, notifications]
requirements: [NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06, NOTIF-07, NOTIF-08, NOTIF-09, NOTIF-10]

dependency_graph:
  requires: []
  provides:
    - profile_settings.notificationsLastSeenAt (DB column + Drizzle type)
    - profile_settings.notifyOnFollow (DB column + Drizzle type)
    - profile_settings.notifyOnWatchOverlap (DB column + Drizzle type)
    - ProfileSettings TypeScript interface (extended)
    - VisibilityField union type (extended with 2 new members)
    - supabase migration 20260425000000 (prod deploy artifact)
    - Wave 0 test suite (9 files covering NOTIF-02..10)
  affects:
    - src/data/profiles.ts (getProfileSettings, updateProfileSettingsField, DEFAULT_SETTINGS)
    - src/db/schema.ts (profileSettings Drizzle table)

tech_stack:
  added: []
  patterns:
    - Drizzle schema extension (3 new columns on profileSettings)
    - Two-file migration discipline (schema.ts + supabase/migrations/*.sql)
    - Idempotent ADD COLUMN IF NOT EXISTS + DO $$ ASSERT post-migration verification
    - Wave 0 TDD (tests authored in RED state before production code)

key_files:
  created:
    - supabase/migrations/20260425000000_phase13_profile_settings_notifications.sql
    - tests/integration/phase13-profile-settings-migration.test.ts
    - tests/integration/phase13-notifications-flow.test.ts
  modified:
    - src/db/schema.ts
    - src/data/profiles.ts
    - tests/data/profiles.test.ts
    - tests/components/home/PersonalInsightsGrid.test.tsx
    - tests/components/home/WywtOverlay.test.tsx
    - tests/components/home/WywtTile.test.tsx
    - tests/data/getFeedForUser.test.ts
    - tests/data/getRecommendationsForViewer.test.ts
    - tests/data/getSuggestedCollectors.test.ts
    - tests/data/getWatchByIdForViewer.test.ts
    - tests/data/getWearRailForViewer.test.ts
    - tests/balance-chart.test.tsx

decisions:
  - "DEFAULT_SETTINGS.notificationsLastSeenAt = new Date(0) (epoch) so missing rows show unread dot — intentional safe default per plan spec"
  - "VisibilityField extended to include notifyOnFollow and notifyOnWatchOverlap — reuses existing updateProfileSettingsField toggle mechanism"
  - "DO $$ ASSERT post-migration blocks used to validate column existence and backfill coverage (belt-and-suspenders per Phase 11 precedent)"
  - "Wave 0 integration test files authored alongside schema — phase13-profile-settings-migration.test.ts passes immediately (schema exists); E2E flow tests are gated on local Supabase env"

metrics:
  duration: "577s (~10 min)"
  completed: "2026-04-23"
  tasks: 3
  files: 15
---

# Phase 13 Plan 01: Schema + Migration + Wave 0 Tests Summary

**One-liner:** Extended profile_settings with 3 notification columns (notificationsLastSeenAt, notifyOnFollow, notifyOnWatchOverlap), authored idempotent Supabase migration with DO $$ ASSERT backfill verification, extended TypeScript types, and created 2 integration test files completing the 9-file Wave 0 test suite.

## What Was Built

### Task 1: Drizzle Schema + Supabase Migration + TypeScript Types

**`src/db/schema.ts`** — profileSettings Drizzle table extended with:
- `notificationsLastSeenAt: timestamp('notifications_last_seen_at', { withTimezone: true }).defaultNow().notNull()`
- `notifyOnFollow: boolean('notify_on_follow').notNull().default(true)`
- `notifyOnWatchOverlap: boolean('notify_on_watch_overlap').notNull().default(true)`

**`supabase/migrations/20260425000000_phase13_profile_settings_notifications.sql`** — production migration with:
- 3 `ALTER TABLE profile_settings ADD COLUMN IF NOT EXISTS` statements (idempotent)
- `UPDATE profile_settings SET notifications_last_seen_at = now() WHERE IS NULL` backfill (Pitfall 2)
- 4 `DO $$ RAISE EXCEPTION` post-migration assertions (column existence, types, nullability, backfill coverage)
- Single atomic `BEGIN ... COMMIT` transaction

**`src/data/profiles.ts`** — all 5 entities extended:
- `ProfileSettings` interface: 3 new required fields
- `VisibilityField` union: 2 new members (`'notifyOnFollow' | 'notifyOnWatchOverlap'`)
- `DEFAULT_SETTINGS`: epoch date + true defaults for 3 new fields
- `getProfileSettings`: maps 3 new columns from DB row
- `updateProfileSettingsField`: inserts with new columns; onConflict upsert path unchanged

### Task 2: Local DB Push

- `npx drizzle-kit push` — applied schema changes to local Postgres
- `supabase migration up --local` / docker exec fallback — applied handwritten migration; DO $$ ASSERT blocks passed
- Verified: `COUNT(*) FROM information_schema.columns ... IN ('notifications_last_seen_at', ...)` = 3
- Verified: `COUNT(*) FROM profile_settings WHERE notifications_last_seen_at IS NULL` = 0

### Task 3: Wave 0 Test Suite

9 test files cover NOTIF-02 through NOTIF-10. 7 were authored by the parallel Plan 13-02 agent (pre-existing in the worktree). Plan 13-01 authored 2 integration files:

| File | Coverage | Status |
|------|----------|--------|
| `tests/unit/notifications/logger.test.ts` | NOTIF-02, NOTIF-03, NOTIF-09 (opt-out, self-guard, dedup, fire-and-forget) | Authored by Plan 13-02 |
| `tests/components/notifications/NotificationRow.test.tsx` | NOTIF-07, D-21 (4-type renderer snapshots) | Authored by Plan 13-02 |
| `tests/components/notifications/NotificationsInbox.test.tsx` | NOTIF-08 (collapse grouping) | Authored by Plan 13-02 |
| `tests/components/notifications/NotificationsEmptyState.test.tsx` | NOTIF-10 ("You're all caught up") | Authored by Plan 13-02 |
| `tests/data/getNotificationsUnreadState.test.ts` | NOTIF-04 (bell unread state) | Authored by Plan 13-02 |
| `tests/data/getNotificationsForViewer.test.ts` | NOTIF-05 (last-50, newest-first) | Authored by Plan 13-02 |
| `tests/actions/notifications.test.ts` | NOTIF-06 (markAllRead SA, revalidateTag two-arg) | Authored by Plan 13-02 |
| `tests/integration/phase13-profile-settings-migration.test.ts` | Schema column types + backfill | **Authored by Plan 13-01** |
| `tests/integration/phase13-notifications-flow.test.ts` | NOTIF-02, NOTIF-03, NOTIF-06, NOTIF-09 (E2E) | **Authored by Plan 13-01** |

**Note on RED/GREEN state:** The `<important_red_tests_note>` said tests should be RED until Plans 02-03 ship code. However, because this plan runs in a parallel wave (wave-0), and Plan 13-02 ran concurrently (also wave-0), production code already exists in the worktree when Task 3 executes. All 9 test files ran GREEN (43 unit/component/action tests pass; integration tests skip without local Supabase). This is the correct end state — Wave 0 tests authored + production code shipped = requirements satisfied.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing Phase 12 wornPublic test residue in 8 test files**
- **Found during:** Task 1 — tsc --noEmit revealed TypeScript errors
- **Issue:** Phase 12 dropped the `worn_public` column from `profile_settings`, but 8 test fixture files still referenced `wornPublic` in DB inserts, updates, and ProfileSettings mock objects. Drizzle's type inference (now stricter after our 3-column addition) surfaced these as TS2353/TS2769 errors. They were pre-existing but blocked tsc from exiting 0.
- **Fix:** Removed `wornPublic` from all fixture objects; replaced update-based `wornPublic` gate tests with no-op/explanatory placeholders noting Phase 12 dropped the column; updated mock `ProfileSettings` objects to include the 3 new required fields
- **Files modified:** `tests/data/profiles.test.ts`, `tests/components/home/PersonalInsightsGrid.test.tsx`, `tests/components/home/WywtOverlay.test.tsx`, `tests/components/home/WywtTile.test.tsx`, `tests/data/getFeedForUser.test.ts`, `tests/data/getRecommendationsForViewer.test.ts`, `tests/data/getSuggestedCollectors.test.ts`, `tests/data/getWatchByIdForViewer.test.ts`, `tests/data/getWearRailForViewer.test.ts`, `tests/balance-chart.test.tsx`
- **Commit:** 9d08d1e

**2. [Rule 1 - Bug] Fixed unused @ts-expect-error directive in balance-chart.test.tsx**
- **Found during:** Task 1 — tsc TS2578 "Unused '@ts-expect-error' directive"
- **Issue:** TypeScript now accepts the `globalThis.ResizeObserver` assignment without suppression (type widened)
- **Fix:** Replaced `@ts-expect-error` with `(globalThis as any).ResizeObserver = ...` pattern
- **Commit:** 9d08d1e

### Parallel Wave Note

Task 3 Wave 0 test files: 7 of 9 test files were already present in the worktree from Plan 13-02 running in parallel. Plan 13-01 authored the 2 integration test files (`phase13-profile-settings-migration.test.ts`, `phase13-notifications-flow.test.ts`) that complete the suite. This is expected behavior for a wave-0 parallel execution.

## Migration Verification

```
Local DB verification (Task 2):
  SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'profile_settings'
    AND column_name IN ('notifications_last_seen_at', 'notify_on_follow', 'notify_on_watch_overlap')
  → 3 ✓

  SELECT COUNT(*) FROM profile_settings WHERE notifications_last_seen_at IS NULL
  → 0 ✓ (backfill coverage confirmed)

DO $$ ASSERT blocks in migration: all 4 passed (no RAISE EXCEPTION fired)
```

## Self-Check: PASSED

Files verified to exist:
- /Users/tylerwaneka/Documents/horlo/src/db/schema.ts — FOUND
- /Users/tylerwaneka/Documents/horlo/src/data/profiles.ts — FOUND
- /Users/tylerwaneka/Documents/horlo/supabase/migrations/20260425000000_phase13_profile_settings_notifications.sql — FOUND
- /Users/tylerwaneka/Documents/horlo/tests/integration/phase13-profile-settings-migration.test.ts — FOUND
- /Users/tylerwaneka/Documents/horlo/tests/integration/phase13-notifications-flow.test.ts — FOUND

Commits verified:
- 9d08d1e feat(13-01): extend profileSettings schema... — FOUND
- 1f8e1eb test(13-01): add Wave 0 integration tests... — FOUND

tsc --noEmit: EXIT 0 ✓
