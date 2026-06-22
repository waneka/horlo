---
spike: 001
name: mr-ios-capture
type: standard
validates: "Given iOS Safari 17+ on a real iPhone, when the user opens the spike page, taps record, and auto-stops at 3.0s, then a playable mp4 blob is produced AND a poster JPEG can be extracted client-side via canvas AND the blob plays inline (autoplay-muted-loop) directly from the in-page object URL"
verdict: PENDING
related: [SEED-020]
tags: [media-recorder, ios-safari, video, wywt]
---

# Spike 001: MediaRecorder iOS Safari Capture Feasibility

## What This Validates

**Given** iOS Safari 17+ on a real iPhone,
**when** the user opens `/spike-mr-capture`, taps "Start camera" (back camera), taps "Record 3s", and waits for auto-stop,
**then** a playable mp4 blob is produced AND a poster JPEG can be extracted client-side via canvas AND the blob plays inline (autoplay-muted-loop) directly from the in-page object URL.

Sub-validations (questions from SEED-020):

1. **Capture** — `MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')` true on iOS 17? What mimeType does the resulting blob report?
2. **Auto-stop** — `setTimeout(stop, 3000)` produces a clean ~3.0s blob (no truncation; `video.duration` ≈ 3.0)?
3. **Poster extraction** — `<canvas>` draw of a seeked frame to `image/jpeg` works on iOS Safari?
4. **Cross-browser playback** — (deferred to Spike 002 if 001 passes; but the "Download blob" affordance lets us spot-check by saving the iOS-recorded mp4 and opening it in Chrome desktop)
5. **Autoplay-muted-loop + playsinline** — inline playback works from the in-page object URL? (Signed URL from Supabase Storage is Spike 002.)
6. **File size** — what's the typical size of a 3s 720p clip? Informs the server-side upload cap.
7. **(Spike 002)** — Supabase upload path; deferred.

## Research

Knowledge as of 2026-01 cutoff (Sonnet 4.7); spike will empirically confirm on actual device.

| Question | Expected behavior | Risk |
|----------|------------------|------|
| iOS MR support | Supported since iOS 14.3; rock-solid on iOS 17 | Low |
| iOS codec | Produces `video/mp4;codecs=avc1` (H.264); webm not supported | Low |
| Auto-stop precision | `setTimeout` typically within 16-100ms; chunked-recording slop adds ≤1 frame | Low |
| Poster via canvas | `canvas.toBlob('image/jpeg')` + `video.currentTime` seek works iOS 14+ | Low |
| Autoplay-muted-loop+playsinline | iOS 17 honors muted+playsinline+autoplay; iOS 16 same | Low |
| File size 3s 720p H.264 | ~800KB–2.5MB depending on motion | N/A (informational) |

**Known iOS Safari gotchas to watch for in the spike:**
- `playsInline` attribute is REQUIRED for non-fullscreen playback on iOS
- `autoplay` requires `muted` — otherwise iOS blocks autoplay
- `getUserMedia` requires HTTPS — Vercel preview/prod URLs are fine; localhost-via-HTTP is not
- Front vs back camera selection: `facingMode: { ideal: 'environment' }` (not `exact:` — that fails on devices with only one camera)
- After `MediaRecorder.stop()`, the `ondataavailable` event may fire AFTER `onstop` in some Safari versions; chunks should be flushed in `onstop` only

## How to Run

1. Push to `main` (Vercel will deploy automatically — typically ~1 minute):
   ```
   git push origin main
   ```
2. On a real iPhone (Safari, iOS 17+), open the Vercel-deployed URL:
   ```
   https://<vercel-domain>/spike-mr-capture
   ```
   (The page is unauthenticated — anyone with the URL can use it.)
3. Tap "Start camera" → grant camera permission → confirm back camera is showing.
4. Tap "Record 3s" → hold the phone over a wrist with a watch → slowly rotate the wrist while the 3s timer counts down.
5. After auto-stop, the page shows:
   - Recorded clip playing in `<video autoplay muted loop playsinline controls>`
   - Extracted poster JPEG (from middle frame)
   - File size, mime type, duration
6. Tap "Copy all" on the forensic log and paste the result into this README's **Results** section (or the issue tracker, or the SPIKE.md — wherever's convenient).
7. Tap "Download blob" to save the mp4 for a cross-browser spot-check (open in Chrome desktop — does it play?).
8. Repeat on a second browser (e.g. Chrome on Android or Chrome desktop) to confirm fallback codec selection and that mp4 from iOS plays cross-browser.

## What to Expect

**If iOS MediaRecorder works as documented:**
- Capability probe shows: `mediaRecorder: true`, `getUserMedia: true`, `mp4: true`, `mp4H264: true` (on iOS; webm fields likely `false`).
- Recording auto-stops at ~3.0s ± 100ms.
- Playback section's `<video>` autoplays muted-looped without fullscreen takeover.
- Poster JPEG renders below the video, ~30–80KB.
- File size 800KB–2.5MB.

**If something fails, the forensic log will show:**
- `MediaRecorder is not defined` → unsupported browser (shouldn't happen on iOS 17, would happen on very old iOS)
- `getUserMedia failed: NotAllowedError` → user denied camera permission
- `recorder.start() / ondataavailable / onstop` event ordering anomalies → noted in log timestamps
- `canvas.toBlob returned null` → poster extraction failed (memory/permissions)
- Playback `<video>` blank or shows error → codec/container mismatch or autoplay policy

## Observability

Forensic log is built into the page. Every event carries:
- ISO timestamp
- Level (info/warn/error)
- Category tag (`probe`, `camera`, `record`, `poster`, `ui`)
- Message + structured `data` payload

"Copy all" button copies the full log to the clipboard for paste into this README.

## Investigation Trail

_To be filled in iteratively as the user reports findings from real-device testing._

### Iteration 1 — initial iPhone test (date: _____)

- Device / iOS version: _____
- Capability probe output: _____
- Recording test result: _____
- Playback test result: _____
- Poster extraction result: _____
- File size: _____
- Surprises / unexpected behavior: _____

### Iteration 2 (if needed) — _____

## Results

**Verdict:** PENDING (awaiting first iPhone test).

**Evidence:** (to be filled)

**Surprises:** (to be filled)

**Implications for the build:**
- If VALIDATED: proceed to Spike 002 (Supabase roundtrip) and from there to phase planning.
- If PARTIAL: document the conditional and adjust SEED-020's open questions.
- If INVALIDATED: pivot to native-camera-roll upload (`<input type="file" accept="video/*" capture="environment">`) and skip in-app MediaRecorder.

## Cleanup

After the spike concludes:
- Delete `src/app/spike-mr-capture/` (the entire directory)
- Keep this README + frontmatter verdict for posterity
- Add a note to SEED-020 referencing this spike's verdict
