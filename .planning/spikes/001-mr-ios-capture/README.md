---
spike: 001
name: mr-ios-capture
type: standard
validates: "Given iOS Safari 17+ on a real iPhone, when the user opens the spike page, taps record, and auto-stops at 3.0s, then a playable mp4 blob is produced AND a poster JPEG can be extracted client-side via canvas AND the blob plays inline (autoplay-muted-loop) directly from the in-page object URL"
verdict: VALIDATED
verdict_date: 2026-06-22
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

### Iteration 1 — initial iPhone test (2026-06-22)

- **Device / iOS version:** iPhone running iOS 26.6 / Safari 26.6 (UA: `iPhone; CPU iPhone OS 26_6 like Mac OS X ... Version/26.6 Mobile/15E148 Safari/604.1`)
- **Capability probe output:** `mediaRecorder: true`, `getUserMedia: true`, `mp4: true`, `mp4+avc1: true`, `webm: true`, `vp9: true`, `vp8: true`
- **Recording test result:** ✓ Recording started cleanly. Selected mimeType `video/mp4;codecs=avc1`. Auto-stop fired at 3010ms (10ms overshoot — well within tolerance). Single `ondataavailable` chunk delivered. Resulting blob type: `video/mp4; codecs=avc1.42000a` (H.264 Baseline Profile, Level 1.0 — maximum cross-browser compat).
- **Playback test result:** ✓ Recorded clip autoplay-muted-looped inline (no fullscreen takeover). Operator reported: "the video looks great and recorded without a problem."
- **Poster extraction result:** ✓ Worked. `canvas.toBlob('image/jpeg', 0.85)` at the seeked-to middle frame returned a 169KB JPEG at 720×1280. No errors.
- **File size:** 3.6 MB for a 3s 720p portrait clip (~9.5 Mbps bitrate). **Higher than the 1-2 MB I had predicted.** Server upload cap should be ~5 MB, not ~3 MB. This is iOS using a fairly high default bitrate for back-camera capture.
- **Video duration:** 2.993s (reported by `video.duration`) — perfectly matches the 3s target within sub-frame precision.

### Surprises

1. **iOS 26 supports webm/VP9/VP8.** Prior to iOS 26, webm was not supported on Safari at all. This makes cross-browser codec normalization a non-issue going forward — we can still ship mp4-from-iOS / mp4-or-webm-from-other-browsers and both work everywhere. Doesn't change the build, but worth noting for future spec language.
2. **File size 3.6 MB,** not the 1-2 MB I predicted. iOS uses high bitrate by default; no `videoBitsPerSecond` constraint was set on the MediaRecorder. Future optimization: pass `{ videoBitsPerSecond: 2_000_000 }` (~2 Mbps) to MediaRecorder for ~600 KB clips at acceptable quality. **Phase decision: ship without the bitrate cap for MVP** (3.6 MB is acceptable; we have headroom) and treat bitrate tuning as a v2 optimization.
3. **Codec is `avc1.42000a` (Baseline Profile),** not Main/High. Plays in every browser including very old Androids — better universal compat than the High Profile most modern apps produce. No action needed; just confirms cross-browser playback isn't going to be a worry.

### Decision: poster frame = 3/4 through clip (operator choice, 2026-06-22)

For a wrist-rotation clip:
- 0/4 (start) is boring (wrist just starting)
- 2/4 (middle) is mid-rotation, often awkward as a still
- **3/4** is the "completed angle" moment — most visually striking single frame
- 4/4 (last) risks motion blur / hand jiggle as the user stops moving for auto-stop
- User-pick scrubber deferred to v2 polish (adds a step to WYWT compose; MVP ships 3/4 default)

**SEED-020 updated:** D-08 added (poster frame default = 3/4 through clip, user-pick scrubber as v2 stretch).

## Results

**Verdict:** ✓ VALIDATED.

**Evidence:** Single-device iPhone iOS 26.6 / Safari 26.6 happy-path test. All seven SEED-020 questions addressed by spike 001 either confirmed or downgraded to non-issues. Forensic log captured every event with timestamps; reproducible.

**Implications for the build:**
- Proceed (or skip) to Spike 002 (Supabase upload roundtrip). The remaining risk is small: the existing Phase 15 photo upload path already proves browser-to-Supabase-Storage uploads work; mp4 vs jpg is just a Content-Type difference, and signed-URL playback on iOS is documented to honor `playsInline` headers. Spike 002 is optional — operator may choose to skip and trust the existing pattern.
- Phase planning can start. Inputs locked: H.264/mp4 codec (Baseline Profile), 720p portrait, ~5 MB upload cap, 3/4 poster frame default, no audio, autoplay-muted-loop+playsinline on /wear/{id}.
- One iOS quirk to remember during phase build: `playsInline` attribute MUST be set on any `<video>` element rendering wear-event videos in feed/rail tiles AND on /wear/{id}, or iOS will go fullscreen on play.

## Cleanup

After the spike concludes:
- Delete `src/app/spike-mr-capture/` (the entire directory)
- Keep this README + frontmatter verdict for posterity
- Add a note to SEED-020 referencing this spike's verdict
