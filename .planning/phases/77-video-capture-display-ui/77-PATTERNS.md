# Phase 77: Video Capture + Display UI — Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 22 (12 new, 9 modified, 1 deleted)
**Analogs found:** 22 / 22

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/hooks/useMediaCapability.ts` | hook | client-side capability probe | `src/hooks/useViewedWears.ts` | role-match |
| `src/components/wywt/VideoCaptureView.tsx` | component | client-side capture | `src/components/wywt/CameraCaptureView.tsx` | exact |
| `src/components/wear/WearVideoClient.tsx` | component | client-side display | `src/components/wear/WearPhotoClient.tsx` | exact |
| `src/components/wear/VideoPlayBadge.tsx` | component | render decoration | `src/components/home/WywtTile.tsx` (overlay pattern) | role-match |
| `src/lib/video/extractPosterBlob.ts` | utility | client-side transform | `src/lib/storage/wearPhotos.ts` (uploadWearPhoto) | partial |
| `src/components/wywt/ComposeStep.tsx` | component (modified) | client-side capture + submit | self | — |
| `src/lib/wywtTypes.ts` | types (modified) | — | self | — |
| `src/components/wear/WearCard.tsx` | component (modified) | client-side display | self | — |
| `src/components/home/WywtTile.tsx` | component (modified) | client-side display | self | — |
| `src/app/wear/[wearEventId]/page.tsx` | page (modified) | SSR signed-URL mint | self | — |
| `src/components/wears/WearsLane.tsx` | component (modified) | client-side display | self | — |
| `src/data/wearEvents.ts` | DAL (modified) | server CRUD reads | self | — |
| `tests/hooks/useMediaCapability.test.ts` | test | unit | `tests/hooks/useViewedWears.test.ts` | exact |
| `tests/unit/videoCapture.test.ts` | test | unit | `tests/unit/buildWearVideoPath.test.ts` | role-match |
| `tests/unit/posterExtraction.test.ts` | test | unit | `tests/unit/buildWearVideoPath.test.ts` | role-match |
| `tests/unit/mediaState.test.ts` | test | unit | `tests/unit/buildWearVideoPath.test.ts` | role-match |
| `tests/unit/dalMediaColumns.test.ts` | test | unit | `tests/unit/wearRail.test.ts` | role-match |
| `tests/components/wywt/VideoCaptureView.test.tsx` | test | component | `tests/components/wywt/CameraCaptureView.test.tsx` | role-match |
| `tests/components/wywt/ComposeStep.video.test.tsx` | test | component | `tests/components/wear/WearCard.test.tsx` | role-match |
| `tests/components/wywt/ComposeStep.submit.video.test.tsx` | test | integration | `tests/components/wear/WearCard.test.tsx` | role-match |
| `tests/components/wear/WearVideoClient.test.tsx` | test | component | `tests/components/wear/WearCard.test.tsx` | role-match |
| `tests/components/wear/WearCard.video.test.tsx` | test | component | `tests/components/wear/WearCard.test.tsx` | exact |
| `tests/components/home/WywtTile.video.test.tsx` | test | component | `tests/components/wear/WearCard.test.tsx` | role-match |
| `src/app/spike-mr-capture/` (DELETE) | — | — | — | — |

---

## Wave 1 — Foundation (DAL + Types + Spike Cleanup)

### `src/app/spike-mr-capture/` — DELETE (entire directory)

**Action:** `rm -rf src/app/spike-mr-capture/`

No pattern to copy. This is a simple directory deletion. It is an unauthenticated production route from the spike phase and must be the very first task in Wave 1 before any other code change.

**Pattern delta:** N/A — deletion only.

---

### `src/data/wearEvents.ts` — WR-02 column widening (MODIFIED)

**Analog:** self (`src/data/wearEvents.ts`)

**Current SELECT pattern** (`getWearEventByIdForViewer`, lines 297–319) — copy this shape and add three columns to every affected reader:

```typescript
// Current shape that must be EXTENDED — not replaced:
const rows = await db
  .select({
    id: wearEvents.id,
    userId: wearEvents.userId,
    watchId: wearEvents.watchId,
    wornDate: wearEvents.wornDate,
    note: wearEvents.note,
    photoUrl: wearEvents.photoUrl,
    visibility: wearEvents.visibility,
    createdAt: wearEvents.createdAt,
    // ... JOINed fields
  })
  .from(wearEvents)
```

**Add these three fields to every reader's SELECT list** (`getWearEventByIdForViewer`, `getWearEventsForViewer` non-owner branch, `getWearRailForViewer`, `getActiveWearsForUser`). The `getAllWearEventsByUser` function currently uses `.select()` (selects all columns) — its return already includes media columns because Drizzle's `select()` without arguments returns every DB column. Confirm this is the case before adding explicit columns; do not add them twice.

```typescript
// New columns to add to every explicit .select({}) call:
mediaType: wearEvents.mediaType,   // 'photo' | 'video' | null
mediaPath: wearEvents.mediaPath,   // string | null
posterPath: wearEvents.posterPath, // string | null
```

**`getPublicWearPicsForWatch`:** DEFERRED. This reader hard-filters `isNotNull(wearEvents.photoUrl)`. The watch-detail carousel is out of scope per CONTEXT.md. Leave this reader unchanged.

**Pattern delta vs current:** Purely additive SELECT extension. The WHERE clause, JOIN structure, and ordering are not touched. The function return type widens; every TypeScript call site that consumes the result must be updated (the planner should identify these via tsc errors after the DAL change, not by hand).

---

### `src/lib/wywtTypes.ts` — MediaState union + WywtTile video fields (MODIFIED)

**Analog:** self (`src/lib/wywtTypes.ts`)

**Current `WywtTile` interface** (lines 13–50):

```typescript
export interface WywtTile {
  wearEventId: string
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  watchId: string
  brand: string
  model: string
  imageUrl: string | null
  photoUrl: string | null   // raw Storage path → signed by page.tsx
  wornDate: string
  note: string | null
  visibility: WearVisibility
  isSelf: boolean
}
```

**Add to `WywtTile`** (additive — no existing fields removed):

```typescript
  // Phase 77: video wear tile support
  mediaType?: 'photo' | 'video'
  posterPath?: string | null  // raw Storage path; page.tsx mints signedPosterUrl
```

**Add `MediaState` discriminated union** (new export in this file):

```typescript
// Phase 77: discriminated union for WYWT compose media — either photo OR video,
// never both. The DB CHECK wear_events_video_paths_required is the DB-layer gate;
// this union is the compile-time + runtime gate (VID-06).
export type MediaState =
  | { kind: 'none' }
  | { kind: 'photo'; blob: Blob }
  | { kind: 'video'; videoBlob: Blob; posterBlob: Blob }
```

**Pattern delta:** The type file currently has no discriminated union exports — it only has `WywtTile` and `WywtRailData`. Follow the existing comment style (`// Phase 77:`) and the `import type { WearVisibility }` import pattern at line 6.

---

### `src/components/wears/WearsLane.tsx` — WearSlide video fields (MODIFIED)

**Analog:** self (`src/components/wears/WearsLane.tsx`)

**Current `WearSlide` interface** (lines 25–50):

```typescript
export interface WearSlide {
  wearEventId: string
  signedUrl: string | null
  watchImageUrl: string | null
  // ... rest of props
}
```

**Add to `WearSlide`** (additive):

```typescript
  // Phase 77: video slide support
  mediaType?: 'photo' | 'video'
  signedVideoUrl?: string | null
  signedPosterUrl?: string | null
```

**No render logic changes to `WearsLane` itself.** `WearCard` receives the new props via spread and handles the branch. The segmented progress indicator is driven by embla `'select'` (verified at line-level in the analog — `emblaApi.on('select', ...)`) and must NOT be coupled to any `video.onEnded` listener. This is a guardrail: do NOT add `onEnded` anywhere in this file.

**Pattern delta:** Type extension only. The component body is untouched except for passing the new optional props through to `WearCard` spread.

---

## Wave 2 — Capture Pipeline

### `src/hooks/useMediaCapability.ts` — NEW

**Analog:** `src/hooks/useViewedWears.ts`

**Hook structure pattern** (from `useViewedWears.ts`, lines 1–50):

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'

export function useViewedWears() {
  const [viewed, setViewed] = useState<Set<string>>(new Set())
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // One-shot: runs in browser only, after hydration
    // ...reads from localStorage...
    setHydrated(true)
  }, [])  // empty deps = runs once on mount

  return { viewed, markViewed, hydrated }
}
```

**Apply this structure to `useMediaCapability`:**

```typescript
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
    supportsVideoCapture: false,  // SSR-safe default: hidden before probe
    preferredMimeType: null,
  })

  useEffect(() => {
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

**Pattern delta vs `useViewedWears`:**
- Same: `'use client'`, `useState` default for SSR safety, `useEffect([], [])` one-shot probe, returns plain object
- Different: probes browser globals (`MediaRecorder`, `navigator.mediaDevices`) instead of reading localStorage; no `useCallback` needed; no eviction/cap logic

---

### `src/components/wywt/VideoCaptureView.tsx` — NEW

**Analog:** `src/components/wywt/CameraCaptureView.tsx` (full file, 163 lines)

**Imports pattern** (from `CameraCaptureView.tsx`, lines 1–27):

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { WristOverlaySvg } from '@/components/wywt/WristOverlaySvg'
// (CameraCaptureView also imports stripAndResize — VideoCaptureView does NOT need it)
```

**Prop interface pattern** (from `CameraCaptureView.tsx`, lines 28–43) — copy shape, replace output:

```typescript
// CameraCaptureView analog:
export interface CameraCaptureViewProps {
  stream: MediaStream
  onPhotoReady: (jpeg: Blob) => void
  onError: (message: string) => void
  onCancel: () => void
  disabled?: boolean
}

// VideoCaptureView — same shape, different callback:
export interface VideoCaptureViewProps {
  stream: MediaStream
  preferredMimeType: string          // from useMediaCapability()
  onVideoReady: (result: { videoBlob: Blob; posterBlob: Blob }) => void
  onError: (message: string) => void
  onCancel: () => void
  disabled?: boolean
}
```

**Stream-wiring useEffect pattern** (from `CameraCaptureView.tsx`, lines 58–65) — copy verbatim:

```typescript
// Wire the stream into <video> on mount; stop all tracks on unmount (Pitfall 2).
useEffect(() => {
  const video = videoRef.current
  if (video) video.srcObject = stream
  return () => {
    stream.getTracks().forEach((t) => t.stop())
    if (video) video.srcObject = null
  }
}, [stream])
```

**Video preview JSX pattern** (from `CameraCaptureView.tsx`, lines 114–139) — copy wrapper + video element exactly:

```tsx
<div
  ref={wrapperRef}
  className="relative w-full aspect-square overflow-hidden rounded-md bg-black"
>
  <video
    ref={videoRef}
    autoPlay
    playsInline
    muted
    aria-label="Camera preview"
    className="block h-full w-full object-cover"
  />
  <WristOverlaySvg className="pointer-events-none absolute inset-0" />
  {/* NEW for video: recording indicator (D-11) */}
  {recording && (
    <div
      role="status"
      aria-label="Recording in progress"
      className="absolute top-3 left-3 z-20 size-3 rounded-full bg-destructive dark:bg-destructive animate-pulse"
    />
  )}
</div>
```

**Button strip pattern** (from `CameraCaptureView.tsx`, lines 141–162) — copy layout, replace actions:

```tsx
// CameraCaptureView button strip (analog):
<div className="mt-3 flex justify-center gap-2">
  <Button type="button" variant="outline" onClick={onCancel} disabled={disabled || busy} className="min-h-11">
    Cancel
  </Button>
  <Button type="button" onClick={handleCapture} disabled={disabled || busy} className="min-h-11">
    {busy ? 'Capturing…' : 'Capture'}
  </Button>
</div>

// VideoCaptureView button strip — same structure, different labels + ring wrapper:
<div className="mt-3 flex justify-center gap-2">
  <Button type="button" variant="outline" onClick={handleCancel} disabled={disabled || extracting} className="min-h-11">
    Cancel
  </Button>
  {/* Progress ring wraps the Record button as relative/absolute overlay */}
  <div className="relative">
    <Button type="button" onClick={handleStartRecording} disabled={disabled || recording || extracting} className="min-h-11">
      {extracting ? 'Processing…' : recording ? 'Recording…' : 'Record 3s'}
    </Button>
    {recording && (
      <svg className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* stroke-dashoffset animation — ring-fill 3.0s linear forwards */}
      </svg>
    )}
  </div>
</div>
```

**Internal state** (new vs analog `busy: boolean`):

```typescript
// CameraCaptureView has: const [busy, setBusy] = useState(false)
// VideoCaptureView needs these states instead:
const [recording, setRecording] = useState(false)
const [extracting, setExtracting] = useState(false)
// Plus refs for MediaRecorder internals:
const recorderRef = useRef<MediaRecorder | null>(null)
const chunksRef = useRef<BlobPart[]>([])
const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const cancelledRef = useRef(false)   // guards against cancel → onstop race
```

**Pattern delta vs `CameraCaptureView`:**
- Same: `'use client'`, stream-as-prop (NEVER calls `getUserMedia` internally), `useEffect` stream wiring with track cleanup on unmount, `wrapperRef` + `videoRef`, `Button` component, `WristOverlaySvg`, `min-h-11`, `aspect-square overflow-hidden rounded-md bg-black` wrapper
- Different: state machine is `recording | extracting` not `busy`; output is `{ videoBlob, posterBlob }` not a JPEG blob; uses `MediaRecorder` API internally; has progress ring SVG + red dot; `disabled` during `extracting` for Cancel (brief window only); no `computeObjectCoverSourceRect` math; no `stripAndResize` call

---

### `src/lib/video/extractPosterBlob.ts` — NEW

**Analog:** `src/lib/storage/wearPhotos.ts` (utility module structure)

**Utility module pattern** (from `wearPhotos.ts`, lines 1–19):

```typescript
'use client'

// src/lib/storage/wearPhotos.ts
//
// [Description comment block — what this does, path convention, references]

import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export type UploadResult = { path: string } | { error: string }
```

**Apply to `extractPosterBlob`:**

```typescript
// src/lib/video/extractPosterBlob.ts
//
// Canvas-based poster frame extraction from a recorded video Blob.
//
// Extracts a JPEG frame at 3/4 through the clip (duration * 0.75) using a
// detached <video> + <canvas>. Validated in Spike 001 on iOS 26.6 Safari
// (3.0s clip → 169 KB JPEG at quality 0.85; 720×1280 frame).
//
// References:
// - .planning/spikes/001-mr-ios-capture/README.md §Results
// - 77-RESEARCH.md §Discretion Item 5

// No 'use client' needed — this is a pure async function, not a hook.
// It uses browser APIs (document.createElement, canvas) so it MUST only
// be called in a browser context (inside a useEffect or event handler).

/**
 * Extract a JPEG poster frame from a video Blob at 3/4 through its duration.
 * Exported for testing via vi.stubGlobal('document', ...).
 */
export async function extractPosterBlob(videoBlob: Blob): Promise<Blob> {
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
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('canvas ctx unavailable'))
        return
      }
      ctx.drawImage(video, 0, 0)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)
          if (blob) resolve(blob)
          else reject(new Error('canvas.toBlob returned null'))
        },
        'image/jpeg',
        0.85,
      )
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('video load failed'))
    }
  })
}
```

**Pattern delta vs `wearPhotos.ts`:**
- Same: camelCase filename, named export, JSDoc comment block, `@throws`-equivalent via Promise reject
- Different: no `'use client'` directive (pure function, not a hook); no Supabase import; returns a Promise<Blob> rather than an UploadResult union; must be in a new `src/lib/video/` directory (create it)

---

### `src/components/wywt/ComposeStep.tsx` — MODIFIED

**Analog:** self

**Import additions** (after line 24 in current file):

```typescript
// Add to existing imports:
import { VideoCaptureView } from './VideoCaptureView'
import { useMediaCapability } from '@/hooks/useMediaCapability'
import { uploadWearVideo, uploadWearPoster } from '@/lib/storage/wearPhotos'
// (uploadWearVideo / uploadWearPoster may not yet exist — follow uploadWearPhoto pattern)
import { logWearWithVideo } from '@/app/actions/wearEvents'
import { extractPosterBlob } from '@/lib/video/extractPosterBlob'
import type { MediaState } from '@/lib/wywtTypes'
```

**Props signature change** — replace `photoBlob: Blob | null` / `setPhotoBlob`:

```typescript
// Current (to be replaced):
photoBlob: Blob | null
setPhotoBlob: (b: Blob | null) => void

// Replacement:
mediaState: MediaState
setMediaState: (s: MediaState) => void
```

**State additions** inside `ComposeStep`:

```typescript
// Keep all existing state; add:
const { supportsVideoCapture, preferredMimeType } = useMediaCapability()
const [mediaSource, setMediaSource] = useState<'camera' | 'video' | 'upload' | null>(null)
// (replaces existing photoSource: 'camera' | 'upload' | null)
```

**`handleTapCamera` re-entrance guard pattern** (lines 165–189) — copy exactly for `handleTapVideoCamera`:

```typescript
// Analog — copy the cameraOpeningRef guard pattern verbatim:
const handleTapCamera = async () => {
  if (cameraOpeningRef.current || cameraStream) return
  cameraOpeningRef.current = true
  setError(null)
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ ... })
    // ...
  } catch (err) {
    // ...
  } finally {
    cameraOpeningRef.current = false
  }
}

// New handler for video — SAME re-entrance guard, different mediaSource:
const handleTapVideoCamera = async () => {
  if (cameraOpeningRef.current || cameraStream) return
  cameraOpeningRef.current = true
  setError(null)
  try {
    // CRITICAL: getUserMedia MUST be the first await (Pitfall 1 / T-15-01)
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })
    setCameraStream(stream)
    setMediaSource('video')
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      setError('Camera access denied — use Upload photo instead.')
    } else {
      setError('Camera unavailable — use Upload photo instead.')
    }
  } finally {
    cameraOpeningRef.current = false
  }
}
```

**Object URL lifecycle pattern** (lines 130–138) — copy for video blob:

```typescript
// Current photo preview URL pattern (analog):
const photoPreviewUrl = useMemo(
  () => (photoBlob ? URL.createObjectURL(photoBlob) : null),
  [photoBlob],
)
useEffect(() => {
  return () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
  }
}, [photoPreviewUrl])

// Video preview URL — same pattern, different source:
const videoPreviewUrl = useMemo(
  () => (mediaState.kind === 'video' ? URL.createObjectURL(mediaState.videoBlob) : null),
  [mediaState],
)
useEffect(() => {
  return () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
  }
}, [videoPreviewUrl])
```

**Pre-capture chooser** (lines 410–434) — extend the existing 2-button `flex gap-2` row to 3 buttons:

```tsx
// Current analog (2 buttons):
<div className="flex gap-2">
  <Button type="button" variant="outline" onClick={handleTapCamera} disabled={pending} className="min-h-11">
    Take wrist shot
  </Button>
  <Button type="button" variant="outline" onClick={() => photoUploaderRef.current?.openPicker()} disabled={pending} className="min-h-11">
    Upload photo
  </Button>
</div>

// Extended (3 buttons; wrap on narrow screens):
<div className="flex flex-wrap justify-center gap-2">
  <Button type="button" variant="outline" onClick={handleTapCamera} disabled={pending} className="min-h-11">
    Take wrist shot
  </Button>
  {supportsVideoCapture && (
    <Button type="button" variant="outline" onClick={handleTapVideoCamera} disabled={pending} className="min-h-11">
      Record video
    </Button>
  )}
  <Button type="button" variant="outline" onClick={() => photoUploaderRef.current?.openPicker()} disabled={pending} className="min-h-11">
    Upload photo
  </Button>
</div>
```

**Photo zone state-machine render** (lines 349–434) — extend the existing `photoBlob ? ... : cameraStream ? ... : ...` ternary:

```tsx
// Current ternary structure (analog):
{photoBlob ? (
  /* POST-CAPTURE PREVIEW */
) : cameraStream ? (
  <CameraCaptureView stream={cameraStream} ... />
) : (
  /* PRE-CAPTURE CHOOSER */
)}

// Extended (4-branch — add video cases):
{mediaState.kind === 'video' ? (
  /* VIDEO POST-CAPTURE PREVIEW */
  <div className="relative">
    <video
      src={videoPreviewUrl ?? ''}
      autoPlay muted loop playsInline
      className="w-full rounded-md object-cover"
    />
    {/* NO VideoPlayBadge here — D-16 */}
    <button type="button" onClick={handleDiscardVideo} disabled={pending}
      className="mt-2 text-xs font-semibold text-accent underline">
      Discard
    </button>
  </div>
) : mediaState.kind === 'photo' ? (
  /* PHOTO POST-CAPTURE PREVIEW — unchanged */
) : cameraStream && mediaSource === 'video' ? (
  /* VIDEO LIVE CAPTURE */
  <VideoCaptureView
    stream={cameraStream}
    preferredMimeType={preferredMimeType ?? 'video/mp4;codecs=avc1'}
    onVideoReady={handleVideoReady}
    onError={(m) => { setError(m); handleCancelVideoCamera() }}
    onCancel={handleCancelVideoCamera}
    disabled={pending}
  />
) : cameraStream ? (
  /* PHOTO LIVE CAPTURE — unchanged */
  <CameraCaptureView ... />
) : (
  /* PRE-CAPTURE CHOOSER — 3 buttons */
)}
```

**Submit handler** (lines 251–294) — add video branch using same `startTransition` pattern:

```typescript
// Existing submit handler structure (analog):
const handleSubmit = () => {
  setError(null)
  startTransition(async () => {
    try {
      if (photoBlob) {
        const upload = await uploadWearPhoto(viewerId, wearEventId, photoBlob)
        if ('error' in upload) { setError('Photo upload failed…'); return }
      }
      const result = await logWearWithPhoto({ ... })
      if (!result.success) { setError(result.error); return }
      router.push(`/wear/${wearEventId}`)
      onSubmitted()
    } catch (err) {
      console.error('[ComposeStep] submit error:', err)
      setError('Could not log that wear. Please try again.')
    }
  })
}

// New video branch — add inside startTransition, before existing photo branch:
if (mediaState.kind === 'video') {
  const videoPath = buildWearVideoPath(viewerId, wearEventId)
  const posterPath = buildWearPosterPath(viewerId, wearEventId)
  const supabase = createSupabaseBrowserClient()

  const { error: videoError } = await supabase.storage
    .from('wear-photos')
    .upload(videoPath, mediaState.videoBlob, { contentType: mediaState.videoBlob.type, upsert: false })
  if (videoError) { setError('Video upload failed — please try again.'); return }

  const { error: posterError } = await supabase.storage
    .from('wear-photos')
    .upload(posterPath, mediaState.posterBlob, { contentType: 'image/jpeg', upsert: false })
  if (posterError) {
    await supabase.storage.from('wear-photos').remove([videoPath])
    setError('Poster upload failed — please try again.')
    return
  }

  const result = await logWearWithVideo({
    wearEventId,
    watchId: watch.id,
    note: note.trim().length > 0 ? note.trim() : null,
    visibility,
    videoBytes: mediaState.videoBlob.size,
    today: todayLocalISO(),
  })
  if (!result.success) { setError(result.error); return }
  router.push(`/wear/${wearEventId}`)
  onSubmitted()
  return
}
// ... existing photo branch follows
```

**Error copy pattern** (line 498) — use same `role="alert" className="text-sm text-destructive"`:

```tsx
// Analog (unchanged):
{error && (
  <p role="alert" className="text-sm text-destructive">
    {error}
  </p>
)}
```

**Pattern delta vs current `ComposeStep`:**
- Same: `startTransition` wrapping, `cameraOpeningRef` re-entrance guard, `useMemo` + `useEffect` for preview URL lifecycle, `setError(null)` before submit, `router.push` on success, `console.error` for unexpected failures
- Different: `mediaState: MediaState` replaces `photoBlob: Blob | null`; `mediaSource` gains `'video'` variant; `useMediaCapability()` hook call at top; 3-button chooser; 4-branch photo-zone ternary; video submit path calls two Storage uploads + `logWearWithVideo` instead of one upload + `logWearWithPhoto`

---

## Wave 3 — Display Pipeline

### `src/components/wear/VideoPlayBadge.tsx` — NEW

**Analog:** `src/components/home/WywtTile.tsx` (overlay JSX pattern, lines 107–116)

**Overlay pattern from `WywtTile`** (lines 107–116):

```tsx
// Existing overlay in WywtTile (analog — inline, not extracted):
<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left">
  <p className="text-xs font-semibold text-white truncate">{tile.username}</p>
  <p className="text-xs text-white/80">{time}</p>
</div>
```

**Apply to `VideoPlayBadge` — centered play icon overlay:**

```typescript
// src/components/wear/VideoPlayBadge.tsx
import { Play } from 'lucide-react'

/**
 * Centered play-icon overlay for video wear tiles (D-13, D-14, D-16).
 *
 * Usage: place inside a `relative overflow-hidden` container.
 * NOT rendered on the composer's post-capture preview (D-16).
 * aria-hidden — decorative; parent tile's aria-label covers the content.
 */
export function VideoPlayBadge() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div
        className="rounded-full bg-black/50 flex items-center justify-center"
        style={{ width: 'clamp(32px, 24%, 56px)', height: 'clamp(32px, 24%, 56px)' }}
      >
        <Play
          className="fill-white stroke-none"
          style={{ width: 'calc(100% - 16px)', height: 'calc(100% - 16px)' }}
          aria-hidden
        />
      </div>
    </div>
  )
}
```

**Pattern delta vs `WywtTile` overlay pattern:**
- Same: `absolute inset-0`, `pointer-events-none`, `aria-hidden`, `text-white` / `black/70` color family, lucide-react icon
- Different: centered not bottom-anchored; backdrop circle not gradient strip; `clamp()` for responsive sizing; no text content; extracted as its own component (D-14 single source of truth for sizing math)

---

### `src/components/wear/WearVideoClient.tsx` — NEW

**Analog:** `src/components/wear/WearPhotoClient.tsx` (full file, 178 lines)

**Imports pattern** (from `WearPhotoClient.tsx`, lines 1–7):

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { PhotoSkeleton } from './PhotoSkeleton'
import { WearPhotoOverlays } from './WearDetailHero'
```

**Adapt for video** (different imports, same conventions):

```typescript
'use client'

import { useRef, useState } from 'react'  // no useEffect needed
import { WearPhotoOverlays } from './WearDetailHero'
```

**Prop interface pattern** (from `WearPhotoClient.tsx`, lines 51–72) — copy shape, replace `signedUrl: string` with two nullable URL props:

```typescript
// WearPhotoClient analog (reference):
export function WearPhotoClient({
  signedUrl,          // string (never null — parent already branches)
  altText,
  watchImageUrl,
  brand, model, username, displayName, avatarUrl, createdAt, watchId,
}: { signedUrl: string; altText: string; watchImageUrl: string | null; ... })

// WearVideoClient — same overlay props, different media props:
export function WearVideoClient({
  signedVideoUrl,     // string | null — null triggers error fallback
  signedPosterUrl,    // string | null — poster fallback per D-08
  altText,
  watchImageUrl,
  brand, model, username, displayName, avatarUrl, createdAt, watchId,
}: {
  signedVideoUrl: string | null
  signedPosterUrl: string | null
  altText: string
  watchImageUrl: string | null
  brand: string; model: string
  username: string | null; displayName: string | null; avatarUrl: string | null
  createdAt: Date; watchId: string
})
```

**Container class** (from `WearPhotoClient.tsx`, line 136) — copy verbatim:

```tsx
// Analog — the happy-path container class:
className="w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto md:max-h-[70vh] relative"

// WearVideoClient — identical container class (VID-15 visual parity):
className="w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto md:max-h-[70vh] relative"
```

**Error fallback pattern** (from `WearPhotoClient.tsx`, lines 87–131) — adapt for video:

```tsx
// WearPhotoClient failed state analog:
if (status === 'failed') {
  if (watchImageUrl) {
    return (
      <div data-testid="wear-photo-container" className="relative w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto md:max-h-[70vh]">
        <img src={watchImageUrl} alt={altText} className="w-full h-full object-cover" loading="eager" />
        <WearPhotoOverlays ... hasPhoto={true} />
      </div>
    )
  }
  // ...no-photo fallback
}

// WearVideoClient error/null fallback (D-08):
if (failed || !signedVideoUrl) {
  return (
    <div
      data-testid="wear-video-container"
      className="relative w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto md:max-h-[70vh]"
      aria-label={altText}
    >
      {signedPosterUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={signedPosterUrl} alt={altText} className="w-full h-full object-cover" />
      )}
      <span className="absolute bottom-[60px] left-3 z-10 text-xs font-semibold text-white/70">
        Video unavailable
      </span>
      <WearPhotoOverlays
        username={username} displayName={displayName} avatarUrl={avatarUrl}
        createdAt={createdAt} brand={brand} model={model}
        hasPhoto={!!signedPosterUrl} watchId={watchId}
      />
    </div>
  )
}
```

**Happy-path video render** (no analog for `<video>` — follow D-05 / D-06 spec):

```tsx
return (
  <div
    data-testid="wear-video-container"
    className="w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto md:max-h-[70vh] relative"
    aria-label={paused ? 'Video paused — tap to resume' : 'Video playing — tap to pause'}
    onClick={() => {
      // D-06: tap to pause/resume loop
      if (videoRef.current?.paused) { videoRef.current.play(); setPaused(false) }
      else { videoRef.current?.pause(); setPaused(true) }
    }}
  >
    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
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
    <WearPhotoOverlays
      username={username} displayName={displayName} avatarUrl={avatarUrl}
      createdAt={createdAt} brand={brand} model={model}
      hasPhoto={true} watchId={watchId}
    />
  </div>
)
```

**Pattern delta vs `WearPhotoClient`:**
- Same: `'use client'`, `data-testid`, container `className` (exact match — VID-15 visual parity contract), `WearPhotoOverlays` props spread, error fallback structure with poster image, `// eslint-disable-next-line @next/next/no-img-element` on raw `<img>`
- Different: NO retry state machine (videos are HEAD-probed by the Server Action before success — no CDN propagation window); `<video autoPlay muted loop playsInline>` not `<img>`; `onClick` toggle on container for pause/resume (D-06); `[failed, setFailed]` boolean replaces `[status, setStatus]` tri-state; no `retryCount` / `retryTimerRef`; `paused` state for aria-label; no `<PhotoSkeleton>` fallback during load

---

### `src/components/wear/WearCard.tsx` — MODIFIED

**Analog:** self

**New optional props** — add to `WearCardProps` interface (lines 17–55) with explicit defaults:

```typescript
// Add after the existing commentCount prop:
// Phase 77: video render branch (VID-13, VID-14) — strictly optional; existing
// call sites that omit these props are byte-identical (VID-15 regression gate).
mediaType?: 'photo' | 'video'
signedVideoUrl?: string | null
signedPosterUrl?: string | null
```

**Photo layer branch** (lines 130–155) — add video discriminator ABOVE the existing `signedUrl !== null` check:

```tsx
// Current analog (unchanged photo path):
{signedUrl !== null ? (
  <WearPhotoClient signedUrl={signedUrl} ... />
) : (
  <WearDetailHero ... />
)}

// New (video branch inserted FIRST; photo branch untouched):
{mediaType === 'video' ? (
  <WearVideoClient
    signedVideoUrl={signedVideoUrl ?? null}
    signedPosterUrl={signedPosterUrl ?? null}
    altText={altText}
    watchImageUrl={watchImageUrl}
    brand={brand} model={model}
    username={username} displayName={displayName} avatarUrl={avatarUrl}
    createdAt={createdAt} watchId={watchId}
  />
) : signedUrl !== null ? (
  <WearPhotoClient signedUrl={signedUrl} ... />  // UNCHANGED
) : (
  <WearDetailHero ... />                          // UNCHANGED
)}
```

**Import addition:**

```typescript
import { WearVideoClient } from '@/components/wear/WearVideoClient'
```

**Pattern delta:** Minimal additive change. The existing `signedUrl !== null` and `WearDetailHero` branches are not modified. `WearPhotoClient.tsx` and `WearDetailHero.tsx` receive zero edits.

---

### `src/components/home/WywtTile.tsx` — MODIFIED

**Analog:** self

**New optional props** — add to the `Props` interface (lines 28–41):

```typescript
// Phase 77: video tile support (VID-13)
mediaType?: 'photo' | 'video'
signedPosterUrl?: string | null
```

**Image render branch** (lines 97–109) — add video poster branch:

```tsx
// Current analog:
{(tile.photoUrl ?? tile.imageUrl) ? (
  <Image src={tile.photoUrl ?? tile.imageUrl ?? ''} alt="" fill className="object-cover" unoptimized />
) : (
  <div className="absolute inset-0 bg-muted flex items-center justify-center">
    <WatchIcon className="text-muted-foreground" aria-hidden />
  </div>
)}

// Extended (poster for video, unchanged for photo):
{mediaType === 'video' && signedPosterUrl ? (
  <Image src={signedPosterUrl} alt="" fill className="object-cover" unoptimized />
) : (tile.photoUrl ?? tile.imageUrl) ? (
  <Image src={tile.photoUrl ?? tile.imageUrl ?? ''} alt="" fill className="object-cover" unoptimized />
) : (
  <div className="absolute inset-0 bg-muted flex items-center justify-center">
    <WatchIcon className="text-muted-foreground" aria-hidden />
  </div>
)}
{/* VideoPlayBadge rendered AFTER image, BEFORE bottom gradient — video tiles only */}
{mediaType === 'video' && <VideoPlayBadge />}
```

**Import addition:**

```typescript
import { VideoPlayBadge } from '@/components/wear/VideoPlayBadge'
```

**Pattern delta:** Additive only. When `mediaType !== 'video'` or absent, render path is unchanged (VID-15). `VideoPlayBadge` is the shared component (D-14) — never inline the badge JSX here.

---

### `src/app/wear/[wearEventId]/page.tsx` — MODIFIED

**Analog:** self (`WearPhotoStreamed` server function, lines 126–230)

**Signed URL mint pattern** (lines 165–172) — extend to cover video + poster:

```typescript
// Current analog (photo only):
let signedUrl: string | null = null
if (photoUrl) {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.storage
    .from('wear-photos')
    .createSignedUrl(photoUrl, 60 * 60)
  signedUrl = data?.signedUrl ?? null
}

// Extended for video support (add BEFORE the existing photoUrl branch):
let signedVideoUrl: string | null = null
let signedPosterUrl: string | null = null

if (wear.mediaType === 'video') {
  const supabase = await createSupabaseServerClient()
  const [videoResult, posterResult] = await Promise.all([
    wear.mediaPath
      ? supabase.storage.from('wear-photos').createSignedUrl(wear.mediaPath, 60 * 60)
      : Promise.resolve({ data: null }),
    wear.posterPath
      ? supabase.storage.from('wear-photos').createSignedUrl(wear.posterPath, 60 * 60)
      : Promise.resolve({ data: null }),
  ])
  signedVideoUrl = videoResult.data?.signedUrl ?? null
  signedPosterUrl = posterResult.data?.signedUrl ?? null
} else if (photoUrl) {
  // Existing photo branch — unchanged
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.storage
    .from('wear-photos')
    .createSignedUrl(photoUrl, 60 * 60)
  signedUrl = data?.signedUrl ?? null
}
```

**`WearCard` invocation** (lines 201–229) — pass new optional props:

```tsx
// Add to the existing WearCard spread (all other props unchanged):
<WearCard
  signedUrl={signedUrl}
  // ... all existing props ...
  mediaType={wear.mediaType ?? undefined}
  signedVideoUrl={signedVideoUrl}
  signedPosterUrl={signedPosterUrl}
/>
```

**Pattern delta:** `createSupabaseServerClient()` admin client used (same as current photo path — this is the durable lesson from Phase 61; cookie client fails for non-owner covers). `Promise.all` for both URLs minimizes latency. The Suspense structure and page outer shell are NOT modified.

---

## Wave 0 — Test Stubs

All test files must be created as failing (RED) stubs in Wave 0 so Wave 1+ implementations have assertions to flip green.

### `tests/hooks/useMediaCapability.test.ts` — NEW

**Analog:** `tests/hooks/useViewedWears.test.ts`

**Test file structure** (from `useViewedWears.test.ts`, lines 1–10):

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useViewedWears } from '@/hooks/useViewedWears'

describe('useViewedWears — SSR-safe localStorage viewed-state hook (W-06 / Pitfall 4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  // ...tests...
})
```

**Apply to `useMediaCapability`:**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMediaCapability } from '@/hooks/useMediaCapability'

describe('useMediaCapability — capability probe hook (VID-01, VID-04)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns supportsVideoCapture=false before probe runs (SSR default)', () => {
    // Stub MediaRecorder as undefined to simulate SSR
    vi.stubGlobal('MediaRecorder', undefined)
    const { result } = renderHook(() => useMediaCapability())
    expect(result.current.supportsVideoCapture).toBe(false)
    expect(result.current.preferredMimeType).toBeNull()
  })

  it('returns supportsVideoCapture=true + mp4 mimeType when mp4 supported (VID-04)', async () => {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: (m: string) => m === 'video/mp4;codecs=avc1',
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn() },
      configurable: true,
    })
    const { result } = renderHook(() => useMediaCapability())
    await act(async () => {})
    expect(result.current.supportsVideoCapture).toBe(true)
    expect(result.current.preferredMimeType).toBe('video/mp4;codecs=avc1')
  })

  it('falls back to webm when mp4 unsupported (VID-04)', async () => {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: (m: string) => m.startsWith('video/webm'),
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn() },
      configurable: true,
    })
    const { result } = renderHook(() => useMediaCapability())
    await act(async () => {})
    expect(result.current.supportsVideoCapture).toBe(true)
    expect(result.current.preferredMimeType).toMatch(/^video\/webm/)
  })

  it('returns supportsVideoCapture=false when getUserMedia unavailable', async () => {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: () => true,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {},  // no getUserMedia
      configurable: true,
    })
    const { result } = renderHook(() => useMediaCapability())
    await act(async () => {})
    expect(result.current.supportsVideoCapture).toBe(false)
  })
})
```

---

### `tests/unit/videoCapture.test.ts` — NEW

**Analog:** `tests/unit/buildWearVideoPath.test.ts` (structure) + RESEARCH.md timer pattern

**Key test pattern** (RESEARCH.md lines 640–656):

```typescript
import { describe, it, expect, vi } from 'vitest'

// Timer test (VID-02):
it('MediaRecorder.stop() is called at 3000ms', () => {
  vi.useFakeTimers()
  const mockRecorder = {
    start: vi.fn(), stop: vi.fn(),
    ondataavailable: null, onstop: null, state: 'inactive',
  }
  // Call the recording start logic with the mock recorder
  startRecording(mockRecorder, ...)
  vi.advanceTimersByTime(3000)
  expect(mockRecorder.stop).toHaveBeenCalledTimes(1)
  vi.useRealTimers()
})
```

Note: `startRecording` must be exported from `VideoCaptureView` or a standalone module for testability.

---

### `tests/unit/posterExtraction.test.ts` — NEW

**Key test pattern** (RESEARCH.md lines 692–710):

```typescript
import { describe, it, expect, vi } from 'vitest'
import { extractPosterBlob } from '@/lib/video/extractPosterBlob'

// Mock document.createElement to intercept video + canvas creation
it('seeks to duration * 0.75 before calling canvas.toBlob', async () => {
  // Intercept createElement('video'), simulate onloadedmetadata + onseeked
  // Assert video.currentTime was set to duration * 0.75 (e.g., 2.25 for 3.0s clip)
})

it('rejects when canvas.toBlob returns null', async () => {
  // Simulate canvas.toBlob returning null; assert extractPosterBlob rejects
})

it('revokes object URL on success', async () => {
  const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
  // ... run extraction ...
  expect(revokeSpy).toHaveBeenCalled()
})
```

---

### `tests/unit/mediaState.test.ts` — NEW

**Key test pattern** (VID-06 — discriminated union type-narrowing):

```typescript
import { describe, it, expect } from 'vitest'
import type { MediaState } from '@/lib/wywtTypes'

// TypeScript compile-time: the tests below exist to confirm the type is importable
// and that runtime switch narrowing works correctly.
describe('MediaState discriminated union (VID-06)', () => {
  it('kind:none has no blob fields', () => {
    const s: MediaState = { kind: 'none' }
    expect(s.kind).toBe('none')
  })
  it('kind:photo carries a blob', () => {
    const blob = new Blob(['x'])
    const s: MediaState = { kind: 'photo', blob }
    expect(s.kind).toBe('photo')
    if (s.kind === 'photo') expect(s.blob).toBeInstanceOf(Blob)
  })
  it('kind:video carries videoBlob + posterBlob', () => {
    const vb = new Blob(['v'])
    const pb = new Blob(['p'])
    const s: MediaState = { kind: 'video', videoBlob: vb, posterBlob: pb }
    expect(s.kind).toBe('video')
    if (s.kind === 'video') {
      expect(s.videoBlob).toBeInstanceOf(Blob)
      expect(s.posterBlob).toBeInstanceOf(Blob)
    }
  })
})
```

---

### `tests/unit/dalMediaColumns.test.ts` — NEW

**Analog:** `tests/unit/wearRail.test.ts`

Assert that `getWearEventByIdForViewer`, `getWearEventsForViewer`, `getWearRailForViewer`, `getActiveWearsForUser` each return objects with `mediaType`, `mediaPath`, `posterPath` fields present (even if null). Use a mock DB or integration test pattern matching the existing wearRail.test.ts approach.

---

### `tests/components/wywt/VideoCaptureView.test.tsx` — NEW

**Analog:** `tests/components/wywt/CameraCaptureView.test.tsx`

**Test file imports pattern** (from `CameraCaptureView.test.tsx`, lines 1–16):

```typescript
import { describe, it, expect } from 'vitest'
import { computeObjectCoverSourceRect } from '@/components/wywt/CameraCaptureView'
```

**Apply to `VideoCaptureView`:**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoCaptureView } from '@/components/wywt/VideoCaptureView'

// Required: mock MediaRecorder globally
vi.stubGlobal('MediaRecorder', class {
  start = vi.fn(); stop = vi.fn()
  ondataavailable: ((e: BlobEvent) => void) | null = null
  onstop: (() => void) | null = null
  state = 'inactive'
})
```

**Key assertions:**
- `Cancel` button is rendered and enabled
- `Record 3s` button is rendered before recording starts
- When `disabled` prop is true, Record button is disabled
- Component does NOT call `getUserMedia` internally (stream is a prop)
- Discard path resets recording state (VID-03)

---

### `tests/components/wywt/ComposeStep.video.test.tsx` — NEW

**Analog:** `tests/components/wear/WearCard.test.tsx` (Wave 0 stub pattern, lines 1–30)

```typescript
// Wave 0 RED — seeded by Wave 0; flipped green by Plan XX (ComposeStep video extend)
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComposeStep } from '@/components/wywt/ComposeStep'

// Stub useMediaCapability to control the video button visibility
vi.mock('@/hooks/useMediaCapability', () => ({
  useMediaCapability: vi.fn(),
}))

// Key: 3 buttons when supportsVideoCapture=true; 2 when false (VID-01 / D-04)
it('renders 3 pre-capture buttons when supportsVideoCapture=true', () => { ... })
it('renders 2 pre-capture buttons when supportsVideoCapture=false (D-04)', () => { ... })
```

---

### `tests/components/wywt/ComposeStep.submit.video.test.tsx` — NEW

**Key assertions:** submit calls `logWearWithVideo` (not `logWearWithPhoto`) when `mediaState.kind === 'video'`; upload ordering is video → poster → action; compensating `.remove([videoPath])` is called when poster upload fails.

---

### `tests/components/wear/WearVideoClient.test.tsx` — NEW

**Key assertions** (VID-14):
- `<video>` has `autoPlay`, `muted`, `loop`, `playsInline` attributes
- `onError` transitions to fallback rendering with "Video unavailable" label
- Tap on container toggles `.pause()` / `.play()` on the video ref

```typescript
it('VID-14: video element has required autoplay attributes', () => {
  const { container } = render(<WearVideoClient signedVideoUrl="https://example.com/v.mp4" ... />)
  const video = container.querySelector('video')
  expect(video).not.toBeNull()
  expect(video?.hasAttribute('autoplay')).toBe(true)
  expect(video?.hasAttribute('muted')).toBe(true)
  expect(video?.hasAttribute('loop')).toBe(true)
  expect(video?.hasAttribute('playsinline')).toBe(true)
})

it('VID-14: shows "Video unavailable" on onError', () => {
  const { container, getByText } = render(<WearVideoClient signedVideoUrl="https://example.com/v.mp4" ... />)
  const video = container.querySelector('video')!
  fireEvent.error(video)
  expect(getByText('Video unavailable')).toBeInTheDocument()
})
```

---

### `tests/components/wear/WearCard.video.test.tsx` — NEW

**Analog:** `tests/components/wear/WearCard.test.tsx` (extends existing test file)

**VID-15 regression pattern** (RESEARCH.md lines 678–688):

```typescript
it('VID-15: no <video> element when mediaType prop absent (photo regression)', () => {
  const { container } = render(
    <WearCard
      signedUrl="https://example.com/photo.jpg"
      // ... all required props, NO mediaType ...
    />
  )
  expect(container.querySelector('video')).toBeNull()
})

it('VID-13: renders WearVideoClient (contains <video>) when mediaType="video"', () => {
  const { container } = render(
    <WearCard
      signedUrl={null}
      mediaType="video"
      signedVideoUrl="https://example.com/v.mp4"
      signedPosterUrl="https://example.com/p.jpg"
      // ... all required props ...
    />
  )
  expect(container.querySelector('video')).not.toBeNull()
})
```

---

### `tests/components/home/WywtTile.video.test.tsx` — NEW

**Key assertions** (VID-13):
- When `mediaType="video"`, `VideoPlayBadge` is rendered (test via aria-hidden div with play icon, or data-testid)
- When `mediaType="photo"` or absent, `VideoPlayBadge` is NOT rendered
- Poster image (`signedPosterUrl`) is used as the tile image source for video tiles

---

## Shared Patterns

### Signed URL Minting (Pitfall F-2)
**Source:** `src/app/wear/[wearEventId]/page.tsx` lines 165–172
**Apply to:** All server components that render wear event media (`WearPhotoStreamed`, home page `src/app/page.tsx` video tile minting, `/wears/[username]/page.tsx` slide minting)

```typescript
// ALWAYS use createSupabaseServerClient() — admin client (Phase 61 lesson)
// NEVER mint in the DAL, NEVER in 'use cache' functions
// ALWAYS inside the Suspense boundary (streamed server child)
const supabase = await createSupabaseServerClient()
const { data } = await supabase.storage
  .from('wear-photos')
  .createSignedUrl(path, 60 * 60)  // 60-minute TTL
const signedUrl = data?.signedUrl ?? null
```

### getUserMedia Gesture Context Guard
**Source:** `src/components/wywt/ComposeStep.tsx` lines 153–189
**Apply to:** `handleTapVideoCamera` in `ComposeStep.tsx`

```typescript
// SYNCHRONOUS ref write before any await (not setState — no microtask)
cameraOpeningRef.current = true
// getUserMedia MUST be the FIRST await — no setState, fetch, or other await before it
const stream = await navigator.mediaDevices.getUserMedia({ ... })
```

### Stream-as-Prop Architecture
**Source:** `src/components/wywt/CameraCaptureView.tsx` lines 1–14 (comment block)
**Apply to:** `VideoCaptureView.tsx` — enforce the same architectural constraint: `VideoCaptureView` NEVER calls `getUserMedia`. The parent (`ComposeStep`) owns stream acquisition. This makes the iOS gesture discipline architecturally enforced rather than convention-dependent.

### Error Copy + Inline Alert Pattern
**Source:** `src/components/wywt/ComposeStep.tsx` lines 497–501
**Apply to:** All new error states in `ComposeStep` video submit path

```tsx
{error && (
  <p role="alert" className="text-sm text-destructive">
    {error}
  </p>
)}
```

### Dark Mode Button Pairing Rule
**Source:** CLAUDE.md (durable memory `feedback_button_outline_dark_override`)
**Apply to:** Any `variant="outline"` Button that adds a `bg-X` class override (e.g., Cancel button in `VideoCaptureView`)

```tsx
// Rule: every un-prefixed bg-X override must be paired with dark:bg-X
// Cancel button uses variant="outline" which already injects dark:bg-input/30
// If NO bg-X override is added, no pairing issue. Only pair if overriding.
```

### Font-Weight Guardrail
**Source:** `77-UI-SPEC.md` §Typography
**Apply to:** All new UI text: `font-semibold` for button labels, tile overlay text, "Video unavailable" label. `font-normal` for body + helper text. Never `font-medium` (recurring regression in prior phases).

### `'use client'` Directive Placement
**Source:** `src/components/wywt/CameraCaptureView.tsx` line 1, `src/components/wear/WearPhotoClient.tsx` line 1
**Apply to:** `VideoCaptureView.tsx`, `WearVideoClient.tsx`, `VideoPlayBadge.tsx` — all new components that use React state or browser APIs must have `'use client'` as the literal first line of the file (before any imports).

### `playsInline` on Every `<video>`
**Apply to:** `VideoCaptureView.tsx` live preview video, ComposeStep post-capture preview video, `WearVideoClient.tsx` playback video
**Rule:** `playsInline` MUST appear on every `<video>` element. iOS Safari goes fullscreen without it. This is not optional.

---

## No Analog Found

All files have close analogs. No gaps.

---

## Metadata

**Analog search scope:** `src/components/wywt/`, `src/components/wear/`, `src/components/home/`, `src/hooks/`, `src/lib/storage/`, `src/data/`, `src/app/wear/[wearEventId]/`, `tests/hooks/`, `tests/components/`, `tests/unit/`
**Files scanned:** 14 source files, 7 test files
**Pattern extraction date:** 2026-06-22

---

## PATTERN MAPPING COMPLETE

**Phase:** 77 — Video Capture + Display UI
**Files classified:** 24 (12 new CREATE, 9 modified EDIT, 1 DELETE, 11 test stubs)
**Analogs found:** 24 / 24

### Coverage
- Files with exact analog: 5 (`VideoCaptureView` ← `CameraCaptureView`; `WearVideoClient` ← `WearPhotoClient`; `WearCard.video.test` ← `WearCard.test`; `useMediaCapability.test` ← `useViewedWears.test`; `buildWearVideoPath.test` structure for utility tests)
- Files with role-match analog: 17 (all other new/modified files)
- Files with no analog: 0

### Key Patterns Identified
- `CameraCaptureView` → `VideoCaptureView`: stream-as-prop architecture is the most critical pattern; the iOS gesture discipline (getUserMedia as first await, `cameraOpeningRef` re-entrance guard) is inherited verbatim and architecturally enforced by never calling `getUserMedia` inside the capture component
- `WearPhotoClient` → `WearVideoClient`: container class is copied byte-for-byte (`w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto md:max-h-[70vh] relative`) for VID-15 visual parity; error fallback structure mirrors the existing photo fallback chain; retry state machine is NOT needed
- DAL WR-02 is a hard Wave 1 prerequisite blocking all display work — `getWearEventsForViewer`, `getWearEventByIdForViewer`, `getWearRailForViewer`, `getActiveWearsForUser` each need `mediaType`, `mediaPath`, `posterPath` added to their explicit SELECT objects

### File Created
`/Users/tylerwaneka/Documents/horlo/.planning/phases/77-video-capture-display-ui/77-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.
