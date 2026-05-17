---
phase: 43-polish-pass
plan: "07"
subsystem: profile-ui, settings-ui
tags: [gap-closure, aspect-ratio, profile-edit, settings]
dependency_graph:
  requires: [43-06]
  provides: [GAP-43-04-closed, GAP-43-05-closed]
  affects: [settings-profile-tab, profile-watch-cards]
tech_stack:
  added: []
  patterns: [component-reuse, server-component-prop-threading]
key_files:
  created: []
  modified:
    - src/components/profile/ProfileWatchCard.tsx
    - tests/components/profile/ProfileWatchCard.test.tsx
    - src/components/settings/ProfileSection.tsx
    - src/components/settings/SettingsTabsShell.tsx
    - src/app/settings/page.tsx
    - tests/components/settings/ProfileSection.test.tsx
    - tests/components/settings/SettingsTabsShell.test.tsx
decisions:
  - "GAP-43-04: Use aspect-square on image container div only; Card keeps h-full flex flex-col equal-height chain"
  - "GAP-43-05: ProfileSection becomes a 'use client' component; onDone calls router.refresh() for server-side data re-fetch after save"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 7
---

# Phase 43 Plan 07: GAP-43-04 + GAP-43-05 Closure Summary

**One-liner:** Profile watch card image switched to 1:1 square (~60px shorter cards, equal-height chain intact); Settings > Profile tab replaced with always-visible ProfileEditForm reusing existing Server Action.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Switch ProfileWatchCard image to aspect-square (GAP-43-04) | f044f25 | ProfileWatchCard.tsx, ProfileWatchCard.test.tsx |
| 2 | Replace Settings ProfileSection stub with real ProfileEditForm (GAP-43-05) | 9679b9c | ProfileSection.tsx, SettingsTabsShell.tsx, settings/page.tsx, ProfileSection.test.tsx, SettingsTabsShell.test.tsx |

## What Was Built

### GAP-43-04: Square image aspect ratio on profile watch cards

Changed `ProfileWatchCard.tsx` image container div from `aspect-[3/4]` to `aspect-square`. This makes each profile watch card roughly 60px shorter while preserving the equal-height mechanism (`h-full flex flex-col` on Card, `flex-1` on CardContent). The aspect class remains on the image div only — not on the Card element, which was the PLSH-04 pitfall.

Updated `ProfileWatchCard.test.tsx`:
- Fixed stale `aspect-[3/4]` comment to `aspect-square`
- Added new test (Test 4b) that asserts: image container has `aspect-square` and not `aspect-[3/4]`; Card has `h-full flex flex-col` and no `aspect-*`; CardContent has `flex-1`

### GAP-43-05: Functional Settings > Profile tab

Rewrote `ProfileSection.tsx` from a read-only stub to an interactive edit surface:
- Added `'use client'` directive (required for interactive form)
- Added `bio: string | null` and `userId: string` props
- Removed the `"Profile editing coming in the next update."` footer note
- Kept the `"View public profile"` `Button` linking to `/u/{username}`
- Renders `ProfileEditForm` with `initial={{ displayName, avatarUrl, bio }}`, `userId={userId}`, and `onDone={() => router.refresh()}` — refresh re-fetches server-fetched profile data after a save

Threaded `bio` and `userId` through the data chain:
- `SettingsTabsShellProps` — added `bio` and `userId`
- `SettingsTabsShell.tsx` — passes `bio={props.bio}` and `userId={props.userId}` to `<ProfileSection>`
- `src/app/settings/page.tsx` — passes `userId={userId}` (from `fullUser.id`, the authenticated user) and `bio={profile?.bio ?? null}`

Security: `userId` is always sourced from `fullUser.id` (via `getCurrentUserFull()`) in the server component — never from client input. This matches T-43-07-01 mitigation documented in the plan's threat model.

Rewrote `ProfileSection.test.tsx`:
- Mocks `ProfileEditForm` with a labeled-field stub for focused composition testing
- Asserts footer note is absent
- Asserts "View public profile" link present and correctly href'd
- Asserts Display name and Bio fields render (via mocked ProfileEditForm)
- Asserts userId is passed through correctly

Also updated `SettingsTabsShell.test.tsx` `stubProps` with new required `bio` and `userId` fields (Rule 3 auto-fix — the tsc error was directly caused by the prop additions).

## Verification

- `npx vitest run tests/components/profile/ProfileWatchCard.test.tsx` — 6/6 passed
- `npx vitest run tests/components/settings/ProfileSection.test.tsx` — 6/6 passed
- `npx vitest run tests/components/settings/SettingsTabsShell.test.tsx` — 6/6 passed
- `npx tsc --noEmit` — no errors in any files changed by this plan

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SettingsTabsShell.test.tsx missing new required props**
- **Found during:** Task 2 tsc verification
- **Issue:** Adding `bio` and `userId` to `SettingsTabsShellProps` caused existing `SettingsTabsShell.test.tsx` `stubProps` to fail type-check (missing properties)
- **Fix:** Added `bio: null` and `userId: 'user-stub-id'` to the `stubProps` object in the test
- **Files modified:** `tests/components/settings/SettingsTabsShell.test.tsx`
- **Commit:** included in `9679b9c`

All other tsc errors present in the output are pre-existing in unrelated files (WatchForm, SearchPageClient, DesktopTopNav, preferences, integration tests) and are out of scope for this plan.

## Threat Model Compliance

| Threat ID | Disposition | Verified |
|-----------|-------------|---------|
| T-43-07-01 | mitigate | `userId` sourced from `fullUser.id` in settings/page.tsx — never client-supplied |
| T-43-07-02 | accept | `updateProfile` Server Action reused unchanged; no new mutation path |
| T-43-07-03 | accept | AvatarUploader reused unchanged; RLS policies from 43-06 still apply |
| T-43-07-04 | accept | Pure CSS class change — no new attack surface |

## Known Stubs

None — all stubs removed. The "Profile editing coming in the next update." note is gone and the live ProfileEditForm is wired.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- `src/components/profile/ProfileWatchCard.tsx` — exists, contains `aspect-square`
- `src/components/settings/ProfileSection.tsx` — exists, contains `ProfileEditForm`, no stub note
- `src/app/settings/page.tsx` — exists, contains `userId={userId}` and `bio={profile?.bio ?? null}`
- Commits `f044f25` and `9679b9c` — confirmed in git log
