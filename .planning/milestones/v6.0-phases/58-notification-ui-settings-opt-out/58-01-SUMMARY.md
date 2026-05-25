---
phase: 58-notification-ui-settings-opt-out
plan: "01"
subsystem: settings-persistence
status: complete
tags: [settings, notifications, persistence, type-widening]
dependency_graph:
  requires: []
  provides: [notifyOnLike-persistence-chain, notifyOnComment-persistence-chain]
  affects: [Plan-03-NotificationsSection-UI]
tech_stack:
  added: []
  patterns: [mirror-existing-field-pattern, as-const-tuple-zod-enum]
key_files:
  created: []
  modified:
    - src/data/profiles.ts
    - src/app/actions/profile.ts
    - tests/components/settings/NotificationsSection.test.tsx
    - tests/components/home/PersonalInsightsGrid.test.tsx
    - tests/components/settings/SettingsTabsShell.test.tsx
decisions:
  - "Cascading ProfileSettings type widening required fixes in PersonalInsightsGrid.test.tsx and SettingsTabsShell.test.tsx fixtures (Rule 1 auto-fix)"
metrics:
  duration: ~8m
  completed: "2026-05-24"
  tasks_completed: 2
  files_modified: 5
---

# Phase 58 Plan 01: Widen ProfileSettings Persistence Chain Summary

**One-liner:** Widen ProfileSettings type, VisibilityField union, VISIBILITY_FIELDS tuple, and DAL return/insert to expose notifyOnLike/notifyOnComment columns (Phase 53) end-to-end from TS type through Server Action allowlist.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Widen ProfileSettings persistence chain (DRIFT-1/2/3) | 4b636cd | src/data/profiles.ts, src/app/actions/profile.ts, tests/components/home/PersonalInsightsGrid.test.tsx, tests/components/settings/SettingsTabsShell.test.tsx |
| 2 | Widen NotificationsSection test fixture (Pitfall 5) | a215d09 | tests/components/settings/NotificationsSection.test.tsx |

## What Was Built

Closed the three RESEARCH.md DRIFT gaps preventing `notifyOnLike` / `notifyOnComment` from being reachable end-to-end:

1. **ProfileSettings interface** — added `notifyOnLike: boolean` and `notifyOnComment: boolean` fields
2. **VisibilityField union** — added `'notifyOnLike'` and `'notifyOnComment'` string literals
3. **DEFAULT_SETTINGS** — added `notifyOnLike: true` and `notifyOnComment: true`
4. **getProfileSettings return** — maps `rows[0].notifyOnLike` and `rows[0].notifyOnComment` from the Drizzle row
5. **updateProfileSettingsField insert** — added `notifyOnLike: field === 'notifyOnLike' ? value : true` and analog for comment
6. **VISIBILITY_FIELDS tuple** (actions/profile.ts) — widened from 5 to 7 members; `z.enum(VISIBILITY_FIELDS)` auto-widens; mass-assignment protection (T-58-01) preserved
7. **NotificationsSection.test.tsx fixture** — added both fields so TS strict compiles when Plan 03 adds the Pick<ProfileSettings,...> prop

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cascading TS strict errors in PersonalInsightsGrid.test.tsx and SettingsTabsShell.test.tsx**
- **Found during:** Task 1 (tsc --noEmit run)
- **Issue:** ProfileSettings type widening immediately caused TS2345/TS1360 errors in two other test fixtures that use `getProfileSettings.mockResolvedValue({...})` or `satisfies ProfileSettings` without the new required fields
- **Fix:** Added `notifyOnLike: true` and `notifyOnComment: true` to 3 fixture locations in PersonalInsightsGrid.test.tsx and 1 location in SettingsTabsShell.test.tsx
- **Files modified:** tests/components/home/PersonalInsightsGrid.test.tsx, tests/components/settings/SettingsTabsShell.test.tsx
- **Commit:** 4b636cd (bundled with Task 1 since caused directly by the same change)

## Verification Results

- `grep -c "notifyOnLike|notifyOnComment" src/data/profiles.ts` → 10 (all five constructs widened, 2 per construct)
- `grep -q "'notifyOnLike'" src/app/actions/profile.ts` → PASS
- `grep -q "'notifyOnComment'" src/app/actions/profile.ts` → PASS
- `git diff --quiet src/db/schema.ts src/lib/notifications/logger.ts` → PASS (no change to schema or logger)
- `npm run test -- tests/components/settings/NotificationsSection.test.tsx` → 3 tests PASS
- `npx tsc --noEmit` → no errors in src/data/profiles.ts, src/app/actions/profile.ts, or any of the modified test files

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. The only change to the trust boundary is widening the existing `VISIBILITY_FIELDS` allowlist by 2 literals — T-58-01 mitigation fully applied (7-member fixed tuple, `z.enum()` rejects all other field names).

## Self-Check: PASSED

- src/data/profiles.ts — FOUND (modified)
- src/app/actions/profile.ts — FOUND (modified)
- tests/components/settings/NotificationsSection.test.tsx — FOUND (modified)
- Commit 4b636cd — FOUND in git log
- Commit a215d09 — FOUND in git log
