---
id: SEED-020
status: shipped
shipped_in: v8.3
shipped_at: 2026-06-23
priority: next
planted: 2026-06-22
planted_during: /gsd-explore session 2026-06-22 — operator request to add short videos to WYWT
trigger_when: NEXT — supersedes v9.0 Catalog Expansion as the next milestone target per operator decision 2026-06-22; gated only by the iOS MediaRecorder spike outcome
scope: medium (single phase, possibly two — capture + display + schema + storage)
related_phases:
  - SEED-012 (v6.0 Social Interaction) — WYWT post is the social surface video plugs into
  - SEED-013 (v7.0 Watch Photos) — wear-photos bucket + Storage path conventions established here
  - Phase 15 (WYWT photo flow) — direct extension of the photo capture path; either-or per post
---

# SEED-020: WYWT 3-Second Video Capture

## Problem

WYWT posts currently support one photo per wear event. The operator wants to extend this to allow a tiny video instead — specifically a ~3-second clip showing **a wrist rotation** (the case profile, lug shape, and dial reflection from different angles). Photo can't convey that motion; a 3s clip can, without becoming a vlog.

## Decisions locked during 2026-06-22 explore session

### D-01: Use case = wrist motion, not boomerang
The video captures a **linear** motion (slow wrist rotation across ~3 seconds). NOT a seamless loop. Boomerang-style ping-pong would feel wrong for this content — a rotation reversing on itself is unnatural. Implication: in the full-frame playback view we either accept a visible loop snap, or play once with a tap-to-replay control. Decision deferred to phase planning.

### D-02: Display = tap-to-enter full-frame; static poster in feed
The WYWT rail and activity feed render a **static poster frame** (with a play-icon overlay so users know it's a video). Tapping the tile navigates to `/wear/{id}` — the existing wear-event detail page — which **autoplays the video muted, looped, `playsinline`**. No autoplay in feed/rail; no "which tile is most-in-view" logic; no battery hit; no visual cacophony of multiple wrists rotating at once. Matches Horlo's existing quiet-feed vibe and is consistent with where photo posts already route.

### D-03: Either-or per post
One WYWT post is one photo OR one video, never both. Schema implication: a single `mediaType: 'photo' | 'video'` column on `wear_events`, not two parallel media columns.

### D-04: Hard 3-second cap
Tap-to-start recording, on-screen countdown, **auto-stop at exactly 3.0s**. Lower friction than hold-to-record, same outcome. Hard cap is enforced client-side (MediaRecorder `setTimeout(stop, 3000)`) and again server-side via file-size cap (a 3s 720p clip is ~1-2MB; cap accepts up to e.g. 4MB to absorb codec variance).

### D-05: Muted, no audio capture
Audio adds no value for a wrist rotation, doubles cost, and creates an entire moderation surface we don't want. `MediaRecorder` is configured with `audio: false`.

### D-06: WYWT-only initially; watch-detail-page carousel deferred
Phase scope: WYWT post → rail/feed → /wear/{id} full-frame view. Watch-detail-page carousel (`/w/[ref]`) renaming `wear_photos` to `wear_media` is **out of initial scope**. The detail page can continue showing only photo wears in its carousel until the operator decides to extend.

### D-07: Schema sketch (subject to phase planning)
- `wear_events` adds `media_type: 'photo' | 'video' NOT NULL DEFAULT 'photo'`
- `wear_events.photo_url` renamed to `media_path` (or kept as `photo_url` for backwards-compat with mediaType discriminator)
- `wear_events.poster_path` added — `NULL` for photos (poster is the photo itself); set for videos
- Storage bucket: reuse `wear-photos` initially with the path convention `{userId}/{wearEventId}.mp4` for video and `{userId}/{wearEventId}-poster.jpg` for the poster (mp4-only — iOS produces mp4, and iOS 26 + all major browsers play mp4 natively per Spike 001)
- Server probe (T-15-04 mitigation pattern from Phase 15) verifies BOTH paths exist before inserting when `mediaType === 'video'`
- Upload cap: ~5 MB (Spike 001 observed 3.6 MB for a 3s 720p portrait clip; 5 MB gives headroom)

### D-08: Poster frame default = 3/4 through clip
Default poster is the frame at `currentTime = video.duration * 0.75`. For a wrist rotation this captures the "completed angle" moment — most visually striking single frame. Avoids the boring start (0/4), the mid-rotation awkwardness (2/4), and the motion-blur risk at the last frame (4/4). User-pick scrubber UI deferred to v2 polish; MVP ships 3/4 default with no scrubber. (Operator decision 2026-06-22 from Spike 001 iteration 1.)

### D-09: Codec = H.264 mp4 only (no webm path needed)
Spike 001 confirmed iOS 26.6 Safari produces `video/mp4;codecs=avc1.42000a` (H.264 Baseline Profile) by default. Surprise finding: iOS 26 also now supports webm playback (`MediaRecorder.isTypeSupported('video/webm')` returns true) — but this is irrelevant for us. We ship mp4-from-iOS / mp4-or-webm-from-other-browsers and both play everywhere. Storage path standardizes on `.mp4` (the Recorder can be forced to mp4 on Chrome/Firefox via `mimeType: 'video/mp4'` if the browser supports it — Chrome 121+ does — with webm fallback only if mp4 unsupported; the resulting blob's actual `type` is what determines the upload extension).

## Open questions

### Resolved by Spike 001 (2026-06-22)

1. ✓ **iOS Safari MediaRecorder feasibility** — VALIDATED on iOS 26.6. Produces `video/mp4;codecs=avc1.42000a` (Baseline H.264). Autoplay-muted-loop+playsinline works inline (no fullscreen takeover).
2. ✓ **Poster frame extraction** — VALIDATED client-side via canvas. ~169 KB JPEG at 720×1280, quality 0.85. No server transcoding needed.
3. ✓ **Codec normalization** — Not needed. mp4 from iOS plays everywhere; iOS 26 now also plays webm if a non-iOS browser uploads it. See D-09.
7. ✓ **Poster frame selection** — Decision = 3/4 through clip (D-08). User-pick scrubber deferred to v2.

### Remaining for phase planning

4. **Edit/delete UX** — same flow as photos (replace, delete via WYWT detail view)? Probably yes; no new affordance.
5. **Tile play-icon overlay** — design token / asset for the "this is a video" indicator on rail/feed tiles.
6. **Detail-page loop behavior** — autoplay-muted-loop (accept the snap) vs play-once with tap-to-replay control. D-01's "linear motion" argues against a loop, but the user already opted into the detail view by tapping, so a loop is forgivable. Phase planning decision.
8. **(Spike 002 — optional)** Supabase Storage roundtrip — does the existing `wear-photos` bucket accept mp4 uploads from the browser, and does signed-URL playback honor `playsInline` on iOS? Phase 15's photo upload path already proves browser→Storage works; mp4 is just a different Content-Type. May skip and validate during execution.

## Why this is "next priority" (supersedes v9.0 Catalog Expansion)

Per operator decision 2026-06-22. Note `.planning/notes/wywt-video-supersedes-v9-priority-2026-06-22.md` captures the reprioritization context.

## Routing

- **Spike first** — iOS MediaRecorder feasibility (open questions 1–3 above). Throwaway code, 1-day timebox. Output: `SPIKE.md` with a yes/no/conditional verdict + recommended codec/mime/cap.
- **Then spec or plan** — if the spike passes, this seed is the input to `/gsd-spec-phase` or directly to `/gsd-mvp-phase` for the actual feature work.
- **Then implement** — likely a new milestone (v8.3 WYWT Video? final name TBD) or a single phase folded into a renamed milestone.
