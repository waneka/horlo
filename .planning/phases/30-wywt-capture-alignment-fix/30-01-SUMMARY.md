---
phase: 30-wywt-capture-alignment-fix
plan: 01
subsystem: testing
tags: [vitest, tdd, canvas, video, wywt, camera]

requires: []

provides:
  - "tests/components/wywt/ directory (new)"
  - "CameraCaptureView.test.tsx — 4 pure-function assertions encoding the D-07 math contract for computeObjectCoverSourceRect"
  - "TDD RED handoff to Plan 30-02: failing with 'computeObjectCoverSourceRect is not a function'"

affects:
  - "30-02-PLAN — must export computeObjectCoverSourceRect from CameraCaptureView.tsx to flip these tests GREEN"

tech-stack:
  added: []
  patterns:
    - "Pure-function test for DOM/canvas math: no render, no mocks, just numeric inputs and output assertions"
    - "tests/components/wywt/ subdirectory for WYWT component tests"

key-files:
  created:
    - tests/components/wywt/CameraCaptureView.test.tsx
  modified: []

key-decisions:
  - "Test imports computeObjectCoverSourceRect as a named export — not a local inline copy — so RED→GREEN handoff is real (Plan 02 export flips it)"
  - "Pure-function approach chosen per RESEARCH Convention 5: no canvas/video mocks needed; numeric in, numeric out"
  - "±1px TOLERANCE encoded as const TOLERANCE = 1 (D-07 literal contract)"
  - "4 test cases: 3 centerpoint fixtures (1920×1080, 1280×720, 1080×1080 + 360×360 wrapper) plus bounds check across all fixtures"

patterns-established:
  - "tests/components/wywt/ directory: home for WYWT component unit tests"
  - "Pure-function math tests: extract helper, test numerically, no DOM setup"

requirements-completed:
  - WYWT-22

duration: 2min
completed: 2026-05-05
---

# Phase 30 Plan 01: WYWT Capture Alignment Fix — RED Test Summary

**TDD RED gate: 4 pure-function assertions encode the D-07 object-cover source-rect math contract in `tests/components/wywt/CameraCaptureView.test.tsx`; all 4 fail with `computeObjectCoverSourceRect is not a function` (export ships in Plan 02)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-05T20:49:51Z
- **Completed:** 2026-05-05T20:51:57Z
- **Tasks:** 1 (TDD RED)
- **Files modified:** 1 created

## Accomplishments

- Created `tests/components/wywt/` directory (did not exist before this plan)
- Wrote `CameraCaptureView.test.tsx` with 4 `it()` blocks encoding the D-07 math contract verbatim from the plan
- Confirmed RED state via `npx vitest run`: all 4 tests fail with `computeObjectCoverSourceRect is not a function`
- Zero edits to any `src/` file — production code is byte-identical to pre-plan state

## Task Commits

1. **Task 1: Create tests/components/wywt/ + CameraCaptureView.test.tsx (RED)** — `f9eee7b` (test)

## TDD Gate Compliance

- RED gate: `test(30-01)` commit `f9eee7b` — PRESENT
- GREEN gate: `feat(30-02)` — PENDING (Plan 02 ships the export)
- REFACTOR gate: N/A (plan-level TDD; refactor in Plan 02 scope if needed)

## Files Created/Modified

- `tests/components/wywt/CameraCaptureView.test.tsx` — 4 pure-function `it()` blocks asserting the D-07 object-cover source-rect math contract. Imports `computeObjectCoverSourceRect` as a named export from `@/components/wywt/CameraCaptureView` (does not yet exist → RED state). No canvas/video mocks; numeric inputs only.

## RED State Detail

**Exact failure message (all 4 tests):**
```
TypeError: computeObjectCoverSourceRect is not a function
```

**Failure mode:** The named import resolves (the module loads without error) but the export does not exist, so calling it throws. This is the correct RED failure mode — NOT a parse error, NOT a module-not-found. Plan 02 must add `export function computeObjectCoverSourceRect(...)` to `src/components/wywt/CameraCaptureView.tsx` to flip to GREEN.

## D-07 Contract Encoded

| Fixture | Assert | Tolerance |
|---------|--------|-----------|
| 1920×1080 stream + 360×360 wrapper | centerpoint = (960, 540) | ±1px |
| 1280×720 stream + 360×360 wrapper | centerpoint = (640, 360) | ±1px |
| 1080×1080 stream + 360×360 wrapper | sx=0, sy=0, sw=1080, sh=1080 | toBeCloseTo |
| All 3 fixtures | sx≥0, sy≥0, sx+sw≤streamW+0.001, sy+sh≤streamH+0.001 | bounds check |

## Decisions Made

- Used named import (not local inline copy) so the RED→GREEN handoff is real — Plan 02 must export the symbol
- Pure-function test: no DOM render, no canvas stubs, no video mocks — consistent with RESEARCH Convention 5 and existing `tests/lib/exif-strip.test.ts` pattern for math-only assertions
- `const TOLERANCE = 1` literal (not a magic number) to make the D-07 ±1px contract self-documenting

## Deviations from Plan

None — plan executed exactly as written. Test file content matches the verbatim code block in the PLAN.md `<action>` section.

## Issues Encountered

None.

## Known Stubs

None — this is a test file with no data sources or rendering. The "missing export" is intentional and the designated RED state, not a stub.

## Threat Flags

None — test file only; no new network endpoints, auth paths, or schema changes introduced.

## Next Phase Readiness

- Plan 30-02 can begin immediately: the D-07 math contract is executable as an automated gate
- Plan 30-02 must add `export function computeObjectCoverSourceRect(streamW, streamH, wrapperW, wrapperH): { sx, sy, sw, sh }` to `src/components/wywt/CameraCaptureView.tsx`
- Once Plan 30-02 ships, `npx vitest run tests/components/wywt/CameraCaptureView.test.tsx` must exit 0

## Self-Check: PASSED

- `tests/components/wywt/CameraCaptureView.test.tsx` — FOUND
- `tests/components/wywt/` directory — FOUND
- Commit `f9eee7b` — FOUND
- `git diff src/components/wywt/CameraCaptureView.tsx` — empty (UNCHANGED)
- vitest exits non-zero (RED state confirmed)

---
*Phase: 30-wywt-capture-alignment-fix*
*Completed: 2026-05-05*
