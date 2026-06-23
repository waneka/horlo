# Requirements: Horlo v8.3 WYWT Video

**Defined:** 2026-06-22
**Core Value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Milestone goal:** Extend WYWT (worn-watch) posts to support a tiny 3-second wrist-rotation video alongside the existing photo path — either-or per post, displayed as a static poster in feed/rail tiles that taps into a full-frame autoplay-muted-loop view at `/wear/{id}`.

**Inputs:**
- [`SEED-020`](./seeds/SEED-020-wywt-video-3s.md) — locked decisions D-01..D-09
- [`Spike 001`](./spikes/001-mr-ios-capture/README.md) — VALIDATED 2026-06-22 (iOS Safari empirically confirmed)

## v8.3 Requirements

### Capture (CAP)

User can record a 3-second wrist-rotation video inside the WYWT compose flow.

- [ ] **VID-01**: User can tap "Record video" in the WYWT compose flow to switch from photo to video capture mode (and back, before submit)
- [ ] **VID-02**: User can tap "Record 3s" → camera records for exactly 3.0 seconds with an on-screen countdown → auto-stops cleanly
- [ ] **VID-03**: User can discard the recorded clip and re-record before submitting the WYWT post
- [ ] **VID-04**: Captured clips are stored as mp4 (`video/mp4;codecs=avc1`) when supported (iOS Safari, Chrome 121+, others); webm fallback on older browsers without mp4 MediaRecorder
- [ ] **VID-05**: A poster JPEG is extracted client-side from 3/4 through the clip via a `<canvas>` (no server transcoding)
- [ ] **VID-06**: Each WYWT post is either one photo OR one video, never both (`media_type` enum on `wear_events`)

### Upload (UPL)

Video + poster reach Supabase Storage safely.

- [x] **VID-07**: Video and poster upload to the existing `wear-photos` bucket at IDOR-safe server-constructed paths (`{userId}/{wearEventId}.mp4` + `{userId}/{wearEventId}-poster.jpg`); client never provides the path
- [ ] **VID-08**: Server probes both Storage objects exist (`storage.list()`) before inserting the `wear_events` row — mirrors Phase 15 T-15-04 mitigation
- [ ] **VID-09**: Server rejects video uploads over 5 MB (client warns at ~4 MB; server is the gate)
- [ ] **VID-10**: On `wear_events` INSERT failure, BOTH Storage objects (video + poster) are best-effort removed — mirrors Phase 15 T-15-18

### Schema (SCH)

Database accommodates the new media type without breaking existing photo wears.

- [x] **VID-11**: Migration adds `wear_events.media_type` (enum `'photo' | 'video' NOT NULL DEFAULT 'photo'`), `media_path TEXT`, `poster_path TEXT`; pre-existing rows default to `'photo'` with their existing `photo_url` migrated into `media_path` (or `photo_url` retained as alias — phase planning decision)
- [x] **VID-12**: DB CHECK constraint enforces that `media_type='video'` rows have both `media_path` and `poster_path` non-NULL

### Display (DSP)

Videos render correctly in feed, rail, and the wear-event detail page.

- [ ] **VID-13**: User browsing the WYWT rail / activity feed / profile wear surfaces sees video posts as static posters with a play-icon overlay (no autoplay in feed; battery-safe, visually quiet)
- [ ] **VID-14**: User tapping a video tile lands on `/wear/{id}` which autoplays the video muted-looped with `playsInline` (NO fullscreen takeover on iOS) — `<video autoplay muted loop playsInline controls>`
- [ ] **VID-15**: Existing photo wear flow is unchanged — photo posts render exactly as they do today on every surface

### Guards (GRD)

Cross-user and tampering attacks are blocked at the server.

- [x] **VID-16**: Cross-user video write is blocked at the Server Action (storage path is constructed from `getCurrentUser().id` + the server-issued `wearEventId`; client-supplied paths are rejected) — mirrors Phase 15 T-15-17

## v2 Requirements (deferred)

Things considered but deferred to a future polish/expansion milestone:

### Capture polish

- **VID-V2-01**: User-pick poster scrubber — let the user choose the poster frame interactively in the compose flow (vs the 3/4 default). Defer rationale: adds a step to compose; 3/4 default is likely good enough for MVP per Spike 001 iteration 1.
- **VID-V2-02**: Bitrate constraint on MediaRecorder — pass `{ videoBitsPerSecond: 2_000_000 }` to shrink 3.6 MB → ~600 KB clips. Defer rationale: 3.6 MB at the existing cap is acceptable; tune later if storage cost becomes a real issue.

### Surface expansion

- **VID-V2-03**: Surface owned wear videos on the watch detail page (`/w/[ref]`) carousel — same surface as the photo wear-pic feature from v7.0 Phase 62 + 63. Defer rationale: SEED-020 D-06 explicitly defers detail-page surfacing; v8.3 is WYWT-only.
- **VID-V2-04**: User-pick aspect ratio (portrait / square) at capture time. Defer rationale: portrait is the natural phone-camera output and matches the WYWT rail tile shape; user-pick would force an editor step.

## Out of Scope

Explicitly excluded from v8.3:

| Feature | Reason |
|---------|--------|
| Audio capture | Wrist rotations have no audio info; adds moderation surface; SEED-020 D-05 |
| Longer videos (>3s) | The 3-second cap is the product decision — keeps the format defined and bandwidth low; SEED-020 D-04 |
| Boomerang / seamless loop | Wrist motion is linear; ping-pong feels wrong; SEED-020 D-01 |
| Feed-level autoplay | Battery, perf, visual cacophony; tap-to-play matches Horlo's quiet vibe; SEED-020 D-02 |
| Native camera-roll upload | MediaRecorder works per Spike 001 — in-app capture is the path. If iOS regresses, we can add `<input type="file" accept="video/*">` as a fallback. Not in v8.3 scope. |
| Cross-device transcoding | iOS produces mp4 / others produce mp4-or-webm; both formats play everywhere per Spike 001 D-09. No transcoding needed. |
| Detail-page carousel videos (`/w/[ref]`) | SEED-020 D-06 defers; watch detail surfaces stay photo-only in v8.3 |
| Video editing / trimming | Adds complexity; the 3s cap eliminates the need |
| Multi-clip composite | Out of scope; one post = one media item |
| Server-side thumbnail generation | Client-side canvas extraction works (Spike 001); no ffmpeg/Vercel function needed |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VID-01 | Phase 77 | Pending |
| VID-02 | Phase 77 | Pending |
| VID-03 | Phase 77 | Pending |
| VID-04 | Phase 77 | Pending |
| VID-05 | Phase 77 | Pending |
| VID-06 | Phase 77 | Pending |
| VID-07 | Phase 76 | Complete |
| VID-08 | Phase 76 | Pending |
| VID-09 | Phase 76 | Pending |
| VID-10 | Phase 76 | Pending |
| VID-11 | Phase 76 | Complete |
| VID-12 | Phase 76 | Complete |
| VID-13 | Phase 77 | Pending |
| VID-14 | Phase 77 | Pending |
| VID-15 | Phase 77 | Pending |
| VID-16 | Phase 76 | Complete |

**Coverage:**
- v8.3 requirements: 16 total
- Mapped to phases: 16/16
- Phase 76: 7 requirements (VID-07, VID-08, VID-09, VID-10, VID-11, VID-12, VID-16)
- Phase 77: 9 requirements (VID-01, VID-02, VID-03, VID-04, VID-05, VID-06, VID-13, VID-14, VID-15)
- Unmapped: 0

---
*Requirements defined: 2026-06-22*
*Last updated: 2026-06-22 — traceability filled (roadmap created; 2 phases: 76 + 77)*
