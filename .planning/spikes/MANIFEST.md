# Spike Manifest

## Idea

Add 3-second wrist-rotation video capture to WYWT (worn-watch) posts. SEED-020 captures the design decisions; this manifest tracks the experiential validation work that de-risks the spec before any phase planning.

## Requirements

Locked decisions from SEED-020 carried into the build (do not contradict in spikes):

- Use case = wrist rotation (linear motion); NOT seamless loop / boomerang
- Display = static poster in feed/rail; tap to enter full-frame `/wear/{id}` that autoplays muted-looped with `playsinline`
- Hard 3-second cap, auto-stop, muted (`audio: false`)
- Either-or per post (one photo OR one video, never both)
- WYWT-only initially; watch-detail-page carousel deferred

## Spikes

| #   | Name                   | Type     | Validates                                                                                                | Verdict | Tags                                |
| --- | ---------------------- | -------- | -------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------- |
| 001 | mr-ios-capture         | standard | iOS Safari MediaRecorder can record a clean 3s mp4 + poster JPEG extractable client-side + inline playback works | ✓ VALIDATED (2026-06-22) | media-recorder, ios-safari, video, wywt |
| 002 | mr-roundtrip-supabase  | standard | Supabase Storage `wear-photos` accepts mp4 upload + signed-URL playback autoplay-muted-loops on iOS | OPTIONAL (Phase 15 photo upload pattern already proves browser→Storage works; mp4 is just a different Content-Type) | media-recorder, supabase-storage, video, wywt |
