---
phase: 77-video-capture-display-ui
plan: 05
subsystem: component
tags: [component, capture, mediarecorder, stream-as-prop, ui]
requires:
  - phase: 77-01
    provides: VideoCaptureView + videoCapture test stubs
  - phase: 77-02
    provides: MediaState union (consumed by parent ComposeStep in Plan 06)
  - phase: 77-04
    provides: extractPosterBlob async function for onstop poster handoff
provides:
  - VideoCaptureView client component (stream-as-prop; 3s auto-stop; cancel-guard; poster handoff)
  - @keyframes ring-fill animation + reduced-motion override in src/app/globals.css
  - 4 component tests + 3 unit tests = 7 passing
affects: [Plan 06]
tech-stack:
  added: []
  patterns:
    - "Stream-as-prop video capture (parallel to CameraCaptureView)"
    - "cancelledRef.current guard inside MediaRecorder.onstop to prevent partial-blob emission on cancel"
    - "Chunks pushed per ondataavailable; Blob assembled once inside onstop (iOS Safari Pitfall 2)"
key-files:
  created:
    - src/components/wywt/VideoCaptureView.tsx
  modified:
    - src/app/globals.css
    - tests/components/wywt/VideoCaptureView.test.tsx
    - tests/unit/videoCapture.test.ts
key-decisions:
  - "Stream-as-prop architecture (parent owns getUserMedia; component takes MediaStream prop) makes iOS gesture-context discipline architecturally enforced (T-77-04)"
  - "setTimeout(stop, 3000) is the ONLY auto-stop mechanism — no MediaRecorder timeslice parameter (would fragment recording)"
  - "Cancel-during-recording uses ref-guard inside onstop (not state-guard) — state updates are async and would race with onstop"
  - "Progress ring CSS uses var(--ring-circumference, 138) so future components can override the ring size without forking the @keyframes"
patterns-established:
  - "MediaRecorder mock that synchronously fires onstop on stop() — lets the cancel-guard path run deterministically in tests"
requirements-completed:
  - VID-02
  - VID-03
duration: 22min
completed: 2026-06-23
---

# Phase 77 Plan 05: VideoCaptureView — live recording surface

**A stream-as-prop video capture component that records exactly 3.0 seconds, animates a progress ring + recording-indicator red dot, hands off the assembled video + extracted poster to the parent — and architecturally cannot call getUserMedia (closes T-77-04).**

## Performance

- **Duration:** ~22 min (executor portion, inline)
- **Completed:** 2026-06-23
- **Tasks:** 2/2
- **Files created:** 1 (`src/components/wywt/VideoCaptureView.tsx`)
- **Files modified:** 3 (`src/app/globals.css`, both Wave 0 test stubs)

## Accomplishments

- `src/components/wywt/VideoCaptureView.tsx` — new client component (~180 lines):
  - Stream wiring `useEffect` (verbatim from `CameraCaptureView`): sets `video.srcObject = stream`; cleanup stops all tracks + nullifies `srcObject`.
  - Unmount cleanup `useEffect`: clears `stopTimerRef` + stops recorder if active.
  - `handleStartRecording` constructs `new MediaRecorder(stream, { mimeType: preferredMimeType })`, registers `ondataavailable`/`onstop`, calls `recorder.start()`, and sets `setTimeout(() => recorder.stop(), 3000)`.
  - `recorder.onstop` short-circuits on `cancelledRef.current` (no extraction, no `onVideoReady`); otherwise awaits `extractPosterBlob(videoBlob)` and reports back via `onVideoReady({ videoBlob, posterBlob })`.
  - `handleCancel` distinguishes mid-recording (cancel + clearTimeout + ref-guard) from idle (pass through to parent's `onCancel`).
  - JSX: square aspect-ratio black wrapper + `<video autoPlay playsInline muted>` + `<WristOverlaySvg>` + conditional red dot (top-3 left-3 z-20, `bg-destructive dark:bg-destructive animate-pulse`) + sr-only aria-live announcer + button strip with conditional SVG progress ring around the Record button.
- `src/app/globals.css` — appended `@keyframes ring-fill`, `.ring-fill-animation` utility, and `@media (prefers-reduced-motion: reduce)` override.
- `tests/components/wywt/VideoCaptureView.test.tsx` — 4 passing cases (render, no-internal-getUserMedia, disabled prop, cancel-during-recording).
- `tests/unit/videoCapture.test.ts` — 3 passing cases (fake-timer 3000ms; clearTimeout cancel path; chunks-in-onstop Pitfall 2).

## Task Commits

1. **Task 1: VideoCaptureView + globals.css keyframes** — `b3d00208` (feat)
2. **Task 2: Upgrade both test stubs** — `c00322e8` (test)

## Files Created/Modified

- `src/components/wywt/VideoCaptureView.tsx` — new (~180 lines)
- `src/app/globals.css` — +30 lines (Phase 77 video capture progress ring block)
- `tests/components/wywt/VideoCaptureView.test.tsx` — 4 `it.todo` → 4 real `it(...)`
- `tests/unit/videoCapture.test.ts` — 3 `it.todo` → 3 real `it(...)`

## Verification

- `grep -c "export function VideoCaptureView" src/components/wywt/VideoCaptureView.tsx` → 1
- `grep -c "export interface VideoCaptureViewProps" src/components/wywt/VideoCaptureView.tsx` → 1
- `grep -c "'use client'" src/components/wywt/VideoCaptureView.tsx` → 1 (line 1)
- `grep -c "navigator.mediaDevices.getUserMedia" src/components/wywt/VideoCaptureView.tsx` → 0 (architectural guarantee for T-77-04)
- `grep -c "playsInline" src/components/wywt/VideoCaptureView.tsx` → 1 (durable iOS guardrail)
- `grep -c "new MediaRecorder" src/components/wywt/VideoCaptureView.tsx` → 1
- `grep -c "setTimeout(() => recorder.stop(), 3000)" src/components/wywt/VideoCaptureView.tsx` → 1
- `grep -c "extractPosterBlob" src/components/wywt/VideoCaptureView.tsx` → 2 (import + call site)
- `grep -c "bg-destructive dark:bg-destructive" src/components/wywt/VideoCaptureView.tsx` → 1 (paired override per durable memory)
- `grep -c "min-h-11" src/components/wywt/VideoCaptureView.tsx` → 2 (both buttons)
- `grep -c "ring-fill" src/app/globals.css` → 4 (keyframes name × 2 + class name × 2)
- `grep -c "prefers-reduced-motion" src/app/globals.css` → 3 (pre-existing 2 + new 1)
- `npm run build` → exit 0
- `npx vitest run tests/components/wywt/VideoCaptureView.test.tsx tests/unit/videoCapture.test.ts` → 7 passed

## Self-Check

PASSED — all acceptance criteria met. No deviations.

## Notes for downstream plans

- Plan 06 (`ComposeStep`) — mounts `<VideoCaptureView stream={cameraStream} preferredMimeType={preferredMimeType} onVideoReady={handleVideoReady} onError={handleError} onCancel={handleCancelVideoCamera} />` when `cameraStream && mediaSource === 'video'`. ComposeStep is the owner of the stream lifecycle; VideoCaptureView consumes it.
- Plan 06's `handleVideoReady` callback receives `{ videoBlob, posterBlob }` and lifts them into `mediaState = { kind: 'video', videoBlob, posterBlob }`.
- Both buttons use `min-h-11` for the 44px touch-target floor (per Phase 76 / Phase 74 mobile guidance).
