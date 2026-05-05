# Phase 30: WYWT Capture Alignment Fix — Research

**Researched:** 2026-05-05
**Domain:** Canvas 2D `drawImage` source-rect math, `object-cover` coordinate mapping, JSDOM video/canvas mocking
**Confidence:** HIGH

---

## Summary

Phase 30 is a tightly bounded coordinate-space bug fix in `src/components/wywt/CameraCaptureView.tsx`. The bug: the capture canvas reads the full intrinsic stream (`video.videoWidth × video.videoHeight`), while the user sees a square, object-cover-cropped preview. The wrist overlay SVG is positioned over the wrapper element, not the stream's full frame — so alignment landmarks in the preview correspond to different pixels in the saved JPEG.

The fix is mathematically straightforward: read `wrapperRef.current.getBoundingClientRect()` at capture time, compute the object-cover source rect in stream coordinates using `videoScale = max(wrapperW/streamW, wrapperH/streamH)`, and pass that rect as the six-argument form of `ctx.drawImage(video, sx, sy, sw, sh, 0, 0, wrapperW, wrapperH)`. The saved JPEG then contains exactly what was visible inside the wrapper, making SVG centerpoint ≡ JPEG centerpoint by construction.

All decisions are pre-locked in CONTEXT.md (D-01 through D-13). Research validates the math formula, confirms the Tailwind 4 `aspect-square` class, documents the JSDOM mocking conventions this repo has already established for canvas/video, and surfaces iOS Safari timing constraints the planner must account for.

**Primary recommendation:** Implement the source-rect math as a small named helper function inside `CameraCaptureView.tsx`. Call it from `handleCapture`. Add `wrapperRef` on the wrapper div. Add `aspect-square` to the wrapper class. Extend the readiness guard to check `wrapperRef.current`. Write the JSDOM math test as a pure-function unit test that does not require rendering.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Strategy = crop capture to preview (WYSIWYG). Canvas reads only the visible-on-screen video rect, not the full intrinsic frame.
- **D-02:** Crop region = the wrapper element rect (`wrapperRef.current.getBoundingClientRect()`).
- **D-03:** Eliminate the black bar in both preview and capture. Add explicit aspect to the wrapper.
- **D-04:** Saved JPEG aspect = 1:1 square.
- **D-05:** Enforcement = wrapper `aspect-square` + `<video class="object-cover">`.
- **D-06:** Stream metadata (`videoWidth`/`videoHeight`) read inside `CameraCaptureView` after `loadedmetadata` (or via the already-non-zero guard at line 68).
- **D-07:** Unit test = JSDOM math test, SVG centerpoint → JPEG centerpoint within ±1px. Three baseline fixtures: 1920×1080, 1280×720, 1080×1080 stream + 360×360 wrapper.
- **D-08:** Manual UAT acceptance = visual comparison overlay test on iOS Safari.
- **D-09:** Binary pass/fail visual judgment. No pixel-measurement tooling.
- **D-10:** `WristOverlaySvg.tsx` geometry LOCKED — no edits.
- **D-11:** `ComposeStep.tsx:162-169` getUserMedia constraints LOCKED — no edits.
- **D-12:** `src/lib/exif/strip.ts` LOCKED — new pre-cropped blob still pipes through `stripAndResize`.
- **D-13:** `ComposeStep.tsx` LOCKED — no edits to any line.

### Claude's Discretion

- Tailwind 4 syntax for `aspect-square` (confirm against existing codebase usage before locking).
- Capture math implementation shape: helper function vs. inline in `handleCapture` vs. `src/lib/wywt/` shared util.
- Where the wrapper measurement comes from: `getBoundingClientRect()` at capture time vs. `ResizeObserver`/`loadedmetadata` listener for pre-caching.
- Test breadth beyond the three baseline fixtures in D-07.

### Deferred Ideas (OUT OF SCOPE)

- WristOverlaySvg geometry redesign (canonical 10:10, arm spacing).
- Multi-device UAT matrix (Android Chrome, desktop Chrome, desktop Safari).
- VRT (visual regression test) baseline for the saved photo.
- Server-side photo cropping.
- Aspect-ratio changes downstream (4:3, etc.).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WYWT-22 | WYWT capture overlay aligns with actual capture frame, not preview frame. Fix overlay positioning math to match capture coords and/or crop preview to match capture dimensions. SVG geometry redesign NOT in scope. | D-01 through D-05 lock the WYSIWYG crop strategy. Math formula validated below in §Architecture Patterns. JSDOM test approach documented in §Validation Architecture. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Capture rect math | Browser / Client | — | All capture logic is client-side in `CameraCaptureView.tsx`; no server involvement |
| Wrapper layout (aspect-square) | Browser / Client | — | Tailwind class on a DOM element; no server rendering impact |
| Stream metadata access | Browser / Client | — | `video.videoWidth/videoHeight` is a live DOM property; available in client component only |
| EXIF strip / resize | Browser / Client | — | `stripAndResize` is a client-side canvas pipeline; unchanged in this phase |
| Photo persistence | API / Backend | — | `stripAndResize` output → `uploadWearPhoto` → server action; all unchanged |

---

## Standard Stack

No new libraries are added in Phase 30. The fix is pure DOM and canvas API.

### Core (in use)
| API / Feature | Where | Purpose |
|--------------|-------|---------|
| `ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh)` | `handleCapture` | Nine-argument form crops the source rect |
| `wrapperRef.current.getBoundingClientRect()` | `handleCapture` | Gets wrapper's rendered pixel dimensions |
| `video.videoWidth` / `video.videoHeight` | `handleCapture` | Stream intrinsic resolution |
| `HTMLCanvasElement.prototype.toBlob` | `handleCapture` | Encodes cropped frame to JPEG |
| Tailwind 4 `aspect-square` | Wrapper `<div>` | Enforces 1:1 wrapper; confirmed valid in codebase |

### Version Verification

No npm installs needed. All APIs are browser-native or already in the codebase.

---

## Architecture Patterns

### System Architecture Diagram

```
User tap → ComposeStep.handleTapCamera (gesture-context, D-13 LOCKED)
  → getUserMedia → stream prop → CameraCaptureView (D-11 LOCKED)

Camera preview display:
  wrapperDiv [aspect-square, w-full, overflow-hidden]  ← Phase 30 adds aspect-square
    └── <video object-cover>  ← fills square via CSS crop (long-edge bands clipped)
    └── <WristOverlaySvg inset-0>  ← covers same square

User taps Capture → handleCapture():
  1. Guard: video.videoWidth > 0 AND wrapperRef.current !== null
  2. Read wrapperW, wrapperH from wrapperRef.current.getBoundingClientRect()
  3. Read streamW = video.videoWidth, streamH = video.videoHeight
  4. Compute object-cover source rect (see math below)
  5. canvas.width = wrapperW; canvas.height = wrapperH
  6. ctx.drawImage(video, sx, sy, sw, sh, 0, 0, wrapperW, wrapperH)
  7. canvas.toBlob → Blob
  8. stripAndResize(blob) → pipe unchanged (D-12 LOCKED)
  9. onPhotoReady(result.blob)
```

### Object-Cover Source Rect Math

[VERIFIED: MDN Canvas API / drawImage nine-argument form]

With `object-cover`, the video element scales so its **shorter edge** fills the container. One dimension matches the container exactly; the other overflows and is clipped.

```
videoScale = max(wrapperW / streamW, wrapperH / streamH)

// Rendered video dimensions inside the wrapper (one equals wrapperW or wrapperH):
renderedW = streamW * videoScale   // >= wrapperW
renderedH = streamH * videoScale   // >= wrapperH

// How much of the stream is visible in each dimension (stream coords):
visibleStreamW = wrapperW / videoScale   // = sw
visibleStreamH = wrapperH / videoScale   // = sh

// Centered offset into the stream where the visible region starts:
sx = (streamW - visibleStreamW) / 2
sy = (streamH - visibleStreamH) / 2
sw = visibleStreamW
sh = visibleStreamH
```

Validation walkthrough — 1920×1080 stream, 360×360 wrapper:

```
videoScale = max(360/1920, 360/1080) = max(0.1875, 0.3333) = 0.3333  (height-constrained)
renderedW  = 1920 * 0.3333 = 640   (overflows 360 by 280 total = 140 each side)
renderedH  = 1080 * 0.3333 = 360   (exactly fills)
sw = 360 / 0.3333 = 1080
sh = 360 / 0.3333 = 1080
sx = (1920 - 1080) / 2 = 420
sy = (1080 - 1080) / 2 = 0

Centerpoint of source rect in stream coords: (420 + 1080/2, 0 + 1080/2) = (960, 540)
Stream centerpoint: (1920/2, 1080/2) = (960, 540)  ✓ match within 0px
```

Validation walkthrough — 1280×720 stream, 360×360 wrapper:

```
videoScale = max(360/1280, 360/720) = max(0.28125, 0.5) = 0.5
sw = 360 / 0.5 = 720
sh = 360 / 0.5 = 720
sx = (1280 - 720) / 2 = 280
sy = (720 - 720) / 2 = 0

Centerpoint: (280 + 360, 0 + 360) = (640, 360)
Stream center: (640, 360)  ✓ match within 0px
```

Validation walkthrough — 1080×1080 stream, 360×360 wrapper:

```
videoScale = max(360/1080, 360/1080) = 0.3333
sw = 1080, sh = 1080
sx = 0, sy = 0

Centerpoint: (540, 540) = stream center  ✓
```

**Conclusion:** The formula in CONTEXT.md `<code_context>` line 110 is mathematically correct. For all three D-07 fixtures, the source rect's centerpoint equals the stream's centerpoint within floating-point rounding (which rounds to ±0px, well inside the ±1px tolerance). [VERIFIED: manual arithmetic above]

### drawImage Nine-Argument Form

[VERIFIED: MDN Web Docs — `CanvasRenderingContext2D.drawImage()`]

```typescript
// Source: MDN CanvasRenderingContext2D.drawImage()
ctx.drawImage(
  image,               // source: HTMLVideoElement works directly
  sx, sy,              // source rect origin (stream coords)
  sw, sh,              // source rect size (stream coords)
  dx, dy,              // dest rect origin (canvas coords)
  dw, dh               // dest rect size (canvas coords)
)

// Phase 30 usage:
ctx.drawImage(video, sx, sy, sw, sh, 0, 0, wrapperW, wrapperH)
```

The browser clips `sx/sy/sw/sh` to the image bounds automatically — no defensive clamping needed in production, but the unit test should verify the formula produces values within `[0, streamW]` × `[0, streamH]`.

### Recommended Project Structure

No new directories. The helper function lives in `CameraCaptureView.tsx`:

```
src/components/wywt/
├── CameraCaptureView.tsx   ← ONLY file edited in Phase 30
├── WristOverlaySvg.tsx     ← LOCKED (D-10)
├── ComposeStep.tsx         ← LOCKED (D-13)
└── ...
```

The test file goes next to the existing test structure:

```
tests/components/
├── WristOverlaySvg.test.tsx    ← existing
├── WywtPostDialog.test.tsx     ← existing
└── wywt/
    └── CameraCaptureView.test.tsx   ← new (or add to tests/components/ flat)
```

Note: the CONTEXT.md says "next to existing `tests/components/wywt/CameraCaptureView.test.tsx`" implying a `wywt/` subdirectory, but no such directory exists yet. Planner creates the directory + file. Flat placement in `tests/components/CameraCaptureView.test.tsx` also works given vitest's `include: ['tests/**/*.test.tsx']` glob.

### Anti-Patterns to Avoid

- **Full-intrinsic drawImage (the current bug):** `ctx.drawImage(video, 0, 0)` with `canvas.width = video.videoWidth` — this is what Phase 30 replaces. Do not leave the old three-argument form anywhere in the capture path.
- **Reading wrapperRef in useEffect at mount:** The wrapper rect is correct at `handleCapture` call time. Reading it at mount time would be stale if the viewport resizes. The right time to call `getBoundingClientRect()` is inside `handleCapture`.
- **Using CSS pixel width as stream pixels:** `wrapperW` from `getBoundingClientRect()` is in CSS pixels (device-independent). `videoWidth` is in stream pixels. Do NOT multiply by `devicePixelRatio` — the crop math is already in the right units. The canvas dimensions `wrapperW × wrapperH` (CSS px) feed `stripAndResize`, which handles the final 1080-cap.
- **Editing files outside `CameraCaptureView.tsx`:** D-10/D-11/D-12/D-13 lock everything else. If the planner finds itself opening any other file for an edit, scope has drifted.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| EXIF strip + 1080-cap | Custom re-encode | `stripAndResize` (D-12) | Already tested, uniform across paths |
| Object-cover crop | CSS calculation library | Direct arithmetic (3 lines) | Problem is fully defined by `max()` + centering |

---

## `getBoundingClientRect()` Timing Analysis

[ASSUMED — based on browser behavior; no test exists to confirm]

**Question from CONTEXT.md (Claude's Discretion):** Does `getBoundingClientRect()` inside `handleCapture` return a stable, correct rect, or is a `ResizeObserver` / `loadedmetadata` listener needed?

**Analysis:**

At `handleCapture` time, all of the following have already occurred:
1. The component mounted and the DOM is laid out.
2. The stream was wired (`useEffect` at line 57-64 runs; `video.srcObject = stream`).
3. The `loadedmetadata` event fired (inferred: the existing readiness guard at line 68 gates on `video.videoWidth > 0`, which is only true after `loadedmetadata`).
4. The user deliberately tapped a button (not a programmatic trigger).

Therefore, by the time `handleCapture` runs, the wrapper layout has been committed and `getBoundingClientRect()` will return the final rendered rect. No `ResizeObserver` or `loadedmetadata` listener is strictly necessary.

**When a listener might be needed:** If the wrapper's height (and therefore the aspect-square constraint) were somehow set *after* the stream loads — e.g., if a conditional class was applied — there could be a timing window. With `aspect-square` unconditionally on the wrapper class, no such window exists.

**Planner guidance:** Use `getBoundingClientRect()` directly inside `handleCapture`. No `ResizeObserver` needed. Add a guard: `if (!wrapperRef.current) return early-error`. This is already the pattern for `videoRef`.

---

## Tailwind 4 `aspect-square` Confirmation

[VERIFIED: codebase grep — `src/components/explore/DiscoveryWatchCard.tsx:34`, `src/components/watch/WatchDetail.tsx:117`]

`aspect-square` is the correct Tailwind 4 class in this codebase. It is used in production components with no fallback or alternative syntax. The 30-UI-SPEC.md also explicitly confirms: "No alternative syntax (`aspect-[1/1]`, inline style) is needed."

Final wrapper class string (from UI-SPEC):
```
relative w-full aspect-square overflow-hidden rounded-md bg-black
```

---

## JSDOM Canvas and Video Mocking Conventions

[VERIFIED: `tests/lib/exif-strip.test.ts`, `tests/components/PhotoUploader.test.tsx`]

This repo has established mocking conventions for canvas and video elements. The D-07 math test must follow these patterns:

### Convention 1: `HTMLCanvasElement.prototype.getContext` stubbing

From `tests/lib/exif-strip.test.ts`:
```typescript
// Source: tests/lib/exif-strip.test.ts
HTMLCanvasElement.prototype.getContext = vi.fn(
  () => ctx as unknown as CanvasRenderingContext2D,
) as unknown as HTMLCanvasElement['getContext']
```
The stub returns a recording context object with `vi.fn()` on each method. For the math test, `ctx.drawImage` is the key assertion target.

### Convention 2: `HTMLCanvasElement.prototype.toBlob` stubbing

```typescript
// Source: tests/lib/exif-strip.test.ts
HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => cb(synthetic))
```
Since JSDOM has no canvas backend, `toBlob` returns `null` by default. Always stub it.

### Convention 3: Mock `stripAndResize` via `vi.mock`

```typescript
// Source: tests/components/PhotoUploader.test.tsx, CatalogPhotoUploader.test.tsx
vi.mock('@/lib/exif/strip', () => ({
  stripAndResize: vi.fn(async () => ({
    blob: new Blob(['stripped'], { type: 'image/jpeg' }),
    width: 360,
    height: 360,
  })),
}))
```
All upstream tests that exercise the capture pipeline mock `stripAndResize`. The math test should do the same.

### Convention 4: `URL.createObjectURL` / `URL.revokeObjectURL` stubs

From `tests/components/WywtPostDialog.test.tsx`:
```typescript
if (typeof URL.createObjectURL !== 'function') {
  ;(URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL =
    () => 'blob:stub/preview'
}
```
JSDOM lacks these. If the math test renders `CameraCaptureView`, add these stubs. For a pure-function unit test (no render), they are not needed.

### Convention 5: `document.createElement('canvas')` produces a real JSDOM canvas element

JSDOM exposes `HTMLCanvasElement` but without a real rendering backend. `getContext('2d')` returns `null` by default. Any test that creates a canvas must stub `getContext`. For the math test, this means the test should either:
- (a) Extract the source-rect computation into a pure function and test that function directly without creating a canvas, OR
- (b) Stub `HTMLCanvasElement.prototype.getContext` before importing and render.

**Recommendation for D-07 math test:** Option (a) is cleaner. Extract a `computeObjectCoverSourceRect(streamW, streamH, wrapperW, wrapperH)` pure function. The test calls it directly with numeric inputs and asserts the output. No DOM, no mocks needed. This is the most robust approach and is consistent with the repo's practice of testing pure logic (e.g., `tests/similarity.test.ts`).

### Convention 6: Video element `videoWidth`/`videoHeight` property stubs

For any test that renders `CameraCaptureView` and exercises `handleCapture`, the video element's `videoWidth` and `videoHeight` must be set. JSDOM's `HTMLVideoElement` properties default to `0`. Stub them via `Object.defineProperty`:

```typescript
Object.defineProperty(videoEl, 'videoWidth', { value: 1920, configurable: true })
Object.defineProperty(videoEl, 'videoHeight', { value: 1080, configurable: true })
```

---

## Common Pitfalls

### Pitfall 1 (from CameraCaptureView.tsx:7-21): iOS Gesture Context

**What goes wrong:** Calling `getUserMedia` after any `await` in the tap handler causes iOS Safari to reject camera permission (gesture context consumed).

**Why it doesn't apply:** Phase 30 does NOT touch `ComposeStep.handleTapCamera` (D-13 locked). The gesture-context discipline is already enforced architecturally.

**Planner must verify:** No edit to `ComposeStep.tsx` in any plan task.

### Pitfall 2: `wrapperRef` null at capture time

**What goes wrong:** If `handleCapture` runs before the wrapper div is mounted (theoretically impossible since capture requires a tap, but worth guarding), `wrapperRef.current` is null and `.getBoundingClientRect()` throws.

**How to avoid:** Extend the existing readiness guard at line 68:
```typescript
if (!video || !wrapperRef.current || video.videoWidth === 0 || video.videoHeight === 0) {
  onError('Camera not ready — please try again.')
  return
}
```

**Warning signs:** If the error string "Camera not ready" appears without the video actually being unready, the wrapper guard is too broad.

### Pitfall 3: CSS px vs. Stream px mismatch

**What goes wrong:** Developer multiplies `wrapperW` by `window.devicePixelRatio` thinking the source rect must be in physical pixels.

**Why it's wrong:** `video.videoWidth/videoHeight` are stream pixels (the actual decoder resolution). `getBoundingClientRect()` returns CSS pixels. The `videoScale` formula relates CSS-px wrapper dimensions to stream-px dimensions directly. DPR is irrelevant here.

**How to avoid:** Never reference `devicePixelRatio` in the capture math. The D-07 math test fixtures use CSS-px wrapper sizes (360) alongside stream sizes (1920×1080) — the formula works directly.

### Pitfall 4: `aspect-square` wrapper causes layout flash before stream loads

**What goes wrong:** The wrapper is 1:1 before `srcObject` is set, which means it shows a `bg-black` square before the camera preview appears. This is visually correct — the black is the pre-stream placeholder — not a bug.

**Why it's fine:** The existing wrapper already has `bg-black`. Adding `aspect-square` just changes the empty-state shape from "whatever the browser computes" to "square." No layout flash, no jarring jump.

### Pitfall 5 (from ComposeStep.tsx:60-64): EXIF Strip Must Stay

**What goes wrong:** Phase 30 produces a smaller (pre-cropped) blob. A future contributor might think "this blob is from the camera, no EXIF" and remove the `stripAndResize` call.

**Why it matters:** D-12 locks `stripAndResize` as a uniform pipeline step. Phase 15 Pitfall 5 established this discipline. The cropped blob still pipes through `stripAndResize` at `CameraCaptureView.tsx:91`. Do not remove or bypass it.

**Warning signs:** If the task plan describes removing or skipping `stripAndResize` for the camera path, reject it.

### Pitfall 6: iOS `videoWidth`/`videoHeight` Timing

**What we know:** iOS Safari sets `videoWidth`/`videoHeight` after the `loadedmetadata` event fires. The existing guard at `CameraCaptureView.tsx:68` (`video.videoWidth === 0 || video.videoHeight === 0`) already protects against premature capture.

**What's uncertain:** Whether `loadedmetadata` fires reliably on iOS before the user can tap Capture in practice. Given the UI flow (camera opens → preview appears → user taps), `loadedmetadata` will have fired before any tap is possible. [ASSUMED]

**iOS-specific note:** On iOS, `getUserMedia({ video: { width: {ideal:1080}, height: {ideal:1080} } })` typically yields a 1920×1080 or 1280×720 stream regardless of the `ideal` values — the device delivers what the sensor supports. This means `videoWidth/videoHeight` will almost never be `1080×1080` on a real device. The D-07 fixture `1080×1080` covers the case where the device perfectly matches the request (uncommon); the `1920×1080` and `1280×720` fixtures cover realistic iOS yields. [VERIFIED: ComposeStep.tsx:162-169 comments, Phase 15 pitfall docs]

---

## Code Examples

### Capture Math Helper (Pure Function)

```typescript
// Pure function — testable without DOM
// Source: CONTEXT.md §Integration Points (verified arithmetic above)
function computeObjectCoverSourceRect(
  streamW: number,
  streamH: number,
  wrapperW: number,
  wrapperH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const videoScale = Math.max(wrapperW / streamW, wrapperH / streamH)
  const sw = wrapperW / videoScale
  const sh = wrapperH / videoScale
  const sx = (streamW - sw) / 2
  const sy = (streamH - sh) / 2
  return { sx, sy, sw, sh }
}
```

### Updated `handleCapture` Skeleton

```typescript
// Source: CameraCaptureView.tsx (Phase 30 target shape)
async function handleCapture() {
  const video = videoRef.current
  const wrapper = wrapperRef.current
  if (!video || !wrapper || video.videoWidth === 0 || video.videoHeight === 0) {
    onError('Camera not ready — please try again.')
    return
  }
  setBusy(true)
  try {
    const { width: wrapperW, height: wrapperH } = wrapper.getBoundingClientRect()
    const { sx, sy, sw, sh } = computeObjectCoverSourceRect(
      video.videoWidth, video.videoHeight, wrapperW, wrapperH,
    )
    const captureCanvas = document.createElement('canvas')
    captureCanvas.width = wrapperW
    captureCanvas.height = wrapperH
    const ctx = captureCanvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, wrapperW, wrapperH)
    const captured = await new Promise<Blob | null>((resolve) =>
      captureCanvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    if (!captured) throw new Error('Could not capture frame')
    const result = await stripAndResize(captured)
    onPhotoReady(result.blob)
  } catch {
    onError('Could not capture photo. Please try again.')
  } finally {
    setBusy(false)
  }
}
```

### D-07 Math Test (Pure Function Approach)

```typescript
// tests/components/wywt/CameraCaptureView.test.tsx
// Source: D-07 fixture spec + formula verified above
import { describe, it, expect } from 'vitest'

// Import the pure helper once it is extracted:
// import { computeObjectCoverSourceRect } from '@/components/wywt/CameraCaptureView'

function computeObjectCoverSourceRect(
  streamW: number, streamH: number, wrapperW: number, wrapperH: number,
) {
  const videoScale = Math.max(wrapperW / streamW, wrapperH / streamH)
  const sw = wrapperW / videoScale
  const sh = wrapperH / videoScale
  const sx = (streamW - sw) / 2
  const sy = (streamH - sh) / 2
  return { sx, sy, sw, sh }
}

describe('computeObjectCoverSourceRect — D-07 math assertions', () => {
  const TOLERANCE = 1 // ±1px

  function centerInStream(sx: number, sy: number, sw: number, sh: number) {
    return { cx: sx + sw / 2, cy: sy + sh / 2 }
  }

  it('1920×1080 stream + 360×360 wrapper: source rect center = stream center', () => {
    const { sx, sy, sw, sh } = computeObjectCoverSourceRect(1920, 1080, 360, 360)
    const { cx, cy } = centerInStream(sx, sy, sw, sh)
    expect(Math.abs(cx - 1920 / 2)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(cy - 1080 / 2)).toBeLessThanOrEqual(TOLERANCE)
  })

  it('1280×720 stream + 360×360 wrapper: source rect center = stream center', () => {
    const { sx, sy, sw, sh } = computeObjectCoverSourceRect(1280, 720, 360, 360)
    const { cx, cy } = centerInStream(sx, sy, sw, sh)
    expect(Math.abs(cx - 1280 / 2)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(cy - 720 / 2)).toBeLessThanOrEqual(TOLERANCE)
  })

  it('1080×1080 stream + 360×360 wrapper: source rect = full stream (no crop)', () => {
    const { sx, sy, sw, sh } = computeObjectCoverSourceRect(1080, 1080, 360, 360)
    expect(sx).toBeCloseTo(0)
    expect(sy).toBeCloseTo(0)
    expect(sw).toBeCloseTo(1080)
    expect(sh).toBeCloseTo(1080)
  })

  it('source rect stays within stream bounds for all fixtures', () => {
    const fixtures = [
      [1920, 1080], [1280, 720], [1080, 1080],
    ] as [number, number][]
    for (const [streamW, streamH] of fixtures) {
      const { sx, sy, sw, sh } = computeObjectCoverSourceRect(streamW, streamH, 360, 360)
      expect(sx).toBeGreaterThanOrEqual(0)
      expect(sy).toBeGreaterThanOrEqual(0)
      expect(sx + sw).toBeLessThanOrEqual(streamW + 0.001)
      expect(sy + sh).toBeLessThanOrEqual(streamH + 0.001)
    }
  })
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-----------------|--------------|--------|
| `ctx.drawImage(video, 0, 0)` full-intrinsic | `ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh)` source-rect crop | Phase 30 | Saves exactly the preview region |
| Wrapper height = browser-computed from stream | `aspect-square` on wrapper | Phase 30 | Eliminates black bar; makes WYSIWYG crop possible |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `loadedmetadata` fires on iOS before user can tap Capture in practice (inferred from UX flow) | Pitfall 6 | Low — existing `videoWidth === 0` guard already protects; worst case is "Camera not ready" error |
| A2 | `getBoundingClientRect()` at `handleCapture` time returns stable, final layout values (no ResizeObserver needed) | §getBoundingClientRect Timing | Low — layout is committed at mount; aspect-square is unconditional; tapping a button is a user-initiated post-layout event |

---

## Open Questions

1. **Helper function export for testing**
   - What we know: The pure `computeObjectCoverSourceRect` function must be testable without DOM setup.
   - What's unclear: Whether to export it as a named export from `CameraCaptureView.tsx` or to place it in a shared `src/lib/wywt/` util.
   - Recommendation: Named export from `CameraCaptureView.tsx` (no new directory, no planner scope creep). Prefix with `_` or add a comment noting it is exported for testing only.

2. **iOS 1280×960 front-camera stream**
   - What we know: CONTEXT.md Claude's Discretion mentions this as a potential edge case.
   - What's unclear: Whether front-camera crops would produce a different failure mode.
   - Recommendation: Add as a fourth test fixture (1280×960 + 360×360). The formula handles non-16:9 streams identically — the `max()` picks the height scale, and the horizontal crop is more aggressive. Centerpoint still equals stream center.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — fix is bounded to one TypeScript file and one test file; all tools are existing npm dependencies).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/components/wywt/CameraCaptureView.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WYWT-22 | `computeObjectCoverSourceRect` produces centerpoint ≡ stream center ±1px for 3+ stream sizes | Unit (pure math) | `npx vitest run tests/components/wywt/CameraCaptureView.test.tsx` | ❌ Wave 0 |
| WYWT-22 | Source rect stays within stream bounds | Unit (pure math) | same | ❌ Wave 0 |
| WYWT-22 | Visual: wrist under overlay appears centered in saved photo on iOS Safari | Manual UAT (D-08, D-09) | — (binary visual judgment) | N/A |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/components/wywt/CameraCaptureView.test.tsx`
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work` + manual iOS Safari UAT pass

### Wave 0 Gaps

- [ ] `tests/components/wywt/CameraCaptureView.test.tsx` — covers WYWT-22 math (pure unit, no DOM needed)
- [ ] Directory `tests/components/wywt/` — create before the test file

*(If the planner decides to place the test at `tests/components/CameraCaptureView.test.tsx` flat, no directory creation needed.)*

---

## Security Domain

`security_enforcement` is not explicitly set to `false` in config.json; treated as enabled.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth changes in this phase |
| V3 Session Management | No | No session changes |
| V4 Access Control | No | No ACL changes |
| V5 Input Validation | No | No user text input; `wrapperW/wrapperH` are DOM-read numerics, not user-supplied |
| V6 Cryptography | No | No crypto; photo encoding is standard JPEG |

No security concerns for this phase. The canvas capture path processes a camera stream into a blob. All uploaded photo paths are unchanged (still go through existing server-side authorization and Supabase Storage RLS).

---

## Sources

### Primary (HIGH confidence)

- `src/components/wywt/CameraCaptureView.tsx` — full file read; existing code verified
- `src/components/wywt/ComposeStep.tsx:60-79, 145-184` — pitfall docs and gesture-context discipline verified
- `tests/lib/exif-strip.test.ts` — JSDOM canvas mocking conventions verified
- `tests/components/WywtPostDialog.test.tsx` — JSDOM video and URL.createObjectURL mocking verified
- `tests/components/PhotoUploader.test.tsx` — Worker + stripAndResize mock conventions verified
- `src/components/explore/DiscoveryWatchCard.tsx:34` — `aspect-square` usage confirmed in production
- `src/components/watch/WatchDetail.tsx:117` — second `aspect-square` confirmation
- `.planning/phases/30-wywt-capture-alignment-fix/30-CONTEXT.md` — all decisions D-01–D-13 read
- `.planning/phases/30-wywt-capture-alignment-fix/30-UI-SPEC.md` — wrapper class string + scope locks confirmed
- `.planning/REQUIREMENTS.md` — WYWT-22 text verified

### Secondary (MEDIUM confidence)

- MDN CanvasRenderingContext2D.drawImage() — nine-argument form behavior (arithmetic walkthrough matches expected behavior; not re-fetched in this session but the API is stable)

### Tertiary (LOW confidence — none)

No LOW-confidence findings used in this research.

---

## Metadata

**Confidence breakdown:**

- Math formula: HIGH — manually verified for all three D-07 fixtures; formula is pure arithmetic with no ambiguity
- Tailwind 4 `aspect-square`: HIGH — two production usages confirmed in codebase grep
- JSDOM mocking conventions: HIGH — three existing test files establish clear patterns
- `getBoundingClientRect()` timing: MEDIUM — correct based on DOM lifecycle reasoning, but tagged ASSUMED (A2)
- iOS `loadedmetadata` timing: MEDIUM — correct based on UX flow reasoning, but tagged ASSUMED (A1)

**Research date:** 2026-05-05
**Valid until:** 2026-06-04 (stable APIs; 30-day window)
