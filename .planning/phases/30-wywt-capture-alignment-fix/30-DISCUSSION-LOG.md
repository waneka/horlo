# Phase 30: WYWT Capture Alignment Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 30-wywt-capture-alignment-fix
**Areas discussed:** Fix strategy, Saved-photo aspect, Verification approach, Out-of-scope re-confirm

---

## Fix Strategy

### Q1: Which fix strategy do you want for the alignment mismatch?

| Option | Description | Selected |
|--------|-------------|----------|
| Crop capture to preview (Recommended) | On capture, draw only the visible-on-screen video rect to canvas. Saved JPEG = exactly what user saw with overlay. WYSIWYG by construction. | ✓ |
| Crop preview to match capture | Force wrapper to a known aspect with object-contain (no letterbox). Wrapper bounds = stream bounds. Zero capture-side math, but user sees less of the camera feed. | |
| Reposition overlay | Compute the rendered video rect inside the wrapper and place SVG over only that sub-rect. Keeps full capture frame, but SVG ends up offset from wrapper center. | |
| You decide | Defer to Claude/research. | |

**User's choice:** Crop capture to preview (Recommended)
**Notes:** WYSIWYG mental model — wrapper rect IS the capture region.

### Q2: What rect defines the WYSIWYG capture region?

| Option | Description | Selected |
|--------|-------------|----------|
| Wrapper element rect (Recommended) | Capture the full bounding rect of the `<div>` wrapper (the same box the SVG covers via inset-0). SVG centerpoint maps to JPEG centerpoint by construction. | ✓ |
| SVG drawing rect (always 1:1) | Capture only the inscribed 1:1 square where the SVG actually draws. Photo always square; wrist always dead-center. Loses any wrapper area outside the 1:1 inscribed square. | |
| Visible video sub-rect (no letterbox) | Crop to ONLY the rendered video rect inside the wrapper — never any black gutter. Requires runtime measurement; SVG centerpoint may not equal video center. | |

**User's choice:** Wrapper element rect (Recommended)
**Notes:** Same box the SVG covers via inset-0; mapping is automatic.

### Q3: Address the black bar at the bottom of the preview?

| Option | Description | Selected |
|--------|-------------|----------|
| Eliminate it (Recommended) | Force wrapper to match the rendered video rect at capture time — no black gutter in preview, none in capture. Cleaner UX both ways. | ✓ |
| Keep WYSIWYG only | Don't touch the wrapper layout. Saved photo shows whatever was in the wrapper, including black bar. Zero layout work; alignment still mathematically correct. | |
| You decide | Defer to planner. | |

**User's choice:** Eliminate it (Recommended)
**Notes:** Bug report explicitly named the black bar — fixing the layout is part of the fix, not a side polish.

---

## Saved-Photo Aspect

### Q1: What aspect ratio should the saved JPEG be?

| Option | Description | Selected |
|--------|-------------|----------|
| Square 1:1 (Recommended) | Lock wrapper to aspect-square; matches Phase 15's getUserMedia request and existing tile/slide layouts. | ✓ |
| Native camera aspect | Keep whatever device delivers (4:3 or 16:9). Pro: more visual context. Con: rail/slide rendering has to handle variable aspect. | |
| Lock to wrist-guide region | Always crop to the 1:1 region the wrist guide drew in. Functionally same as Square 1:1. | |
| You decide | Defer to planner. | |

**User's choice:** Square 1:1 (Recommended)
**Notes:** Existing downstream rendering expects roughly-square photos.

### Q2: How should the 1:1 lock be enforced?

| Option | Description | Selected |
|--------|-------------|----------|
| Wrapper aspect-square + object-cover (Recommended) | Set wrapper to aspect-square; `<video>` with object-cover crops the rectangular stream to 1:1 visually. Capture canvas reads from the visible 1:1 wrapper rect. Stream-aspect-agnostic. | ✓ |
| Compute capture rect from stream dims | Leave wrapper natural, inscribe 1:1 capture rect mathematically. Pro: no CSS layout assumptions. Con: violates WYSIWYG (user sees more than saved photo). | |
| Tighten getUserMedia constraints | Use `exact: 1080` to force 1:1 stream. Many devices reject `exact:` — camera fails to open on iOS. Ruled out by Phase 15 pitfall discipline. | |

**User's choice:** Wrapper aspect-square + object-cover (Recommended)
**Notes:** Capture math reads from wrapper rect; getUserMedia stays `ideal:1080`.

---

## Verification Approach

### Q1: How should we verify alignment is correct?

| Option | Description | Selected |
|--------|-------------|----------|
| Math-test + iOS UAT (Recommended) | JSDOM unit test mathematically verifies SVG centerpoint → JPEG centerpoint within ±1px. Plus manual UAT on iOS Safari where the bug surfaced. | ✓ |
| Manual UAT only, single device | Just verify on iOS Safari. No unit test. Risk: regression on Android/desktop without test coverage. | |
| Math-test + multi-device UAT | Unit test plus manual UAT on iOS Safari + Android Chrome + desktop Chrome + desktop Safari. Most thorough, may be overkill. | |
| You decide | Defer to planner. | |

**User's choice:** Math-test + iOS UAT (Recommended)
**Notes:** JSDOM math covers cross-browser; iOS Safari is the device-specific gate.

### Q2: What's the iOS UAT acceptance criterion?

| Option | Description | Selected |
|--------|-------------|----------|
| Visual comparison overlay test (Recommended) | Take wear photo with watch under wrist guide; on /wear/[id], watch appears centered (not at bottom edge). Subjective but matches bug report. | ✓ |
| Pixel-measurement test | Open saved JPEG, measure watch centerpoint, compare to image center. Accept if within ±5%. More objective; needs a measurement tool. | |
| Side-by-side preview/photo screenshot | Screenshot preview just before capture, compare to saved photo. Watch should sit at same relative position. | |

**User's choice:** Visual comparison overlay test (Recommended)
**Notes:** Binary pass/fail visual judgment — simplest gate.

---

## Out-of-Scope Re-Confirm

### Q1: Locking the no-touch list. Which of these stay UNCHANGED in Phase 30?

| Option | Description | Selected |
|--------|-------------|----------|
| WristOverlaySvg geometry | viewBox=0 0 100 100; arm lines y=38/y=62; circles r=22/r=17 at (50,50); hands at 10:10; crown rect at (72,49). Per WYWT-22 explicit note. | ✓ |
| getUserMedia constraints | Keep facingMode: environment, width: ideal:1080, height: ideal:1080, audio:false. Phase 15 Pitfall 1 (T-15-01) preserved. | ✓ |
| stripAndResize pipeline | Keep src/lib/exif/strip.ts as-is: maxDim=1080, EXIF strip on every path. New cropped blob still pipes through the helper. | ✓ |
| ComposeStep gesture discipline | Keep handleTapCamera as gesture-context entrypoint with no awaits before getUserMedia. Phase 30 changes nothing in ComposeStep.tsx. | ✓ |

**User's choice:** All four (multiSelect)
**Notes:** User initially asked for clarification on each item; after explanation of what each is and why a planner might be tempted to drift into it, all four were locked as no-touch.

---

## Claude's Discretion

- **Tailwind 4 syntax for the wrapper aspect lock** — `aspect-square` vs `aspect-[1/1]` vs an inline style; planner picks based on existing aspect-* usage in the codebase.
- **Capture math implementation shape** — small helper in `CameraCaptureView.tsx` vs inlined in `handleCapture` vs shared util. The math itself is locked: with object-cover, `videoScale = max(wrapperW/streamW, wrapperH/streamH)`; mapping wrapper-coord rect back to stream coords uses `1/videoScale`.
- **Where wrapper measurement comes from** — `wrapperRef.current.getBoundingClientRect()` at capture time is simplest. Planner adds `ResizeObserver` or `loadedmetadata` listener if a layout flash needs avoiding.
- **Test breadth** — three stream sizes (1920×1080, 1280×720, 1080×1080) is the starting list; planner adds more if iOS-specific fixtures reveal edge cases.

## Deferred Ideas

- **WristOverlaySvg geometry redesign** (canonical 10:10, arm spacing) — owner-deferred (user). Future design pass.
- **Multi-device UAT matrix** (Android Chrome, desktop Chrome, desktop Safari) — relying on JSDOM math for cross-browser; revisit if regression is reported.
- **VRT baseline for saved photo** — adds infrastructure; revisit if alignment regresses post-ship.
- **Server-side photo cropping** — centralizes WYSIWYG guarantee but adds backend dependency for a client-only bug.
- **Non-1:1 saved-photo aspect** (e.g., 4:3) — would require downstream redesigns in WywtTile, WywtSlide, /wear/[id] hero.
