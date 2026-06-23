# Phase 77: Video Capture + Display UI - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

A collector can record a 3-second wrist-rotation clip from the WYWT compose flow, sees it represented as a static poster + centered play-icon in feed/rail/grid tiles, and watches it play (autoplay-muted-looped, playsInline) in the `/wear/{id}` detail view and `/wears/{username}` stories lane. The existing photo flow stays visually unchanged (VID-15 regression preservation).

**In scope:**
- 9 capability requirements: VID-01..06 (capture UX), VID-13/14/15 (display)
- Mode-switch UX in ComposeStep (3-button pre-capture chooser)
- Live recording surface with countdown UX
- Client-side mp4 capture (`MediaRecorder`) + canvas-based poster extraction at 3/4 through clip
- Client-direct upload of video + poster to Supabase Storage (paths shaped by Phase 76 `buildWearVideoPath`/`buildWearPosterPath`)
- Submit through the Phase 76 `logWearWithVideo` Server Action
- Display surfaces: WYWT rail tile, activity feed card, profile grid card (static poster + play overlay), `/wear/{id}` detail page, `/wears/{username}` stories lane (autoplay-muted-loop video)
- Either photo OR video per post (UI-level enforcement; CHECK constraint enforces at DB layer)

**Out of scope (deferred per SEED-020):**
- User-pick poster scrubber (V2 polish — D-08; MVP ships 3/4 default)
- Bitrate constraint on MediaRecorder (V2 optimization — Spike §Surprises #2)
- `/w/[ref]` carousel showing wear videos (D-06; v8.4+ scope)
- User-pick aspect ratio at capture (deferred — portrait native)

</domain>

<decisions>
## Implementation Decisions

### Mode-switch UX in ComposeStep

- **D-01: Three-button pre-capture chooser.** Replace the existing 2-button chooser with three mutually-exclusive paths: "Take wrist shot" (camera-photo), "Record video" (new), "Upload photo". Each affordance owns its own permission flow and capture surface. Reads as parallel choices — no mode-toggle widget above.

- **D-02: Discard & re-record on post-capture preview.** Mirrors the existing photo path's Retake/Choose another buttons. Tapping it clears the blob + poster and returns to the live camera view, ready for a fresh MediaRecorder cycle. Same `useRef`-based re-entrance guard pattern as Phase 15's `cameraOpeningRef`.

- **D-03: Post-capture preview = inline autoplay-muted-loop video player + Discard button.** The composer sees exactly what `/wear/{id}` viewers will see. The poster is implicit (extracted but not separately shown to the composer). Reuses `<video autoplay muted loop playsInline>` markup with the in-page object URL.

- **D-04: Hide "Record video" button if MediaRecorder unsupported.** Capability probe at component mount checks `typeof MediaRecorder !== 'undefined'` + `navigator.mediaDevices?.getUserMedia` + `MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')` (with webm fallback per VID-04). If any fail, the third button doesn't render. Photo path still works. No disabled-state UX needed.

### Detail-page playback behavior

- **D-05: Autoplay-muted-loop on `/wear/{id}` AND `/wears/{username}`.** Both surfaces play video posts identically. `playsInline` REQUIRED on every `<video>` element (Spike 001 iOS quirk — without it iOS Safari goes fullscreen). No autoplay in feed/rail (D-02 from SEED-020).

- **D-06: No native browser controls; tappable to pause/resume the loop.** Custom `onClick` toggles `.pause()`/`.play()`. Lets users freeze on an interesting frame without the visual weight of `<video controls>` chrome (which looks awkward on a 3-second clip anyway). Loop is the default state.

- **D-07: Stories lane uses the same autoplay-loop behavior.** Don't pause the lane's segmented progress indicator on video; let it loop until the user swipes manually (matches the lane's existing photo-slide behavior — no auto-advance). The video keeps looping until the slide changes.

- **D-08: Video error fallback → show poster JPEG + subtle "Video unavailable" label.** Poster signed URL is independently minted, so it survives most video failures. Closest behavioral analog to the photo-fallback pattern in `WearPhotoClient.tsx`. No retry button; refresh-page is the implicit recovery action.

### Countdown UX during 3s recording

- **D-09: Progress ring around the record button (no numeric label).** Visual sweep around the circular record button fills clockwise over 3.0s. TikTok/IG convention; immediately readable as "recording in progress, this long left". No numeric counter overlay on the preview — keeps user focus on the wrist they're filming.

- **D-10: No pre-record countdown.** Tap "Record 3s" → recording starts immediately. User pre-positions their wrist using the existing `WristOverlaySvg` overlay while the camera is live (before tapping). Lowest friction; matches the photo path's tap-to-capture immediacy.

- **D-11: Pulsing red dot in the preview top-left corner during recording.** Universal recording indicator. Stops when the ring completes. Complements the ring without competing with it.

- **D-12: Cancel button stays active during recording — tapping aborts the clip.** Recording stops, no blob produced, returns to live camera. Mirrors the existing CameraCaptureView Cancel-button-during-capture pattern. The 3s commit is auto-stop, not commit-on-tap.

### Tile play-icon affordance (feed / rail / profile grid)

- **D-13: Centered Play icon (filled triangle) with backdrop blur/circle.** Standard video-tile language. Uses `lucide-react` `<Play fill="white" />` with a semi-transparent rounded backdrop for readability on any poster brightness. Single icon component shared across WYWT rail tile, activity feed card, profile grid card.

- **D-14: Icon size scales with tile size (~24% of min side, capped).** Tile sizes differ across the 3 surfaces; a fixed pixel size looks wrong somewhere. Scaling keeps perceived visual weight uniform. Implementation: CSS `clamp()` or a `useResizeObserver` + computed prop on the icon wrapper.

- **D-15: No duration label on tiles ("0:03" or similar).** Every video is exactly 3 seconds (D-04 from SEED-020 enforced client + server). Duration label would be redundant noise. Maintains quiet-feed aesthetic.

- **D-16: Play icon only on viewer-facing tiles, NOT on the composer's post-capture preview.** The composer is watching the playable video inline (D-03) — they don't need a video-ness indicator. The play icon's job is signaling to a feed-scanning viewer, which doesn't apply in compose state.

### Claude's Discretion

The following implementation details are intentionally left to research + planner judgment, grounded in the locked decisions above:

- **VideoCaptureView component shape** — likely a new component parallel to `CameraCaptureView`, sharing the `WristOverlaySvg` + wrapper geometry. Whether to extract a common base or duplicate-then-converge is a planner call; both have precedent in this codebase.
- **Capability probe location** — could live in ComposeStep mount effect, in a shared `useMediaCapability()` hook, or as a module-scope const. Pick by what's testable + reusable.
- **Front-vs-back camera default for video** — back camera (`facingMode: { ideal: 'environment' }`) per Spike 001 precedent; same as photo path. Already locked, but worth noting.
- **Webm fallback codec selection** — `MediaRecorder.isTypeSupported()` probe chain per VID-04; first supported `mimeType` wins. Storage extension follows the actual blob `.type`. Don't hard-code `.mp4`.
- **Poster extraction technique** — Spike 001 used `<canvas>` + `video.currentTime = duration * 0.75` + `toBlob('image/jpeg', 0.85)`. Reuse verbatim.
- **Signed URL caching for video + poster** — must follow Pitfall F-2 (per-request, per-user, NEVER cached across either axis). Mint inline in the streamed server child like Phase 26 photo render does.
- **Either-or enforcement at UI** — discriminated `MediaState` union in ComposeStep (e.g., `{ kind: 'none' } | { kind: 'photo'; blob: Blob } | { kind: 'video'; videoBlob: Blob; posterBlob: Blob }`). The CHECK constraint catches DB-level violations; UI never sends both.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 77 scope + requirements

- `.planning/ROADMAP.md` §"Phase 77: Video Capture + Display UI" — Goal, requirements, success criteria
- `.planning/REQUIREMENTS.md` lines 17–22 (VID-01..06), 44–46 (VID-13..15) — Capability requirements
- `.planning/seeds/SEED-020-wywt-video-3s.md` — D-01..D-09 locked decisions (wrist-rotation use case, either-or per post, 3s cap, muted, mp4-only, 3/4 poster, etc.)

### Spike validation (iOS feasibility — VALIDATED 2026-06-22)

- `.planning/spikes/001-mr-ios-capture/README.md` §"Investigation Trail" + §"Results" — iOS 26.6 Safari capture confirmed (`video/mp4;codecs=avc1.42000a`, 3.6 MB for 3s 720p, 169 KB poster JPEG, autoplay-muted-loop+playsInline inline)
- `.planning/spikes/001-mr-ios-capture/README.md` §"What to Expect" — iOS gotchas (playsInline REQUIRED, autoplay requires muted, getUserMedia requires HTTPS, facingMode `ideal:` not `exact:`)

### Phase 76 backend (already shipped — Phase 77 consumes)

- `.planning/phases/76-video-schema-storage-paths-server-action/76-01-PLAN.md` — Schema: `mediaTypeEnum`, `wear_events.mediaType/mediaPath/posterPath`, `wear_events_video_paths_required` CHECK
- `.planning/phases/76-video-schema-storage-paths-server-action/76-02-SUMMARY.md` — Client-side path builders: `buildWearVideoPath(userId, wearEventId)` + `buildWearPosterPath(userId, wearEventId)` (exact path shape Server Action expects)
- `.planning/phases/76-video-schema-storage-paths-server-action/76-03-PLAN.md` — `logWearWithVideo` Server Action contract + 9-test surface (auth → Zod → 5 MB byte gate VID-09 → IDOR check VID-16 → server-derived paths VID-07 → createSignedUrl HEAD probes VID-08 → DAL insert → compensating .remove on failure VID-10). Phase 77 calls this Server Action; never `logWearWithPhoto` for video posts.
- `src/lib/storage/wearPhotos.ts` (post-Phase-76) — `buildWearPhotoPath` (existing), `buildWearVideoPath` + `buildWearPosterPath` (new). All client-side; Server Action recomputes server-side from `getCurrentUser().id` — these helpers are NOT a trust path.
- `src/app/actions/wearEvents.ts` (post-Phase-76 + CR-01 fix) — `logWearWithVideo` Server Action; `createSignedUrl(path, 1)` HEAD probes (NOT paginated `.list({search})` — that's the CR-01 fix landed in-phase)

### Existing capture flow (extension target — DO NOT BREAK)

- `src/components/wywt/ComposeStep.tsx` — 3-state photo zone (pre-capture chooser → live camera → post-capture preview); D-05/06/07/11/12/18/19 contracts. Phase 77 adds a fourth path (live recording → recorded preview) and a third pre-capture button.
- `src/components/wywt/CameraCaptureView.tsx` — getUserMedia + canvas snapshot; iOS gesture-context rules (Pitfall 1 — `getUserMedia` MUST be the first await); `computeObjectCoverSourceRect` math; WristOverlaySvg integration. Phase 77 either extends or parallels this for video.
- `src/components/wywt/WristOverlaySvg.tsx` — Wrist-position helper; reuse identically in video capture surface.
- `src/components/wywt/PhotoUploader.tsx` — File picker; unchanged by Phase 77 (third button, parallel path).
- `src/components/wywt/WywtPostDialog.tsx` — Outer dialog chrome; minor signature changes only (the dialog hosts the new state shape).
- `src/lib/wywtTypes.ts` — Photo flow types; Phase 77 likely extends `MediaState` discriminated union here.

### Existing display surfaces (extension target — VID-15 REGRESSION GATE)

- `src/components/wear/WearCard.tsx` — Shared card; renders in `/wear/{id}`, `/wears/{username}`, profile grid. Phase 77 adds video-render branch alongside existing photo-render path; photo posts must remain byte-for-byte identical.
- `src/components/wear/WearDetailHero.tsx` + `src/components/wear/WearPhotoClient.tsx` — Detail-page render surface; new VideoClient sibling for video posts.
- `src/components/wear/PhotoSkeleton.tsx` — Suspense fallback; same pattern reused for video Suspense.
- `src/components/wears/WearsLane.tsx` — Stories lane; renders WearCard, segmented progress indicator. Phase 77 ensures video loop doesn't fight the lane's swipe controller (D-07 = don't auto-advance on video end).
- `src/components/home/WywtTile.tsx` + `src/components/home/WywtRail.tsx` — Home rail tile; needs play-icon overlay branch when wear is video (D-13/D-14).
- `src/app/wear/[wearEventId]/page.tsx` — Detail page; signed-URL minting in streamed Suspense child (Phase 26 Pitfall F-2 pattern). Phase 77 adds video signed-URL mint alongside.

### Cache + framework primitives (Next 16)

- `node_modules/next/dist/docs/` — Next 16 source of truth (per AGENTS.md project guardrail — DO NOT rely on training data for `revalidateTag`/`updateTag`/`cacheTag` semantics; check the local docs)
- `.planning/PROJECT.md` §"Durable lesson" — `revalidateTag` Next 16 signature drift (`revalidateTag(tag, 'max')` for cross-user SWR; `updateTag(tag)` for read-your-own-write). Phase 77's submit flow inherits this from Phase 76's `logWearWithVideo` (already uses the correct shape).

### Project-level patterns + guardrails

- `CLAUDE.md` — Tech stack, naming conventions, file structure, no GSD-bypass rule
- `AGENTS.md` — "This is NOT the Next.js you know"; read `node_modules/next/dist/docs/` before any Next 16 framework choice
- `.planning/codebase/CONVENTIONS.md` — TypeScript strict mode, absolute imports via `@/*`, `'use client'` directive placement
- `.planning/codebase/ARCHITECTURE.md` — Next 16 App Router; Zustand persist; client/server boundary rules

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`CameraCaptureView` getUserMedia gesture pattern** — `getUserMedia` MUST be the first `await` after a user tap (iOS Safari Pitfall 1 / threat T-15-01). The `cameraOpeningRef = useRef(false)` re-entrance guard prevents a rapid double-tap from acquiring two MediaStreams. Phase 77's video capture inherits both patterns verbatim.
- **`WristOverlaySvg`** — Renders identically over video capture preview (same wrapper, same aspect ratio). No changes needed.
- **`stripAndResize` pipeline** — Photos run through EXIF strip + 1080-cap. Video doesn't need EXIF strip (MediaRecorder emits no EXIF), and the 720p stream is already <1080 native; reuse the *poster* JPEG through this pipeline if any normalization is desired (Spike showed 169 KB at quality 0.85; further compression unnecessary).
- **`logWearWithVideo` Server Action** (Phase 76) — Phase 77 submit calls this with `{ wearEventId, watchId, videoBytes, today, note, visibility }`. The Server Action constructs the paths from `getCurrentUser().id` independently — client builders (`buildWearVideoPath`/`buildWearPosterPath`) are only for the direct-upload step.
- **CR-01 createSignedUrl probe pattern** (Phase 76) — Defense-in-depth pattern Phase 77 should mirror anywhere we probe object existence client-side.

### Established Patterns

- **3-state photo zone in ComposeStep** — `pre-capture chooser` | `live camera` | `post-capture preview`. Phase 77 extends to `pre-capture chooser` (+1 button) | `live camera` (photo OR video — same surface, different recorder) | `post-capture preview` (photo OR video — same wrapper, different player). State discriminated via `MediaState` union, NOT booleans.
- **Direct-upload-then-probe pattern** (Phase 15 → Phase 76) — Client uploads blob directly to Storage; Server Action HEAD-probes via `createSignedUrl` before inserting DB row; cleanup on insert failure. Phase 77 inherits this exactly — two uploads (video + poster) sequenced before the single Server Action call.
- **Either-or per post enforcement** — DB CHECK `wear_events_video_paths_required` is the last-line gate. UI enforces via discriminated `MediaState` so the action call site can only construct one of two valid input shapes.
- **`'use client'` boundary** — Compose flow is fully client-side (camera, MediaRecorder, blob handling); display flow uses Server Components with streamed signed-URL mint per Phase 26 Pitfall F-2.

### Integration Points

- **`logWearWithVideo` ↔ ComposeStep submit** — Submit pipeline: (1) `uploadWearVideo(userId, wearEventId, videoBlob)` direct to Storage at `${userId}/${wearEventId}.mp4`, (2) `uploadWearPoster(userId, wearEventId, posterBlob)` direct to Storage at `${userId}/${wearEventId}-poster.jpg`, (3) `logWearWithVideo({ wearEventId, watchId, videoBytes, today, note, visibility })`. Server Action probes both objects via createSignedUrl HEAD, inserts the row, returns `{ success: true, data: { wearEventId } }` → `router.push('/wear/${wearEventId}')`.
- **`WearCard` ↔ video render** — New `VideoPlayer` sibling to `WearPhotoClient`. Discriminator: `wear.mediaType === 'video'`. Photo render path stays untouched (VID-15).
- **`/wears/{username}` stories lane ↔ video loop** — `WearCard` inside `WearsLane` autoplays-loops; lane's segmented progress indicator advances on its own timer (don't couple to video's onEnded).
- **Tile play-icon overlay** — New `VideoPlayBadge` component reused by `WywtTile` (home rail), feed card, profile grid card. Single source of truth for sizing + styling.

</code_context>

<specifics>
## Specific Ideas

- **iOS 26.6 was the spike device.** Spike 001 confirmed `video/mp4;codecs=avc1.42000a` (H.264 Baseline) emitted by default. Cross-browser fallback to webm is for non-iOS browsers that don't support mp4 MediaRecorder (rare in 2026).
- **3.6 MB / 169 KB observed sizes.** 5 MB Server Action gate (Phase 76 VID-09) gives ~40% headroom; client-side pre-warn at 4 MB (VID-09) is UX-only. Poster well within Supabase's bucket file_size_limit.
- **`<Play>` icon from `lucide-react`** — already used elsewhere; no new icon dependency.
- **Spike test page exists** at `src/app/spike-mr-capture/` — Spike 001 cleanup note says delete after spike concludes. Phase 77 plan should include this deletion as a task (or earlier if it has security exposure as an unauthenticated route).

</specifics>

<deferred>
## Deferred Ideas

- **User-pick poster scrubber** (V2 polish per SEED-020 D-08) — Let user pick the poster frame interactively instead of the 3/4 default. Adds a step to compose; defer until 3/4 default proves insufficient in practice.
- **MediaRecorder bitrate constraint** (V2 optimization per Spike 001 Surprises #2) — Pass `{ videoBitsPerSecond: 2_000_000 }` to shrink 3.6 MB → ~600 KB at acceptable quality. Defer until storage cost becomes a real issue.
- **`/w/[ref]` carousel showing wear videos** (SEED-020 D-06) — Watch detail page carousel currently only shows photo wears; extending to videos requires DAL `getPublicWearPicsForWatch` filter widening + carousel render branch. Defer to a future milestone.
- **User-pick aspect ratio at capture** (square / landscape) — Portrait is the natural phone-camera output and matches the WYWT rail tile shape; would force an editor step otherwise.
- **WR-02 from Phase 76 review** — DAL readers (`getWearEventByIdForViewer`, `getWearEventsForViewer`, `getWearRailForViewer`, `getActiveWearsForUser`, `getPublicWearPicsForWatch`) currently don't select `media_type`/`media_path`/`poster_path`. Phase 77 OWNS this fix as part of the display path — every reader that surfaces a wear MUST include the 3 new columns OR explicitly bypass them. Not really deferred — folded into Phase 77 scope as a planning input.
- **`getPublicWearPicsForWatch` filter widening** — Currently hard-filters `isNotNull(photoUrl)`, which would make video-only wear events invisible to the watch detail carousel. Folded into Phase 77 IF the carousel surfaces video; otherwise deferred with the watch-detail-page carousel itself.
- **Spike test page deletion** — `src/app/spike-mr-capture/` should be deleted as part of Phase 77 (it's an unauthenticated route currently in prod from the spike push). Folded as a Phase 77 cleanup task.
- **Front-camera selfie mode for video** — Could add a camera-flip control during recording. Deferred as an optimization; wrist content is intrinsically back-camera.

</deferred>

---

*Phase: 77-video-capture-display-ui*
*Context gathered: 2026-06-23*
