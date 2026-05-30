---
phase: 74-dupebanner-gate-refinement-mobile-polish
plan: 01
subsystem: ui
tags: [dupe-banner, confirm-step, gate, regression-test, disappearance-assertion, add-watch-flow]

# Dependency graph
requires:
  - phase: 68-confirmstep-component
    provides: "ConfirmStep prop contract (D-03 LOCKED — additive extensions allowed)"
  - phase: 70-addwatchflow-state-machine-rewrite-dupe-wiring
    provides: "DupeBanner sibling-above-ConfirmStep pattern (D-11 LOCKED) + Phase 70 gap plan 08 WR-01 OR-gate (now reverted)"
provides:
  - "Additive bannerActive?: boolean prop on ConfirmStep (default false; backward compat)"
  - "Section 6 primary CTA early-return null when bannerActive=true (DUPE-04 SC#1: 'hidden entirely' branch)"
  - "AddWatchFlow.tsx:694 reverted pending semantic + new bannerActive prop wired from state.dupeContext"
  - "ConfirmStep mock in AddWatchFlow.test.tsx honors bannerActive (omits Confirm primary from DOM)"
  - "3 pivoted WR-01 tests (A/B/C) using disappearance-paired assertions"
  - "1 new WR-01 Test D — pure absence-by-construction assertion closing DUPE-04 SC#1"
affects: [add-watch-flow, confirm-step, dupe-banner, regression-tests, v8.1-bundled-prod-push]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Disappearance-paired assertion (recurrence-3 of feedback_test_assert_disappearance_too): triple-assertion pattern — banner-appears + CTA-disappears + click-cannot-fire-because-button-absent"
    - "Additive ConfirmStep prop extension (recurrence-3 of Phase 68 D-03 additive-extension contract)"

key-files:
  created: []
  modified:
    - src/components/watch/ConfirmStep.tsx
    - src/components/watch/AddWatchFlow.tsx
    - src/components/watch/AddWatchFlow.test.tsx

key-decisions:
  - "D-01 hide entirely chosen over distinct copy / disabled stub: minimum-surface diff, no label-thrashing, no copy-string proliferation, ARIA-clean (no disabled button under banner)"
  - "D-02 additive bannerActive?: boolean prop on ConfirmStep (default false) — Phase 68 D-03 contract allows additive extensions; pending semantic reverted to original 'real async work only' meaning"
  - "D-03 ghost row (Edit details / Start over) stays mounted + clickable while bannerActive=true; price/reference/year inputs stay editable; only Section 6 primary CTA is removed from DOM"
  - "D-04+D-10 test pivot: 3 existing WR-01 tests pivot toBeDisabled() → queryByText.not.toBeInTheDocument() paired with findByTestId('dupe-banner-{owned|wishlist}').toBeInTheDocument()"
  - "WR-01 Test D added as pure-absence assertion (no click attempt) to close DUPE-04 SC#1 — distinct from Test B which keeps the click-impossible-because-absent attempt"
  - "ConfirmStep mock in test file updated to omit Confirm primary button when bannerActive=true — mirrors production Section 6 early-return null so jsdom can observe the disappearance"

patterns-established:
  - "Disappearance-paired assertion pattern (recurrence-3 in v8.1; first shipped Phase 72 SRCH-03b, then Phase 73 ROUTE-01): when a state change both mounts an alternative surface AND removes a competing surface, assert BOTH directions in jsdom — getByX.toBeInTheDocument() + queryByY.not.toBeInTheDocument()"
  - "Component-mock-must-mirror-production-conditional pattern: when production hides/omits a DOM element under a prop, the test mock MUST honor the same prop so jsdom observes the same disappearance — without the mock update, structural absence is silently bypassed"
  - "JSDoc-prose grep-collision avoidance (recurrence-4): reworded 'Section 6 primary CTA' JSDoc reference to 'primary CTA in the final section' so `grep -c 'Section 6' ConfirmStep.tsx` returns 1 (single source of truth in the actual block comment, not in JSDoc prose)"

requirements-completed: [DUPE-04]

# Metrics
duration: ~6min
completed: 2026-05-30
---

# Phase 74 Plan 01: DupeBanner gate refinement — hide ConfirmStep primary CTA entirely when banner mounted Summary

**ConfirmStep primary CTA hidden entirely when DupeBanner is mounted via additive `bannerActive?: boolean` prop; the 'Saving...' copy on a non-saving button (Phase 70 gap-08 WR-01 OR-gate) is removed and replaced by structural absence — the banner IS the action surface.**

## Performance

- **Duration:** ~6 minutes
- **Started:** 2026-05-30T20:24:38Z (per STATE.md last_updated)
- **Completed:** 2026-05-30T20:30:14Z
- **Tasks:** 3
- **Files modified:** 3
- **Commits:** 3 (1 feat ConfirmStep, 1 feat AddWatchFlow, 1 test pivot + new test)

## Accomplishments

- ConfirmStep gains additive `bannerActive?: boolean` prop (default false — backward compat) per Phase 68 D-03 additive-extension contract; Section 6 primary CTA wrapped in `{!bannerActive && (...)}` early-return null
- AddWatchFlow.tsx:694 reverts the Phase 70 gap-08 OR-combined gate (`pending={state.pending || state.dupeContext != null}` → `pending={state.pending}`) restoring Phase 68 D-03 pending-semantic purity (pending = real async work only); new adjacent `bannerActive={state.dupeContext != null}` prop wires the gate signal
- 3 existing Phase 70 gap-plan-08 WR-01 tests pivoted from `toBeDisabled()` assertions to disappearance-paired assertions (`queryByText('Confirm primary').not.toBeInTheDocument()` paired with `findByTestId('dupe-banner-{owned|wishlist}').toBeInTheDocument()`) per recurrence-3 of `feedback_test_assert_disappearance_too`
- New WR-01 Test D added as a pure-absence-by-construction assertion (no click attempt) — closes DUPE-04 SC#1 with the cleanest possible contract: banner appears + CTA absent + addWatch never called
- ConfirmStep mock in AddWatchFlow.test.tsx updated to honor `bannerActive` — when true, the Confirm primary button is omitted from the rendered DOM (ghost row stays mounted per D-03)
- DUPE-04 closed structurally: when DupeBanner mounts on the confirm screen, the redundant `<Loader2 spinning/> Saving...` button no longer renders; the user re-orients to the banner's explicit affordances (View existing / Move to Collection / Add another copy)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add bannerActive prop to ConfirmStep + early-return null on Section 6** — `aad79072` (feat)
2. **Task 2: Revert pending semantic at AddWatchFlow.tsx:694 + wire new bannerActive prop** — `00f94480` (feat)
3. **Task 3: Pivot 3 WR-01 tests to disappearance-paired assertions + add WR-01 Test D** — `f7c4f1f8` (test)

## Files Created/Modified

- `src/components/watch/ConfirmStep.tsx` — added `bannerActive?: boolean` to ConfirmStepProps (default false in destructure); wrapped Section 6 primary CTA `<Button>` block in `{!bannerActive && (...)}`. JSDoc prose reworded to avoid grep-collision (`primary CTA in the final section` instead of literal `Section 6`)
- `src/components/watch/AddWatchFlow.tsx` — line 694 reverted from `pending={state.pending || state.dupeContext != null}` to `pending={state.pending}` + new adjacent `bannerActive={state.dupeContext != null}`. Inline comment block (lines 689-693) reworded to explain Phase 74 D-01/D-02 invariant. DupeBanner sibling block at lines 660-672 UNCHANGED
- `src/components/watch/AddWatchFlow.test.tsx` — ConfirmStep mock (lines 186-218) updated to destructure `bannerActive` and omit Confirm primary button when bannerActive=true; 3 WR-01 tests pivoted (A/B/C); new WR-01 Test D added in the same describe block; total tests in file 27 → 28

## Decisions Made

None beyond what is captured in CONTEXT.md D-01 through D-15 — all decisions ratified there; plan executed exactly as specified.

The only planner's-discretion choice exercised was:
- **WR-01 Test D phrasing — pure-absence form (chosen) vs. attempt-and-confirm-nothing-fires form.** Selected pure-absence per CONTEXT.md Claude's Discretion guidance because Test B already covers the attempt-click form (now mooted by the absence-by-construction); Test D is cleanest as a structural-contract assertion.

## Deviations from Plan

None - plan executed exactly as written.

The 3 tasks landed in plan order, each commit passed `npm run build` exit 0, and the targeted vitest run (`src/components/watch/AddWatchFlow.test.tsx`) finished 28/28 green after Task 3 (vs. 27 before — 1 new Test D added; the 3 pivoted tests A/B/C went from RED to GREEN as expected once the mock + assertions were updated).

## Issues Encountered

None. The RED state was captured cleanly between Task 2 and Task 3 (3 failed tests confirming the gate has flipped from disabled-to-absent), and GREEN was achieved on the first vitest run after the test pivots.

## Verification Results

- `npm run build`: exits 0 after all 3 tasks (authoritative gate per `project_baseline_not_green_build_is_gate`)
- `npx vitest run src/components/watch/AddWatchFlow.test.tsx`: 28/28 pass (was 27 + 1 new Test D)
- `grep -c "bannerActive" src/components/watch/ConfirmStep.tsx` = 4 (≥3 — interface, JSDoc, destructure, conditional)
- `grep -c "bannerActive={state.dupeContext != null}" src/components/watch/AddWatchFlow.tsx` = 1
- `grep -c "pending={state.pending || state.dupeContext" src/components/watch/AddWatchFlow.tsx` = 0 (OR-gate removed)
- `grep -c "font-medium" src/components/watch/ConfirmStep.tsx src/components/watch/AddWatchFlow.tsx` = 0 (recurrence-5 guardrail intact)
- `grep -cF "queryByText('Confirm primary')" src/components/watch/AddWatchFlow.test.tsx` = 4 (one per Test A/B/C initial + Test D)

## Deferred Items

- **DUPE-04 prod UAT visual verification** — `human_needed: true` per `feedback_mobile_ui_verify_on_prod`. Local jsdom assertions guarantee structural absence (the `<Button>` is not in the DOM); whether the confirm screen visually feels clean under the banner is a runtime call that bundles into the Phase 72+73+74 deploy walk per CONTEXT D-15. Tasks for the prod walk:
  - Add a watch via search whose catalog row matches an existing owned/wishlist row → DupeBanner mounts → confirm ConfirmStep primary CTA is NOT visible under the banner
  - Ghost row (Edit details / Start over) remains clickable; inputs remain editable
  - Clicking "Add another copy" makes the primary CTA reappear and become functional

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 74 has 2 plans total per STATE.md; this is Plan 01 (DUPE-04). Plan 02 ships MOB-01 (iOS Safari input auto-zoom global CSS floor + className rewrites + 2 static guards) per CONTEXT.md D-06 through D-14
- DUPE-04 is structurally closed; bundled v8.1 prod push (Phase 72 SRCH-03 + Phase 73 ROUTE-01 + Phase 74 DUPE-04 + MOB-01) awaits Plan 02 completion per CONTEXT D-15
- No blockers; ConfirmStep prop contract and DupeBanner sibling pattern are intact for Phase 75+ consumers

## Self-Check: PASSED

- `src/components/watch/ConfirmStep.tsx` — FOUND (modified, 4 bannerActive hits, 0 font-medium)
- `src/components/watch/AddWatchFlow.tsx` — FOUND (modified, 1 bannerActive wire, 0 OR-gate, 0 font-medium)
- `src/components/watch/AddWatchFlow.test.tsx` — FOUND (modified, 4 queryByText('Confirm primary') + Test D + mock honors bannerActive)
- Commit `aad79072` (Task 1) — FOUND in git log
- Commit `00f94480` (Task 2) — FOUND in git log
- Commit `f7c4f1f8` (Task 3) — FOUND in git log

---
*Phase: 74-dupebanner-gate-refinement-mobile-polish*
*Plan: 01 (DUPE-04)*
*Completed: 2026-05-30*
