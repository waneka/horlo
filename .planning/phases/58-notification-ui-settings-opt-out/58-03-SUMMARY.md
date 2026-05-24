---
phase: 58-notification-ui-settings-opt-out
plan: "03"
status: complete
subsystem: settings-ui
tags: [notifications, settings, opt-out, ui, toggles]
dependency_graph:
  requires: [58-01]
  provides: [NOTIF-15-ui]
  affects: [src/components/settings/NotificationsSection.tsx]
tech_stack:
  added: []
  patterns: [PrivacyToggleRow, Pick widening, SettingsSection]
key_files:
  modified:
    - src/components/settings/NotificationsSection.tsx
    - tests/components/settings/NotificationsSection.test.tsx
decisions:
  - "Widen Pick<ProfileSettings, ...> to include notifyOnLike | notifyOnComment — settings page pass-through already covers new fields, no page-level change needed (confirmed by RESEARCH)"
  - "Section renamed from 'Email notifications' to 'Notifications' per D-09 — misnomer since all four toggles gate in-app rows, not email"
metrics:
  duration: "~1m"
  completed: "2026-05-24"
  tasks: 2
  files_modified: 2
---

# Phase 58 Plan 03: NotificationsSection UI — Likes + Comments Toggles Summary

**One-liner:** Four-toggle `NotificationsSection` with Likes/Comments `PrivacyToggleRow` instances, renamed "Notifications" title, and widened `Pick<ProfileSettings, ...>` prop — closes NOTIF-15 UI side.

## What Was Built

Added `notifyOnLike` and `notifyOnComment` opt-out toggles to the Settings notifications section as `PrivacyToggleRow` instances, renamed the section heading from "Email notifications" to "Notifications", and widened the component's `ProfileSettings` Pick prop to include the two new fields. The persistence chain (DAL + Server Action allowlist) was already in place from Plan 01.

The component now renders four toggles in order: New Followers → Watch Overlaps → Likes → Comments, each wiring directly to the existing `updateProfileSettings` Server Action via the unmodified `PrivacyToggleRow` contract.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Likes + Comments toggles, rename title, widen Pick (D-09/D-10/D-11) | e16a81c | src/components/settings/NotificationsSection.tsx |
| 2 | Update NotificationsSection tests — 4 switches, title, Likes/Comments SA-call shape | 4643e8b | tests/components/settings/NotificationsSection.test.tsx |

## Verification

- `npm run test -- tests/components/settings/NotificationsSection.test.tsx tests/data/profiles.test.ts` — 9 tests passed (6 NotificationsSection + 3 profiles)
- Task 1 acceptance grep checks: all PASS
- Task 2 assertion grep checks: all PASS
- `PrivacyToggleRow.tsx`, `src/app/settings/page.tsx`, `SettingsTabsShell.tsx` — untouched (`git diff --quiet` PASS)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — `notifyOnLike` and `notifyOnComment` are wired to real `ProfileSettings` fields passed through from the settings page. No placeholder or hardcoded values.

## Threat Flags

None — the two new toggles reuse the existing `PrivacyToggleRow` → `updateProfileSettings` path. No new network endpoints, auth paths, or file access patterns introduced. T-58-06 (mass-assignment) and T-58-07 (IDOR) from the plan's threat register apply and are mitigated by the existing Plan 01 SA allowlist and `getCurrentUser()` scoping respectively.

## Self-Check: PASSED

- [x] src/components/settings/NotificationsSection.tsx exists and contains `notifyOnComment`
- [x] tests/components/settings/NotificationsSection.test.tsx exists and contains `notifyOnLike`
- [x] Commits e16a81c and 4643e8b exist in git log
</content>
</invoke>