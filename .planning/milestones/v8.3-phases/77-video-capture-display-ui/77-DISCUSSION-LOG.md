# Phase 77: Video Capture + Display UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 77-video-capture-display-ui
**Areas discussed:** Mode-switch UX in ComposeStep, Detail-page playback behavior, Countdown UX during 3s recording, Tile play-icon affordance

---

## Mode-switch UX in ComposeStep

### Where does the user pick photo vs video?

| Option | Description | Selected |
|--------|-------------|----------|
| Add a 3rd button — "Take wrist shot" + "Record video" + "Upload photo" | Smallest change to ComposeStep. Each affordance owns its own permission flow. Reads as parallel choices. | ✓ |
| Segmented Photo/Video toggle above the existing chooser | Toggle at top, the existing 2 buttons below adapt to mode. Reuses chooser shape, adds top-level mode commit. | |
| Default to photo, subtle "Switch to video" link beneath | Lowest friction for existing photo-first users; buries video as secondary affordance. | |

**User's choice:** 3rd button alongside existing chooser
**Notes:** Recommended option. Three mutually-exclusive paths; minimal disruption to existing flow.

### Once recording starts, can the user discard the clip and try again?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — "Discard & re-record" button on the post-capture preview | Mirrors the photo path's Retake button. Cheap to implement; expected behavior. | ✓ |
| Yes, plus mode-switch (back to Photo/Upload) from preview | More flexible; slightly more UI on the preview surface. | |
| No — commit-on-record, one shot, then submit or cancel post | Forces a clean take. Friction-heavy. | |

**User's choice:** Discard & re-record button (mirrors photo path)

### What does the user see in the post-capture preview?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline playable video (autoplay-muted-loop, like detail page) + Discard button | Composer sees exactly what others will see on /wear/{id}. Reuses same `<video>` markup. Poster is implicit. | ✓ |
| Poster image preview with tap-to-play overlay + Discard button | Composer sees feed-tile experience; adds a click before they can verify motion. | |
| Both — inline video player AND a small "Cover image" thumbnail beneath | Most explicit; more vertical space; 3/4 poster choice is locked so showing it is informational. | |

**User's choice:** Inline playable video + Discard button

### MediaRecorder unsupported — how should the video button behave?

| Option | Description | Selected |
|--------|-------------|----------|
| Hide the "Record video" button entirely | Capability probe at mount; cleanest UX. | ✓ |
| Show button but disable with tooltip explaining why | More discoverable for future updates; adds tooltip UI for edge case. | |
| Show button; surface error inline at capture-time | Cheapest to ship; user already tapped expecting capture, failure feels worse than absence. | |

**User's choice:** Hide entirely with capability probe

---

## Detail-page playback behavior

### How does /wear/{id} play a video?

| Option | Description | Selected |
|--------|-------------|----------|
| Autoplay-muted-loop | IG/TikTok feel; no user gesture needed; loop snap forgivable since user opted in. Spike 001 confirmed iOS 26 honors with playsInline. | ✓ |
| Autoplay-muted ONCE, then pause on final frame | Cleaner for D-01 linear motion (no snap); requires onEnded handler + replay overlay state. | |
| Static poster + big Play overlay, tap to play once | Most conservative; loses ambient "this is alive" feel. | |

**User's choice:** Autoplay-muted-loop

### Native browser controls visible by default?

| Option | Description | Selected |
|--------|-------------|----------|
| No controls — muted-loop, plays ambiently | Most minimal; browser default touch-tap-pause still works. | |
| Show controls always | Standard `<video controls>`; chrome looks awkward on 3s clip. | |
| No controls, but tappable to pause/resume the loop | Custom onClick toggles .pause()/.play(); lets users freeze on interesting frames. | ✓ |

**User's choice:** No controls, tappable to pause/resume

### Same playback behavior on /wears/{username} stories lane?

| Option | Description | Selected |
|--------|-------------|----------|
| Same — autoplay-muted-loop in stories lane too | Consistent with /wear/{id}; segmented progress advances independently; user swipes manually. | ✓ |
| In stories lane, play once then auto-advance to next slide | TikTok-style; requires coupling video's onEnded into lane's swipe controller. | |
| Hybrid — loop video but progress counter only counts one play | May confuse users ("why is this looping if timer is moving?"). | |

**User's choice:** Same autoplay-muted-loop behavior

### Video load failure — what does /wear/{id} show?

| Option | Description | Selected |
|--------|-------------|----------|
| Show the poster JPEG with subtle "Video unavailable" label | Poster signed URL is independent. Most failures transient; static content preserved. | ✓ |
| Show only the poster — silent fallback | Least disruptive; viewers may not realize they're missing motion. | |
| Show error card with retry button | Most explicit; more UI weight for edge case. | |

**User's choice:** Poster + subtle "Video unavailable" label

---

## Countdown UX during 3s recording

### How does the 3-second countdown render during recording?

| Option | Description | Selected |
|--------|-------------|----------|
| Progress ring around the record button (no numeric label) | TikTok/IG convention; record button becomes the timer; user focus stays on wrist. | ✓ |
| Centered numeric overlay — "3… 2… 1…" | Explicit; sits on the wrist preview, partially obscuring framing. | |
| Thin linear progress bar along top edge of preview | Minimal visual weight; doesn't obscure wrist; may not read as countdown. | |
| Both — progress ring AND small numeric tick | Most explicit; slightly busy. | |

**User's choice:** Progress ring around record button

### Pre-record countdown ("3… 2… 1… GO") before the actual record?

| Option | Description | Selected |
|--------|-------------|----------|
| No — tap "Record 3s" → recording starts immediately | Simpler; wrist-overlay already shows target placement before tap. | ✓ |
| Yes — 3s countdown overlay before the actual 3s record (6s total) | More forgiving for one-handed wrist positioning; more UI complexity. | |
| Yes, shorter — 1.5s pre-countdown | Compromise; still adds non-trivial UI. | |

**User's choice:** No pre-record countdown

### Visual signal that recording has started — anything besides the progress ring?

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle red dot on the preview (top corner, pulsing) | Standard recording indicator; universal visual language. | ✓ |
| Just the progress ring — no other indicator | Minimal; record button could change color while ring fills. | |
| Subtle screen-edge frame color shift (red glow inset) | Ambient strong signal; may feel heavy on small dialog. | |

**User's choice:** Subtle pulsing red dot in top corner

### Can the user abort mid-recording?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — Cancel button stays active during recording; tap discards | Mirrors CameraCaptureView Cancel pattern; recording stops, no blob. | ✓ |
| No — once recording starts, commits to full 3s | Simpler state machine; slightly worse UX for mid-record realizations. | |

**User's choice:** Yes — Cancel stays active during recording

---

## Tile play-icon affordance

### Which play-icon affordance overlays the static poster?

| Option | Description | Selected |
|--------|-------------|----------|
| Centered Play icon (filled triangle) with backdrop blur/circle | Most universal video-tile language; backdrop ensures readability on any poster brightness. | ✓ |
| Bottom-corner Video badge (icon + optional "0:03") | Subtler; lets poster fill visual space; duration label adds chrome. | |
| Centered PlayCircle outline (just ring + triangle) | Lightweight, no backdrop; can be hard to see on bright posters. | |

**User's choice:** Centered Play icon with backdrop

### Icon sizing — fixed or scaling with tile?

| Option | Description | Selected |
|--------|-------------|----------|
| Scale with tile (~24% of min side, capped) | Tile sizes differ; scaling keeps visual weight uniform. | ✓ |
| Fixed pixel size (e.g., 48px) | Simpler CSS; oversized on small grid tiles, undersized on feed cards. | |
| Fixed pixel size, different per surface | Hand-tuned; creates 3 surface-specific values to keep in sync. | |

**User's choice:** Scale with tile

### Duration label on tile?

| Option | Description | Selected |
|--------|-------------|----------|
| Icon alone | Every video is exactly 3s (D-04); label would be redundant. Maintains quiet-feed aesthetic. | ✓ |
| Small "0:03" label paired with icon | More informative; redundant since duration is fixed. | |

**User's choice:** Icon alone (no duration label)

### Play icon on the composer's preview too?

| Option | Description | Selected |
|--------|-------------|----------|
| Only on viewer-facing tiles, not composer's preview | Composer is watching the playable video inline (D-03); icon's job is signaling video-ness to feed-scanners. | ✓ |
| Show on both | More explicit "this is what tiles will look like"; adds redundant chrome. | |

**User's choice:** Only on viewer-facing tiles

---

## Claude's Discretion

The user explicitly left to Claude (per CONTEXT.md `<decisions> § Claude's Discretion`):

- VideoCaptureView component shape (new component vs extending CameraCaptureView with mode prop)
- Capability probe location (component effect vs shared hook vs module const)
- Front-vs-back camera default for video (back camera per Spike 001 precedent, same as photo path)
- Webm fallback codec selection (per VID-04 capability chain; first supported wins)
- Poster extraction technique (canvas + `currentTime = duration * 0.75` + `toBlob('image/jpeg', 0.85)` per Spike 001)
- Signed URL caching strategy (Pitfall F-2 — per-request, per-user, never cached)
- Either-or enforcement at UI (discriminated MediaState union; DB CHECK is last-line gate)

## Deferred Ideas

(See CONTEXT.md `<deferred>` for full list — captured here for audit trail.)

- User-pick poster scrubber (V2 polish per SEED-020 D-08)
- MediaRecorder bitrate constraint (V2 optimization per Spike 001)
- `/w/[ref]` carousel showing wear videos (deferred per SEED-020 D-06; future milestone)
- User-pick aspect ratio at capture
- Front-camera selfie mode for video
- WR-02 from Phase 76 review (DAL readers don't select new columns) — folded INTO Phase 77 scope, not deferred
- Spike test page deletion (`src/app/spike-mr-capture/`) — folded INTO Phase 77 as cleanup task
