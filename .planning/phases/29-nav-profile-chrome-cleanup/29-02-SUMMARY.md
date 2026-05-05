---
phase: 29-nav-profile-chrome-cleanup
plan: 02
subsystem: ui
tags: [user-menu, dropdown-menu, navigation, nav-16, chrome-cleanup, base-ui, shadcn, dual-affordance]

# Dependency graph
requires:
  - phase: 25-nav-profile-restructure
    provides: avatar Link → /u/{username}/collection dual-affordance (D-01..D-04) — primary canonical path to profile after Profile dropdown row removal
  - phase: 14-userMenu-base
    provides: UserMenu dropdown shell (DropdownMenuContent + Group + Label + Separators + Settings + Theme + Sign out)
provides:
  - UserMenu dropdown without the redundant Profile row (Settings → Theme → Sign out)
  - Both surrounding DropdownMenuSeparator instances preserved (UI-SPEC D-01 wording-precision honored)
  - Updated test contract: Test 3 rewritten without profileIdx; Test 4 deleted; Test 9 (null-username) preserved verbatim
affects:
  - 29-03 (PROF-10 ProfileTabs horizontal-only scroll) — sibling plan, independent surface
  - 29-04 (FORM-04 AddWatchFlow reset) — sibling plan, independent surface
  - Future Phase 5.0+ design considerations re. dropdown menu length post-Profile removal

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Avatar Link as canonical profile-navigation primary path; dropdown affordance retired as redundant"
    - "Test contract update pattern — when removing a UI affordance, rewrite the order-assertion test and delete the link-assertion test (Test 9-style null-branch assertion becomes globally true)"

key-files:
  created: []
  modified:
    - src/components/layout/UserMenu.tsx
    - tests/components/layout/UserMenu.test.tsx

key-decisions:
  - "UI-SPEC D-01 wording precision honored: BOTH surrounding DropdownMenuSeparator instances stay (the literal-source separators on the original lines 68 and 75 each serve a purpose post-deletion — line 68 brackets email-label / Settings, line 75 brackets Settings / Theme block). The 'trailing separator collapse' language in CONTEXT D-01 was conceptual, not literal."
  - "JSDoc dropdown-content listing updated from 'Profile / Settings / Theme / Sign out' to 'Settings / Theme / Sign out — per Phase 29 NAV-16 dropdown content' to satisfy strict acceptance criterion `grep -c \"Profile\" src/components/layout/UserMenu.tsx == 0` and keep documentation truthful."
  - "Phase 25 D-04 dual-affordance lock relaxed minimally per NAV-16 D-02 — only Profile-row removal + JSDoc adjustment; Settings, Theme, Sign out, avatar Link, chevron Button all unchanged."
  - "Test 9 (null-username branch) intentionally NOT modified — its `queryByRole({ name: /^profile$/i })).toBeNull()` assertion is now globally true (was previously branch-specific). RESEARCH Pitfall 6 confirmed."

patterns-established:
  - "Surgical UI affordance removal: delete the conditional JSX wrapper + its inner DropdownMenuItem in one diff; preserve surrounding structural elements (separators) when they serve post-deletion purposes."
  - "Test rewrite ordering for affordance removal: drop the order-index assertion, add an explicit `not.toMatch` negative assertion to lock the absence."

requirements-completed: [NAV-16]

# Metrics
duration: 2m 21s
completed: 2026-05-05
---

# Phase 29 Plan 02: NAV-16 Remove Profile DropdownMenuItem from UserMenu Summary

**Deletes the redundant `Profile` DropdownMenuItem block from `UserMenu.tsx` dropdown content (4 lines of JSX + 1 JSDoc-comment adjustment), preserves both surrounding `<DropdownMenuSeparator />` instances per UI-SPEC D-01 wording precision, and updates the matching tests (Test 3 rewritten without profileIdx, Test 4 deleted, Test 9 preserved).**

## Performance

- **Duration:** 2m 21s
- **Started:** 2026-05-05T07:22:58Z
- **Completed:** 2026-05-05T07:25:19Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Profile dropdown row removed; UserMenu dropdown order is now email-label → Separator → Settings → Separator → Theme → Separator → Sign out.
- Avatar Link → `/u/${username}/collection` (Phase 25 dual-affordance D-01..D-04) remains the canonical profile-navigation path; chevron Button still opens the dropdown for Settings / Theme / Sign out.
- Both surrounding `<DropdownMenuSeparator />` JSX instances preserved (3 total separator usages in source — 1 import + 3 JSX usages = 4 grep hits on `DropdownMenuSeparator`).
- 12/12 UserMenu tests pass (was 13 — Test 4 deleted as redundant with avatar Link assertion in Test 2).
- Phase 25 D-04 dual-affordance byte-identity lock relaxed minimally per NAV-16 D-02; the avatar Link, chevron Button, hit targets, gap tokens, and AvatarDisplay sizing all unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete Profile DropdownMenuItem block from UserMenu.tsx** — `9c2b72c` (feat)
2. **Task 2: Update tests/components/layout/UserMenu.test.tsx (Test 3 rewrite + Test 4 delete)** — `37e0aa1` (test)

**Plan metadata:** _(this commit, after SUMMARY + STATE updates)_

## Files Created/Modified

- `src/components/layout/UserMenu.tsx` — Deleted the `{username && <DropdownMenuItem render={<Link href="/u/${username}/collection">Profile</Link>} />}` block (lines 69-73 in pre-edit numbering); both surrounding `<DropdownMenuSeparator />` instances preserved; JSDoc dropdown-content listing updated from `Profile / Settings / Theme / Sign out` to `Settings / Theme / Sign out` so documentation matches post-deletion source. Net: −7 lines, +1 line.
- `tests/components/layout/UserMenu.test.tsx` — Rewrote Test 3 (`Email / Settings / Theme / Sign out (NAV-16)` ordering, drop `profileIdx`, add `expect(text).not.toMatch(/Profile/)`); deleted Test 4 (`Profile dropdown item links to /u/${username}/collection`); Test 9 (null-username branch) untouched per RESEARCH Pitfall 6 — its existing `queryByRole(/^profile$/i) → null` assertion is now globally true post-NAV-16. Net: −13 lines, +4 lines.

## Decisions Made

- **UI-SPEC D-01 wording precision honored.** CONTEXT D-01 read literally would have removed the `<DropdownMenuSeparator />` at line 75; UI-SPEC §"Visual Diff Contract — NAV-16 D-01 wording precision" explicitly overrides that reading and states BOTH separators stay (line 68 brackets email-identity / actions; line 75 brackets Settings / Theme block). Both retained per the override.
- **JSDoc adjustment scoped to keep `grep -c "Profile" == 0` passing.** Initial JSDoc edit substituted `Settings / Theme / Sign out — Profile row removed in Phase 29 NAV-16` which kept the word "Profile" in the file; second edit reworded to `Settings / Theme / Sign out — per Phase 29 NAV-16 dropdown content` to satisfy the strict acceptance criterion AND keep the comment truthful.
- **Test 4 deletion (not skip / not rename).** Per CONTEXT D-05: the avatar Link assertion in Test 2 already covers the `/u/${username}/collection` navigation path, and Test 9's `queryByRole({ name: /^profile$/i })).toBeNull()` is now globally true — Test 4 is fully redundant and was deleted entirely.
- **Test description strings unchanged for Tests 5-13.** Per Pattern Map §5 and CONTEXT D-05: do NOT renumber `it()` description strings. The file now contains tests labeled "Test 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13" with no "Test 4" — this is intentional and matches the documented test contract.

## Deviations from Plan

None - plan executed exactly as written.

The two minor in-task adjustments (the JSDoc rewrite happening in two passes to satisfy the strict `grep` criterion, and confirming Test 9's existing assertion needed no edit) were both anticipated by the plan's `<acceptance_criteria>` and `<read_first>` instructions. They are not deviations from the plan; they are the plan operating as designed.

**Total deviations:** 0
**Impact on plan:** Plan executed exactly as written. No auto-fix rules triggered.

## Issues Encountered

None. The pre-existing TypeScript errors surfaced by `npx tsc --noEmit --project tsconfig.json` (in `tests/components/preferences/PreferencesClient.debt01.test.tsx`, `tests/components/search/useSearchState.test.tsx`, `tests/components/settings/PreferencesClientEmbedded.test.tsx`, `tests/components/watch/WatchForm.isChronometer.test.tsx`, `tests/components/watch/WatchForm.notesPublic.test.tsx`, `tests/integration/phase17-extract-route-wiring.test.ts`) are unrelated to this plan's files (UserMenu.tsx and UserMenu.test.tsx). Per the SCOPE BOUNDARY in deviation rules, these are out of scope for plan 29-02 and were not addressed. Targeted check `npx tsc --noEmit | grep UserMenu` returned zero errors.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 29-02 (NAV-16) closes 1 of 3 success criteria for Phase 29 ("UserMenu dropdown no longer shows a Profile item; the avatar Link remains the primary path").
- Plans 29-03 (PROF-10) and 29-04 (FORM-04) are independent surfaces and unblocked by this work.
- No new dependencies, no new shadcn primitives, no new copy strings, no new design tokens.
- Phase 25 D-04 dual-affordance lock now scoped to "avatar Link + chevron Button + their containers + the dropdown surface elements other than the deleted Profile row" — future phases may continue to rely on those locks.

## Self-Check: PASSED

Verified:
- `src/components/layout/UserMenu.tsx` exists (FOUND).
- `tests/components/layout/UserMenu.test.tsx` exists (FOUND).
- Commit `9c2b72c` exists in `git log --oneline` (FOUND).
- Commit `37e0aa1` exists in `git log --oneline` (FOUND).
- `grep -c "Profile" src/components/layout/UserMenu.tsx` → `0` (PASSES strict criterion).
- `grep -c "<DropdownMenuSeparator />" src/components/layout/UserMenu.tsx` → `3` (3 JSX usages preserved per UI-SPEC D-01 wording precision).
- `npm run test -- tests/components/layout/UserMenu.test.tsx` → 12/12 passing.

---
*Phase: 29-nav-profile-chrome-cleanup*
*Completed: 2026-05-05*
