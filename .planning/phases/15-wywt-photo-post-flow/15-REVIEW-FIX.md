---
phase: 15-wywt-photo-post-flow
fixed_at: 2026-04-25T03:05:29Z
review_path: .planning/phases/15-wywt-photo-post-flow/15-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 15: Code Review Fix Report

**Fixed at:** 2026-04-25T03:05:29Z
**Source review:** .planning/phases/15-wywt-photo-post-flow/15-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (all warnings; 0 critical; info findings out of scope)
- Fixed: 5
- Skipped: 0
- Full vitest suite (2699 tests) passes after every commit; baseline + each fix re-checked.

## Fixed Issues

### WR-01: Double `stripAndResize` on submit — redundant lossy JPEG re-encode

**Files modified:** `src/components/wywt/ComposeStep.tsx`, `tests/components/WywtPostDialog.test.tsx`
**Commit:** 94151ec
**Applied fix:** Removed the `stripAndResize(photoBlob)` call inside `handleSubmit`. PhotoUploader (line 118) and CameraCaptureView (line 91) both already pipe blobs through `stripAndResize` before invoking the upstream `handlePhotoReady` callback, so by the time submit fires the blob is already EXIF-stripped and ≤1080px. Dropping the second canvas re-encode eliminates a generation-loss artifact pass and 50–300 ms of main-thread CPU per submit. Removed the now-unused `import { stripAndResize }` from ComposeStep.tsx and updated the JSDoc submit pipeline (steps 1–3 → 1–2) so a future contributor does not assume the strip is duplicated. Updated `Test 17` in `tests/components/WywtPostDialog.test.tsx` to assert the new contract: `uploadWearPhoto → logWearWithPhoto` ordering, plus an explicit regression guard that `stripAndResize` is NOT called inside the submit handler. The test now also asserts the same blob reference is forwarded to `uploadWearPhoto` (no copy / re-encode in between). All 20 WywtPostDialog tests pass.

### WR-02: `today` computed from UTC — timezone drift causes duplicate-day false positives

**Files modified:** `src/lib/wear.ts`, `src/app/actions/wearEvents.ts`, `src/components/wywt/WywtPostDialog.tsx`, `tests/integration/phase15-wywt-photo-flow.test.ts`
**Commit:** dafa616
**Applied fix:** Added a single `todayLocalISO()` helper to `src/lib/wear.ts` that formats `new Date()` as `YYYY-MM-DD` in the caller's local timezone (matches the zod `preflightSchema.regex(/^\d{4}-\d{2}-\d{2}$/)` shape). Replaced all three `new Date().toISOString().split('T')[0]` call sites:
- `src/app/actions/wearEvents.ts:35` (`markAsWorn` — for parity with logWearWithPhoto so both Server Actions agree on the same day boundary)
- `src/app/actions/wearEvents.ts:153` (`logWearWithPhoto` — DB insert + UNIQUE-constraint key)
- `src/components/wywt/WywtPostDialog.tsx:80` (preflight — picker "Worn today" disable hint)

Product decision baked into the helper's JSDoc: the canonical "wear day" is the user's local calendar day. Single-user MVP has no clock-skew concern; profile-timezone threading is a future extension if multi-user adds clock-mismatched contexts. Updated the integration test's `isoToday` helper to also use local-date methods so seeded `wornDate` rows match the Server Action's `today` (Test 20 duplicate-day collision). Pinned `vi.setSystemTime(new Date(\`${date}T12:00:00\`))` (no `Z` — local midday) so the fake clock yields the same calendar day in the runner's local timezone. The integration suite is env-gated (DATABASE_URL) and skipped under the local run, but the unit suite confirms no regression. All 20 WywtPostDialog tests pass.

**Note:** `requires human verification` — this finding involves correctness across a date-boundary that depends on the runner's local timezone. The unit tests do not exercise the UTC-vs-local divergence (jsdom runs in the host's local TZ). A manual UAT is needed in a non-UTC zone (e.g., America/Los_Angeles) to confirm the reported failure mode no longer reproduces: log a watch at 11pm local; on the next morning open the picker and confirm the watch is NOT marked "Worn today". This is consistent with VERIFICATION.md item 6 (duplicate-day preflight UAT).

### WR-03: Pre-capture chooser shows "Take wrist shot" but Upload button visually orphaned below

**Files modified:** `src/components/wywt/ComposeStep.tsx`
**Commit:** 8985801
**Applied fix:** Moved an `Upload photo` button INSIDE the dashed-border chooser zone next to `Take wrist shot`, matching UI-SPEC §Copywriting Contract / D-06. The chooser-internal Upload button proxies taps through `photoUploaderRef.current?.openPicker()`. The real `<PhotoUploader>` component is now mounted permanently in `<div className="sr-only" aria-hidden>` (no longer toggling between "flex justify-center" and "sr-only" based on chooser state) so its ref stays stable across all three photo-zone states (chooser / live camera / preview), preserving the D-07 "Choose another" re-open path. The mock `PhotoUploader` in `tests/components/WywtPostDialog.test.tsx` is reached via `getByTestId('simulate-upload')`, which works regardless of `sr-only` styling, so existing Tests 18 and 20 still pass without modification. All 20 WywtPostDialog tests pass.

### WR-04: Camera stream leak if user rapidly clicks "Take wrist shot" twice

**Files modified:** `src/components/wywt/ComposeStep.tsx`
**Commit:** 1cff698
**Applied fix:** Added a synchronous `cameraOpeningRef = useRef(false)` re-entrance guard. `handleTapCamera` now early-returns if `cameraOpeningRef.current || cameraStream` is true, then sets the ref to `true` and clears it in a `finally` block.

**Important deviation from REVIEW suggestion:** The reviewer's suggested fix used `useState` (`setCameraOpening(true)` before `await getUserMedia`). That would violate **Pitfall 1 / T-15-01** (the iOS gesture-context rule the entire Phase 15 architecture is built around): `setState` schedules a microtask, which iOS Safari treats as gesture-context loss; subsequent `getUserMedia` would prompt-and-fail because no preceding await is permitted between the user gesture and the `getUserMedia` call. Using `useRef` is synchronous, does not enqueue a microtask, and does NOT trigger a re-render — preserving Pitfall 1 while still blocking the re-entrant call. The comment block at the new ref declaration explains this trade-off so future contributors don't "fix" it back to `useState`. All 20 WywtPostDialog tests pass.

### WR-05: `logActivity` metadata can be stale after race with watch deletion

**Files modified:** `src/app/actions/wearEvents.ts`
**Commit:** 311f240
**Applied fix:** Adopted reviewer's option (1) — accept the race + document. Added a comment block at the activity-logging site (line 204) explaining that brand/model/imageUrl in the activity row are **intentional snapshots** captured at log-time from the watch row fetched during the ownership check (line 128), NOT joined at read-time. Cross-referenced to Phase 12 D-10 (denormalized activity contract). Same shape as the `markAsWorn` activity log above. No behavioral change; comment-only documentation so future readers don't assume the activity feed reflects the live watch state. All 20 WywtPostDialog tests pass.

---

## Skipped Issues

None. All 5 in-scope warnings were fixed.

The 6 info-severity findings (IN-01 through IN-06) are out of scope for `fix_scope: critical_warning` and were intentionally left for a future iteration. They are advisory per the phase VERIFICATION.md and do not block goal completion.

---

## Verification Summary

**3-tier verification per fix:**
- **Tier 1 (re-read):** Performed for every modified file; no corruption observed.
- **Tier 2 (TypeScript syntax check):** `npx tsc --noEmit` produced no errors in any of the modified production files. (Two pre-existing errors in `tests/components/preferences/PreferencesClient.debt01.test.tsx` are unrelated to this work — Phase 15 did not touch that file or `UserPreferences`.)
- **Tier 3 (full test suite):** `npm test -- --run` ran 2699 tests, 0 failures, 149 unrelated skips (env-gated DB integration suites + 15 file-level skips). Matches the pre-fix baseline.

**Files modified across all fixes:**
- `src/components/wywt/ComposeStep.tsx` (WR-01, WR-03, WR-04)
- `src/components/wywt/WywtPostDialog.tsx` (WR-02)
- `src/app/actions/wearEvents.ts` (WR-02, WR-05)
- `src/lib/wear.ts` (WR-02 — new helper)
- `tests/components/WywtPostDialog.test.tsx` (WR-01 — Test 17 contract update)
- `tests/integration/phase15-wywt-photo-flow.test.ts` (WR-02 — local-date helper alignment)

**Commits (chronological, atomic):**
1. `94151ec` — fix(15): WR-01 remove double stripAndResize on submit
2. `dafa616` — fix(15): WR-02 use local date for wear today across client and server
3. `8985801` — fix(15): WR-03 group Take wrist shot and Upload photo inside chooser zone
4. `1cff698` — fix(15): WR-04 guard handleTapCamera against rapid double-tap re-entry
5. `311f240` — fix(15): WR-05 document activity log snapshot semantics

---

_Fixed: 2026-04-25T03:05:29Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
