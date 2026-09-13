---
phase: 84-wear-history-depth
fixed_at: 2026-09-13T00:00:00Z
review_path: .planning/phases/84-wear-history-depth/84-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 84: Code Review Fix Report

**Fixed at:** 2026-09-13T00:00:00Z
**Source review:** .planning/phases/84-wear-history-depth/84-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (CR-01, CR-02, WR-01..WR-06; Info items out of scope)
- Fixed: 8
- Skipped: 0

**Gates:** targeted vitest green for every touched file (wearEventsBackfill 15, wearEventsVideo 9, wearEventsDelete 16, wornTabScope 8, LogTodaysWearButton 14, WearLeaderboard 13, WornTabContent 5 (new), profile-tab-insights 4, common-ground-fallback 3, tests/static 486 incl. ppr-dynamic-before-use-cache). `npm run build` exit 0 after all fixes. Worked directly on `main` (no worktree, per orchestrator); only explicit paths staged.

**Not yet done:** Worn-tab runtime check in `npm run dev` against local Supabase (CLAUDE.md local-first rule). The env-gated integration suite `phase15-wywt-photo-flow` was skipped locally (no env), so its updated CR-01 assertion has not run.

## Fixed Issues

### CR-01: The duplicate-day check never matches, so users never see the "already logged" message (D-05)

**Files modified:** `src/app/actions/wearEvents.ts`, `tests/actions/wearEventsBackfill.test.ts`, `tests/actions/wearEventsVideo.test.ts`, `tests/integration/phase15-wywt-photo-flow.test.ts`
**Commit:** 7a3b3473
**Applied fix:** Added a private `pgErrorCode(err)` helper (`err.code ?? err.cause?.code`, strings only) to the `'use server'` module. It is not exported, because a `'use server'` file may only export async functions. `logBackfillWear`, `logWearWithPhoto` and `logWearWithVideo` now all use it for the `23505` check. `deleteWearEvent` (260913-cae) never reads DB error codes (it uses a generic catch), so it needed no change. Nothing else in `src/` checks `'23505'`.

### WR-06: The duplicate-day test mocks an error shape the real driver never produces

**Files modified:** `tests/actions/wearEventsBackfill.test.ts`, `tests/actions/wearEventsVideo.test.ts`, `tests/integration/phase15-wywt-photo-flow.test.ts`
**Commit:** 7a3b3473 (same commit as CR-01, since the fix and the tests that prove it belong together)
**Applied fix:**
- Backfill Test 7 and Test 8 now reject with a `mkDrizzleQueryError(sqlState)` helper. It builds a `DrizzleQueryError`-named error with no top-level `code` and `cause: { code }`, and it asserts that the top-level `code` is undefined.
- Added Test 8b so a raw driver error with a top-level `code` is still recognized.
- Video Test 8 uses the wrapped shape.
- Integration Test 6 now asserts `code ?? cause.code`.
- The integration assertion against local Supabase that the review suggested was not added. The existing env-gated Test 6 already inserts a real duplicate through the DAL, and it now checks the correct field.

### CR-02: The Worn tab still sends full `Watch` rows (price paid, private notes) to non-owners

**Files modified:** `src/lib/wornTabScope.ts`, `src/app/u/[username]/[tab]/page.tsx`, `src/components/profile/WornTabContent.tsx`, `tests/unit/wornTabScope.test.ts`
**Commit:** 7f5d7eef
**Applied fix:**
- Added a pure `toWornTabWatchSummary()` and a `WornTabWatchSummary` type (`{id, brand, model, imageUrl: string | null}`) to `wornTabScope.ts`. It picks fields explicitly, with no spread.
- `page.tsx` projects both `ownedWatches` and `watchMap` through it before they reach the client component. There are no new awaits and `unstable_instant` is untouched, so the static PPR test stays green.
- `WornTabContent.ownedWatches` is narrowed from `Watch[]` to `WornTabWatchSummary[]`. None of the consumers read `status`.
- New unit tests check that `pricePaid`, `targetPrice`, `marketPrice`, `acquisitionDate`, `notes`, `notesPublic` and `status` are not present after projection, including for the private-collection viewer path.

### WR-01: The client can get past the future-date check and the "today-only activity" rule by sending its own `today`

**Files modified:** `src/app/actions/wearEvents.ts`, `tests/actions/wearEventsBackfill.test.ts`
**Commit:** bfa52253
**Status:** fixed: requires human verification (date logic)
**Applied fix:**
- Added `isPlausibleClientToday(today)`. It accepts `today` only if it falls between the UTC date of now−14h and the UTC date of now+14h, which covers every real timezone (UTC−12..+14). The server still does not work out the user's day, so 260622-exo holds.
- `logBackfillWear` runs this check right after zod and before the IDOR check. On failure it returns "Couldn't log that wear. Check your device's date and try again."
- The existing `wornDate > today` check is kept.
- Tests pin `Date` with `vi.useFakeTimers({ toFake: ['Date'] })`. They cover a 2099 `today`, an old `today` equal to `wornDate`, the UTC+14 and UTC−12 extremes (accepted), and 2 days off (rejected).
- **Not mirrored** into `markAsWorn`, `logWearWithPhoto` or `logWearWithVideo`. The check itself would be trivial to add, but it is not low-risk. Integration Test 20 in `phase15-wywt-photo-flow` deliberately passes `today = isoToday(-2)` to `logWearWithPhoto`, and the video unit tests use a fixed `today: '2026-06-22'`. Mirroring would break those env-gated tests, which I can't run locally. It could also reject a WYWT compose dialog left open for a long time. This should be a follow-up.

### WR-02: The "already logged" check shows stale results after the date changes or the dialog reopens

**Files modified:** `src/components/profile/LogTodaysWearButton.tsx`, `tests/components/profile/LogTodaysWearButton.test.tsx`
**Commit:** 1915d2a7
**Status:** fixed: requires human verification (client state logic)
**Applied fix:**
- Added `preflightDate` state, recording which date the current `wornOnDateIds` belongs to. When it doesn't match `wornDate`, the results are treated as empty: no stale disabled rows or labels are shown, and `canSubmit` is false.
- A preflight failure sets `preflightDate` to the current date so submit isn't blocked forever. The server backstop still applies.
- `handleOpen` resets `wornOnDateIds` and `preflightDate` when the dialog opens, not on mount, following the Router Cache rule.
- New T12 holds a preflight open and asserts that submit is blocked and stale labels are hidden. New T13 asserts that a reopen doesn't carry over the previous session.

### WR-03: No error handling around the server action call inside `startTransition`

**Files modified:** `src/components/profile/LogTodaysWearButton.tsx`, `tests/components/profile/LogTodaysWearButton.test.tsx`
**Commit:** 4e39c487
**Applied fix:** The `logBackfillWear` call is now wrapped in try/catch. A rejection sets the inline alert "Couldn't log that wear. Please try again." and keeps the dialog open. New T14 rejects the action and asserts the alert appears, the dialog stays open, and submit is enabled again.

### WR-04: Leaderboard rows link to pages non-owners of private collections can't open

**Files modified:** `src/components/profile/WearLeaderboard.tsx`, `src/components/profile/WornTabContent.tsx`, `src/app/u/[username]/[tab]/page.tsx`, `tests/components/profile/WearLeaderboard.test.tsx` (plus `tests/components/profile/WornTabContent.test.tsx` in da46472c)
**Commit:** 425a7858
**Applied fix:**
- `WearLeaderboard` takes `linkable?: boolean`, defaulting to true. When it is false, rows render as a plain `<div data-slot="leaderboard-row">` with the same layout and no hover or focus ring.
- `WornTabContent` takes a new `collectionPublic` prop, passed from `settings.collectionPublic`, which the page already loads, so there is no new fetch. It computes `linkable = isOwner || collectionPublic`.
- New L6b, plus WornTabContent tests covering three cases: private collection non-owner (unlinked), public collection non-owner (linked), and private collection owner (linked).

### WR-05: Non-owners are told to "log a wear", and zero-wear profiles show two empty states

**Files modified:** `src/components/profile/WearLeaderboard.tsx`, `src/components/profile/WornTabContent.tsx`, `tests/components/profile/WearLeaderboard.test.tsx`, `tests/components/profile/WornTabContent.test.tsx` (new file)
**Commit:** da46472c
**Status:** fixed: requires human verification (UX change against 84-UI-SPEC)
**Applied fix:**
- `WearLeaderboard` takes `isOwner?: boolean`, defaulting to false. The owner keeps the copy locked in UI-SPEC: "Try a longer window, or log a wear to get started." Non-owners now see "Try a longer window."
- `WornTabContent` no longer mounts the leaderboard when `events.length === 0`, in both the owner and non-owner empty branches.
- L7 now passes `isOwner`. New L7b covers non-owner copy, and new WornTabContent tests check that the zero-wear branches have no leaderboard.
- The new test file was created because `WornTabContent` had no direct tests.
- **Check with the product owner:** 84-UI-SPEC line 115 describes zero-count rows rendering under the empty-window note. That still happens when wears exist outside the selected window. Only the case with no wears at all now shows the empty card alone.

---

_Fixed: 2026-09-13T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
