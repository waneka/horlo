---
phase: 23
plan: 01
subsystem: settings + watch-form-fields (Wave 0)
tags: [test, vitest, rtl, wave-0, red-scaffolds, nyquist]
requires:
  - vitest 2.1.9 + RTL + jsdom (existing)
  - tests/setup.ts (existing globals + jest shim)
provides:
  - 8 RED test scaffolds covering SET-07, SET-08, SET-10, FEAT-07, FEAT-08
  - <automated> verify command targets for Plan 02..05 implementation tasks
affects:
  - tests/components/settings/preferences/ (new directory)
  - tests/components/watch/ (new directory)
  - tests/actions/watches.notesPublic.test.ts
tech-stack:
  added: []
  patterns:
    - vi.mock hoisting for '@/app/actions/preferences' + '@/app/actions/watches'
      (RED tests for not-yet-emitted Server Action payload shapes)
    - next/navigation useRouter mock pattern (matches tests/components/WatchForm.test.tsx)
    - Mock-Supabase-browser-client + uploadCatalogSourcePhoto fakes in WatchForm scaffolds
      (mirrors existing Phase 19.1 Plan 03/05 test mocks)
key-files:
  created:
    - tests/components/settings/preferences/CollectionGoalCard.test.tsx
    - tests/components/settings/preferences/OverlapToleranceCard.test.tsx
    - tests/components/settings/PreferencesClientEmbedded.test.tsx
    - tests/components/settings/AppearanceSection.test.tsx
    - tests/components/watch/WatchForm.notesPublic.test.tsx
    - tests/components/watch/WatchForm.isChronometer.test.tsx
    - tests/components/watch/WatchDetail.isChronometer.test.tsx
    - tests/actions/watches.notesPublic.test.ts
  modified: []
decisions:
  - "Adapted PLAN's literal WatchForm scaffolds to use real component
    signature (mode + watch, not onSave) with full Server Action mocks.
    Plan stub would have failed for prop-mismatch reasons; the RED reason
    must be missing implementation so Plan 04 turns it GREEN organically."
  - "WatchDetail scaffold provides minimal {collection: [], preferences,
    verdict: null} props so the component mounts cleanly. RED reason is
    'no Certification row', not 'crash on missing prop'."
metrics:
  duration: ~12min
  completed_date: 2026-05-01
---

# Phase 23 Plan 01: Wave 0 RED Test Scaffolds Summary

Tests-first contract: 8 failing test scaffolds committed before any production code change in Plans 02–05. Each scaffold imports the not-yet-written symbol or asserts a not-yet-rendered element, fails with a clear "module-not-found" / "element-not-found" / "field-rejected" error, and gives every downstream implementation task an `<automated>` verification command to point at.

## Files Created (8)

### Settings Sections (Task 1, commit `bf48c57`)

| File | Requirement | RED Reason |
|------|-------------|-----------|
| `tests/components/settings/preferences/CollectionGoalCard.test.tsx` | SET-07 | Cannot find module `@/components/settings/preferences/CollectionGoalCard` (file does not exist). |
| `tests/components/settings/preferences/OverlapToleranceCard.test.tsx` | SET-08 | Cannot find module `@/components/settings/preferences/OverlapToleranceCard` (file does not exist). |
| `tests/components/settings/PreferencesClientEmbedded.test.tsx` | D-02 / D-04 | `PreferencesClient` does not yet accept `embedded` prop; legacy `<h1>Preferences</h1>`, subtitle, "Collection Settings" Card, and Overlap/Goal Labels still render. |
| `tests/components/settings/AppearanceSection.test.tsx` | SET-10 / D-05 / D-07 | `AppearanceSection` heading is currently "Appearance" not "Theme"; the Palette stub copy ("Theme and visual preferences are coming in the next update.") is still rendered; no Light/Dark/System segmented control mounted. |

### Watch Field Exposures (Task 2, commit `f1b46a8`)

| File | Requirement | RED Reason |
|------|-------------|-----------|
| `tests/components/watch/WatchForm.notesPublic.test.tsx` | FEAT-07 / D-13/14/16 | `WatchForm` has no `role="switch"` Public/Private pill in the Notes Card (currently 6 of 6 tests fail). |
| `tests/components/watch/WatchForm.isChronometer.test.tsx` | FEAT-08 / D-09/10 | `WatchForm` has no Chronometer-certified Checkbox in the Specifications Card (4 of 5 tests fail; the "submits NOT-true when not toggled" assertion vacuously passes because the field is absent from the payload entirely today). |
| `tests/components/watch/WatchDetail.isChronometer.test.tsx` | FEAT-08 / D-11 | `WatchDetail` does not render a Certification row regardless of `watch.isChronometer` value (1 of 4 tests fails — the positive case; negatives pass vacuously because the row is correctly absent today). |
| `tests/actions/watches.notesPublic.test.ts` | FEAT-07 / D-17/19 | `insertWatchSchema` in `src/app/actions/watches.ts` does not include `notesPublic`; addWatch / editWatch do not call `revalidatePath('/u/[username]', 'layout')` on success (4 of 4 tests fail). |

## Confirmation: All 8 Files Are RED

Quick run command output (per VALIDATION.md sampling rate):

```
npm test -- tests/components/settings/preferences/ \
  tests/components/settings/AppearanceSection.test.tsx \
  tests/components/settings/PreferencesClientEmbedded.test.tsx \
  tests/components/watch/ tests/actions/watches.notesPublic.test.ts
```

| File | Tests / Failures |
|------|------------------|
| CollectionGoalCard.test.tsx | 0 collected (module-not-found before describe) — RED |
| OverlapToleranceCard.test.tsx | 0 collected (module-not-found before describe) — RED |
| PreferencesClientEmbedded.test.tsx | 5 tests, 4 failed |
| AppearanceSection.test.tsx | 4 tests, 3 failed |
| WatchForm.notesPublic.test.tsx | 6 tests, 6 failed |
| WatchForm.isChronometer.test.tsx | 5 tests, 4 failed |
| WatchDetail.isChronometer.test.tsx | 4 tests, 1 failed (positive case) |
| watches.notesPublic.test.ts | 4 tests, 4 failed |

**Each plan task has at least one `<automated>` target it must turn GREEN.**

## Confirmation: No Regression to Existing Suite

Pre-existing failures in this worktree base (`f167b38`):

| File | Pre-existing Failures (NOT caused by Plan 01) |
|------|---------------------------------------------|
| `tests/integration/backfill-taste.test.ts` | 2 (script invocation) |
| `tests/app/explore.test.tsx` | 3 (matchMedia / SVG render) |
| `tests/no-raw-palette.test.ts` | 2 (font-medium check on CollectionFitCard / WatchSearchRow) |
| `src/components/watch/AddWatchFlow.test.tsx` | 0–1 (flaky "Working..." copy) |

**Total pre-existing in scope of full suite:** 5–8 failures (flake band).
**My Plan 01 RED additions:** 22 expected failures across 8 files.

Stash-and-rerun spot-check: with all my changes stashed, `tests/integration/backfill-taste.test.ts`, `tests/app/explore.test.tsx`, `tests/no-raw-palette.test.ts`, and `src/components/watch/AddWatchFlow.test.tsx` produced 7 failures across 4 files — confirming they are pre-existing and out of Plan 01 scope. Per the executor scope-boundary rule, these are logged as deferred items, not fixed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted WatchForm scaffolds to real component signature**

- **Found during:** Task 2
- **Issue:** PLAN's literal scaffolds for `WatchForm.notesPublic.test.tsx` and `WatchForm.isChronometer.test.tsx` used a fictional `onSave` prop (claimed in the plan's `<interfaces>` block as `onSave: (data) => void | Promise<void>`). The real `WatchForm` requires `mode: 'create' | 'edit'` and calls `addWatch` / `editWatch` Server Actions directly (no callback prop). Tests-as-written would have failed at runtime for missing `useRouter` mock, addWatch import, etc. — not for the intended RED reason.
- **Fix:** Used the real `WatchForm` signature with full Server Action mocks (mirroring the existing `tests/components/WatchForm.test.tsx` pattern). Mocks for `next/navigation`, `@/app/actions/watches`, `CatalogPhotoUploader`, `UrlImport`, Supabase browser client, and `catalogSourcePhotos`. This way the RED reason is "no role=switch pill" / "no Chronometer checkbox" — exactly what Plan 04 will fix.
- **Files modified:** Both WatchForm scaffold files
- **Commit:** `f1b46a8`

**2. [Rule 1 - Bug] Adapted WatchDetail scaffold to provide required props**

- **Found during:** Task 2
- **Issue:** PLAN's `WatchDetail` stub fixture supplied only `{ watch }`. The real component requires `collection`, `preferences`, `verdict`, `lastWornDate?`, and `viewerCanEdit?`. Without these the component would throw `Cannot read properties of undefined (reading 'length')` on `collection.length` — masking the intended RED reason (no Certification row).
- **Fix:** Provided minimal valid props (`collection: []`, full `UserPreferences` stub, `verdict: null`). Mocked `useRouter`, `removeWatch`, `editWatch`, `markAsWorn`, and `CollectionFitCard` (returns `null`) so the component mounts cleanly under jsdom.
- **Files modified:** `tests/components/watch/WatchDetail.isChronometer.test.tsx`
- **Commit:** `f1b46a8`

**3. [Rule 1 - Bug] Removed fictional `userId` field from PreferencesClient stub**

- **Found during:** Task 1
- **Issue:** PLAN's stub `UserPreferences` fixture included `userId: 'test-user'`. The real type at `src/lib/types.ts:67-90` has no `userId` field — UserPreferences is keyed by user externally (one row per user, foreign-keyed in the DB).
- **Fix:** Used the real shape from `tests/components/preferences/PreferencesClient.debt01.test.tsx:36-49` (no `userId`).
- **Files modified:** `tests/components/settings/PreferencesClientEmbedded.test.tsx`
- **Commit:** `bf48c57`

### Worktree Base Rebase

- **Found during:** Pre-task 1
- **Issue:** Worktree HEAD was at `0c240e9` (49 commits behind the expected base `f167b38`). The base check rule in the prompt mandated rebase.
- **Fix:** `git rebase --onto f167b38 HEAD^ HEAD` (drop the single legacy commit, rebase onto target) followed by `git checkout -B worktree-agent-aac296329040edac3` to re-attach to the named branch. Working tree was already clean.
- **Verification:** `git rev-parse HEAD` → `f167b38…` before any test work began.

### Auth Gates

None — Plan 01 produces test files only, with vi-mocked auth (`vi.mock('@/lib/auth')`). No real Supabase auth or Anthropic API was invoked.

## Acceptance Criteria — Per-Task Verification

### Task 1 — Settings Sections RED Scaffolds

- [x] All 4 files exist at the listed paths.
- [x] Running the tests fails (RED) — module-not-found for the two missing components, element-not-found for the embedded prop and Theme heading.
- [x] Each test file has a `describe(...)` block with at least 3 `it(...)` cases (CollectionGoalCard: 4, OverlapToleranceCard: 3, PreferencesClientEmbedded: 5, AppearanceSection: 4).
- [x] Locked copy strings appear LITERALLY: "Brand Loyalist — Same maker, different models", "Collection goal", "Overlap tolerance", "Theme", "How do you want your collection to grow over time?", "How strictly should we flag watches that overlap with what you already own?".
- [x] `grep -c '—' tests/components/settings/preferences/CollectionGoalCard.test.tsx` → **9** (≥ 4 required).
- [x] `grep -l "embedded" tests/components/settings/PreferencesClientEmbedded.test.tsx` → returns the file path.

### Task 2 — Watch Field Exposures RED Scaffolds

- [x] All 4 files exist at the listed paths.
- [x] Tests fail (RED): no `role="switch"` pill, no Chronometer Checkbox, no Certification row, Zod rejects `notesPublic`, no `revalidatePath('/u/[username]', 'layout')` call.
- [x] Locked copy literal in scaffolds: "Visibility:", "Public", "Private", "Note is public, click to make private", "Note is private, click to make public", "Chronometer-certified", "(COSC or equivalent)", "Certification", "Chronometer".
- [x] `grep -n 'aria-checked' tests/components/watch/WatchForm.notesPublic.test.tsx` → 3 lines (≥ 2 required).
- [x] `grep -n "revalidatePath.*'/u/\[username\]'" tests/actions/watches.notesPublic.test.ts` → 2 lines (≥ 2 required).
- [x] Existing test suite is unchanged — pre-existing 5–8 failures all reproduce with my changes stashed.

## Wave 0 Completion Signal for Planner

`23-VALIDATION.md` Wave 0 checklist (lines 73–80):

- [x] `tests/components/settings/preferences/CollectionGoalCard.test.tsx`
- [x] `tests/components/settings/preferences/OverlapToleranceCard.test.tsx`
- [x] `tests/components/settings/PreferencesClientEmbedded.test.tsx`
- [x] `tests/components/settings/AppearanceSection.test.tsx`
- [x] `tests/components/watch/WatchForm.notesPublic.test.tsx`
- [x] `tests/components/watch/WatchForm.isChronometer.test.tsx`
- [x] `tests/components/watch/WatchDetail.isChronometer.test.tsx`
- [x] `tests/actions/watches.notesPublic.test.ts`

`wave_0_complete: true` is now satisfiable in the VALIDATION frontmatter once the planner refreshes after Plan 01 is merged. Plans 02 / 03 / 04 / 05 each have a clear `<automated>` target.

## Self-Check: PASSED

All 8 created files exist:
- `tests/components/settings/preferences/CollectionGoalCard.test.tsx` — FOUND
- `tests/components/settings/preferences/OverlapToleranceCard.test.tsx` — FOUND
- `tests/components/settings/PreferencesClientEmbedded.test.tsx` — FOUND
- `tests/components/settings/AppearanceSection.test.tsx` — FOUND
- `tests/components/watch/WatchForm.notesPublic.test.tsx` — FOUND
- `tests/components/watch/WatchForm.isChronometer.test.tsx` — FOUND
- `tests/components/watch/WatchDetail.isChronometer.test.tsx` — FOUND
- `tests/actions/watches.notesPublic.test.ts` — FOUND

Both commits exist on branch `worktree-agent-aac296329040edac3`:
- `bf48c57` — Task 1 (4 files) — FOUND
- `f1b46a8` — Task 2 (4 files) — FOUND
