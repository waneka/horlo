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

### 1. iOS Safari live capture — getUserMedia + 3s record + playsInline (VID-02, VID-04)
expected: On prod iPhone Safari, open `/` → tap "What are you wearing?" → pick a watch → tap "Record video" → grant camera → tap "Record 3s" → ring fills clockwise over ~3s → auto-stops at 3.0s → inline `<video>` preview plays muted-looped without fullscreen takeover → submit → `/wear/{id}` shows autoplay-muted-loop without fullscreen.
result: [pending]

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

## Pre-flight follow-ups (from 77-REVIEW.md)

These are NOT phase-blocking but will hit the UAT walker immediately on a non-owner video tile. Strongly recommend bundling a fix-pass before walking:

- **CR-01 (Critical):** Phase 11 storage RLS policy uses `split_part(storage.filename(name), '.', 1)` which cannot parse `{wearEventId}-poster.jpg` (returns `{wearEventId}-poster` — not a valid UUID). Non-owner viewers cannot SELECT posters → home-rail video tiles render `(catalog imageUrl) + VideoPlayBadge` (CR-03 manifestation); detail/lane shows "Video unavailable". Fix: new RLS migration that strips `-poster` suffix before the UUID cast. Operator-blocking (`supabase db push --linked`).
- **CR-03 (Critical):** WywtTile renders VideoPlayBadge unconditionally for `mediaType === 'video'` regardless of whether `signedPosterUrl` resolved. Fix: gate the badge on `signedPosterUrl != null` (or omit the badge entirely when the catalog fallback fires).
- **WR-05 (Warning):** Bucket `allowed_mime_types` strict-matches `'video/mp4'`. Client uploads with `contentType: mediaState.videoBlob.type` which is `'video/mp4;codecs=avc1'` on iOS — works by coincidence (Supabase storage parses the prefix). Android Chrome would 400. Fix: pass `contentType: 'video/mp4'` explicitly when the chosen MIME is mp4-family.
