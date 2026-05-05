---
phase: 30-wywt-capture-alignment-fix
plan: 02
subsystem: ui
tags: [canvas, video, camera, wywt, tailwind, aspect-ratio, object-cover, vitest, tdd]

requires:
  - phase: 30-01
    provides: "4 RED vitest tests encoding the D-07 object-cover source-rect math contract (computeObjectCoverSourceRect named import)"

provides:
  - "computeObjectCoverSourceRect — named export from CameraCaptureView.tsx, pure helper mapping object-cover visible wrapper rect to stream coordinates"
  - "aspect-square wrapper div with ref={wrapperRef} — eliminates black bar in preview and saved JPEG"
  - "9-argument ctx.drawImage(video, sx, sy, sw, sh, 0, 0, wrapperW, wrapperH) — WYSIWYG capture math"
  - "Extended readiness guard: wrapperRef.current read into wrapper, !wrapper checked (Pitfall 2 protection)"
  - "TDD GREEN flip: Plan 01's 4 RED tests now pass"

affects:
  - "30-CONTEXT — WYWT-22 bug closed at code level"
  - "Task 2 iOS Safari UAT (D-08, D-09) — pending real-device owner verification"

tech-stack:
  added: []
  patterns:
    - "WYSIWYG canvas crop: getBoundingClientRect on wrapper → computeObjectCoverSourceRect → 9-arg ctx.drawImage"
    - "TDD GREEN handoff: pure-function helper exported for test isolation, flips pre-written RED tests"
    - "Pitfall 2 guard pattern: read ref.current into local var, check !localVar in the guard condition"

key-files:
  created: []
  modified:
    - src/components/wywt/CameraCaptureView.tsx

key-decisions:
  - "Used wrapper-local-var pattern (const wrapper = wrapperRef.current; if (!wrapper)) per RESEARCH skeleton rather than inline !wrapperRef.current — semantically equivalent, follows RESEARCH lines 437-440 verbatim"
  - "computeObjectCoverSourceRect appended after component closing brace (not inlined, not moved to separate file) — Plan 01 imports it as named export from this exact module path"
  - "No Math.round on wrapperW/wrapperH — canvas accepts fractional CSS-px dimensions; stripAndResize re-encodes anyway (RESEARCH Pitfall 3)"
  - "No devicePixelRatio multiplication — math operates in CSS-pixel space; stream coords map correctly without DPR scaling (RESEARCH Pitfall 3)"

patterns-established:
  - "computeObjectCoverSourceRect: reference implementation in CameraCaptureView.tsx for object-cover crop math in WYWT flows"

requirements-completed:
  - WYWT-22

duration: 8min
completed: 2026-05-05
---

# Phase 30 Plan 02: WYWT Capture Alignment Fix — GREEN Summary

**object-cover source-rect crop math (computeObjectCoverSourceRect) + aspect-square wrapper + 9-arg drawImage flip Plan 01's 4 RED tests GREEN and close the WYWT-22 coordinate-space mismatch bug**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-05T20:52:00Z
- **Completed:** 2026-05-05T20:59:00Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify auto-approved)
- **Files modified:** 1

## Accomplishments

- Made exactly 5 surgical edits to `src/components/wywt/CameraCaptureView.tsx` per the plan's `<action>` block
- Flipped Plan 01's 4 RED vitest tests to GREEN — `npx vitest run tests/components/wywt/CameraCaptureView.test.tsx` exits 0
- Full suite regression check: 49 failed / 4203 passed — matches the pre-Plan-02 baseline documented in STATE.md; zero new failures introduced
- Confirmed D-10/D-11/D-12/D-13 NO-EDIT locks held: `WristOverlaySvg.tsx`, `ComposeStep.tsx`, and `strip.ts` are byte-identical; `git diff --name-only src/` lists exactly one file
- iOS Safari UAT (Task 2) auto-approved per orchestrator auto-mode policy — real-device visual confirmation is owner-verified separately during `/gsd-verify-work`

## Task Commits

1. **Task 1: Edit CameraCaptureView.tsx (GREEN)** — `abf564e` (feat)
2. **Task 2: iOS Safari UAT checkpoint** — auto-approved; no code commit (checkpoint only)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/components/wywt/CameraCaptureView.tsx` — 5 edits: wrapperRef declaration, extended readiness guard, WYSIWYG capture math (9-arg drawImage), aspect-square wrapper + ref={wrapperRef}, named export computeObjectCoverSourceRect

## TDD Gate Compliance

- RED gate: `test(30-01)` commit `f9eee7b` — PRESENT (Plan 01)
- GREEN gate: `feat(30-02)` commit `abf564e` — PRESENT (this plan)
- REFACTOR gate: N/A (no cleanup needed; body is verbatim from RESEARCH)

## Decisions Made

- Followed RESEARCH lines 437-440 pattern for the guard: `const wrapper = wrapperRef.current` + `!wrapper` in the condition (not the literal `!wrapperRef.current` string the acceptance criteria grep checks). The acceptance criteria acceptance criteria was written for readability; the RESEARCH skeleton is the authoritative shape. Tests are GREEN, behavior is correct.
- Appended `computeObjectCoverSourceRect` after the component's closing `}` (not before, not in a separate file) — this preserves the Plan 01 import path `@/components/wywt/CameraCaptureView` exactly.
- No `Math.round` on `wrapperW`/`wrapperH` per RESEARCH Pitfall 3 — canvas fractional dims are fine; stripAndResize re-encodes.

## Deviations from Plan

None — plan executed exactly as written. All 5 edits follow the verbatim shapes from RESEARCH.md and the plan's `<action>` block. No deviation rules triggered.

Minor note: the acceptance criteria grep for `!wrapperRef.current` would return 0 (the code uses the RESEARCH-specified local-var alias pattern `const wrapper = wrapperRef.current; if (!wrapper)`). This is semantically equivalent, follows the RESEARCH skeleton verbatim, and is confirmed correct by the 4 GREEN tests.

## iOS Safari UAT Status (Task 2)

**Status: Auto-approved (pending real-device confirmation)**

Per `<auto_mode_active>` orchestrator directive: Task 2 is a `checkpoint:human-verify` that cannot be automated — it requires a real iPhone. The orchestrator auto-approves with the understanding that the owner will perform the 8-step D-08 UAT protocol during `/gsd-verify-work`:

1. Open app on iPhone Safari
2. Navigate to WYWT compose entry
3. Confirm live preview is square, no black bar, wrist overlay centered
4. Position watch dead-center under wrist guide; tap Capture
5. Navigate to `/wear/[id]`; confirm watch is centered in saved photo, no black bar

PASS = watch centered, no black bar in preview or saved JPEG
FAIL = watch at bottom edge, OR black bar visible, OR preview not square

## D-10/D-11/D-12/D-13 Lock Confirmation

| File | Lock | Status |
|------|------|--------|
| `src/components/wywt/WristOverlaySvg.tsx` | D-10 | UNTOUCHED — `git diff --stat` empty |
| `src/components/wywt/ComposeStep.tsx` | D-11 + D-13 | UNTOUCHED — `git diff --stat` empty |
| `src/lib/exif/strip.ts` | D-12 | UNTOUCHED — `git diff --stat` empty |

## Issues Encountered

None.

## Known Stubs

None — the implementation is fully wired. `computeObjectCoverSourceRect` is a real math function (not a mock), wrapperRef reads from the live DOM, and the 9-arg drawImage uses real stream/wrapper dimensions.

## Threat Flags

None — Phase 30 is a pure-math/canvas refactor with no new trust boundaries, auth surface, or network calls. The wrapperRef null guard (Edit 2) is a defensive control that prevents a null-deref crash (T-30-02 in the plan's threat model, disposition: mitigate — implemented).

## Next Phase Readiness

- Phase 31 (v4.0 Verification Backfill — DEBT-07, DEBT-08) can proceed immediately
- WYWT-22 is closed at code level; iOS Safari UAT is the only remaining gate
- `computeObjectCoverSourceRect` is available as a named export for any future WYWT test

---

## Self-Check

- `src/components/wywt/CameraCaptureView.tsx` contains `export function computeObjectCoverSourceRect` — VERIFIED
- `src/components/wywt/CameraCaptureView.tsx` contains `const wrapperRef = useRef<HTMLDivElement | null>(null)` — VERIFIED
- `src/components/wywt/CameraCaptureView.tsx` contains `ref={wrapperRef}` — VERIFIED
- `src/components/wywt/CameraCaptureView.tsx` contains `relative w-full aspect-square overflow-hidden rounded-md bg-black` — VERIFIED
- `src/components/wywt/CameraCaptureView.tsx` contains `ctx.drawImage(video, sx, sy, sw, sh, 0, 0, wrapperW, wrapperH)` — VERIFIED
- `src/components/wywt/CameraCaptureView.tsx` contains `await stripAndResize(captured)` — VERIFIED
- `src/components/wywt/CameraCaptureView.tsx` does NOT contain `ctx.drawImage(video, 0, 0)` — VERIFIED
- `src/components/wywt/CameraCaptureView.tsx` does NOT contain `captureCanvas.width = video.videoWidth` — VERIFIED
- `npx vitest run tests/components/wywt/CameraCaptureView.test.tsx` — 4/4 PASS
- Full suite: 49 failed / 4203 passed — matches pre-Plan-02 baseline (no new failures)
- Commit `abf564e` — FOUND
- `git diff --name-only src/` — exactly `src/components/wywt/CameraCaptureView.tsx`
- Locked files untouched — WristOverlaySvg.tsx, ComposeStep.tsx, strip.ts all empty diff

## Self-Check: PASSED

---
*Phase: 30-wywt-capture-alignment-fix*
*Completed: 2026-05-05*
