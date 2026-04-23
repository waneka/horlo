---
phase: 14-nav-shell-explore-stub
plan: 09
subsystem: testing
tags: [debt-01, preferences, regression-test, vitest, react-testing-library, accessibility]

# Dependency graph
requires:
  - phase: 999.1-phase-5-code-review-followups-rls-errors
    provides: DEBT-01 production fix — PreferencesClient.tsx saveError state, role="alert" banner, aria-live="polite" Saving hint (MR-01 closure)
provides:
  - Regression-lock test suite (5 tests) for DEBT-01 error-UX behavior
  - Targeted selector pattern with loud-failure fallback (prevents silent timeout on future refactor)
  - Scoped PointerEvent polyfill pattern for tests that exercise base-ui Checkbox
  - REQUIREMENTS.md traceability marks DEBT-01 Complete with cross-phase provenance
affects: [future-preferences-edits, preferences-client-refactor, debt-verification-pattern]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Verification-only plan pattern — no production code changes; regression test locks a previously-shipped fix"
    - "Targeted-selector-with-loud-fallback helper — named STYLE_TAGS lookup → any checkbox fallback → descriptive throw"
    - "Structural source-file assertion — reads .tsx file to lock JSX attributes whose runtime render is gated behind transient state"

key-files:
  created:
    - tests/components/preferences/PreferencesClient.debt01.test.tsx
  modified:
    - .planning/REQUIREMENTS.md

key-decisions:
  - "No production code changes — DEBT-01 was shipped in Phase 999.1 Plan 01 (MR-01); Phase 14 only adds the regression lock per CONTEXT.md D-25"
  - "Scoped PointerEvent polyfill inside the test file rather than tests/setup.ts — base-ui Checkbox dispatches new PointerEvent('click') which jsdom doesn't implement, but this is the only test that exercises it today"
  - "Structural lock asserts aria-live='polite' via fs.readFileSync of the .tsx source because the Saving hint only renders while isPending=true; source-file presence is the most reliable guard against a refactor that deletes the attribute"
  - "Selector helper uses name-matched STYLE_TAGS 'diver' rather than first-checkbox-anywhere heuristic so a refactor moving the element surfaces a descriptive error rather than a generic waitFor timeout on missing role='alert'"

patterns-established:
  - "Verification-only phase task — test + docs only, no production code delta"
  - "PointerEvent polyfill shim — inline in test file for base-ui Checkbox interactions under jsdom"
  - "Cross-phase traceability row — 'Complete (fix shipped Phase 999.1; regression-lock test added Phase 14)' preserves provenance across phase boundaries"

requirements-completed: [DEBT-01]

# Metrics
duration: 3min
completed: 2026-04-23
---

# Phase 14 Plan 09: DEBT-01 Regression Lock — PreferencesClient Save-Error UX Summary

**Locked the Phase 999.1 DEBT-01 fix against future regression with 5 tests (role=alert banner, destructive styling, success-path no-alert, aria-live Saving hint via source-file read, selector-resolution lock); marked DEBT-01 Complete in REQUIREMENTS.md traceability with cross-phase provenance.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-23T22:51:03Z
- **Completed:** 2026-04-23T22:54:05Z
- **Tasks:** 2 / 2
- **Files modified:** 2 (1 created, 1 edited)

## Accomplishments

### Task 1 — DEBT-01 regression-lock test

Created `tests/components/preferences/PreferencesClient.debt01.test.tsx` with 5 tests:

1. **selector-resolution lock** — Asserts the targeted Preferred-Styles checkbox is reachable in the rendered DOM BEFORE any save-failure path runs. Fails loudly with a descriptive error if PreferencesClient's first interactive surface has moved, rather than silently timing out on a missing `role="alert"` element downstream.
2. **role="alert" banner on save failure** — Mocks `savePreferences` to return `{ success: false, error: 'Database unavailable' }`, clicks the first Preferred-Styles checkbox, and asserts a `role="alert"` element appears with text `Couldn't save preferences: Database unavailable`.
3. **destructive styling** — Asserts the alert element's className contains `text-destructive`.
4. **no-alert on success** — Mocks `savePreferences` to resolve `{ success: true }` and verifies no `role="alert"` element appears after the update.
5. **structural lock on aria-live** — Reads `src/components/preferences/PreferencesClient.tsx` from disk and asserts the source contains `aria-live="polite"` and `Saving`. The element only renders while `isPending=true`, so a runtime DOM assertion would require synchronization gymnastics; the source-file assertion is the most reliable guard against a refactor that deletes the attribute.

**Selector helper:** `findFirstPrefCheckbox()` uses a three-strategy resolution — named `/diver/i` checkbox (STYLE_TAGS anchor) → any role=checkbox fallback → descriptive `Error` throw. This replaces the original "first checkbox anywhere" heuristic which could silently no-op after a refactor.

**PointerEvent polyfill:** base-ui's Checkbox internally dispatches `new PointerEvent('click', ...)` on toggle. jsdom does not implement PointerEvent. Inline polyfill at the top of the test file extends `MouseEvent` with minimal `pointerId`/`pointerType` fields so `fireEvent.click` reaches `onCheckedChange` without a ReferenceError. Scoped to this test file (not `tests/setup.ts`) because this is the only suite today that exercises base-ui's PointerEvent path.

**Commit:** `c95b726` — test(14-09): add DEBT-01 regression-lock test for PreferencesClient

### Task 2 — REQUIREMENTS.md traceability update

- Active checklist: `- [ ] **DEBT-01**: ...` → `- [x] **DEBT-01**: ...`
- Traceability table: `| DEBT-01 | Phase 14 | Pending |` → `| DEBT-01 | Phase 14 | Complete (fix shipped Phase 999.1; regression-lock test added Phase 14) |`
- Net effect: pending-count dropped from 51 → 50 (DEBT-01 only; no other rows changed)

**Commit:** `0553acf` — docs(14-09): mark DEBT-01 complete in REQUIREMENTS traceability

## Verification

- `npx vitest run tests/components/preferences/PreferencesClient.debt01.test.tsx` — **5/5 passed** (Test Files 1 passed)
- `grep -c "DEBT-01 | Phase 14 | Complete" .planning/REQUIREMENTS.md` → 1 ✓
- `grep -c "DEBT-01 | Phase 14 | Pending" .planning/REQUIREMENTS.md` → 0 ✓
- `grep -c "^- \[x\] \*\*DEBT-01\*\*" .planning/REQUIREMENTS.md` → 1 ✓
- `grep -c "^- \[ \] \*\*DEBT-01\*\*" .planning/REQUIREMENTS.md` → 0 ✓
- Pending row count delta: 51 → 50 (exactly 1, confirming only DEBT-01 changed) ✓
- `src/components/preferences/PreferencesClient.tsx` unchanged: `role="alert"` count = 1, `aria-live="polite"` count = 1, `Couldn` count = 1 (Phase 999.1 fix intact) ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jsdom lacks PointerEvent — base-ui Checkbox click crashed with ReferenceError**

- **Found during:** Task 1 — initial test run failed 2/5 with `ReferenceError: PointerEvent is not defined` thrown from `@base-ui/react/esm/checkbox/root/CheckboxRoot.js:275` where `inputRef.current?.dispatchEvent(new PointerEvent('click', ...))` runs on toggle.
- **Issue:** jsdom does not implement PointerEvent; fireEvent.click on a base-ui Checkbox that goes through this path throws, which unwinds the React event handler before `onCheckedChange` fires, meaning `savePreferences` is never invoked and `role="alert"` never renders.
- **Fix:** Added a scoped polyfill at the top of `PreferencesClient.debt01.test.tsx` that defines `globalThis.PointerEvent` as a subclass of MouseEvent with minimal `pointerId`/`pointerType` fields. Guarded behind a `typeof globalThis.PointerEvent === 'undefined'` check so real browsers / future jsdom releases unaffected.
- **Scope boundary:** Kept inline in this single test file rather than promoting to `tests/setup.ts` because no other tests currently exercise base-ui Checkbox under fireEvent.click. If more suites adopt this pattern, promoting to setup is a trivial future refactor.
- **Files modified:** `tests/components/preferences/PreferencesClient.debt01.test.tsx` (polyfill block L5-22)
- **Commit:** `c95b726` (merged with the test itself)

## Known Stubs

None. Verification-only plan.

## Self-Check: PASSED

- File `tests/components/preferences/PreferencesClient.debt01.test.tsx` — **FOUND**
- File `.planning/REQUIREMENTS.md` modifications — **FOUND** (row 77 checkbox, row 192 traceability)
- Commit `c95b726` (Task 1) — **FOUND**
- Commit `0553acf` (Task 2) — **FOUND**
- Production code `src/components/preferences/PreferencesClient.tsx` — **UNCHANGED** (Phase 999.1 fix intact)
- Test suite `npx vitest run tests/components/preferences/PreferencesClient.debt01.test.tsx` — **5/5 PASS**
