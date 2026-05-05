---
phase: 30-wywt-capture-alignment-fix
verified: 2026-05-05T21:05:00Z
status: human_needed
score: 2/3 must-haves verified (SC-3 VERIFIED by code inspection; SC-1 and SC-2 VERIFIED at code level; iOS Safari UAT pending for full closure)
overrides_applied: 0
human_verification:
  - test: "iOS Safari visual UAT — D-08 protocol"
    expected: "Live preview is square (no black bar), wrist overlay centered. After capturing, /wear/[id] shows the watch centered in the saved JPEG, not at the bottom edge."
    why_human: "Visual judgment is the acceptance criterion per D-08/D-09. Requires a real iPhone on iOS Safari; JSDOM math test covers the coordinate math but cannot substitute for real-device visual confirmation of the full capture-to-render pipeline."
---

# Phase 30: WYWT Capture Alignment Fix — Verification Report

**Phase Goal:** When a user aligns their wrist with the WYWT camera overlay, the saved photo crops the wrist where the overlay said it would be — not lower in the frame.
**Verified:** 2026-05-05T21:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | WYWT capture overlay's geometric center corresponds to the same pixel coordinates in the saved JPEG that it visually occupies in the live preview | VERIFIED (code level) | `computeObjectCoverSourceRect` math proven: for all 3 D-07 fixtures the source-rect centerpoint equals the stream centerpoint at delta=(0,0), well inside ±1px. The 9-arg `ctx.drawImage(video, sx, sy, sw, sh, 0, 0, wrapperW, wrapperH)` maps the wrapper rect → stream coords → canvas exactly. See §Math Walkthrough. |
| 2 | Capture pipeline crops the preview to match the capture frame so a user who aligns their wrist sees the same alignment in the resulting /wear/[id] photo | VERIFIED (code level) | Data flow: `wrapperRef.current.getBoundingClientRect()` → `computeObjectCoverSourceRect` → 9-arg `drawImage` → `toBlob` → `stripAndResize` → `onPhotoReady`. No step injects divergent geometry. `captureCanvas.width = wrapperW; captureCanvas.height = wrapperH` (not `video.videoWidth`). Old 3-arg `ctx.drawImage(video, 0, 0)` is absent. iOS Safari visual confirmation pending (human item below). |
| 3 | WristOverlaySvg geometry (canonical 10:10 + arm spacing) is unchanged — out of scope | VERIFIED | `WristOverlaySvg.tsx` last commit is `ad3f473` (Phase 15). No edit by Phase 30 commits. `git diff abf564e^^ -- src/components/wywt/WristOverlaySvg.tsx` is empty. |

**Score:** 3/3 truths VERIFIED at code level. SC-1 and SC-2 require iOS Safari visual UAT to close fully (human item below).

---

## Code-Level Checks (Verification Protocol)

### Check 1: `computeObjectCoverSourceRect` is a named export

```
grep result: line 170 — export function computeObjectCoverSourceRect(
```

**PASS** — Named export present at line 170 of `src/components/wywt/CameraCaptureView.tsx`.

### Check 2: Wrapper has `aspect-square` + `ref={wrapperRef}`

```
grep result (aspect-square): line 122 — className="relative w-full aspect-square overflow-hidden rounded-md bg-black"
grep result (ref={wrapperRef}): line 121 — ref={wrapperRef}
```

**PASS** — Both present on the same wrapper `<div>`. Class string exactly matches UI-SPEC line 116 contract.

### Check 3: Readiness guard includes wrapper check

```
grep result: line 69 — const wrapper = wrapperRef.current
             line 70 — if (!video || !wrapper || video.videoWidth === 0 || video.videoHeight === 0)
```

**PASS** — Guard uses the RESEARCH-specified local-var alias pattern (`const wrapper = wrapperRef.current; if (!wrapper)`), which is semantically equivalent to `!wrapperRef.current` and is the form documented verbatim in RESEARCH.md lines 437-440. The SUMMARY.md notes this deviation from the literal grep string; the behavior is correct and the tests confirm it.

### Check 4: 9-argument drawImage is in use

```
grep result: line 95 — ctx.drawImage(video, sx, sy, sw, sh, 0, 0, wrapperW, wrapperH)
```

**PASS** — 9-argument form (image + 4 source args + 4 dest args). Old 3-arg form absent.

### Check 5: `stripAndResize` call preserved (D-12)

```
grep result: line 105 — const result = await stripAndResize(captured)
```

**PASS** — Pipeline preserved. `captured` is the pre-cropped blob from `toBlob`; it still pipes through `stripAndResize` unchanged.

### Check 6: D-07 math test exists and passes

```
npx vitest run tests/components/wywt/CameraCaptureView.test.tsx
Result: 4 tests passed (4) — exit 0
```

**PASS** — All 4 tests GREEN. Test file at `tests/components/wywt/CameraCaptureView.test.tsx` imports `computeObjectCoverSourceRect` directly from `@/components/wywt/CameraCaptureView` (named export, not a local copy). This is the key wiring check: the test exercises the actual production function.

### Check 7: Locked files unchanged

| File | Lock | Last Commit | Status |
|------|------|-------------|--------|
| `src/components/wywt/WristOverlaySvg.tsx` | D-10 | `ad3f473` (Phase 15) | UNTOUCHED |
| `src/components/wywt/ComposeStep.tsx` | D-11 + D-13 | `de680e4` (Phase 26) | UNTOUCHED |
| `src/lib/exif/strip.ts` | D-12 | `c5a3e7a` (Phase 15) | UNTOUCHED |

`git diff abf564e^^ -- <locked files>` produces empty output. Phase 30 commit `abf564e` modifies exactly one file: `src/components/wywt/CameraCaptureView.tsx`.

**PASS** — All three locked files confirmed unchanged.

---

## Math Correctness (Check 8)

Formula extracted from `CameraCaptureView.tsx` lines 176-181:

```
videoScale = max(wrapperW / streamW, wrapperH / streamH)
sw = wrapperW / videoScale
sh = wrapperH / videoScale
sx = (streamW - sw) / 2
sy = (streamH - sh) / 2
```

Node.js walkthrough against RESEARCH.md manual arithmetic:

| Fixture | sx | sy | sw | sh | Source-rect center | Stream center | Delta |
|---------|----|----|----|----|-------------------|---------------|-------|
| 1920×1080 + 360×360 | 420 | 0 | 1080 | 1080 | (960, 540) | (960, 540) | (0, 0) |
| 1280×720 + 360×360 | 280 | 0 | 720 | 720 | (640, 360) | (640, 360) | (0, 0) |
| 1080×1080 + 360×360 | 0 | 0 | 1080 | 1080 | (540, 540) | (540, 540) | (0, 0) |

All three fixtures produce delta=(0,0), matching RESEARCH.md §"Object-Cover Source Rect Math" manual arithmetic exactly.

**PASS** — Formula is correct. For a square wrapper (`wrapperW == wrapperH`), the source-rect centerpoint is identical to the stream centerpoint by construction regardless of stream resolution.

---

## WYSIWYG Capture Data-Flow Trace (Check 9)

Full data-flow from wrapper rect to `onPhotoReady`:

1. `wrapper.getBoundingClientRect()` at capture time → `wrapperW, wrapperH` (CSS pixels)
2. `computeObjectCoverSourceRect(video.videoWidth, video.videoHeight, wrapperW, wrapperH)` → `{sx, sy, sw, sh}` (stream coords)
3. `captureCanvas.width = wrapperW; captureCanvas.height = wrapperH` — canvas is wrapper-sized, NOT stream-sized
4. `ctx.drawImage(video, sx, sy, sw, sh, 0, 0, wrapperW, wrapperH)` — draws only the visible wrapper region from stream
5. `captureCanvas.toBlob(resolve, 'image/jpeg', 0.85)` → `captured` Blob
6. `stripAndResize(captured)` → `result.blob` (EXIF-stripped, 1080px-capped)
7. `onPhotoReady(result.blob)` — delivers the cropped, stripped JPEG

No step injects geometry that diverges from the wrapper rect. The old code path (`captureCanvas.width = video.videoWidth`) is absent from the file. No `devicePixelRatio` multiplication (Pitfall 3 avoided).

**PASS** — Data flow is clean end-to-end.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/wywt/CameraCaptureView.tsx` | WYSIWYG capture math + aspect-square wrapper | VERIFIED | 183-line file; wrapperRef, aspect-square, 9-arg drawImage, named export all present |
| `tests/components/wywt/CameraCaptureView.test.tsx` | 4 D-07 math tests importing production export | VERIFIED | 66-line file; imports `computeObjectCoverSourceRect` directly from production module; 4/4 pass |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CameraCaptureView.tsx:handleCapture` | `computeObjectCoverSourceRect` | Direct call line 84 | WIRED | Called with live `video.videoWidth/Height` and `wrapperW/wrapperH` |
| `CameraCaptureView.tsx:handleCapture` | `stripAndResize` (D-12) | Import + call line 105 | WIRED | Pre-cropped blob passed; pipeline unchanged |
| Test file | `computeObjectCoverSourceRect` | Named import from `@/components/wywt/CameraCaptureView` | WIRED | Test exercises the production function, not a local copy |
| Wrapper `<div>` | `wrapperRef` | `ref={wrapperRef}` line 121 | WIRED | DOM ref attached; `getBoundingClientRect()` reads real layout |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 4 D-07 math tests pass | `npx vitest run tests/components/wywt/CameraCaptureView.test.tsx` | 4/4 passed, exit 0 | PASS |
| Named export resolves | `grep "export function computeObjectCoverSourceRect"` | Found line 170 | PASS |
| No old 3-arg drawImage | `grep "ctx.drawImage(video, 0, 0)"` | No match | PASS |
| No old full-stream canvas sizing | `grep "captureCanvas.width = video.videoWidth"` | No match | PASS |

Step 7b iOS Safari behavior: SKIPPED — requires real device (routed to human verification below).

---

## Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|-----------|
| `CameraCaptureView.tsx` | None found | — | No TODOs, no stubs, no empty returns, no hardcoded empty state. `computeObjectCoverSourceRect` is a real math function returning computed values. |

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| WYWT-22 | WYWT capture overlay aligns with actual capture frame; fix overlay positioning math; SVG geometry redesign not in scope | VERIFIED (code level) | SC-1 math proven; SC-2 pipeline traced; SC-3 locked files confirmed unchanged. iOS UAT pending. |

---

## Human Verification Required

### 1. iOS Safari Visual UAT (D-08 Protocol)

**Test:**
1. Open the app on iPhone Safari
2. Navigate to WYWT compose entry (tap the WYWT button)
3. Confirm live preview is square with no black bar at the bottom, wrist overlay centered
4. Position a watch dead-center under the on-screen wrist guide
5. Tap Capture
6. Navigate to `/wear/[id]`
7. Confirm the watch appears centered in the saved photo (not at the bottom edge)
8. Confirm no black bar appears in either the preview or the saved JPEG

**Expected:** Watch centered in saved photo; no black bar in preview or saved JPEG; wrist overlay aligns with the captured content.

**Why human:** Visual judgment is the acceptance criterion per D-08/D-09. No pixel-measurement tooling. Requires a real iPhone on iOS Safari because: (a) JSDOM cannot run `getUserMedia` or render video frames, (b) the black-bar bug was iOS-specific (stream resolution mismatch on real hardware), and (c) the WYSIWYG guarantee depends on `getBoundingClientRect()` returning layout-stable values in a real browser paint cycle.

**PASS criteria:** Watch visually centered under wrist guide in saved JPEG. No black bar.
**FAIL criteria:** Watch at bottom edge of saved JPEG, OR black bar visible in preview, OR preview is not square.

---

## Gaps Summary

No gaps found at code level. All 3 roadmap success criteria are VERIFIED by code inspection and math proof. The only remaining item is the iOS Safari visual UAT (D-08) which is owner-verified and was explicitly planned as a manual checkpoint (not a code gap).

The phase status is `human_needed` solely because SC-1 and SC-2 involve real-device visual confirmation that cannot be performed programmatically.

---

_Verified: 2026-05-05T21:05:00Z_
_Verifier: Claude (gsd-verifier)_
