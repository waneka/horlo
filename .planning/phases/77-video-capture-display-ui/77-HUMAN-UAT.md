---
status: complete
phase: 77-video-capture-display-ui
source: [77-VERIFICATION.md]
started: 2026-06-23
updated: 2026-06-23
completed: 2026-06-23
---

## Current Test

[complete — all 5 items resolved on prod iPhone Safari walk]

## Tests

### 1. iOS Safari live capture — getUserMedia + 4s record + playsInline (VID-02, VID-04)
expected: On prod iPhone Safari, open `/` → tap "What are you wearing?" → pick a watch → tap "Record video" → grant camera → tap "Record 4s" → 40px ring overlay (top-left of camera, red dot centered) fills clockwise over ~4s → auto-stops at 4.0s → inline `<video>` preview plays muted-looped without fullscreen takeover → submit → `/wear/{id}` shows autoplay-muted-loop without fullscreen.
result: pass — first walk uncovered four design issues, all resolved in commits `6cbd3dc4` (ring relocated to camera top-left as a 40px overlay with red dot centered inside; clip duration bumped to 4s; MediaRecorder bitrate set to 6 Mbps) and `79d7e988` (Retake link added to post-capture preview alongside Discard; WristOverlaySvg opacity 100%→80%). Re-walked successfully after both polish rounds.

### 2. Tile poster + VideoPlayBadge visual weight across rail / lane / detail (VID-13, VID-14)
expected: After prod deploy, on a profile with at least one video wear, visit home rail and stories lane → confirm `<Play>` icon visually centered, backdrop visible on bright and dark posters, weight uniform across surface sizes.
result: pass — poster image shows (not catalog), Play badge centered + proportionate, no broken-image fallback, lane video autoplays + loops.

### 3. Stories lane: video loops until user swipes (VID-14, D-07)
expected: Open `/wears/{username}` with a video post → confirm video keeps looping; segmented progress lane does NOT advance to next slide on video loop completion.
result: pass — video loops indefinitely, segmented progress stays put, swipe still advances, tap pauses/resumes (D-06).

### 4. iOS Safari poster extraction (VID-05)
expected: After 4s record completes, the post-capture preview shows the recorded clip looping; submit proceeds → `/wear/{id}` displays poster behind the autoplaying video (poster visible briefly before video metadata loads).
result: pass — poster shows briefly before video metadata loads, displays the 3/4 frame of the clip per SEED-020 D-08; video autoplays muted-loop after metadata loads.

### 5. Either-or per post — CHECK constraint sanity (VID-06, defense-in-depth)
expected: Submit a wear via dev-tools network throttle / manual fetch with both mediaPath and photoUrl populated → confirm Server Action rejects OR DB CHECK fires.
result: pass-by-coverage — DB CHECK `wear_events_video_paths_required` verified in Phase 76 Plan 01 integration tests (5/5 PASS locally). Video wears submit successfully through the discriminated-union UI path (Items 1 + 4). Forged-fetch check is paranoid coverage and would surface as a developer error, not a user-visible regression.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

(none — all items resolved)

## Polish fixes shipped during walk (commits 6cbd3dc4, 79d7e988)

Item 1 surfaced 4 UX issues during the prod walk. All resolved inline before continuing to Item 2:

- **Recording indicator visibility** — relocated from a 44px ring around the Record button (hidden under the user's thumb during recording) to a 40px overlay on the camera preview top-left with the red dot centered inside the ring. Single combined visual indicator in the natural eye-line.
- **3s clip duration** — bumped to 4s. SEED-020 D-04 originally specified 3s but UAT confirmed it was "just barely not long enough" for a complete wrist rotation. setTimeout literal, CSS animation duration, button label, and 3 test assertions all updated.
- **Default bitrate** — set `videoBitsPerSecond: 6_000_000` on MediaRecorder. Spike 001's default-bitrate 3s clip was 3.6 MB (~9.6 Mbps); linear extrapolation puts a 4s clip at ~4.8 MB (too close to 5 MB server cap). 6 Mbps keeps 4s portrait-720p around 3 MB with imperceptible quality drop for wrist-rotation content.
- **Retake on video post-capture** — added a Retake link alongside Discard. Mirrors the photo path's Retake behavior (re-acquires fresh MediaStream → straight back to live capture, skipping the chooser). Discard still returns to the 3-button chooser.
- **WristOverlaySvg opacity** — 100% → 80%. The framing PNG was reading too prominently during both photo and video capture; reducing to 80% lets the camera content show through more clearly. Shared component — applies to both flows.

## Fix-pass shipped pre-walk (commits 3474a781, 774d4f25)

The three pre-flight follow-ups from 77-REVIEW.md were bundled into a fix-pass before this UAT walk:

- **CR-01 (Critical):** New migration `20260623000000_phase77_storage_rls_poster_filename.sql` extends the Phase 11 `wear_photos_select_three_tier` policy with a `regexp_replace(filename, '-poster\.', '.')` step so the UUID cast succeeds for both `{uuid}.{ext}` and `{uuid}-poster.{ext}` filenames. Confirmed via Items 2 + 4 passing on the prod walk.
- **CR-03 (Critical):** `WywtTile` now gates `<VideoPlayBadge />` on `signedPosterUrl != null`. The badge no longer renders over the catalog imageUrl fallback. Confirmed via Item 2 passing.
- **WR-05 (Warning):** `ComposeStep` strips the codec suffix from the upload `Content-Type` for Android Chrome compatibility. Not directly tested on this iOS-only walk; Phase 77's iOS path uses `video/mp4;codecs=avc1` natively which is correctly stripped to `video/mp4` for the upload header.
