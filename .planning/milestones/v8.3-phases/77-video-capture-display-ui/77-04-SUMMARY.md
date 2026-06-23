---
phase: 77-video-capture-display-ui
plan: 04
subsystem: utilities
tags: [hook, capability-probe, poster-extraction, video]
requires:
  - phase: 77-01
    provides: tests/hooks/useMediaCapability.test.ts + tests/unit/posterExtraction.test.ts Wave 0 RED stubs
provides:
  - useMediaCapability React hook (SSR-safe; probes MediaRecorder + getUserMedia + mimeType candidates)
  - extractPosterBlob pure async function (canvas-based JPEG at duration * 0.75, quality 0.85)
  - 4 + 3 = 7 passing tests across both files
affects: [Plan 05, Plan 06]
tech-stack:
  added: []
  patterns:
    - "SSR-safe capability hook: useState default = closed; useEffect probe flips it on the client"
    - "Pure browser-API utility (no 'use client') — caller responsible for invoking in browser context"
key-files:
  created:
    - src/hooks/useMediaCapability.ts
    - src/lib/video/extractPosterBlob.ts
  modified:
    - tests/hooks/useMediaCapability.test.ts
    - tests/unit/posterExtraction.test.ts
key-decisions:
  - "useMediaCapability checks API existence (truthy navigator.mediaDevices?.getUserMedia) but does NOT INVOKE it — avoids spurious camera permission prompts"
  - "MIME candidate order: mp4+avc1 (preferred — iOS 26.6 Safari confirmed in Spike 001) → webm/vp9 → webm/vp8 → webm"
  - "Poster seeks to duration * 0.75 (SEED-020 D-08 'completed angle' moment for wrist rotation); JPEG quality 0.85"
  - "URL.revokeObjectURL called on every code path in extractPosterBlob (success + 3 reject paths)"
patterns-established:
  - "jsdom shim pattern: tests beforeAll(() => Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:placeholder' })) before spyOn — jsdom doesn't ship URL.createObjectURL/revokeObjectURL"
requirements-completed:
  - VID-04
  - VID-05
duration: 18min
completed: 2026-06-23
---

# Phase 77 Plan 04: useMediaCapability + extractPosterBlob

**The two browser-API building blocks Plan 05's VideoCaptureView composes — capability probe + canvas poster extraction — each unit-tested in isolation.**

## Performance

- **Duration:** ~18 min (executor portion, inline)
- **Completed:** 2026-06-23
- **Tasks:** 2/2
- **Files created:** 2 (`src/hooks/useMediaCapability.ts`, `src/lib/video/extractPosterBlob.ts`)
- **Files modified:** 2 (test stubs upgraded)

## Accomplishments

- `useMediaCapability()` (`src/hooks/useMediaCapability.ts`) — `'use client'` React hook returning `{ supportsVideoCapture: boolean; preferredMimeType: string | null }`. SSR default = closed; `useEffect` probe chain runs on hydration. Probes (1) `typeof MediaRecorder !== 'undefined'`, (2) `navigator.mediaDevices?.getUserMedia` truthy, (3) first-supported MIME from `mp4+avc1 → webm/vp9 → webm/vp8 → webm`.
- `extractPosterBlob(videoBlob: Blob): Promise<Blob>` (`src/lib/video/extractPosterBlob.ts`) — pure async function. Creates detached `<video>` + `<canvas>`, seeks to `duration * 0.75`, draws current frame, emits JPEG at quality 0.85. `URL.revokeObjectURL` called on all 4 code paths.
- Tests: 4 useMediaCapability cases + 3 posterExtraction cases = 7 passing.

## Task Commits

1. **Task 1: useMediaCapability hook + tests** — `3842bb60` (feat)
2. **Task 2: extractPosterBlob + tests** — `de1da81b` (feat)

## Files Created/Modified

- `src/hooks/useMediaCapability.ts` — created (42 lines)
- `src/lib/video/extractPosterBlob.ts` — created (50 lines)
- `tests/hooks/useMediaCapability.test.ts` — upgraded 4 `it.todo` → 4 real `it(...)` cases
- `tests/unit/posterExtraction.test.ts` — upgraded 3 `it.todo` → 3 real `it(...)` cases with shared mock setup

## Verification

- `test -f src/hooks/useMediaCapability.ts` → present
- `test -f src/lib/video/extractPosterBlob.ts` → present
- `grep -c "'use client'" src/hooks/useMediaCapability.ts` → 1
- `grep -c "use client" src/lib/video/extractPosterBlob.ts` → 0 (pure function)
- `grep -c "duration \* 0.75" src/lib/video/extractPosterBlob.ts` → 1
- `grep -c "revokeObjectURL" src/lib/video/extractPosterBlob.ts` → 4 (one per code path)
- `npx vitest run tests/hooks/useMediaCapability.test.ts` → 4 passed
- `npx vitest run tests/unit/posterExtraction.test.ts` → 3 passed
- `npm run build` → exit 0

## Self-Check

PASSED — all acceptance criteria met.

### Deviation: jsdom URL shim

The plan's mock pattern assumed `URL.createObjectURL` and `URL.revokeObjectURL` exist in the test environment so `vi.spyOn` could wrap them. jsdom does NOT ship these. Added a `beforeAll` block that defines no-op placeholders via `Object.defineProperty` before any spy runs. This is mechanical scaffolding that doesn't affect the test contract — every spy still verifies the same behavior the plan specifies.

Worth durable-memory consideration if other future tests touch these APIs in jsdom — currently a one-off shim.

## Notes for downstream plans

- Plan 05 (`VideoCaptureView`) — imports both: `useMediaCapability` for the `preferredMimeType` (passed via prop) and `extractPosterBlob` invoked inside `MediaRecorder.onstop` after chunks are assembled.
- Plan 06 (ComposeStep) — calls `useMediaCapability()` once at component top; gates the third pre-capture button on `supportsVideoCapture`; passes `preferredMimeType` down to `VideoCaptureView` via prop.
- Neither utility depends on Plan 02 / Plan 03 types — they're standalone building blocks.
