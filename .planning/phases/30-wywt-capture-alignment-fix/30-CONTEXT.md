# Phase 30: WYWT Capture Alignment Fix - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the coordinate-space mismatch between the WYWT camera **preview** (what the user sees on screen with the WristOverlaySvg overlay) and the **capture frame** (the JPEG written to `wear_events.photo_url`). Today, the SVG is positioned over the wrapper bounds while the capture canvas reads the full intrinsic stream — so the SVG centerpoint in the DOM does not correspond to the same pixel in the saved photo. Symptom: the user reports a black bar at the bottom of the preview that the capture does not include; a wrist aligned with the on-screen guide ends up at the bottom of the saved JPEG instead of centered.

The fix is bounded to **capture math + wrapper layout** in `src/components/wywt/CameraCaptureView.tsx`. The SVG geometry, the camera-request constraints in `ComposeStep.tsx`, the gesture-context discipline (Pitfall 1 / T-15-01), and the EXIF-strip/resize pipeline are all explicitly NOT in scope.

**In scope:**
- Make the saved JPEG's pixel coordinates equal what the user sees through the wrapper element. Implementation = WYSIWYG crop at capture time: the canvas reads only the rect that corresponds to the wrapper's bounding box, mapped into stream coordinates.
- Lock the saved photo to a 1:1 (square) aspect ratio. Enforced by setting the wrapper to `aspect-square` with `object-cover` on `<video>` so the visible preview is itself a 1:1 crop of whatever the device delivers (typically 1920×1080 or 1280×720 even when we requested 1080×1080).
- Eliminate the black bar at the bottom of the preview. Wrapper is sized so its rendered rect equals the visible video rect — no letterbox, no pillarbox, no gutter — so WYSIWYG capture doesn't bake a black band into the JPEG.
- Unit test the capture rect math in JSDOM: given a mock video (e.g., 1920×1080 stream, wrapper 360×360), assert the SVG centerpoint maps to the JPEG centerpoint within ±1px.
- Manual UAT on iOS Safari (where the bug surfaced) using the visual comparison overlay test: take a wear photo with a watch sitting under the wrist guide; on `/wear/[id]`, the watch must appear centered in the saved photo, not at the bottom edge.

**Out of scope:**
- WristOverlaySvg internal geometry — `viewBox=0 0 100 100`, arm lines at y=38/y=62, watch circles r=22/r=17 at (50,50), hands at 10:10, crown rect at (72,49). Per WYWT-22 explicit note + roadmap success criterion #3, the canonical 10:10 + arm spacing redesign is owner-deferred.
- `getUserMedia` constraints in `ComposeStep.tsx:162` — keep `facingMode: 'environment'`, `width: { ideal: 1080 }`, `height: { ideal: 1080 }`, `audio: false`. No tightening to `exact:` (iOS NotAllowedError regression risk; Phase 15 pitfall).
- The `stripAndResize` pipeline in `src/lib/exif/strip.ts` — `maxDim=1080`, EXIF-strip-on-every-path discipline preserved. The new pre-cropped blob from this phase still pipes through the existing helper unchanged.
- `ComposeStep.tsx` — gesture-context discipline (`getUserMedia` as the FIRST await after the user tap) is unchanged. No edits to `handleTapCamera` or anything in `ComposeStep`. Stream metadata can be read from `videoRef.current.videoWidth/videoHeight` inside `CameraCaptureView` after `loadedmetadata`.
- Multi-device UAT (Android Chrome, desktop Chrome, desktop Safari) — iOS Safari only is the acceptance gate; cross-browser regression coverage relies on the JSDOM math test.
- VRT (visual regression test) baselines, server-side cropping, or any change to how `/wear/[id]`, the WYWT rail, or the WYWT overlay slide render the saved photo.

</domain>

<decisions>
## Implementation Decisions

### Fix Strategy

- **D-01:** Strategy = **crop capture to preview** (WYSIWYG). On capture, draw only the visible-on-screen video rect to the canvas, not the full intrinsic `video.videoWidth × video.videoHeight` frame. The saved JPEG is exactly what the user saw with the overlay, so the SVG centerpoint maps to the JPEG centerpoint by construction. Alternatives ruled out: cropping the preview to the stream (forces a different visual experience, more invasive); repositioning the overlay over the visible video sub-rect only (overlay stops being centered if there's any letterbox — visually weird).
- **D-02:** Crop region = **the wrapper element rect** (the `<div class="relative w-full overflow-hidden rounded-md bg-black">` at `CameraCaptureView.tsx:106` — the same box the SVG covers via `inset-0`). The capture canvas dimensions and the source rect drawn onto it are derived from `wrapperRef.current.getBoundingClientRect()` mapped into stream coordinates using the `object-cover` crop math (sx/sy/sw/sh on `ctx.drawImage`). Alternative ruled out: the SVG drawing rect (the inscribed 1:1 square under `xMidYMid meet`) — functionally identical to D-04 below once the wrapper is square, but conceptually less intuitive than "what the user can see in the preview box."
- **D-03:** Eliminate the black bar in both preview and capture. The wrapper today has no fixed aspect or height, so `<video class="block w-full">` resolves to whatever the browser computes from the stream's intrinsic ratio — and on iOS that produces the gutter the user reported. Phase 30 sets an explicit aspect on the wrapper so its rendered rect equals the visible video rect. With D-04 below this becomes `aspect-square`.

### Saved-Photo Aspect

- **D-04:** Saved JPEG aspect = **1:1 square**. Matches the intent of Phase 15's `getUserMedia({ width: { ideal: 1080 }, height: { ideal: 1080 } })` request. Existing tile (`WywtTile`), slide (`WywtSlide`), and `/wear/[id]` hero render paths already assume a roughly square crop — locking 1:1 keeps downstream rendering simple.
- **D-05:** Enforcement technique = **wrapper `aspect-square` + `<video class="object-cover">`**. The wrapper class adds `aspect-square` (or equivalent — planner picks Tailwind 4 syntax). `object-cover` on the video element crops the rectangular stream (typical iOS yield: 1920×1080 or 1280×720) to fill the 1:1 wrapper — discarding the long-edge bands visually. Capture canvas reads from the visible 1:1 wrapper rect using the `object-cover` crop math. `getUserMedia` constraints stay `ideal:1080`; we do NOT tighten to `exact:` (Phase 15 pitfall — iOS rejects `exact:` and the camera fails to open).
- **D-06:** Stream metadata is read inside `CameraCaptureView` after the `loadedmetadata` event (or via `videoRef.current.videoWidth/videoHeight` once it's non-zero). The capture math depends on knowing both the wrapper's rendered size (DOM) and the stream's intrinsic size (video element) at capture time. The existing readiness guard at `CameraCaptureView.tsx:68` (`video.videoWidth === 0 || video.videoHeight === 0`) already covers this; planner extends it with the wrapper measurement.

### Verification

- **D-07:** Unit test = **JSDOM math test** asserting SVG centerpoint → JPEG centerpoint mapping within ±1px. Test fixture: mock a video element with `videoWidth=1920`, `videoHeight=1080`, and a wrapper rect of 360×360. Compute the capture source rect using the production math; assert the centerpoint of that source rect equals (videoWidth/2, videoHeight/2) within ±1px. Cover at least: 1920×1080 stream + square wrapper, 1280×720 stream + square wrapper, 1080×1080 stream + square wrapper. Test file lives next to existing `tests/components/wywt/CameraCaptureView.test.tsx` (planner extends or adds a sibling).
- **D-08:** Manual UAT acceptance = **visual comparison overlay test on iOS Safari**. Take a wear photo on iPhone with a watch positioned so it sits dead-center under the on-screen wrist guide. Open `/wear/[id]`. Pass criterion: the watch appears visually centered in the saved photo, not at the bottom edge. Subjective but matches the bug report. iOS Safari only — cross-browser coverage relies on D-07's math test.
- **D-09:** Acceptance is binary (pass/fail visual judgment). No pixel-measurement tooling, no side-by-side preview/photo screenshot ritual. If the wrist visibly lands where the overlay said, alignment is fixed.

### Out of Scope (Confirmed No-Touch List)

- **D-10:** **WristOverlaySvg geometry is locked.** `src/components/wywt/WristOverlaySvg.tsx` lines 36–52 (the `<line>`, `<circle>`, `<rect>` elements + their viewBox coordinates) MUST NOT change in this phase. WYWT-22 explicit note + roadmap success criterion #3.
- **D-11:** **`getUserMedia` constraints are locked.** `ComposeStep.tsx:162-169` MUST NOT change. Don't tighten `ideal:1080` to `exact:1080`. Phase 15 Pitfall 1 (T-15-01) preserved.
- **D-12:** **`stripAndResize` pipeline is locked.** `src/lib/exif/strip.ts` is unchanged; `CameraCaptureView.tsx:91` still pipes the (now pre-cropped) blob through `stripAndResize(captured)` at `maxDim=1080`. Phase 15 D-10 + Pitfall 5 preserved.
- **D-13:** **`ComposeStep.tsx` is unchanged.** No edits to `handleTapCamera` or the surrounding gesture-context machinery. The fix is bounded to `CameraCaptureView.tsx` (capture math + wrapper layout classes).

### Claude's Discretion

- **Tailwind 4 syntax for the wrapper aspect lock (D-05).** `aspect-square` is the obvious choice but if Tailwind 4's class generation differs from v3 in this codebase, planner picks the equivalent (`aspect-[1/1]`, an arbitrary aspect-ratio utility, or inline style). Confirm against existing aspect-* usage in the codebase before locking.
- **Capture math implementation shape (D-01, D-02, D-05).** Planner picks how to express the source-rect math: a small helper function in `CameraCaptureView.tsx` (probably the cleanest), inlined in `handleCapture`, or a shared util in `src/lib/wywt/` if reuse is plausible. The math itself: with `object-cover`, `videoScale = max(wrapperW / streamW, wrapperH / streamH)`; the rendered video rect inside the wrapper has width `streamW * videoScale` and is centered; mapping a wrapper-coord rect back to stream coords uses `1 / videoScale`. Planner verifies and tests this.
- **Where the wrapper measurement comes from (D-03, D-06).** `wrapperRef.current.getBoundingClientRect()` at capture time is the simplest answer. If a `ResizeObserver` or `loadedmetadata` listener turns out to be needed (e.g., to set the aspect-square explicitly only after the stream is ready, to avoid a layout flash), planner adds it. Goal: at the moment `handleCapture` runs, the wrapper rect and the stream's intrinsic dimensions are both known and stable.
- **Test breadth in D-07.** Three stream sizes is a starting list; planner adds more if specific iOS fixtures (e.g., 1280×960 — iPhone front camera) reveal an edge case. Skip gigantic permutation matrices — the math is uniform.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/REQUIREMENTS.md` §"WYWT Capture (Phase 15 follow-up)" — WYWT-22 locked requirement (overlay aligns with capture frame, not preview frame; SVG geometry redesign explicitly out of scope)
- `.planning/ROADMAP.md` §"Phase 30: WYWT Capture Alignment Fix" — goal + 3 success criteria. Criterion #3 explicitly carves out SVG geometry as out of scope.
- `.planning/PROJECT.md` — current product context (v4.1 Polish & Patch milestone)
- `.planning/STATE.md` — milestone status

### Primary edit site (capture math + wrapper layout)
- `src/components/wywt/CameraCaptureView.tsx` — the only source file edited in this phase. Lines 100–116 are the wrapper + video + overlay JSX that needs the layout change (aspect-square wrapper, ref on the wrapper). Lines 66–98 (`handleCapture`) are where the canvas math changes from full-intrinsic to wrapper-rect-mapped. Existing readiness guard at line 68 stays.

### Read-only references (must NOT be edited in Phase 30)
- `src/components/wywt/WristOverlaySvg.tsx` — pure SVG. Geometry locked (D-10). Read to understand `viewBox=0 0 100 100` + `preserveAspectRatio="xMidYMid meet"` behavior; do not edit.
- `src/components/wywt/ComposeStep.tsx` — `handleTapCamera` (line 157), `getUserMedia` call (line 162), camera stream lifecycle (line 170 setCameraStream, line 187 cleanup). All locked (D-11, D-13). Read to understand the gesture-context contract; do not edit.
- `src/lib/exif/strip.ts` — `stripAndResize(blob, maxDim = 1080)`. Locked (D-12). The new cropped blob still pipes through this helper at line 91 of `CameraCaptureView.tsx`; do not edit the helper.

### Tests
- `tests/components/wywt/CameraCaptureView.test.tsx` (existing) — planner extends with the new capture-rect math tests per D-07 (or adds a sibling file). Three baseline cases: 1920×1080 + 360² wrapper, 1280×720 + 360² wrapper, 1080×1080 + 360² wrapper.

### Background (Phase 15 lineage)
- Phase 15 RESEARCH/CONTEXT files are archived under `.planning/milestones/v3.0-*` (no direct path active in `.planning/phases/`); Pitfalls 1, 2, 5 are summarized inline in `CameraCaptureView.tsx:7-21` and `ComposeStep.tsx:70-79, 145-156`. Read those inline comments to confirm what must not change.
- `src/components/home/WywtTile.tsx`, `src/components/home/WywtSlide.tsx`, `src/components/wywt/WywtPostDialog.tsx`, `src/app/wear/[wearEventId]/page.tsx` — downstream renderers of the saved photo. Read-only; no edits expected. Confirms a 1:1 saved JPEG slots into existing layouts without secondary work.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`stripAndResize` (`src/lib/exif/strip.ts`)** — already handles arbitrary input blobs with EXIF strip + 1080px resize. Phase 30's pre-cropped blob feeds directly into it; no changes needed.
- **`videoRef` + `videoWidth`/`videoHeight` readiness guard** at `CameraCaptureView.tsx:68` — already gates capture on stream readiness. Planner extends to also guard on wrapper-ref availability.
- **`useEffect` stream wiring** at `CameraCaptureView.tsx:57-64` — already handles srcObject + cleanup. Phase 30 may add a `loadedmetadata` listener for wrapper sizing if needed (Claude's discretion).

### Established Patterns
- **MediaStream-as-prop discipline** (`CameraCaptureView.tsx:7-21` doc comment) — `CameraCaptureView` does NOT call `getUserMedia`; the parent's tap handler does. This pattern is preserved; Phase 30 only changes the capture canvas math, not the stream lifecycle.
- **EXIF-strip-on-every-path** (Phase 15 D-10 + Pitfall 5) — both upload and camera paths pipe through `stripAndResize`. Phase 30's cropped frame still goes through the same helper.
- **Pure-SVG overlay** (`WristOverlaySvg.tsx`) — drawing logic is presentational only; positioning is the parent's concern. Reinforced by Phase 30 (we change the overlay's container, never the SVG itself).
- **`<video class="block w-full object-cover">`** — established camera preview class shape; `object-cover` semantics drive the capture-side crop math.

### Integration Points
- **Wrapper rect ↔ stream rect mapping** — the new connection point. With `object-cover`, the visible video rect is computed as: `videoScale = max(wrapperW/streamW, wrapperH/streamH); visibleW = streamW * videoScale; visibleH = streamH * videoScale` (one of these equals wrapperW or wrapperH; the other is overflow that gets clipped). Source rect on the canvas: `sx = (streamW - wrapperW/videoScale) / 2`, `sy = (streamH - wrapperH/videoScale) / 2`, `sw = wrapperW/videoScale`, `sh = wrapperH/videoScale`. Capture canvas size = `wrapperW × wrapperH` (CSS px) — `stripAndResize` handles final dimensions.
- **Capture canvas → `stripAndResize` → `onPhotoReady`** — pipeline shape unchanged. The blob handed to `onPhotoReady` is now smaller (cropped) but still EXIF-stripped + 1080-capped.
- **`ComposeStep.tsx` ↔ `CameraCaptureView`** — prop contract (`stream`, `onPhotoReady`, `onError`, `onCancel`, `disabled`) unchanged. No upstream changes.

</code_context>

<specifics>
## Specific Ideas

- **WYSIWYG is the mental model.** Whatever's inside the wrapper rect at capture time = the saved JPEG. Don't introduce a separate "capture region" abstraction — the wrapper IS the capture region.
- **The black bar is the tell.** The user reported it explicitly. Eliminating it (D-03 + D-05) is part of the fix, not a side polish.
- **Square stays.** Phase 15 already requested 1:1; downstream renderers expect roughly-square photos. Do not introduce a rectangular saved-photo aspect just to "show more of the camera feed."
- **No edits outside `CameraCaptureView.tsx`.** Tight scope. If the planner finds themselves opening `ComposeStep.tsx` or `WristOverlaySvg.tsx`, they're drifting.

</specifics>

<deferred>
## Deferred Ideas

- **WristOverlaySvg geometry redesign** (canonical 10:10, arm spacing) — owner-deferred (the user). Tracked as a future design pass; not v4.1 scope.
- **Multi-device UAT matrix** (Android Chrome, desktop Chrome, desktop Safari) — Phase 30 explicitly relies on the JSDOM math test for cross-browser coverage. If a regression is reported on a non-iOS platform later, that's a follow-up phase or quick task, not Phase 30 scope.
- **VRT (visual regression test) baseline for the saved photo** — could catch future drift but adds infrastructure overhead. Not Phase 30 scope; revisit if alignment regresses post-ship.
- **Server-side photo cropping** — would centralize the WYSIWYG guarantee but introduces a backend dependency for a client-only bug. Not Phase 30 scope.
- **Aspect-ratio choice changes downstream** (e.g., 4:3 saved photos for more context) — would require redesigns in `WywtTile`, `WywtSlide`, and `/wear/[id]` hero. Not Phase 30 scope; revisit if the 1:1 lock causes user complaints.

</deferred>

---

*Phase: 30-wywt-capture-alignment-fix*
*Context gathered: 2026-05-05*
