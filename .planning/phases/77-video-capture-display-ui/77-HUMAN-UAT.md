---
status: partial
phase: 77-video-capture-display-ui
source: [77-VERIFICATION.md]
started: 2026-06-23
updated: 2026-06-23
---

## Current Test

[awaiting human testing — bundle into a single Vercel push + single iPhone Safari walk per `feedback_mobile_ui_verify_on_prod`]

## Tests

### 1. iOS Safari live capture — getUserMedia + 4s record + playsInline (VID-02, VID-04)
expected: On prod iPhone Safari, open `/` → tap "What are you wearing?" → pick a watch → tap "Record video" → grant camera → tap "Record 4s" → 40px ring overlay (top-left of camera, red dot centered) fills clockwise over ~4s → auto-stops at 4.0s → inline `<video>` preview plays muted-looped without fullscreen takeover → submit → `/wear/{id}` shows autoplay-muted-loop without fullscreen.
result: pass-with-followup-fix — first walk uncovered two design issues (low ring visibility on button + 3s too short). Resolved in commit `6cbd3dc4`: ring relocated to camera top-left as a 40px overlay with red dot centered inside; clip duration bumped to 4s; MediaRecorder bitrate set to 6 Mbps (~3 MB for 4s portrait-720p, comfortable margin under 5 MB cap). Re-walk required to confirm.

### 2. Tile poster + VideoPlayBadge visual weight across rail / lane / detail (VID-13, VID-14)
expected: After prod deploy, on a profile with at least one video wear, visit home rail and stories lane → confirm `<Play>` icon visually centered, backdrop visible on bright and dark posters, weight uniform across surface sizes.
result: [pending]

### 3. Stories lane: video loops until user swipes (VID-14, D-07)
expected: Open `/wears/{username}` with a video post → confirm video keeps looping; segmented progress lane does NOT advance to next slide on video loop completion.
result: [pending]

### 4. iOS Safari poster extraction (VID-05)
expected: After 3s record completes, the post-capture preview shows the recorded clip looping; submit proceeds → `/wear/{id}` displays poster behind the autoplaying video (poster visible briefly before video metadata loads).
result: [pending]

### 5. Either-or per post — CHECK constraint sanity (VID-06, defense-in-depth)
expected: Submit a wear via dev-tools network throttle / manual fetch with both mediaPath and photoUrl populated → confirm Server Action rejects OR DB CHECK fires.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

(none yet — populated as UAT progresses)

## Fix-pass shipped (commits 3474a781, 774d4f25)

The three pre-flight follow-ups from 77-REVIEW.md were bundled into a fix-pass before this UAT walk:

- **CR-01 (Critical):** New migration `20260623000000_phase77_storage_rls_poster_filename.sql` extends the Phase 11 `wear_photos_select_three_tier` policy with a `regexp_replace(filename, '-poster\.', '.')` step so the UUID cast succeeds for both `{uuid}.{ext}` and `{uuid}-poster.{ext}` filenames. **Requires `supabase db push --linked` post-merge — see `77-POST-DEPLOY.md`.** UAT items 1, 2, 4 below depend on this push landing.
- **CR-03 (Critical):** `WywtTile` now gates `<VideoPlayBadge />` on `signedPosterUrl != null`. The badge no longer renders over the catalog imageUrl fallback when the poster mint fails.
- **WR-05 (Warning):** `ComposeStep` strips the codec suffix from the upload `Content-Type` so Android Chrome's strict MIME parser accepts the upload (`video/mp4;codecs=avc1` → `video/mp4`).
