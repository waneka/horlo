---
phase: 77-video-capture-display-ui
plan: 06
subsystem: integration
tags: [compose, integration, media-state, submit-pipeline]
requires:
  - phase: 76
    provides: logWearWithVideo Server Action, buildWearVideoPath/buildWearPosterPath
  - phase: 77-01
    provides: ComposeStep.video + ComposeStep.submit.video test stubs
  - phase: 77-02
    provides: MediaState discriminated union (consumed by ComposeStep + WywtPostDialog props)
  - phase: 77-04
    provides: useMediaCapability hook (capability-gates 3rd button)
  - phase: 77-05
    provides: VideoCaptureView (mounted in the live-capture branch)
provides:
  - 3-button pre-capture chooser in ComposeStep (Take wrist shot / Record video / Upload photo)
  - Full video submit pipeline (upload video → upload poster → logWearWithVideo)
  - WywtPostDialog migrated from photoBlob/setPhotoBlob to mediaState/setMediaState
  - 5 new passing tests (2 chooser + 3 submit pipeline)
affects: [Plan 08, downstream production WYWT compose flow]
tech-stack:
  added: []
  patterns:
    - "Discriminated-union-driven submit branch: switch on mediaState.kind to select the right pipeline"
    - "Convenience local for narrowed access (const photoBlob = mediaState.kind === 'photo' ? mediaState.blob : null) — minimizes diff vs old photoBlob refs"
    - "Stream-as-prop video capture mount: <VideoCaptureView stream={cameraStream} preferredMimeType={preferredMimeType ?? fallback} ...> when cameraStream && mediaSource === 'video'"
    - "Compensating cleanup on poster-upload failure: supabase.storage.from('wear-photos').remove([videoPath]) before returning the error"
key-files:
  created: []
  modified:
    - src/components/wywt/ComposeStep.tsx
    - src/components/wywt/WywtPostDialog.tsx
    - tests/components/wywt/ComposeStep.video.test.tsx
    - tests/components/wywt/ComposeStep.submit.video.test.tsx
key-decisions:
  - "T-77-04 mitigated by handleTapVideoCamera mirroring handleTapCamera VERBATIM — cameraOpeningRef.current = true (synchronous) BEFORE await getUserMedia (first await)"
  - "Photo path preserved via mediaState.kind === 'photo' ? mediaState.blob : null convenience accessor — every old photoBlob reference works unchanged (VID-15)"
  - "Submit handler video branch runs FIRST and returns early — photo branch only executes when mediaState.kind !== 'video' (no leak path)"
  - "4 MB UX pre-warn is non-blocking; Server Action's 5 MB gate (Phase 76 Plan 03) is the authoritative server-side limit"
patterns-established:
  - "URL.createObjectURL jsdom shim pattern (defineProperty in beforeAll) — needed by any test rendering a component that calls URL.createObjectURL"
requirements-completed:
  - VID-01
  - VID-06
duration: 32min
completed: 2026-06-23
---

# Phase 77 Plan 06: ComposeStep video wiring + MediaState migration

**The integration plan — every Phase 77 building block (MediaState union, DAL columns, capability hook, poster lib, VideoCaptureView) plus Phase 76's Server Action come together inside the existing ComposeStep state machine, with the photo path preserved byte-for-byte.**

## Performance

- **Duration:** ~32 min (executor portion, inline)
- **Completed:** 2026-06-23
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

### ComposeStep (10 numbered changes)

1. **Imports** — added `VideoCaptureView`, `useMediaCapability`, `buildWearVideoPath`/`buildWearPosterPath`, `logWearWithVideo`, `createSupabaseBrowserClient`, `MediaState` type.
2. **Props interface** — `photoBlob: Blob | null` + `setPhotoBlob` REPLACED by `mediaState: MediaState` + `setMediaState`.
3. **Top of body** — `const { supportsVideoCapture, preferredMimeType } = useMediaCapability()`; `mediaSource` widened from `'camera' | 'upload' | null` to `'camera' | 'video' | 'upload' | null`; convenience local `const photoBlob = mediaState.kind === 'photo' ? mediaState.blob : null` (minimizes diff with old photo refs).
4. **`handleTapVideoCamera`** — new handler; mirrors `handleTapCamera` exactly. `cameraOpeningRef.current = true` (sync) → `setError(null)` → `await navigator.mediaDevices.getUserMedia(...)` as first await → on success `setCameraStream(stream); setMediaSource('video')`. T-77-04 mitigation enforced architecturally.
5. **`handleVideoReady` + `handleDiscardVideo` + `handleCancelVideoCamera`** — three new callbacks per the plan.
6. **`videoPreviewUrl`** useMemo + revoke useEffect mirroring the existing `photoPreviewUrl` pattern.
7. **`setPhotoBlob(null)` migration** — every call (handleRemovePhoto, handleRetake, handleChooseAnother) now `setMediaState({ kind: 'none' })`. `setPhotoBlob(jpeg)` in `handlePhotoReady` now `setMediaState({ kind: 'photo', blob: jpeg })`.
8. **4-branch photo-zone ternary** — `mediaState.kind === 'video'` → video preview (inline `<video autoPlay muted loop playsInline>` + Discard button + 4 MB pre-warn) → `cameraStream && mediaSource === 'video'` → `<VideoCaptureView>` → `photoBlob` (existing photo preview, byte-identical except photoBlob is now the narrowed local) → `cameraStream` → `<CameraCaptureView>` → pre-capture chooser.
9. **Pre-capture chooser** — inner div changes from `flex gap-2` to `flex flex-wrap justify-center gap-2`; the conditional `{supportsVideoCapture && <Button>Record video</Button>}` is inserted between the photo-camera and upload buttons.
10. **Submit handler** — new video branch runs FIRST inside `startTransition`. Order: `buildWearVideoPath` + `buildWearPosterPath` → `createSupabaseBrowserClient` → `upload(.mp4)` → `upload(-poster.jpg)` (with `remove([videoPath])` compensating cleanup on failure) → `logWearWithVideo` → `router.push` → `onSubmitted` → return. Photo branch only runs when `mediaState.kind !== 'video'`.

### WywtPostDialog

- Imported `MediaState` type
- `useState<Blob | null>(null)` → `useState<MediaState>({ kind: 'none' })`
- All three reset sites (`handleOpenChange`, the `prevOpen !== open` block, and the defensive close branch) migrated to `setMediaState({ kind: 'none' })`
- `<ComposeStep>` invocation: `photoBlob={photoBlob} setPhotoBlob={setPhotoBlob}` → `mediaState={mediaState} setMediaState={setMediaState}`
- ZERO `photoBlob` references remain in the file

## Task Commits

1. **Task 1: ComposeStep + WywtPostDialog migration** — `ca4a6f67` (feat)
2. **Task 2: Upgrade both test stubs** — `a069f575` (test)

## Files Modified

- `src/components/wywt/ComposeStep.tsx` — ~80 net additions across the 10 changes above
- `src/components/wywt/WywtPostDialog.tsx` — 4-line migration (import + state + 3 reset sites + 2 props passed)
- `tests/components/wywt/ComposeStep.video.test.tsx` — 2 `it.todo` → 2 real `it(...)` cases
- `tests/components/wywt/ComposeStep.submit.video.test.tsx` — 3 `it.todo` → 3 real `it(...)` cases

## Verification

- `grep -c "useMediaCapability" src/components/wywt/ComposeStep.tsx` → 2 (import + call)
- `grep -c "VideoCaptureView" src/components/wywt/ComposeStep.tsx` → 2 (import + JSX)
- `grep -c "handleTapVideoCamera" src/components/wywt/ComposeStep.tsx` → 2 (declaration + onClick)
- `grep -c "buildWearVideoPath" src/components/wywt/ComposeStep.tsx` → 1
- `grep -c "buildWearPosterPath" src/components/wywt/ComposeStep.tsx` → 1
- `grep -c "logWearWithVideo" src/components/wywt/ComposeStep.tsx` → 2 (import + call)
- `grep -c "logWearWithPhoto" src/components/wywt/ComposeStep.tsx` → 2 (preserved — VID-15)
- `grep -c "mediaState" src/components/wywt/ComposeStep.tsx` → 18 occurrences
- `grep -c "kind: 'video'" src/components/wywt/ComposeStep.tsx` → 2
- `grep -c "kind: 'photo'" src/components/wywt/ComposeStep.tsx` → 2
- `grep -c "kind: 'none'" src/components/wywt/ComposeStep.tsx` → 3
- `grep -c "supportsVideoCapture" src/components/wywt/ComposeStep.tsx` → 2
- `grep -c "flex flex-wrap justify-center gap-2" src/components/wywt/ComposeStep.tsx` → 1
- `grep -c "remove(\[videoPath\])" src/components/wywt/ComposeStep.tsx` → 1
- `grep -c "playsInline" src/components/wywt/ComposeStep.tsx` → 1 (post-capture preview)
- `grep -c "Clip is large" src/components/wywt/ComposeStep.tsx` → 1
- `grep -c "MediaState" src/components/wywt/WywtPostDialog.tsx` → 2 (import + state type)
- `grep -c "photoBlob" src/components/wywt/WywtPostDialog.tsx` → 0 (full migration)
- `grep -c "mediaState" src/components/wywt/WywtPostDialog.tsx` → 4 (state + 3 reset sites or prop pair)
- `npm run build` → exit 0
- `npx vitest run tests/components/wywt/ComposeStep.video.test.tsx tests/components/wywt/ComposeStep.submit.video.test.tsx` → 5 passed
- `npx vitest run tests/components/wywt/CameraCaptureView.test.tsx` → 4 passed (VID-15 photo regression check)

## Self-Check

PASSED — all acceptance criteria met.

### Deviation: jsdom URL.createObjectURL shim

`ComposeStep.submit.video.test.tsx` adds a `beforeAll` block defining `URL.createObjectURL`/`URL.revokeObjectURL` placeholders before render, because the `videoPreviewUrl` useMemo inside ComposeStep otherwise crashes the jsdom environment. Same shim pattern already used in `tests/unit/posterExtraction.test.ts`.

### Deviation: UUID fixture for wearEventId

`buildWearVideoPath` validates `wearEventId` as a UUID (throws TypeError otherwise). The test fixture uses `'00000000-0000-0000-0000-000000000001'` instead of `'we-1'`. The path-builder validation is a defense-in-depth guard from Phase 76; the production WywtPostDialog generates wearEventId via `crypto.randomUUID()` so this is never an issue at runtime.

## Notes for downstream plans

- Plan 08 (end-to-end page wiring) — page-level Server Components mint signed URLs and pass them to `WearCard` / `WearsLane` / `WywtTile`. The DAL already surfaces `mediaType`/`mediaPath`/`posterPath` (Plan 03). The discriminator branches in `WearCard` (Plan 07) and `WywtTile` (Plan 08) consume those columns.
- The user can now record + submit a video wear end-to-end from the WYWT compose dialog. The display half (rendering on /wear/[id], /wears/[username], home rail) is Plan 08's responsibility.
