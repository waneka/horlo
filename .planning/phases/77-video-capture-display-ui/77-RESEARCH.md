# Phase 77: Video Capture + Display UI — Research

**Researched:** 2026-06-23
**Domain:** MediaRecorder capture pipeline, Canvas poster extraction, discriminated MediaState union, DAL column-widening, signed-URL minting, multi-surface video render branching
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Mode-switch UX in ComposeStep**
- D-01: Three-button pre-capture chooser — "Take wrist shot" (camera-photo), "Record video" (new), "Upload photo". Parallel choices, no mode-toggle.
- D-02: Discard & re-record on post-capture preview. Clears blob + poster, returns to live camera view. Same `cameraOpeningRef` re-entrance guard pattern.
- D-03: Post-capture preview = inline autoplay-muted-loop video player + Discard button. Composer sees exactly what viewers see. Poster is implicit (extracted but not separately shown).
- D-04: Hide "Record video" button if MediaRecorder unsupported. Capability probe at mount. No disabled-state UX — button simply absent.

**Detail-page playback behavior**
- D-05: Autoplay-muted-loop on `/wear/{id}` AND `/wears/{username}`. `playsInline` REQUIRED on every `<video>` element.
- D-06: No native browser controls; tappable to pause/resume the loop. Custom `onClick` toggles `.pause()`/`.play()`.
- D-07: Stories lane uses the same autoplay-loop behavior. Don't pause segmented progress indicator on video; let it loop until user swipes manually.
- D-08: Video error fallback → show poster JPEG + subtle "Video unavailable" label. Poster signed URL is independently minted.

**Countdown UX during 3s recording**
- D-09: Progress ring around the record button (no numeric label). Visual sweep clockwise over 3.0s.
- D-10: No pre-record countdown. Tap "Record 3s" → recording starts immediately.
- D-11: Pulsing red dot in the preview top-left corner during recording.
- D-12: Cancel button stays active during recording — tapping aborts the clip. Returns to live camera, no blob produced.

**Tile play-icon affordance (feed / rail / profile grid)**
- D-13: Centered Play icon (filled triangle) with backdrop blur/circle. `lucide-react` `<Play fill="white" />` with semi-transparent rounded backdrop.
- D-14: Icon size scales with tile size (~24% of min side, capped). CSS `clamp()` or `useResizeObserver` + computed prop.
- D-15: No duration label on tiles. Every video is exactly 3 seconds — redundant noise.
- D-16: Play icon only on viewer-facing tiles, NOT on the composer's post-capture preview.

### Claude's Discretion
- VideoCaptureView component shape — new parallel component vs. common base
- Capability probe location — ComposeStep effect, shared hook, or module-scope const
- Front-vs-back camera default — back camera confirmed (environment, same as photo)
- Webm fallback codec selection — `MediaRecorder.isTypeSupported()` probe chain
- Poster extraction technique — Spike 001 canvas + currentTime = duration * 0.75 + toBlob('image/jpeg', 0.85)
- Signed URL caching — Phase 26 Pitfall F-2 (per-request, per-user, NEVER cached)
- Either-or enforcement at UI — discriminated `MediaState` union

### Deferred Ideas (OUT OF SCOPE)
- User-pick poster scrubber (v2 polish)
- MediaRecorder bitrate constraint (v2 optimization)
- `/w/[ref]` carousel showing wear videos (v8.4+ scope)
- User-pick aspect ratio at capture (portrait only)
- Front-camera selfie mode for video
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VID-01 | User can tap "Record video" in WYWT compose flow to switch to video capture mode (and back before submit) | D-01 three-button chooser; discriminated MediaState union gates which submit path fires |
| VID-02 | User can tap "Record 3s" → camera records for exactly 3.0 seconds with on-screen countdown → auto-stops cleanly | `setTimeout(recorder.stop, 3000)` pattern; D-09/D-10/D-11 countdown UX; progress ring via CSS animation |
| VID-03 | User can discard the recorded clip and re-record before submitting | D-02 Discard button; same `cameraOpeningRef` re-entrance guard; new MediaRecorder instance on re-record |
| VID-04 | Captured clips stored as mp4 when supported; webm fallback on older browsers | Capability probe chain; blob `.type` drives extension; `buildWearVideoPath` uses `.mp4` literal but extension should follow actual blob type |
| VID-05 | Poster JPEG extracted client-side from 3/4 through clip via `<canvas>` (no server transcoding) | Spike 001 validated: seeked `video.currentTime`, `canvas.toBlob('image/jpeg', 0.85)` |
| VID-06 | Each post is either one photo OR one video, never both | Discriminated `MediaState` union in ComposeStep; DB CHECK `wear_events_video_paths_required` is last-line gate |
| VID-13 | Video posts render as static poster + play-icon overlay in feed/rail/profile grid | New `VideoPlayBadge` component; `WearCard`, `WywtTile`, `WearsLane` render branch on `mediaType === 'video'` |
| VID-14 | `/wear/{id}` autoplays video muted-looped with `playsInline` (no fullscreen takeover on iOS) | New `WearVideoClient` parallel to `WearPhotoClient`; D-05/D-06 behavior |
| VID-15 | Existing photo wear flow is unchanged — photo posts render exactly as today on every surface | Additive-only changes: new props default to undefined/null; photo-render branch untouched; snapshot regression tests |
</phase_requirements>

---

## Summary

Phase 77 is a client-heavy UI phase that consumes the Phase 76 backend (schema, path builders, Server Action) and builds two distinct subsystems: a video capture pipeline inside the WYWT compose flow, and a video display pipeline across six render surfaces. Both subsystems are additive — photo posts must remain byte-identical on all surfaces (VID-15).

The capture subsystem requires a new `VideoCaptureView` component that manages a `MediaRecorder` instance, a 3-second auto-stop timer, a CSS progress ring, a pulsing red-dot recording indicator, a cancel affordance, and a canvas-based poster extraction step. The existing `CameraCaptureView` is the closest analog; the two should be parallel components sharing `WristOverlaySvg` and the `getUserMedia`-first gesture discipline, rather than a refactored common base. `ComposeStep` gains a third pre-capture button, a third MediaState discriminant, and a new submit path that calls `logWearWithVideo` instead of `logWearWithPhoto`.

The display subsystem requires DAL column-widening (WR-02) as a Wave 1 prerequisite before any render surface can know whether a wear is a photo or a video. WearCard receives new optional props (`mediaType`, `mediaPath`, `posterPath`, `signedVideoUrl`) and delegates to either `WearPhotoClient` (existing) or a new `WearVideoClient`. Tile surfaces receive a new `VideoPlayBadge` component. The detail page's `WearPhotoStreamed` server child is widened to mint both photo and video signed URLs.

**Primary recommendation:** Build `VideoCaptureView` as a new parallel component (not a common-base refactor), implement `useMediaCapability()` as a shared hook so capability results are testable and reusable, and treat DAL column-widening (WR-02) as a Wave 1 blocking task that every render surface depends on.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Camera permission + MediaStream acquisition | Browser / Client | — | getUserMedia is browser-only; gesture context must be preserved |
| MediaRecorder recording + timer | Browser / Client | — | MediaRecorder API is browser-only |
| Canvas poster extraction | Browser / Client | — | canvas.toBlob is browser-only |
| Video + poster upload to Storage | Browser / Client | — | Direct-upload pattern; auth scoped to browser session |
| `logWearWithVideo` Server Action | API / Backend | — | Auth, IDOR defense, Storage probes, DB insert |
| DAL reads (wear event + media columns) | API / Backend | — | server-only Drizzle queries |
| Signed URL minting (video + poster) | API / Backend (SSR) | — | Per-request, per-user; must NOT be cached; runs in streamed Suspense child |
| Tile play-icon overlay | Browser / Client | — | Pure render decoration on existing tile components |
| Video autoplay-muted-loop render | Browser / Client | — | `<video>` element behavior; `playsInline` iOS requirement |
| Video error fallback to poster | Browser / Client | — | `onError` event on `<video>`; poster signed URL independently minted |
| Capability probe | Browser / Client | — | `typeof MediaRecorder`, navigator.mediaDevices, MediaRecorder.isTypeSupported |
| Either-or UI enforcement | Browser / Client | API / Backend (CHECK) | Client enforces via discriminated union; DB CHECK is last-line |

---

## Implementation Approach (Claude's Discretion Items)

### Discretion Item 1: VideoCaptureView Component Shape

**Recommendation: New parallel component, NOT a common base refactor.**

`CameraCaptureView` takes a pre-acquired `MediaStream` as a prop and produces a JPEG blob via canvas snapshot. `VideoCaptureView` takes a pre-acquired `MediaStream` and produces a `{ videoBlob: Blob; posterBlob: Blob }` pair via `MediaRecorder` + canvas seek. The two components share the gesture-context discipline and `WristOverlaySvg`, but their internal state machines are completely different (busy flag vs. recording/progress/timer/countdown ring). Extracting a common base would require a complex generic that carries both output types and both recording modes — the abstraction cost exceeds the code-sharing benefit when the shared code is only a dozen lines of wrapper JSX.

Concrete guidance:
- New file: `src/components/wywt/VideoCaptureView.tsx`
- Props: `stream: MediaStream`, `onVideoReady: (result: { videoBlob: Blob; posterBlob: Blob }) => void`, `onError: (message: string) => void`, `onCancel: () => void`, `disabled?: boolean`
- Reuse `WristOverlaySvg` identically (same wrapper geometry, same `inset-0 absolute` positioning)
- `facingMode: { ideal: 'environment' }` — same as `CameraCaptureView` per Spike 001

**Tradeoff accepted:** Some JSX duplication in the outer wrapper div. The benefit is zero coupling between the two components' state machines and zero risk of the refactor breaking the existing photo path (VID-15).

### Discretion Item 2: Capability Probe Location

**Recommendation: Shared `useMediaCapability()` hook in `src/hooks/useMediaCapability.ts`.**

The probe needs to (a) run at or after component mount (browser APIs not available during SSR), (b) be testable in isolation with `vi.stubGlobal`, and (c) be reusable if a future surface also needs to know MediaRecorder support. A `useEffect` inside `ComposeStep` would work but is not testable in isolation and would scatter probe logic alongside ComposeStep's dense state machine. A module-scope const (`const SUPPORTS_VIDEO_CAPTURE = typeof MediaRecorder !== 'undefined' && ...`) runs at import time during SSR and would crash or return wrong results in the Next.js server environment.

Hook signature:
```typescript
// src/hooks/useMediaCapability.ts
export function useMediaCapability(): {
  supportsVideoCapture: boolean
  preferredMimeType: string | null
}
```

Returns `{ supportsVideoCapture: false, preferredMimeType: null }` on first render (before mount) and again after hydration if probe fails. The hook runs the probe chain in a `useEffect` with `[]` deps. `ComposeStep` gates the "Record video" button on `supportsVideoCapture` per D-04.

**Tradeoff accepted:** An extra `useState` round-trip means the "Record video" button is hidden on first render even in supported browsers. This is correct behavior — SSR renders without the button (server doesn't know the client's MediaRecorder support), hydration confirms support, and the button appears. This avoids a hydration mismatch.

### Discretion Item 3: Front-vs-Back Camera Default

**Confirmed: back camera (`facingMode: { ideal: 'environment' }`).**

Spike 001 used `environment` successfully. Wrist content is intrinsically back-camera. `ideal:` not `exact:` per the iOS gotcha documented in the Spike. [VERIFIED: Spike 001 README §Research]

### Discretion Item 4: Webm Fallback Codec Selection

**Recommendation: Probe chain with first-supported wins; extension from blob `.type`.**

```typescript
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null
}
```

Store the selected `mimeType` in a ref (not state — no re-render needed). After `onstop`, the blob `.type` property gives the actual recorded MIME type. The extension for the Storage upload derives from `blob.type.startsWith('video/mp4') ? '.mp4' : '.webm'` — never hard-coded.

`buildWearVideoPath` currently returns `${userId}/${wearEventId}.mp4` (hard-coded `.mp4`). This works for iOS (which always produces mp4). For webm-producing browsers, the client must use a different path shape. **Planning implication: the submit path must derive the extension from `videoBlob.type` and call `supabase.storage.from(...).upload(path, videoBlob, { contentType: videoBlob.type })` with the correct extension.** The Server Action currently hard-codes `.mp4` in the probe path too (see 76-03-PLAN.md). The WR-02 column widening that exposes `mediaPath` to renders must carry the actual path stored in `media_path`, which may end in `.webm` on non-iOS. [VERIFIED: 76-02-SUMMARY.md, Spike 001 §Surprises #1]

**Note for planner:** The Server Action's HEAD probe uses `${wearEventId}.mp4` hard-coded. For the MVP (iOS primary target), this is fine — iOS produces mp4. On non-iOS browsers that produce webm, the probe would fail. Recommend: the `videoBytes` check in the Server Action is format-agnostic; for MVP, accept this limitation and note it as a webm-extension follow-up (post-v8.3).

### Discretion Item 5: Poster Extraction Technique

**Recommendation: Verbatim reuse of Spike 001's canvas approach.**

```typescript
async function extractPosterBlob(videoBlob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(videoBlob)
    video.src = url
    video.muted = true
    video.playsInline = true
    video.onloadedmetadata = () => {
      video.currentTime = video.duration * 0.75  // 3/4 through clip (SEED-020 D-08)
    }
    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('canvas ctx unavailable')); return }
      ctx.drawImage(video, 0, 0)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        if (blob) resolve(blob)
        else reject(new Error('canvas.toBlob returned null'))
      }, 'image/jpeg', 0.85)
    }
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('video load failed')) }
  })
}
```

This runs after `MediaRecorder.stop()` fires `onstop` and the final `ondataavailable` chunk has been collected. The object URL is revoked after `toBlob` resolves. [VERIFIED: Spike 001 §Results — 169 KB JPEG at 720×1280]

**iOS Safari gotcha:** In some Safari versions, `ondataavailable` fires AFTER `onstop`. Always collect chunks via an array pushed in `ondataavailable`, and only `new Blob(chunks, { type: mimeType })` inside `onstop`. Do not start poster extraction until inside `onstop` after the blob is assembled.

### Discretion Item 6: Signed URL Caching for Video + Poster

**Confirmed: per-request, per-user, NEVER cached. Both URLs minted inline in the streamed Suspense child.**

This is Pitfall F-2 carried forward from Phase 26. The `WearPhotoStreamed` server child (in `/wear/[wearEventId]/page.tsx`) currently mints a single photo signed URL with a 60-minute TTL. Phase 77 extends this to mint BOTH a video signed URL AND a poster signed URL when `wear.mediaType === 'video'`. The poster URL is the fallback when video errors (D-08).

Admin client (NOT cookie client) must be used for signing. Non-owner cover photo signing fails to placeholder otherwise (durable memory `project_phase_61_complete`). Use `createSupabaseServerClient()` which returns the admin-scoped server client in the existing pattern.

### Discretion Item 7: Either-Or Enforcement at UI

**Recommendation: Extend `MediaState` as a discriminated union in `src/lib/wywtTypes.ts` (or a new `src/lib/wywtVideoTypes.ts`).**

Current: `WywtPostDialog` holds `photoBlob: Blob | null` in state. Phase 77 replaces this with a discriminated union so the submit-path code can never send both:

```typescript
// Proposed extension to src/lib/wywtTypes.ts
export type MediaState =
  | { kind: 'none' }
  | { kind: 'photo'; blob: Blob }
  | { kind: 'video'; videoBlob: Blob; posterBlob: Blob }
```

`ComposeStep` consumes `mediaState: MediaState` and `setMediaState` (replacing `photoBlob`/`setPhotoBlob`). The submit handler switches on `mediaState.kind` to call `logWearWithPhoto` or `logWearWithVideo`. TypeScript's exhaustive union ensures no branch can send both.

**WywtPostDialog signature change:** `photoBlob: Blob | null` / `setPhotoBlob` props replaced by `mediaState: MediaState` / `setMediaState`. The outer dialog retains `mediaState.kind === 'none'` on open. The "Change" link resets to `{ kind: 'none' }`.

---

## Surface Inventory + WR-02 Closure

All DAL readers that surface a wear event to render logic currently omit `media_type`, `media_path`, and `poster_path` from their SELECT lists. WR-02 is a Wave 1 prerequisite — until these columns are in the returned objects, every render surface is blocked from branching on `mediaType === 'video'`.

### DAL Readers (Wave 1 — "read+render" upstream; blocks everything else)

| DAL function | File | Currently selects media columns? | WR-02 action |
|---|---|---|---|
| `getWearEventByIdForViewer` | `src/data/wearEvents.ts` | No — only `photoUrl` | Add `mediaType`, `mediaPath`, `posterPath` to SELECT |
| `getWearEventsForViewer` | `src/data/wearEvents.ts` | No — only `photoUrl` | Add `mediaType`, `mediaPath`, `posterPath` to SELECT |
| `getWearRailForViewer` | `src/data/wearEvents.ts` | No — only `photoUrl` | Add `mediaType`, `mediaPath`, `posterPath` to SELECT (also update `WywtTile` type) |
| `getActiveWearsForUser` | `src/data/wearEvents.ts` | No — only `photoUrl` | Add `mediaType`, `mediaPath`, `posterPath` to SELECT |
| `getPublicWearPicsForWatch` | `src/data/wearEvents.ts` | No — hard-filters `isNotNull(wearEvents.photoUrl)` | **DEFERRED** — watch detail carousel is out of scope (per CONTEXT.md deferred); leave as-is |
| `getAllWearEventsByUser` (internal) | `src/data/wearEvents.ts` | No | Add `mediaType`, `mediaPath`, `posterPath` for completeness; called by `getWearEventsForViewer` owner bypass |

### Type Updates (Wave 1, required before render surfaces)

| Type | File | Change |
|---|---|---|
| `WywtTile` | `src/lib/wywtTypes.ts` | Add `mediaType: 'photo' \| 'video'`, `mediaPath: string \| null`, `posterPath: string \| null` |
| `WearSlide` | `src/components/wears/WearsLane.tsx` | Add `mediaType`, `mediaPath`, `posterPath`, `signedVideoUrl: string \| null`, `signedPosterUrl: string \| null` |
| `MediaState` | `src/lib/wywtTypes.ts` | Add discriminated union as described in Discretion Item 7 |

### Render Surfaces (Wave 2 — "render-only", consume updated DAL rows)

| Surface | File | Change type | What changes |
|---|---|---|---|
| `WearCard` | `src/components/wear/WearCard.tsx` | render-only | New optional props: `mediaType`, `signedVideoUrl`, `signedPosterUrl`. Render branch: if `mediaType === 'video'` → `WearVideoClient` instead of `WearPhotoClient`. `signedUrl` remains for the photo branch. |
| `WearPhotoClient` | `src/components/wear/WearPhotoClient.tsx` | **UNCHANGED** — VID-15 regression gate | Zero edits. Photo branch delegates here. |
| `WearVideoClient` (new) | `src/components/wear/WearVideoClient.tsx` | new component | Renders `<video autoPlay muted loop playsInline>` with poster, `onClick` toggle, D-08 error fallback |
| `WearDetailHero` | `src/components/wear/WearDetailHero.tsx` | **UNCHANGED** | Zero edits. Only renders when `signedUrl === null` (no-photo fallback). |
| `WearPhotoStreamed` (in `/wear/[wearEventId]/page.tsx`) | `src/app/wear/[wearEventId]/page.tsx` | read+render | Mint video + poster signed URLs when `mediaType === 'video'`; pass them as new props to `WearCard` |
| `WywtTile` | `src/components/home/WywtTile.tsx` | render-only | Add `VideoPlayBadge` overlay when `tile.mediaType === 'video'`; tile image remains the poster (signed) |
| `WywtRail` / `src/app/page.tsx` | `src/components/home/WywtRail.tsx` / `src/app/page.tsx` | read+render | Home page Server Component mints poster signed URL for video tiles; WywtRail passes to WywtTile |
| `WearsLane` | `src/components/wears/WearsLane.tsx` | render-only | `WearSlide` gets video fields; `WearCard` already handles the branch |
| `/wears/[username]/page.tsx` | `src/app/wears/[username]/page.tsx` | read+render | Mint video + poster signed URLs for each slide when `mediaType === 'video'` |
| Activity feed card | Unknown — needs investigation | potentially read+render | Depends on how activity feed surfaces wear events; may get media columns for free if it reads from a DAL that's already widened |
| `VideoPlayBadge` (new) | `src/components/wear/VideoPlayBadge.tsx` | new component | Shared centered Play icon with semi-transparent backdrop; consumed by `WywtTile`, `WearCard` tile contexts |

---

## Capture Pipeline (Client-Side)

The following sequence describes what happens from the moment the user taps "Record video" to the moment both blobs are ready for upload. It mirrors the architecture of `CameraCaptureView` + `ComposeStep` but for the video path.

### Pre-Conditions
- `useMediaCapability()` hook returned `{ supportsVideoCapture: true }` — button is visible
- `cameraOpeningRef.current === false` — no concurrent stream acquisition in flight
- `cameraStream === null` — no existing stream open

### Step 1: User taps "Record video" in the pre-capture chooser
- `ComposeStep.handleTapVideoCamera()` is called
- Synchronous re-entrance guard: `if (cameraOpeningRef.current) return`; set `cameraOpeningRef.current = true`
- **PITFALL 1 / CRITICAL: `getUserMedia` MUST be the first `await`. No setState, no fetch, no other await runs first.** iOS Safari revokes the gesture context after any microtask boundary.
- `const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })`
- On success: `setCameraStream(stream); setMediaSource('video'); cameraOpeningRef.current = false`
- On error: `setError(...)` appropriate message; `cameraOpeningRef.current = false`

### Step 2: VideoCaptureView mounts with the stream
- `stream` prop wired into `<video ref={videoRef} autoPlay playsInline muted>` via `useEffect`
- `WristOverlaySvg` overlaid identically to `CameraCaptureView`
- User sees live preview; can tap "Record 3s" or "Cancel"

### Step 3: User taps "Record 3s"
- `handleStartRecording()` called
- `mimeType = preferredMimeType` from `useMediaCapability()` (e.g. `'video/mp4;codecs=avc1'`)
- `const recorder = new MediaRecorder(stream, { mimeType })`
- `chunks: BlobPart[] = []`
- `recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }`
- `recorder.onstop = () => { const videoBlob = new Blob(chunks, { type: mimeType }); handleVideoReady(videoBlob) }`
- `recorder.start()` — starts recording
- State: `setRecording(true)` — triggers progress ring CSS animation + pulsing red dot (D-09, D-11)
- `stopTimer = setTimeout(() => recorder.stop(), 3000)` — auto-stop at exactly 3.0s (D-02)

### Step 4: Auto-stop at 3.0s (or user taps Cancel)
- If auto-stop: `recorder.stop()` fires — `onstop` assembles the blob
- If user taps Cancel: `clearTimeout(stopTimer); recorder.stop(); setCancelled(true)` — `onstop` fires but `cancelled` ref is checked and blob is discarded; stream stays alive for a fresh take
- Progress ring CSS animation completes
- State: `setRecording(false); setExtracting(true)` (brief loading state while poster extraction runs)

### Step 5: Poster extraction (inside `onstop`)
- `if (cancelled) return` — guard against cancel path
- `const posterBlob = await extractPosterBlob(videoBlob)` — creates an off-screen `<video>`, seeks to `duration * 0.75`, draws to canvas, calls `toBlob('image/jpeg', 0.85)`
- On success: `onVideoReady({ videoBlob, posterBlob })`
- On error: `setError('Could not extract poster — please re-record.')` and return to live preview

### Step 6: ComposeStep receives `{ videoBlob, posterBlob }` via `handleVideoReady`
- `setMediaState({ kind: 'video', videoBlob, posterBlob })`
- Camera stream stopped: `stream.getTracks().forEach(t => t.stop()); setCameraStream(null)`
- UI transitions to post-capture preview (D-03): `<video autoPlay muted loop playsInline src={URL.createObjectURL(videoBlob)} />` + Discard button (D-16: NO `VideoPlayBadge` here)

### Pitfall 1: iOS Gesture Context
- `getUserMedia` MUST be the first `await` in `handleTapVideoCamera`
- The `cameraOpeningRef = useRef(false)` re-entrance guard prevents a rapid double-tap from acquiring two MediaStreams
- Pattern enforced architecturally: `ComposeStep` acquires the stream and passes it to `VideoCaptureView` as a prop — `VideoCaptureView` cannot accidentally call `getUserMedia` itself

### Pitfall 2: MediaRecorder chunk ordering on iOS
- Safari may fire `ondataavailable` AFTER `onstop` in some versions
- Always push chunks in `ondataavailable` and assemble the `Blob` inside `onstop` ONLY, after all `ondataavailable` events have been processed. The `onstop` fires after all buffered `ondataavailable` events.

---

## Submit Pipeline (Client → Server Action)

When `mediaState.kind === 'video'` and the user taps "Log wear":

### Step 1: Upload video blob to Storage
```typescript
const videoPath = buildWearVideoPath(viewerId, wearEventId)
// NOTE: extension follows blob.type for non-iOS correctness
const actualExt = mediaState.videoBlob.type.startsWith('video/mp4') ? '.mp4' : '.webm'
// MVP: buildWearVideoPath always returns .mp4 — acceptable for iOS primary target
const supabase = createSupabaseBrowserClient()
const { error: videoError } = await supabase.storage
  .from('wear-photos')
  .upload(videoPath, mediaState.videoBlob, {
    contentType: mediaState.videoBlob.type,
    upsert: false,  // Pitfall F-4
  })
if (videoError) { setError('Video upload failed — please try again.'); return }
```

### Step 2: Upload poster blob to Storage
```typescript
const posterPath = buildWearPosterPath(viewerId, wearEventId)
const { error: posterError } = await supabase.storage
  .from('wear-photos')
  .upload(posterPath, mediaState.posterBlob, {
    contentType: 'image/jpeg',
    upsert: false,
  })
if (posterError) {
  // Best-effort cleanup of the video that already uploaded
  await supabase.storage.from('wear-photos').remove([videoPath])
  setError('Poster upload failed — please try again.')
  return
}
```

### Step 3: Call Server Action
```typescript
const result = await logWearWithVideo({
  wearEventId,
  watchId: watch.id,
  note: note.trim().length > 0 ? note.trim() : null,
  visibility,
  videoBytes: mediaState.videoBlob.size,  // Server gate VID-09
  today: todayLocalISO(),
})
if (!result.success) { setError(result.error); return }
```

### Step 4: Navigate
```typescript
router.push(`/wear/${wearEventId}`)
onSubmitted()
```

### Failure Modes

| Stage | Failure | Client action |
|---|---|---|
| Video upload | Supabase storage error | Show error; no cleanup needed (video never uploaded) |
| Poster upload | Supabase storage error | Best-effort remove video; show error |
| Server Action: auth | Returns `'Not authenticated'` | Show error |
| Server Action: oversize | Returns `'Video too large — maximum 5 MB'` | Show error (client should have pre-warned at 4 MB) |
| Server Action: IDOR | Returns `'Watch not found'` | Show error |
| Server Action: HEAD probe miss | Returns `'Video upload failed — please try again'` | Show error (upload may have succeeded but probe didn't see it) |
| Server Action: DAL 23505 | Returns `'Already logged this watch today'` | Show error; Server Action already compensating-deleted both Storage objects |
| Server Action: DAL other | Returns `'Could not log that wear. Please try again.'` | Show error; Server Action already compensating-deleted both |
| Network mid-flight | `fetch` throws | Catch in `startTransition`; show generic error |

**Note:** The 4 MB client-side pre-warn (showing a non-fatal warning while the user is composing) is a UX nicety that can be implemented as a `useEffect` or computed value watching `mediaState.videoBlob?.size`. It does not block submit — the server rejects at 5 MB. [CITED: 76-03-PLAN.md §truths]

---

## Display Surfaces

### WywtTile (Home Rail Tile)
When `tile.mediaType === 'video'`:
- Render the poster signed URL (NOT the video) as the tile background — same `<Image fill className="object-cover">` as the current `tile.photoUrl ?? tile.imageUrl` branch
- Overlay `<VideoPlayBadge>` centered over the tile (D-13, D-14)
- The play badge is NOT rendered when `tile.mediaType !== 'video'` (VID-15 regression preservation)
- The signed URL minted in `src/app/page.tsx` covers the poster (same bucket path `{userId}/{wearEventId}-poster.jpg`)
- Tile tap navigates to `/wears/{username}?from={wearEventId}` exactly as photo tiles do — no change to navigation behavior

### WearCard (Shared: /wear/{id}, /wears/{username}, Profile Grid)
New optional props: `mediaType?: 'photo' | 'video'`, `signedVideoUrl?: string | null`, `signedPosterUrl?: string | null`.

When `mediaType === 'video'`:
```tsx
{signedVideoUrl !== null ? (
  <WearVideoClient
    signedVideoUrl={signedVideoUrl}
    signedPosterUrl={signedPosterUrl}
    /* ...overlay props unchanged... */
  />
) : (
  // fallback: show poster static image if video URL unavailable
  <WearDetailHero watchImageUrl={signedPosterUrl} /* ...rest... */ />
)}
```

When `mediaType !== 'video'` (default / undefined / 'photo'): existing `signedUrl` / `WearPhotoClient` / `WearDetailHero` path is UNCHANGED. Photo posts must be byte-identical before and after Phase 77 (VID-15). [VERIFIED: WearCard.tsx — current conditional on `signedUrl !== null`]

### WearVideoClient (New Component)
File: `src/components/wear/WearVideoClient.tsx`

Parallel to `WearPhotoClient`. No retry state machine needed (videos are not subject to the 200–800ms CDN propagation window that photos have — the Server Action HEAD-probes before returning success, and the detail page is not opened until after `router.push` on success).

Behavior (D-05, D-06, D-08):
```tsx
'use client'

export function WearVideoClient({ signedVideoUrl, signedPosterUrl, ...overlayProps }) {
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  if (failed || !signedVideoUrl) {
    // D-08: show poster + "Video unavailable" label
    return (
      <div className="relative w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto">
        {signedPosterUrl && <img src={signedPosterUrl} ... />}
        <span className="absolute bottom-2 left-2 text-xs text-white/70">Video unavailable</span>
        <WearPhotoOverlays {...overlayProps} hasPhoto={!!signedPosterUrl} />
      </div>
    )
  }

  return (
    <div className="relative w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto"
         onClick={() => {
           // D-06: tap to pause/resume loop
           if (videoRef.current?.paused) { videoRef.current.play(); setPaused(false) }
           else { videoRef.current?.pause(); setPaused(true) }
         }}>
      <video
        ref={videoRef}
        src={signedVideoUrl}
        autoPlay
        muted
        loop
        playsInline              // REQUIRED — iOS goes fullscreen without this
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
      <WearPhotoOverlays {...overlayProps} hasPhoto={true} />
    </div>
  )
}
```

### WearDetailHero + WearPhotoClient
**UNCHANGED.** Phase 77 adds no code to these files. The `WearCard` discriminates BEFORE delegating to them. [VERIFIED: WearDetailHero.tsx, WearPhotoClient.tsx — current code read]

### WearsLane (Stories Lane)
`WearSlide` interface gains `mediaType`, `mediaPath`, `posterPath`, `signedVideoUrl`, `signedPosterUrl` fields. `WearsLane` passes them as spread props through to `WearCard` (which already handles the branch). D-07: the segmented progress indicator timer MUST NOT be coupled to the `video.onEnded` event — it already runs on its own `selectedIndex` logic in embla's `'select'` event. Video loops indefinitely; progress bar advances only on slide change. [VERIFIED: WearsLane.tsx — `setSelectedIndex` is driven by `emblaApi.on('select', ...)`, not by any video event]

---

## Signed URL Minting Pattern

### Pattern (Pitfall F-2 — verified in Phase 26 and Phase 61)
- Mint inline in the **streamed Suspense child** on the server — NEVER in the DAL, NEVER in a `'use cache'` function, NEVER in a React `useMemo` or `useEffect` on the client
- Both video and poster URLs must be minted in the SAME server child (one call site, no race)
- Use the admin/server Supabase client (`createSupabaseServerClient()`) NOT `createSupabaseBrowserClient()` — non-owner cover signing fails to placeholder with the cookie client
- 60-minute TTL (same as photo signed URLs)

### Extension for Video in `WearPhotoStreamed`
```typescript
// In WearPhotoStreamed (src/app/wear/[wearEventId]/page.tsx)
let signedUrl: string | null = null
let signedVideoUrl: string | null = null
let signedPosterUrl: string | null = null

if (wear.mediaType === 'video') {
  const supabase = await createSupabaseServerClient()
  // Mint both URLs; either can fail independently
  const [videoResult, posterResult] = await Promise.all([
    wear.mediaPath
      ? supabase.storage.from('wear-photos').createSignedUrl(wear.mediaPath, 60 * 60)
      : { data: null },
    wear.posterPath
      ? supabase.storage.from('wear-photos').createSignedUrl(wear.posterPath, 60 * 60)
      : { data: null },
  ])
  signedVideoUrl = videoResult.data?.signedUrl ?? null
  signedPosterUrl = posterResult.data?.signedUrl ?? null
} else if (wear.photoUrl) {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.storage.from('wear-photos').createSignedUrl(wear.photoUrl, 60 * 60)
  signedUrl = data?.signedUrl ?? null
}
```

Pass `signedVideoUrl` and `signedPosterUrl` as new props to `WearCard`.

### Same Pattern for WearsLane and WywtRail
Each server component that resolves a list of wear events must also mint URLs per-item. For WywtRail (home page), the tile loop must check `tile.mediaType === 'video'` and mint the poster URL (video itself is not auto-played in the tile — only the poster static image is needed at the tile level). For WearsLane, the slide loop mints both URLs per-slide for video slides. [VERIFIED: src/app/page.tsx pattern for photo URL minting; src/app/wears/[username]/page.tsx for slide URL minting — reviewed indirectly via DAL and component structure]

**PPR / `await connection()` consideration:** `/wear/[wearEventId]/page.tsx` currently does NOT use `await connection()`. The page fetches `getCurrentUser()` which is a request-time API that already opts out of the static shell. The Suspense boundary around `WearPhotoStreamed` is already correct. No additional `connection()` call is needed. [VERIFIED: src/app/wear/[wearEventId]/page.tsx — current code does not call connection(); it calls getCurrentUser() which triggers dynamic rendering; durable memory `project_ppr_dynamic_before_use_cache` pattern confirmed]

---

## Capability Probe Strategy

### Exact Probe Sequence
```typescript
// src/hooks/useMediaCapability.ts
'use client'

import { useState, useEffect } from 'react'

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const

export interface MediaCapability {
  supportsVideoCapture: boolean
  preferredMimeType: string | null
}

export function useMediaCapability(): MediaCapability {
  const [cap, setCap] = useState<MediaCapability>({
    supportsVideoCapture: false,  // default: hidden until probe runs
    preferredMimeType: null,
  })

  useEffect(() => {
    // All three checks required (D-04):
    // 1. MediaRecorder API exists in the browser
    // 2. getUserMedia is available (HTTPS gate — fails in insecure contexts)
    // 3. At least one supported mimeType exists
    if (typeof MediaRecorder === 'undefined') return
    if (!navigator.mediaDevices?.getUserMedia) return
    const preferred = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null
    if (preferred) {
      setCap({ supportsVideoCapture: true, preferredMimeType: preferred })
    }
  }, [])

  return cap
}
```

### How it gates D-04
In `ComposeStep`:
```tsx
const { supportsVideoCapture } = useMediaCapability()
// In the pre-capture chooser:
{supportsVideoCapture && (
  <Button type="button" variant="outline" onClick={handleTapVideoCamera}>
    Record video
  </Button>
)}
```

The button is absent (not disabled) when unsupported. Per D-04, no disabled-state UX is needed.

### Why a hook rather than module-scope const
Module-scope evaluation runs at import time including during SSR. `typeof MediaRecorder !== 'undefined'` is `false` in the Node.js SSR environment — a module-scope const would always return `false`. A `useEffect` runs only in the browser after hydration, correctly detecting capability. [ASSUMED — browser-vs-SSR environment behavior of `typeof MediaRecorder`; however this is fundamental JS/Node.js behavior, effectively certain]

---

## Validation Architecture

`nyquist_validation` is enabled in `.planning/config.json`. Required test coverage for Phase 77:

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing; `vitest.config.ts` or package.json scripts) |
| Config file | Check `vitest.config.ts` at project root |
| Quick run command | `npx vitest run tests/unit/ tests/actions/ tests/components/wear/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | File | Automated Command |
|--------|----------|-----------|------|-------------------|
| VID-01 | "Record video" button appears when MediaRecorder supported; hidden when unsupported | unit | `tests/hooks/useMediaCapability.test.ts` | `npx vitest run tests/hooks/useMediaCapability.test.ts` |
| VID-01 | ComposeStep renders 3 buttons (not 2) when `supportsVideoCapture=true` | unit | `tests/components/wywt/ComposeStep.video.test.tsx` | `npx vitest run tests/components/wywt/ComposeStep.video.test.tsx` |
| VID-02 | MediaRecorder auto-stops at exactly 3000ms | unit | `tests/unit/videoCapture.test.ts` | `npx vitest run tests/unit/videoCapture.test.ts` |
| VID-03 | Discard returns to live camera; recording state resets | unit | `tests/components/wywt/VideoCaptureView.test.tsx` | `npx vitest run tests/components/wywt/VideoCaptureView.test.tsx` |
| VID-04 | Probe chain selects mp4 first, webm fallback | unit | `tests/hooks/useMediaCapability.test.ts` | same |
| VID-05 | Poster extraction: `video.currentTime = duration * 0.75` before `toBlob` | unit | `tests/unit/posterExtraction.test.ts` | `npx vitest run tests/unit/posterExtraction.test.ts` |
| VID-06 | MediaState discriminated union prevents `{ kind: 'photo' }` and `{ kind: 'video' }` co-existing (compile-time via TypeScript + runtime via discriminant) | unit (TS) | Enforced by TypeScript strict mode at compile time; smoke-test the union narrowing in the submit handler test |
| VID-13 | `WywtTile` renders `VideoPlayBadge` when `mediaType='video'`, not when `mediaType='photo'` | unit | `tests/components/home/WywtTile.video.test.tsx` | `npx vitest run tests/components/home/WywtTile.video.test.tsx` |
| VID-13 | `WearCard` renders video branch when `mediaType='video'` | unit | `tests/components/wear/WearCard.video.test.tsx` | `npx vitest run tests/components/wear/WearCard.video.test.tsx` |
| VID-14 | `WearVideoClient` renders `<video>` with `autoPlay muted loop playsInline` | unit | `tests/components/wear/WearVideoClient.test.tsx` | `npx vitest run tests/components/wear/WearVideoClient.test.tsx` |
| VID-14 | `WearVideoClient` shows poster + "Video unavailable" on `onError` | unit | same | same |
| VID-15 | `WearCard` photo branch: no regression — same DOM output as pre-Phase-77 when `mediaType` prop is absent/undefined | unit | `tests/components/wear/WearCard.test.tsx` (extend existing) | `npx vitest run tests/components/wear/WearCard.test.tsx` |
| VID-15 | `WearPhotoClient` is not modified — existing tests still pass | regression | `tests/components/wear/` (any existing WearPhotoClient tests) | `npx vitest run tests/components/wear/` |
| WR-02 | DAL readers return `mediaType`, `mediaPath`, `posterPath` | unit | `tests/unit/dalMediaColumns.test.ts` (mock or integration) | `npx vitest run tests/unit/dalMediaColumns.test.ts` |

### Key Test Patterns

**Timer test (VID-02) — vi.useFakeTimers:**
```typescript
// tests/unit/videoCapture.test.ts
import { vi } from 'vitest'

it('MediaRecorder.stop() is called at 3000ms', () => {
  vi.useFakeTimers()
  const mockRecorder = {
    start: vi.fn(),
    stop: vi.fn(),
    ondataavailable: null,
    onstop: null,
    state: 'inactive',
  }
  // Call the start recording handler
  startRecording(mockRecorder, ...)
  vi.advanceTimersByTime(3000)
  expect(mockRecorder.stop).toHaveBeenCalledTimes(1)
  vi.useRealTimers()
})
```

**Capability probe test:**
```typescript
// tests/hooks/useMediaCapability.test.ts
it('supportsVideoCapture=true when MediaRecorder + mp4 supported', () => {
  vi.stubGlobal('MediaRecorder', {
    isTypeSupported: (m: string) => m === 'video/mp4;codecs=avc1',
  })
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn() },
    configurable: true,
  })
  const { result } = renderHook(() => useMediaCapability())
  act(() => {}) // flush useEffect
  expect(result.current.supportsVideoCapture).toBe(true)
  expect(result.current.preferredMimeType).toBe('video/mp4;codecs=avc1')
  vi.unstubAllGlobals()
})
```

**VID-15 regression test:**
```typescript
// tests/components/wear/WearCard.test.tsx (extend existing)
it('VID-15: photo WearCard is unchanged when mediaType prop absent', () => {
  const { container } = render(<WearCard signedUrl="https://..." /* ...all existing props, NO mediaType */ ... />)
  // Assert no <video> element in output
  expect(container.querySelector('video')).toBeNull()
  // Assert existing photo img is present
  expect(container.querySelector('img[src="https://..."]')).toBeTruthy()
})
```

**Poster extraction test:**
```typescript
// tests/unit/posterExtraction.test.ts
it('seeks to duration * 0.75 before toBlob', async () => {
  const mockVideo = {
    src: '',
    muted: false,
    playsInline: false,
    duration: 3.0,
    videoWidth: 720,
    videoHeight: 1280,
    onloadedmetadata: null as (() => void) | null,
    onseeked: null as (() => void) | null,
    onerror: null as (() => void) | null,
    currentTime: 0,
  }
  // Trigger the extraction, simulate events
  const promise = extractPosterBlob(new Blob())
  // mockVideo.currentTime should be set to 2.25 (3.0 * 0.75)
  expect(mockVideo.currentTime).toBe(2.25)
})
```

### Wave 0 Gaps (files that don't yet exist — create in Wave 0)
- [ ] `tests/hooks/useMediaCapability.test.ts` — capability probe unit tests
- [ ] `tests/unit/videoCapture.test.ts` — MediaRecorder timer test + cancel guard
- [ ] `tests/unit/posterExtraction.test.ts` — canvas seek + toBlob
- [ ] `tests/components/wywt/VideoCaptureView.test.tsx` — component render + discard behavior
- [ ] `tests/components/wywt/ComposeStep.video.test.tsx` — 3-button chooser + video submit path
- [ ] `tests/components/wear/WearVideoClient.test.tsx` — autoplay attrs + error fallback
- [ ] `tests/components/wear/WearCard.video.test.tsx` — video branch rendering + VID-15 regression
- [ ] `tests/components/home/WywtTile.video.test.tsx` — VideoPlayBadge overlay

**No Wave 0 framework install needed** — Vitest, @testing-library/react, jsdom all already in use (confirmed by existing test files).

---

## Risks + Landmines

### Risk 1: VID-15 Regression (WearCard shared render path)

WearCard is used in 4+ contexts: `/wear/{id}`, `/wears/{username}`, profile grid, and activity feed. Adding new props (`mediaType`, `signedVideoUrl`, `signedPosterUrl`) as optional with defaults preserves all existing call sites. The risk is an unintentional change to the `signedUrl !== null` branch — if any refactor accidentally changes when `WearPhotoClient` is called, photo posts break silently.

**Mitigation:** Make new props strictly optional with `| undefined` default. Add a snapshot-style unit test that asserts `container.querySelector('video')` is null when `mediaType` is absent. Never modify `WearPhotoClient.tsx` or `WearDetailHero.tsx` in Phase 77.

### Risk 2: iOS Gesture Context for Video (getUserMedia)

The `handleTapVideoCamera` handler in ComposeStep MUST call `navigator.mediaDevices.getUserMedia` as the first `await`, with no preceding `await`, `setState`, or `fetch`. If any code is inserted before the `getUserMedia` call (e.g., a capability re-check, an analytics call, a `setError(null)` async operation), iOS Safari will revoke the gesture context and camera permission will silently fail with `NotAllowedError`.

**Mitigation:** `cameraOpeningRef.current = true` (synchronous, not setState) before the `await`. This is the same pattern used in `handleTapCamera` in ComposeStep. The `VideoCaptureView` component NEVER calls `getUserMedia` itself — it receives the stream as a prop. This makes the discipline architecturally enforced. [VERIFIED: CameraCaptureView.tsx comment at top of file]

### Risk 3: PPR / Suspense Static Shell on `/wear/[id]`

`/wear/[wearEventId]/page.tsx` currently calls `getCurrentUser()` which is a request-time API that opts out of static prerendering. The Suspense boundary around `WearPhotoStreamed` is already correct. Adding video URL minting to `WearPhotoStreamed` does not change the dynamic-rendering behavior. No `await connection()` is needed.

However, if any Phase 77 plan adds a NEW Suspense boundary or restructures the page in a way that could produce a static shell, the PPR #419 issue (durable memory `project_ppr_dynamic_before_use_cache`) would resurface. Keep the Suspense structure identical to the current form — extend `WearPhotoStreamed`, don't add new boundaries.

### Risk 4: Spike Test Page Deletion (Unauthenticated Prod Route)

`src/app/spike-mr-capture/` is currently live in production as an unauthenticated route. It was pushed to `main` during the spike and never removed. This must be the FIRST task in Wave 1 (or a standalone quick task before Wave 1 begins). Leaving it open is a security exposure — any URL visitor can access the camera capture page without auth.

**Mitigation:** Delete `src/app/spike-mr-capture/` (the entire directory) in Wave 1 Task 1. This is a simple directory deletion with no downstream dependencies.

### Risk 5: Either-Or UI Enforcement (Discriminated Union vs. Booleans)

If the `MediaState` discriminated union is implemented incorrectly (e.g., using two separate boolean flags `hasPhoto: boolean` and `hasVideo: boolean` instead of a discriminant), it becomes possible to construct an invalid state where both are true. The DB CHECK `wear_events_video_paths_required` catches this at the DB layer, but the user experience would be broken (which submit path fires?).

**Mitigation:** `MediaState` must be a discriminated union with `kind: 'none' | 'photo' | 'video'`. TypeScript's exhaustive check in the submit handler switch statement makes this a compile-time guarantee. Never use boolean flags.

### Risk 6: Webm Extension Drift

`buildWearVideoPath` returns `${userId}/${wearEventId}.mp4` — the `.mp4` extension is hard-coded. The Server Action's Storage HEAD probe also hard-codes `${wearEventId}.mp4`. On iOS this is correct (all iOS recordings are mp4). On non-iOS browsers that record webm, the upload path and the probe path would both be wrong. For MVP (iOS primary target), this is acceptable. The extension drift is a known limitation documented in CONTEXT.md and deferred.

**For the planner:** The submit pipeline in ComposeStep must upload to the `buildWearVideoPath` path (`.mp4`) regardless of actual blob type for MVP — or alternatively, carry the actual extension through the MediaState union. If the planner wants webm correctness, `MediaState.kind === 'video'` should include a `mimeType: string` field and the upload path derived accordingly. This is a planning-level decision.

### Risk 7: Signed URL Admin Client

`createSignedUrl` for video and poster must use the same `createSupabaseServerClient()` (admin client) used for photo signed URLs, NOT `createSupabaseBrowserClient()`. The browser client uses the cookie-scoped session, which can fail for non-owner covers (Phase 61 lesson). The server client uses the service role. The pattern is already established in `WearPhotoStreamed` — extend it, don't diverge.

### Risk 8: Stories Lane Segmented Progress Decoupling from Video

D-07 specifies: don't pause the segmented progress indicator on video; let it loop until the user swipes. The current WearsLane progress indicator is driven by embla's `'select'` event → `setSelectedIndex(i)`. The indicator advances when the USER SWIPES, not when a timer fires or a video ends. This is already decoupled from video — NO action needed to implement D-07. But if any Phase 77 plan mistakenly adds a `video.onEnded` listener to `WearCard` that fires `emblaApi.scrollNext()`, it would override the user's control. **Do not add `onEnded` to any video element.**

### Risk 9: Font-Medium Dark Mode on Outline Buttons (Recurring)

If `VideoPlayBadge` or `VideoCaptureView` uses `Button variant="outline"` for the Cancel or Record buttons, the dark mode override issue applies: Horlo's outline Button cva injects `dark:bg-input/30 dark:hover:bg-input/50`. Any `bg-X` override must be paired with a `dark:bg-X` variant. (Durable memory `feedback_button_outline_dark_override`)

---

## Open Questions for Planner

1. **Activity Feed Card surface:** The context doc lists "activity feed card" as a display surface for video posts, but the codebase file for this was not explicitly identified in the research scope. Does the activity feed card render `WearCard` directly (in which case it inherits the video branch automatically from the WearCard change), or does it have its own independent render path? If independent, it needs its own media column reads. The planner should grep for the activity feed card component and determine if it reuses WearCard.

2. **Webm Extension Correctness for MVP:** Should the Phase 77 plan accept the `.mp4` hard-coding for MVP (iOS primary target, non-iOS users get a silent failure at the Server Action HEAD probe), or should the plan thread the actual blob MIME type through `MediaState` and use the correct extension for all browsers? This is a one-time architecture choice with rework cost if deferred.

3. **`WywtTile.photoUrl` field in `WywtTile` type vs. new `posterPath`:** The `WywtTile` type has a `photoUrl: string | null` field that is currently used for both the raw Storage path AND the signed URL (home page replaces it with the signed URL before passing to the component). For video tiles, the poster path plays the same role as `photoUrl` for photo tiles. Should the planner add `mediaType` + `posterPath` (raw) to `WywtTile` type and have `page.tsx` sign the poster path, OR reuse the existing `photoUrl` field to carry the signed poster URL for video tiles? Reusing `photoUrl` would be a naming mismatch but avoids type changes propagating to `WywtRail`; adding new fields is cleaner. Recommend: add `mediaType` + `posterPath` fields, sign them in `page.tsx`, and add `signedPosterUrl` to the tile before passing to `WywtRail`.

4. **Profile Grid Surface:** The context doc mentions "profile grid card" as a tile surface requiring `VideoPlayBadge`. The profile grid renders wear events from the profile page. Phase 77 should confirm which component the profile grid uses for wear tiles and whether it reuses `WywtTile` or `WearCard` or something else.

5. **`getAllWearEventsByUser` (internal, owner-bypass path):** This function is called by `getWearEventsForViewer` when `viewerUserId === profileUserId`. If it doesn't select the media columns, the owner's own profile view won't see video metadata. The planner must include this in the WR-02 wave.

---

## Sources

### Primary (HIGH confidence)
- `.planning/phases/77-video-capture-display-ui/77-CONTEXT.md` — locked decisions D-01..D-16, canonical refs, code context
- `.planning/spikes/001-mr-ios-capture/README.md` — VALIDATED empirical results: mp4, 3.6 MB, 169 KB poster, autoplay-muted-loop+playsInline confirmed on iOS 26.6 Safari
- `.planning/phases/76-video-schema-storage-paths-server-action/76-01-PLAN.md` — schema details, CHECK constraint
- `.planning/phases/76-video-schema-storage-paths-server-action/76-02-SUMMARY.md` — `buildWearVideoPath`/`buildWearPosterPath` contract
- `.planning/phases/76-video-schema-storage-paths-server-action/76-03-PLAN.md` — `logWearWithVideo` Server Action pipeline, 9 test surfaces
- `src/components/wywt/ComposeStep.tsx` — existing 3-state photo zone, `cameraOpeningRef` pattern, `handleTapCamera` gesture discipline
- `src/components/wywt/CameraCaptureView.tsx` — getUserMedia architecture, stream-as-prop pattern, `computeObjectCoverSourceRect`
- `src/components/wear/WearCard.tsx` — existing prop surface, `signedUrl` conditional, `WearPhotoClient` delegation
- `src/components/wear/WearPhotoClient.tsx` — retry state machine pattern; parallel for `WearVideoClient`
- `src/components/wear/WearDetailHero.tsx` — `WearPhotoOverlays` pattern, aspect-ratio class
- `src/components/wears/WearsLane.tsx` — embla carousel, `WearSlide` type, segmented progress indicator logic
- `src/components/home/WywtTile.tsx` — tile render pattern, current `photoUrl ?? imageUrl` branch
- `src/app/wear/[wearEventId]/page.tsx` — `WearPhotoStreamed` pattern, signed URL mint in Suspense child
- `src/data/wearEvents.ts` — all DAL reader SELECT lists confirming media column absence
- `src/lib/wywtTypes.ts` — `WywtTile` type (missing media fields)
- `src/lib/storage/wearPhotos.ts` — `buildWearVideoPath`/`buildWearPosterPath` implementations, `uploadWearPhoto` pattern
- `src/components/wywt/WywtPostDialog.tsx` — outer dialog state machine, `wearEventId` generation via `crypto.randomUUID()`
- `.planning/REQUIREMENTS.md` — VID-01..06, VID-13..15 requirement text
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md` — `connection()` API; `/wear/{id}` does not need it (getCurrentUser is already request-time)

### Secondary (MEDIUM confidence)
- `.planning/config.json` — `nyquist_validation: true` confirmed; `use_worktrees: false` confirmed (no worktree for this phase)
- Durable memory entries (via CLAUDE.md system context): PPR opt-out pattern, font-medium dark mode, accent token, updateTag vs revalidateTag, mobile UAT pattern

### Tertiary / Assumed
- [ASSUMED] `typeof MediaRecorder === 'undefined'` is `false` in Node.js SSR environment — standard JS behavior, effectively certain but not tool-verified in this session
- [ASSUMED] `useEffect(() => { probe() }, [])` runs only in the browser — standard React behavior

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `typeof MediaRecorder === 'undefined'` is falsy in Node.js SSR | Capability Probe Strategy | If wrong: module-scope const approach would also work; hook approach is still correct |
| A2 | Activity feed card reuses `WearCard` (not independent render) | Surface Inventory, Open Question #1 | If wrong: activity feed needs separate media-column reads and render branch |
| A3 | `getAllWearEventsByUser` (owner bypass) also omits media columns | Surface Inventory, Open Question #5 | If wrong: owner profile view may work without the WR-02 fix to this function |

---

## RESEARCH COMPLETE

Phase 77 is a client-heavy UI phase with no new server infrastructure. The most important findings for planning are:

1. **WR-02 (DAL column widening) is a hard Wave 1 prerequisite** — five DAL reader functions in `src/data/wearEvents.ts` currently omit `media_type`, `media_path`, `poster_path` from their SELECT lists. Every single render surface is blocked until these columns are in the returned rows. This is a mechanical, low-risk change but must land before any display work.

2. **`VideoCaptureView` should be a new parallel component** — do NOT refactor `CameraCaptureView`. The iOS gesture-context discipline (getUserMedia as first `await`) is architecturally enforced by the stream-as-prop pattern; `VideoCaptureView` accepts a stream prop and never calls `getUserMedia` itself. `ComposeStep` owns both stream acquisitions.

3. **Spike test page `src/app/spike-mr-capture/` is an unauthenticated production route** — this must be deleted in Wave 1 Task 1, before any other work.

4. **Signed URLs for video AND poster must both be minted in the Suspense child** (`WearPhotoStreamed`) using the admin/server client, not the cookie client. The poster URL is the D-08 fallback when video errors — if only the video URL is minted, the error fallback shows nothing.

5. **VID-15 regression risk is the highest-risk VID requirement** — `WearCard` is used in at least 4 contexts. All new props must be strictly optional with no behavioral change when absent. `WearPhotoClient` and `WearDetailHero` must not be modified at all.
