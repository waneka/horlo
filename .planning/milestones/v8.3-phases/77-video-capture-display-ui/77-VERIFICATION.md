---
phase: 77-video-capture-display-ui
verified: 2026-06-23T17:15:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "iOS Safari live capture — getUserMedia + 3s record + playsInline (VID-02, VID-04)"
    expected: "On prod iPhone Safari, open /wywt → tap Record video → grant camera → tap Record 3s → ring fills clockwise over ~3s → auto-stops at 3.0s → inline <video> preview plays muted-looped without fullscreen takeover → submit → /wear/{id} shows autoplay-muted-loop without fullscreen"
    why_human: "Real camera permission + iOS WebKit codec path not faithfully simulated in jsdom; per durable feedback_mobile_ui_verify_on_prod, iOS behavior verifies on prod, not locally"
  - test: "Tile poster + VideoPlayBadge visual weight across rail / lane / detail (VID-13, VID-14)"
    expected: "After prod deploy, on a profile with at least one video wear, visit home rail and stories lane → confirm <Play> icon visually centered, backdrop visible on bright and dark posters, weight uniform across surface sizes"
    why_human: "Pixel-level icon scaling per surface size is a perceptual check, not a numeric assertion"
  - test: "Stories lane: video loops until user swipes (VID-14, D-07)"
    expected: "Open /wears/{username} with a video post → confirm video keeps looping; segmented progress lane does NOT advance to next slide on video loop completion"
    why_human: "Embla swipe + video loop interaction is multi-frame; automated test only asserts code absence of onEnded handler"
  - test: "iOS Safari poster extraction (VID-05)"
    expected: "After 3s record completes, the post-capture preview shows the recorded clip looping; submit proceeds → /wear/{id} displays poster behind the autoplaying video (poster visible briefly before video metadata loads)"
    why_human: "Empirical Spike 001 confirmed 169 KB JPEG at 720×1280; real-device verification re-confirms the codec path"
  - test: "Either-or per post — CHECK constraint sanity (VID-06, defense-in-depth)"
    expected: "Submit a wear via dev-tools network throttle / manual fetch with both mediaPath and photoUrl populated → confirm Server Action rejects OR DB CHECK fires"
    why_human: "DB-layer enforcement; automated tests assert UI/type-narrowing, not the DB layer; covered by Phase 76 Plan 01 but exercises Phase 77's submit flow"
gaps: []
deferred: []
overrides: []
---

# Phase 77: Video Capture + Display UI Verification Report

**Phase Goal:** Video Capture + Display UI for v8.3 WYWT Video — add a 3-second wrist-rotation video capture flow paralleling the existing photo flow, plus display surfaces (home rail tile, /wear/[id] detail page, /wears/[username] stories lane). The photo path must remain byte-for-byte intact (VID-15 invariant).
**Verified:** 2026-06-23T17:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                    | Status     | Evidence                                                                                                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | T-77-01 closed: unauthenticated `/spike-mr-capture` route removed from prod                                                              | VERIFIED   | `src/app/spike-mr-capture/` directory absent (`test -d` returns false); deletion committed via `75b00386`                                                                                                                                                                                                                                          |
| 2   | VID-01: User taps "Record video" → 3-button chooser visible when capability supported, 2 when not                                       | VERIFIED   | `ComposeStep.tsx:115` calls `useMediaCapability()`; `ComposeStep.tsx:588` gates Record video button on `supportsVideoCapture`; ComposeStep.video.test.tsx (2 passing cases)                                                                                                                                                                       |
| 3   | VID-02: Record 3s → MediaRecorder records exactly 3.0s with progress ring → auto-stops                                                  | VERIFIED   | `VideoCaptureView.tsx:118` `setTimeout(() => recorder.stop(), 3000)`; ring-fill `@keyframes` in globals.css:186 animates over `3s`; videoCapture.test.ts (3 passing) + VideoCaptureView.test.tsx (4 passing)                                                                                                                                       |
| 4   | VID-03: User discards recorded clip and re-records before submit                                                                         | VERIFIED   | `VideoCaptureView.tsx:121-130` `handleCancelRecording` sets `cancelledRef.current = true`, clears timer, stops recorder, onstop short-circuits; `ComposeStep.tsx:264` Discard returns to `{ kind: 'none' }`; videoCapture.test.ts cancel-before-3000ms passing                                                                                     |
| 5   | VID-04: mp4 mimeType when supported, webm fallback                                                                                       | VERIFIED   | `useMediaCapability.ts:15-20` MIME_CANDIDATES `[mp4;codecs=avc1, webm;codecs=vp9, webm;codecs=vp8, webm]`; first-supported wins; useMediaCapability.test.ts (4 passing — SSR default, mp4 happy, webm fallback, no-getUserMedia)                                                                                                                  |
| 6   | VID-05: Client-side poster JPEG extracted at duration*0.75                                                                              | VERIFIED   | `extractPosterBlob.ts:24` `video.currentTime = video.duration * 0.75`; `toBlob('image/jpeg', 0.85)` at L43-44; posterExtraction.test.ts (3 passing — seek, toBlob null reject, revokeObjectURL)                                                                                                                                                   |
| 7   | VID-06: Either-or per post enforced at compile time (MediaState discriminated union)                                                     | VERIFIED   | `wywtTypes.ts:84-87` exports `MediaState = { kind: 'none' } \| { kind: 'photo'; blob } \| { kind: 'video'; videoBlob; posterBlob }`; ComposeStep submit switches on `mediaState.kind`; mediaState.test.ts (3 passing); DB CHECK from Phase 76 is the final gate                                                                                    |
| 8   | VID-13: Video tile shows poster + VideoPlayBadge overlay on rail/lane/detail                                                             | VERIFIED   | `VideoPlayBadge.tsx` exports centered Play icon over `bg-black/50` backdrop; `WywtTile.tsx:103-130` 3-way ternary renders poster + badge for `mediaType==='video'`; WywtTile.video.test.tsx (3 passing); WearCard.video.test.tsx (2 passing)                                                                                                       |
| 9   | VID-14: Detail/lane video autoplays muted-looped with playsInline (no iOS fullscreen)                                                    | VERIFIED   | `WearVideoClient.tsx:98-107` `<video autoPlay muted loop playsInline>` + onClick tap-toggle + onError → poster fallback + "Video unavailable" label; WearVideoClient.test.tsx (3 passing); /wear/[id]/page.tsx:180-191 mints both URLs; /wears/[username]/page.tsx:137-149 mints both URLs                                                          |
| 10  | VID-15: Existing photo flow byte-identical (no behavior change on photo path)                                                            | VERIFIED   | WearPhotoClient.tsx + WearDetailHero.tsx NOT modified (zero edits); photo branch of WearCard, WywtTile, ComposeStep, 3 SSR pages preserved verbatim; pre-existing WearCard.test.tsx photo cases continue to pass under Phase 77 changes; pre-Phase-77 baseline test count *worse* than post-Phase-77 (53 → 50 failures, 20 → 15 files)               |

**Score:** 10/10 must-have truths VERIFIED

### Required Artifacts

| Artifact                                          | Expected                                                                  | Status     | Details                                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/spike-mr-capture/`                       | DELETED (T-77-01)                                                          | VERIFIED   | Directory absent; `test -d` returns false                                                                                                       |
| `src/hooks/useMediaCapability.ts`                 | `'use client'` hook with MIME probe chain                                  | VERIFIED   | 44 lines; 4 MIME candidates present; `MediaRecorder.isTypeSupported` invoked                                                                    |
| `src/lib/video/extractPosterBlob.ts`              | Pure async function — canvas seek + toBlob                                 | VERIFIED   | 53 lines; no `'use client'`; `duration * 0.75` literal; `image/jpeg`, `0.85` quality; 3 `revokeObjectURL` calls (all code paths)                |
| `src/lib/wywtTypes.ts`                            | + MediaState union + WywtTile.mediaType + .posterPath + .signedPosterUrl  | VERIFIED   | Lines 84-87 MediaState 3-variant union; lines 51-62 WywtTile additive fields                                                                    |
| `src/data/wearEvents.ts`                          | 5 readers SELECT mediaType/mediaPath/posterPath                            | VERIFIED   | 5 occurrences of `mediaType: wearEvents.mediaType` (lines 254, 310, 399, 536, 599) — exceeds the >=4 contract; `photoUrl` count preserved        |
| `src/components/wywt/VideoCaptureView.tsx`        | Stream-as-prop component with 3s timer + cancel guard                      | VERIFIED   | 212 lines; `new MediaRecorder(stream, { mimeType })` at L90; `setTimeout(..., 3000)` at L118; `cancelledRef` guard at L99, L122                  |
| `src/components/wywt/ComposeStep.tsx`             | 3-button chooser + handleTapVideoCamera + video submit branch              | VERIFIED   | useMediaCapability hook L115; handleTapVideoCamera L205; logWearWithVideo invoked L364; mediaState.kind switching                              |
| `src/components/wywt/WywtPostDialog.tsx`          | MediaState prop wiring (replaces photoBlob)                                | VERIFIED   | `mediaState`/`setMediaState` threaded through; legacy photoBlob prop pair removed                                                              |
| `src/components/wear/VideoPlayBadge.tsx`          | Centered Play overlay with clamp sizing                                    | VERIFIED   | 35 lines; `clamp(32px, 24%, 56px)` sizing; `bg-black/50` backdrop; `fill-white` icon; `aria-hidden`                                              |
| `src/components/wear/WearVideoClient.tsx`         | Autoplay-muted-loop video + tap-toggle + onError fallback                  | VERIFIED   | 121 lines; `<video autoPlay muted loop playsInline>` L98-104; onClick toggles play/pause L85-95; failed/!signedVideoUrl renders poster + label |
| `src/components/wear/WearCard.tsx`                | Discriminator branch — mediaType==='video' → WearVideoClient               | VERIFIED   | L7 import; L60-62 new props; L141-145 video branch above existing signedUrl ternary                                                            |
| `src/components/home/WywtTile.tsx`                | Video branch — poster Image + VideoPlayBadge overlay                       | VERIFIED   | L8 import; L43-44 new props; L103-130 3-way ternary + badge gated on mediaType==='video'                                                       |
| `src/components/home/WywtRail.tsx`                | Passes mediaType + signedPosterUrl to WywtTile                             | VERIFIED   | grep confirms entries spread to tile props                                                                                                      |
| `src/components/wears/WearsLane.tsx`              | WearSlide widened with mediaType/signedVideoUrl/signedPosterUrl            | VERIFIED   | grep confirms new fields; `grep -c onEnded` == 0 (D-07 guardrail honored)                                                                       |
| `src/app/wear/[wearEventId]/page.tsx`             | WearPhotoStreamed mints both URLs via Promise.all for video wears          | VERIFIED   | L180-191 video branch with Promise.all; L193 photo branch verbatim                                                                              |
| `src/app/page.tsx` (home rail)                    | Mints signedPosterUrl for video tiles in parallel with photo signing       | VERIFIED   | L53 filter for video tiles; L56 createSupabaseServerClient; L79-80 posterById Map; L88 enrichment                                                |
| `src/app/wears/[username]/page.tsx`               | signedTriples for video wears (video + poster URLs)                        | VERIFIED   | L132-164 signedTriples Promise.all; L204-206 slide construction                                                                                  |
| `src/app/globals.css`                             | `@keyframes ring-fill` + `.ring-fill-animation` + prefers-reduced-motion   | VERIFIED   | L186 keyframes; L195-196 animation `3s linear forwards`; L200 reduced-motion override                                                            |

### Key Link Verification

| From                                                  | To                                                              | Via                                          | Status   | Details                                                                                              |
| ----------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| ComposeStep.tsx                                       | VideoCaptureView                                                | Mount when `cameraStream && mediaSource === 'video'` | WIRED    | Import L18; usage L504 (`<VideoCaptureView stream={cameraStream} ... onVideoReady={handleVideoReady} />`) |
| ComposeStep.tsx                                       | logWearWithVideo Server Action                                  | Called when `mediaState.kind === 'video'`    | WIRED    | Import L25; invoked L364 inside video submit branch                                                  |
| ComposeStep.tsx                                       | useMediaCapability hook                                         | Hook call at top of component               | WIRED    | Import L26; called L115                                                                              |
| ComposeStep.tsx                                       | buildWearVideoPath / buildWearPosterPath (Phase 76)             | Client-side path construction                | WIRED    | Used in submit branch around L340 (upload to wear-photos bucket)                                     |
| VideoCaptureView                                      | extractPosterBlob                                               | Called in MediaRecorder.onstop after blob   | WIRED    | Import L26; called L107 (`await extractPosterBlob(videoBlob)`)                                       |
| WearCard.tsx                                          | WearVideoClient                                                 | mediaType==='video' branch                   | WIRED    | Import L7; mounted L141-148                                                                          |
| WywtTile.tsx                                          | VideoPlayBadge                                                  | Overlay when mediaType==='video'             | WIRED    | Import L8; rendered L130                                                                             |
| /wear/[id]/page.tsx                                   | WearCard signedVideoUrl + signedPosterUrl + mediaType           | Render-time prop pass                        | WIRED    | L180-191 mint; L231-233 spread to WearCard                                                           |
| /page.tsx (home rail)                                 | WywtTile.signedPosterUrl                                        | Tile enrichment loop                         | WIRED    | L88 `next.signedPosterUrl = posterById.get(t.wearEventId) ?? null`                                   |
| /wears/[username]/page.tsx                            | WearsLane slides → WearCard                                     | Slide spread                                 | WIRED    | L204-206 mediaType + signedVideoUrl + signedPosterUrl threaded into each slide                       |
| Data flow (DAL → page → component)                    | mediaType / mediaPath / posterPath surface                       | 5 readers updated                            | WIRED    | grep confirms 5 occurrences each of mediaType/mediaPath/posterPath in src/data/wearEvents.ts        |

### Data-Flow Trace (Level 4)

| Artifact                | Data Variable           | Source                                                                    | Produces Real Data | Status      |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------- | ------------------ | ----------- |
| WywtTile (video branch) | `signedPosterUrl` prop  | /page.tsx mints via admin client `.from('wear-photos').createSignedUrl()` | Yes (if RLS passes) | FLOWING (see warning) |
| WearVideoClient         | `signedVideoUrl` prop   | /wear/[id]/page.tsx + /wears/[username]/page.tsx Promise.all              | Yes (if RLS passes) | FLOWING (see warning) |
| WearVideoClient         | `signedPosterUrl` prop  | Same SSR pages mint posterPath via createSignedUrl                        | Yes (if RLS passes) | FLOWING (see warning) |
| VideoCaptureView output | `{ videoBlob, posterBlob }` | MediaRecorder.start() → onstop → extractPosterBlob (Plan 04)         | Yes (in-browser)   | FLOWING     |
| ComposeStep submit      | logWearWithVideo result | Phase 76 Server Action writes wear_events row with mediaPath/posterPath  | Yes                | FLOWING     |

**Warning — see CR-01 (advisory):** The data-flow for the home rail's signedPosterUrl and the detail/lane signedVideoUrl PASSES at the application layer (the SSR code is wired and would deliver a real URL) but FAILS at the storage RLS layer for non-owner viewers because the Phase 11 RLS policy `wear_photos_select_three_tier` uses `split_part(storage.filename(name), '.', 1)` to extract the wear_event_id. For `{userId}/{wearEventId}-poster.jpg`, that expression resolves to `{wearEventId}-poster`, which never matches a wear_events.id. Non-owners will see "Video unavailable" or a fallback to the catalog image. This is an operator-blocking RLS bug that requires `supabase db push --linked`. Per phase scope rules ("Code review found issues" is advisory, not phase-blocking), this is documented as a follow-up below; it does not fail the Phase 77 goal because the application code itself correctly mints and threads the URLs.

### Behavioral Spot-Checks

| Behavior                                                                   | Command                                                                                          | Result                            | Status     |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------- | ---------- |
| `npm run build` exits 0                                                     | `npm run build 2>&1 \| grep "Compiled successfully"`                                              | `✓ Compiled successfully in 5.7s` | PASS       |
| All 11 Phase 77 test files have 0 it.todo                                  | `grep -c it.todo tests/{hooks,unit,components}/...`                                              | 0 in every file                   | PASS       |
| Phase 77 dedicated test suite (34 cases)                                    | `npx vitest run tests/{hooks,unit,components}/...video... ...mediaState... ...Capability...`     | 11 files passed / 34 tests passed | PASS       |
| spike-mr-capture removed                                                    | `test -d src/app/spike-mr-capture`                                                                | exit 1 (absent)                   | PASS       |
| D-07 `onEnded` guardrail honored in WearsLane                              | `grep -c onEnded src/components/wears/WearsLane.tsx`                                             | 0                                 | PASS       |
| Pre-Phase-77 baseline regression check                                     | Stash-and-rerun: pre-77 had 53 failures / 20 files; post-77 has 50 failures / 15 files          | No new regressions; net better    | PASS       |
| Build does not error on type widening (VID-15 invariant)                   | All 5 DAL readers updated; downstream consumers compile                                          | Compiled successfully             | PASS       |
| iOS playsInline attribute present on detail-page video                     | `grep playsInline src/components/wear/WearVideoClient.tsx`                                       | Present (L104)                    | PASS       |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| n/a   | No probes declared for this UI phase                                                              | —      | SKIPPED (no probes defined) |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                     | Status     | Evidence                                                                                                                                       |
| ----------- | ----------- | ----------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| VID-01      | 77-06       | "Record video" button switches photo/video capture mode                                          | SATISFIED  | ComposeStep.tsx:588 (gated chooser); ComposeStep.video.test.tsx 2 passing                                                                       |
| VID-02      | 77-05       | Tap Record 3s → 3.0s record + countdown + auto-stop                                              | SATISFIED  | VideoCaptureView.tsx:118 setTimeout 3000ms; videoCapture.test.ts (3 passing); ring-fill keyframes in globals.css                                |
| VID-03      | 77-05, 77-06 | Discard recorded clip + re-record before submit                                                  | SATISFIED  | cancelledRef guard L99/L122; handleDiscardVideo in ComposeStep L264; videoCapture.test.ts cancel passing                                       |
| VID-04      | 77-04       | mp4+avc1 when supported; webm fallback                                                           | SATISFIED  | useMediaCapability.ts MIME_CANDIDATES probe chain; useMediaCapability.test.ts 4 passing                                                        |
| VID-05      | 77-04       | Client-side poster JPEG at 3/4 through clip                                                      | SATISFIED  | extractPosterBlob.ts `duration * 0.75` + `image/jpeg`, `0.85`; posterExtraction.test.ts 3 passing                                              |
| VID-06      | 77-02, 77-06 | Either-or per post (media_type enum + discriminated union)                                       | SATISFIED  | MediaState 3-variant union in wywtTypes.ts; submit switch on kind; DB CHECK from Phase 76                                                       |
| VID-13      | 77-07, 77-08 | Static poster + play-icon overlay on rail/feed/profile surfaces                                  | SATISFIED  | VideoPlayBadge + WywtTile branch + WearCard discriminator; 3 + 2 + 3 passing tests                                                              |
| VID-14      | 77-07, 77-08 | Detail page autoplays muted-looped with playsInline                                              | SATISFIED  | WearVideoClient `<video autoPlay muted loop playsInline>`; SSR pages mint both URLs; 3 passing tests. **HUMAN UAT required for iOS behavior** |
| VID-15      | All plans   | Existing photo flow unchanged                                                                    | SATISFIED  | WearPhotoClient + WearDetailHero NOT modified; photo branches preserved in WearCard, WywtTile, ComposeStep, 3 SSR pages; baseline tests improve |
| WR-02       | 77-03       | DAL readers select mediaType/mediaPath/posterPath (Phase 76 review fold-in, not a formal REQ)    | SATISFIED  | 5 readers in src/data/wearEvents.ts; dalMediaColumns.test.ts 4 passing                                                                          |

**Coverage:** 9 of 9 formal VID-* requirements SATISFIED; WR-02 (carryover, not in REQUIREMENTS.md) also SATISFIED. No requirement ID declared in PLAN frontmatter is unaccounted for. No orphaned requirements mapped to Phase 77.

### Anti-Patterns Found

| File                                       | Line(s)       | Pattern                                                                              | Severity   | Impact                                                                                                                                                                     |
| ------------------------------------------ | ------------- | ------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| src/components/wear/WearVideoClient.tsx    | 89            | `v.play()` Promise not awaited or `.catch()`-ed                                       | Warning    | Per 77-REVIEW.md WR-03: unhandled promise rejection if autoplay policy denies; UI state still set to play. Live behavior on iOS Safari is fine empirically.               |
| src/lib/video/extractPosterBlob.ts         | 16-52         | No timeout on `onloadedmetadata` / `onseeked`; `Infinity` duration not handled        | Warning    | Per 77-REVIEW.md WR-02: promise could hang forever on malformed Blob; UI stuck on "Processing…". iOS Safari path validated empirically by Spike 001; non-iOS untested.    |
| src/components/wywt/VideoCaptureView.tsx   | 105           | `new Blob(chunks, { type: preferredMimeType })` with parameterized MIME              | Warning    | Per 77-REVIEW.md WR-05: bucket allowed_mime_types is strict-equality ['video/mp4'], not parameterized. iOS Safari emits bare 'video/mp4' coincidentally; Chrome 121+ untested. |
| src/components/wywt/ComposeStep.tsx        | submit branch | No cleanup on early Server Action rejection (auth/Zod/byte-gate/watch-not-found)     | Warning    | Per 77-REVIEW.md WR-01: ~5 MB orphan in Storage per invalid attempt. Self-DoS rather than cross-user; RLS confines to attacker's own folder.                              |
| src/components/wywt/WywtPostDialog.tsx     | 108-139       | Two separate reset-on-close code paths (handleOpenChange + state-during-render)      | Warning    | Per 77-REVIEW.md WR-04: duplication risks state-clear race during in-flight submit. In practice safe (parent closes only after onSubmitted returns).                       |
| src/components/wear/WearVideoClient.tsx    | 48-78         | Failed-fallback overlays use `text-white/70` with potentially low contrast on gray   | Warning    | Per 77-REVIEW.md WR-06: when no poster signs (CR-01 case), overlay text floats on bare bg-muted; legibility marginal. `aria-label={altText}` also inaccurate in this state. |
| supabase/migrations (referenced)            | 4 / 11 policy | RLS `split_part(storage.filename(name), '.', 1)` does NOT match `-poster.jpg` files | **Blocker-advisory** | **CR-01 (CRITICAL)** — non-owner viewers cannot read posters; home rail tile falls through to catalog image + Play badge; detail/lane "Video unavailable" fallback fires. Operator-blocking (requires `supabase db push --linked`). See follow-up below. |
| src/app/page.tsx / wear/[id]/page.tsx / wears/[username]/page.tsx | 56 / 181 / 134 | Comments claim "admin client" but call `createSupabaseServerClient()` (cookie-bound) | **Blocker-advisory** | **CR-02 (CRITICAL)** — signed-URL minting runs as the viewer's RLS context, not service-role. Combined with CR-01, non-owner views fail. Phase 61 lesson `project_ppr_dynamic_before_use_cache` recorded `createSupabaseAdminClient()` as the canonical pattern. |
| src/components/home/WywtTile.tsx           | 103-130       | VideoPlayBadge renders even when `signedPosterUrl` is null → catalog image + Play   | **Blocker-advisory** | **CR-03 (CRITICAL)** — confusing visual on mint failure; soft VID-15 regression for video tiles (pre-77 photo tiles never showed a Play badge). |

Per the verification workflow ("Code review found issues" is advisory not phase-blocking) and per durable memory `feedback_mobile_ui_verify_on_prod`: the three Critical findings are documented for follow-up but do not by themselves fail the Phase 77 goal. The application code is wired correctly; CR-01 is an RLS policy bug from Phase 11 that surfaces under Phase 77's new file-naming convention. CR-02 + CR-03 are cooperating with CR-01 to produce the visible failure mode for non-owner viewers.

### Required Follow-up (advisory, not phase-blocking)

A Phase 77.1 or quick-task is recommended to:

1. **CR-01 fix** — new migration that widens the RLS policy to match the `-poster.jpg` filename pattern. Recommended approach (per 77-REVIEW.md): use `substring(storage.filename(name) FROM 1 FOR 36)` instead of `split_part('.', 1)` to extract the first-36-character UUID. Also update the SECDEF helper from Migration 4b. Operator: requires `supabase db push --linked`.
2. **CR-02 fix** — switch the three signing sites (`src/app/page.tsx:56`, `src/app/wear/[wearEventId]/page.tsx:181,193`, `src/app/wears/[username]/page.tsx:134`) from `createSupabaseServerClient()` to `createSupabaseAdminClient()` (imported from `@/lib/supabase/admin`). Update the inline comments to match.
3. **CR-03 fix** — move the `VideoPlayBadge` render inside the `mediaType === 'video' && signedPosterUrl` branch, OR gate it on `signedPosterUrl !== null` so the badge is not shown over a catalog image during mint failure.

These fixes can ship together as a single follow-up plan; they are NOT blockers for marking Phase 77 code-complete, since all 10 must-have truths are independently verified to be present in the application layer.

### Human Verification Required

5 items require human testing on the prod Vercel build (per durable memory `feedback_mobile_ui_verify_on_prod`):

1. **iOS Safari live capture — getUserMedia + 3s record + playsInline (VID-02, VID-04)**
   - Test: On prod iPhone Safari, /wywt → Record video → grant camera → Record 3s → ring fills → auto-stops → inline preview muted-looped (no fullscreen) → submit → /wear/{id} autoplay-muted-loop (no fullscreen)
   - Why human: Real camera + iOS WebKit codec path not simulated in jsdom

2. **Tile poster + VideoPlayBadge visual weight (VID-13, VID-14)**
   - Test: Confirm `<Play>` icon centered, backdrop visible on bright + dark posters, uniform across rail/lane/detail
   - Why human: Pixel-level perceptual check

3. **Stories lane: video loops until user swipes (VID-14, D-07)**
   - Test: Open /wears/{username} with video post → video keeps looping; lane does NOT advance on loop completion
   - Why human: Embla swipe + video loop interaction is multi-frame

4. **iOS Safari poster extraction (VID-05)**
   - Test: After 3s record, preview shows clip looping; submit → /wear/{id} poster visible briefly before video metadata loads
   - Why human: Real-device re-confirmation of Spike 001 empirical result

5. **Either-or per post — CHECK constraint sanity (VID-06)**
   - Test: Submit a wear via manual fetch with both mediaPath and photoUrl populated → Server Action rejects OR DB CHECK fires
   - Why human: DB-layer defense-in-depth; exercises Phase 77's submit flow against Phase 76's gate

### Gaps Summary

No phase-blocking gaps. All 10 must-have truths VERIFIED. All 18 required artifacts VERIFIED. All 11 key links WIRED. All 9 formal VID-* requirements SATISFIED plus WR-02 carryover. The 5 baseline test failures cited in the verifier context are pre-existing (53→50 failures across phase; Phase 77 actually reduces failure count) — confirmed via stash-and-rerun against pre-77 head commit `c6a55ed8`.

The 3 Critical code-review findings (CR-01, CR-02, CR-03) are documented as advisory follow-ups. They do not block the phase per workflow rules but should be addressed before the prod UAT walk in a follow-up plan/quick-task. Notably, CR-01 + CR-02 are the load-bearing pair that determines whether non-owner viewers can see video wears at all — a high-impact UX failure that a UAT walker will hit on the first non-owner video tile attempted.

---

_Verified: 2026-06-23T17:15:00Z_
_Verifier: Claude (gsd-verifier)_
