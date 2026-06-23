'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PhotoUploader } from './PhotoUploader'
import type { PhotoUploaderHandle } from './PhotoUploader'
import { CameraCaptureView } from './CameraCaptureView'
import { VideoCaptureView } from './VideoCaptureView'
import { VisibilitySegmentedControl } from './VisibilitySegmentedControl'
import {
  uploadWearPhoto,
  buildWearVideoPath,
  buildWearPosterPath,
} from '@/lib/storage/wearPhotos'
import { logWearWithPhoto, logWearWithVideo } from '@/app/actions/wearEvents'
import { useMediaCapability } from '@/hooks/useMediaCapability'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { todayLocalISO } from '@/lib/wear'
import { cn } from '@/lib/utils'
import type { Watch } from '@/lib/types'
import type { WearVisibility } from '@/lib/wearVisibility'
import type { MediaState } from '@/lib/wywtTypes'

/**
 * ComposeStep — Phase 15 Plan 03b Step 2 form (D-05, D-06, D-07, D-11, D-12,
 * D-18, D-19). Owned by WywtPostDialog; no dialog chrome rendered here.
 *
 * Layout (top → bottom):
 *   1. Header row: "Log a wear" title + "Change" link (D-05)
 *   2. Compact watch card header
 *   3. Photo zone in ONE of three mutually-exclusive states (D-06, D-07):
 *        - pre-capture chooser: "Take wrist shot" + Upload photo buttons
 *        - live camera: <CameraCaptureView stream={...} ... />
 *        - post-capture preview: <img> + X button + (Retake | Choose another)
 *   4. Note textarea with 0/200 character counter (destructive at 200) — D-11
 *   5. VisibilitySegmentedControl — D-12
 *   6. Inline `role="alert"` error banner (Plan 03a server errors, camera
 *      errors, upload errors) — single surface, no toast on failure (H-2)
 *   7. Footer: "Keep browsing" + "Log wear" buttons (D-18 "Logging…" label
 *      while pending)
 *
 * D-07 three distinct handlers (threat T-15-28):
 *   - X button on preview → handleRemovePhoto → clears blob+source →
 *     pre-capture chooser re-renders from EITHER source.
 *   - "Retake" (camera path only) → handleRetake → clears blob, re-invokes
 *     getUserMedia to acquire a FRESH MediaStream → returns directly to live
 *     camera preview. mediaSource stays 'camera'.
 *   - "Choose another" (upload path only) → handleChooseAnother → clears blob,
 *     calls photoUploaderRef.current?.openPicker() to programmatically re-open
 *     the native file picker. mediaSource stays 'upload'.
 *   Clicking different elements MUST produce different behavior — do not wire
 *   all three to a single handler.
 *
 * Submit pipeline:
 *   1. (optional) uploadWearPhoto(userId, wearEventId, photoBlob) →
 *      direct client upload to Supabase Storage at {userId}/{wearEventId}.jpg.
 *      `photoBlob` is ALREADY EXIF-stripped + 1080-capped: PhotoUploader
 *      (file path) and CameraCaptureView (camera path) both run
 *      `stripAndResize` BEFORE invoking handlePhotoReady. Re-running it here
 *      would force a second canvas-based JPEG re-encode (lossy generation
 *      loss; ~50–300ms wasted CPU). Per WR-01, the submit-time strip was
 *      removed — Pitfall 5 (uniform EXIF strip on all paths) is satisfied
 *      upstream since BOTH entry points pipe through stripAndResize.
 *   2. logWearWithPhoto({wearEventId, watchId, note, visibility, hasPhoto}) →
 *      Plan 03a Server Action. On success → router.push(`/wear/${wearEventId}`)
 *      (Phase 26 D-04) → dialog closes. On failure →
 *      inline role="alert" with the exact server error string.
 *
 * Pitfall 1 (iOS gesture rule, threat T-15-01): getUserMedia is the FIRST
 * await in handleTapCamera / handleRetake. No setState / prop access / fetch
 * runs before it, so the tap/link gesture context is preserved for iOS
 * Safari's camera-permission check.
 *
 * Pitfall H-2 (Server Action toast): all toast.success calls live in this
 * Client Component. The Server Action (Plan 03a logWearWithPhoto) does NOT
 * import sonner — enforced by plan-level grep in 15-03a verification.
 */
export function ComposeStep({
  watch,
  viewerId,
  wearEventId,
  mediaState,
  setMediaState,
  note,
  setNote,
  visibility,
  setVisibility,
  onChange,
  onSubmitted,
}: {
  watch: Watch
  viewerId: string
  wearEventId: string
  mediaState: MediaState
  setMediaState: (s: MediaState) => void
  note: string
  setNote: (s: string) => void
  visibility: WearVisibility
  setVisibility: (v: WearVisibility) => void
  onChange: () => void
  onSubmitted: () => void
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const { supportsVideoCapture, preferredMimeType } = useMediaCapability()
  const [error, setError] = useState<string | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [mediaSource, setMediaSource] = useState<
    'camera' | 'video' | 'upload' | null
  >(null)
  // Convenience accessor for the photo blob narrowed out of mediaState.
  const photoBlob = mediaState.kind === 'photo' ? mediaState.blob : null
  const photoUploaderRef = useRef<PhotoUploaderHandle | null>(null)
  // Progressive disclosure for the note field — start collapsed unless the
  // user already has draft content (D-05 preserves note across Change → back).
  const [noteOpen, setNoteOpen] = useState(note.length > 0)
  const noteRef = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    if (noteOpen) noteRef.current?.focus()
  }, [noteOpen])
  // WR-04: ref-based re-entrance guard for handleTapCamera. Cannot use
  // useState here because the React state update would land on the
  // microtask queue AFTER the awaited getUserMedia resolves, leaving a
  // window in which a second tap re-enters the function. A useRef write
  // is synchronous and intentionally NOT a state update — it does not
  // trigger a re-render and does not introduce a microtask between the
  // tap gesture and the getUserMedia call (Pitfall 1 / T-15-01 preserved).
  const cameraOpeningRef = useRef(false)

  // Preview URL lifecycle — revoke on blob change / unmount.
  const photoPreviewUrl = useMemo(
    () => (photoBlob ? URL.createObjectURL(photoBlob) : null),
    [photoBlob],
  )
  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    }
  }, [photoPreviewUrl])

  // Stop any active camera track when the component unmounts (defense in
  // depth — handleRemovePhoto / handleCancelCamera / submit also stop tracks
  // when they apply).
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop())
      }
    }
    // cameraStream is intentionally read from the closure on unmount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pitfall 1 (T-15-01): getUserMedia MUST be the first await. Do NOT
  // await anything (setState, props, fetch) before it.
  //
  // WR-04: a rapid second tap during the in-flight first call (cameraStream
  // is still null because setState hasn't run yet) would acquire a SECOND
  // MediaStream — only the last setCameraStream wins, and the earlier
  // stream's tracks never stop (LED stays on until tab close). The
  // synchronous `cameraOpeningRef` flag short-circuits the re-entrant call
  // BEFORE getUserMedia is invoked. setError + the ref write are synchronous
  // (not setState) so they do NOT introduce a microtask boundary between
  // the user gesture and getUserMedia, preserving iOS Safari's gesture
  // context.
  const handleTapCamera = async () => {
    if (cameraOpeningRef.current || cameraStream) return
    cameraOpeningRef.current = true
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1080 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      setCameraStream(stream)
      setMediaSource('camera')
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

  // Phase 77 (VID-01, T-77-04): video-camera tap handler mirrors handleTapCamera
  // VERBATIM up to the await — synchronous cameraOpeningRef write BEFORE the
  // getUserMedia call is the first await, preserving iOS gesture context.
  const handleTapVideoCamera = async () => {
    if (cameraOpeningRef.current || cameraStream) return
    cameraOpeningRef.current = true
    setError(null)
    try {
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

  // Common callback from PhotoUploader / CameraCaptureView when a processed
  // JPEG blob is ready. Stops any active camera stream, stores the blob.
  const handlePhotoReady = (jpeg: Blob) => {
    setMediaState({ kind: 'photo', blob: jpeg })
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop())
      setCameraStream(null)
    }
  }

  const handleCameraPhotoReady = (jpeg: Blob) => {
    setMediaSource('camera')
    handlePhotoReady(jpeg)
  }

  const handleUploadReady = (jpeg: Blob) => {
    setMediaSource('upload')
    handlePhotoReady(jpeg)
  }

  // D-07 handler #1: X button on preview → remove photo entirely → return to
  // the pre-capture chooser regardless of source. Stops any active stream as
  // a defensive no-op (cameraStream is normally already null on the preview).
  const handleRemovePhoto = () => {
    setMediaState({ kind: 'none' })
    setMediaSource(null)
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop())
      setCameraStream(null)
    }
  }

  // D-07 handler #2: Retake link (camera path only) → discard current photo
  // and re-acquire a fresh MediaStream, returning directly to the live
  // camera preview. mediaSource remains 'camera'. Re-uses handleTapCamera
  // for the getUserMedia call (link tap IS a gesture; iOS requirement met).
  const handleRetake = async () => {
    setMediaState({ kind: 'none' })
    await handleTapCamera()
  }

  // D-07 handler #3: Choose another link (upload path only) → discard current
  // photo and programmatically re-open the native file picker via the
  // PhotoUploader ref. mediaSource remains 'upload' so the UI stays on the
  // upload branch if the user cancels the file picker.
  const handleChooseAnother = () => {
    setMediaState({ kind: 'none' })
    photoUploaderRef.current?.openPicker()
  }

  // Cancel button on the camera live preview — stops stream, returns to
  // pre-capture chooser (different from Retake: no photo was captured).
  const handleCancelCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop())
      setCameraStream(null)
    }
    setMediaSource(null)
  }

  // Phase 77 (VID-02 onstop result): video + poster blobs ready. Lift into
  // mediaState as { kind: 'video', ... } and tear down the live stream — the
  // post-capture preview uses an object URL on the videoBlob.
  const handleVideoReady = (result: { videoBlob: Blob; posterBlob: Blob }) => {
    setMediaState({
      kind: 'video',
      videoBlob: result.videoBlob,
      posterBlob: result.posterBlob,
    })
    cameraStream?.getTracks().forEach((t) => t.stop())
    setCameraStream(null)
    setMediaSource(null)
  }

  // Phase 77 (VID-03 post-capture): Discard the recorded clip and return to
  // the pre-capture chooser. cameraStream was already torn down by
  // handleVideoReady — user re-acquires via tapping 'Record video' again.
  const handleDiscardVideo = () => {
    setMediaState({ kind: 'none' })
    setMediaSource(null)
  }

  // Phase 77 (VID-03 mid-recording): Cancel from VideoCaptureView before the
  // user-stop / 3.0s auto-stop fires. Tear down the live stream.
  const handleCancelVideoCamera = () => {
    cameraStream?.getTracks().forEach((t) => t.stop())
    setCameraStream(null)
    setMediaSource(null)
  }

  // Phase 77: video preview object URL — mirrors photoPreviewUrl pattern;
  // revoked on mediaState change / unmount.
  const videoPreviewUrl = useMemo(
    () =>
      mediaState.kind === 'video' ? URL.createObjectURL(mediaState.videoBlob) : null,
    [mediaState],
  )
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    }
  }, [videoPreviewUrl])

  const handleSubmit = () => {
    setError(null)
    startTransition(async () => {
      try {
        // Phase 77 (VID-01, VID-06): video submit branch. Runs FIRST and
        // returns early — the photo branch only executes when
        // mediaState.kind !== 'video'.
        if (mediaState.kind === 'video') {
          const videoPath = buildWearVideoPath(viewerId, wearEventId)
          const posterPath = buildWearPosterPath(viewerId, wearEventId)
          const supabase = createSupabaseBrowserClient()
          const { error: videoError } = await supabase.storage
            .from('wear-photos')
            .upload(videoPath, mediaState.videoBlob, {
              contentType: mediaState.videoBlob.type,
              upsert: false,
            })
          if (videoError) {
            setError('Video upload failed — please try again.')
            return
          }
          const { error: posterError } = await supabase.storage
            .from('wear-photos')
            .upload(posterPath, mediaState.posterBlob, {
              contentType: 'image/jpeg',
              upsert: false,
            })
          if (posterError) {
            // Compensating cleanup: video already uploaded but the action
            // will never insert the DB row.
            await supabase.storage.from('wear-photos').remove([videoPath])
            setError('Poster upload failed — please try again.')
            return
          }
          const videoResult = await logWearWithVideo({
            wearEventId,
            watchId: watch.id,
            note: note.trim().length > 0 ? note.trim() : null,
            visibility,
            videoBytes: mediaState.videoBlob.size,
            today: todayLocalISO(),
          })
          if (!videoResult.success) {
            setError(videoResult.error)
            return
          }
          router.push(`/wear/${wearEventId}`)
          onSubmitted()
          return
        }

        // Photo submit branch (VID-15 invariant — byte-identical to pre-77).
        // Upload photo if present. WR-01: do NOT re-run stripAndResize here —
        // PhotoUploader (line 118 in PhotoUploader.tsx) and CameraCaptureView
        // (line 91 in CameraCaptureView.tsx) already pipe their blob through
        // stripAndResize BEFORE invoking handlePhotoReady, so by the time we
        // reach this submit handler `photoBlob` is already EXIF-stripped and
        // ≤1080px. A second canvas re-encode would introduce extra
        // generation-loss artifacts and waste 50–300ms of main-thread CPU.
        if (photoBlob) {
          const upload = await uploadWearPhoto(viewerId, wearEventId, photoBlob)
          if ('error' in upload) {
            setError('Photo upload failed — please try again.')
            return
          }
        }
        const today = todayLocalISO()
        const result = await logWearWithPhoto({
          wearEventId,
          watchId: watch.id,
          note: note.trim().length > 0 ? note.trim() : null,
          visibility,
          hasPhoto: !!photoBlob,
          today,
        })
        if (!result.success) {
          setError(result.error)
          return
        }
        // D-04 (Phase 26): standard router.push so browser back returns
        // to the trigger page. D-07 ordering is LOCKED — both awaits
        // (uploadWearPhoto + logWearWithPhoto) must succeed before this
        // fires; otherwise the user lands on /wear/{id} before the row
        // exists and sees a 404.
        router.push(`/wear/${wearEventId}`)
        onSubmitted()
      } catch (err) {
        console.error('[ComposeStep] submit error:', err)
        setError('Could not log that wear. Please try again.')
      }
    })
  }

  const counterAt200 = note.length >= 200
  const watchImage =
    'imageUrl' in watch && typeof watch.imageUrl === 'string'
      ? watch.imageUrl
      : null

  return (
    <div className="space-y-4">
      {/* Header row: title + Change link (D-05). Plain <h2> rather than
          DialogTitle so ComposeStep can be rendered under test without a
          DialogRoot — production wraps ComposeStep in DialogContent (which
          is itself inside DialogRoot) so accessibility is already covered
          by the outer container's role=dialog semantics. */}
      <div className="flex items-center justify-between pr-10">
        <h2 className="font-heading text-base leading-none font-semibold">
          Log a wear
        </h2>
        <button
          type="button"
          onClick={onChange}
          disabled={pending}
          className="text-xs font-semibold text-accent underline underline-offset-2"
        >
          Change
        </button>
      </div>

      {/* Compact watch card header (D-05) */}
      <div className="flex items-center gap-3 p-2 bg-card rounded-md border border-border">
        {watchImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={watchImage}
            alt=""
            className="size-10 rounded-md object-cover"
          />
        ) : (
          <div className="size-10 rounded-md bg-muted" aria-hidden />
        )}
        <div className="flex flex-col">
          <span className="text-base font-semibold">{watch.brand}</span>
          <span className="text-sm text-muted-foreground">{watch.model}</span>
        </div>
      </div>

      {/* Photo zone — 3 mutually-exclusive states (D-06, D-07).
          PhotoUploader is rendered UNCONDITIONALLY below the state branches
          but visually hidden when we're not in the pre-capture chooser. This
          keeps the ref stable across state transitions so the D-07 "Choose
          another" link (post-capture upload path) can programmatically call
          photoUploaderRef.current.openPicker() — if PhotoUploader were only
          rendered inside the chooser branch, the ref would be null by the
          time the user clicked the link. */}
      {mediaState.kind === 'video' ? (
        /* VIDEO POST-CAPTURE PREVIEW (Phase 77 — VID-03 / D-16) */
        <div className="relative">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={videoPreviewUrl ?? ''}
            autoPlay
            muted
            loop
            playsInline
            className="w-full rounded-md object-cover"
          />
          <button
            type="button"
            onClick={handleDiscardVideo}
            disabled={pending}
            className="mt-2 text-xs font-semibold text-accent underline"
          >
            Discard
          </button>
          {mediaState.videoBlob.size > 4 * 1024 * 1024 && (
            <p className="text-xs text-muted-foreground">
              Clip is large — upload may be slow.
            </p>
          )}
        </div>
      ) : cameraStream && mediaSource === 'video' ? (
        /* VIDEO LIVE CAPTURE (Phase 77 — VID-02) */
        <VideoCaptureView
          stream={cameraStream}
          preferredMimeType={preferredMimeType ?? 'video/mp4;codecs=avc1'}
          onVideoReady={handleVideoReady}
          onError={(m) => {
            setError(m)
            handleCancelVideoCamera()
          }}
          onCancel={handleCancelVideoCamera}
          disabled={pending}
        />
      ) : photoBlob ? (
        /* POST-CAPTURE PREVIEW */
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoPreviewUrl ?? ''}
            alt="Wear photo preview"
            className="w-full rounded-md object-cover"
          />
          {/* D-07 #1: X → chooser */}
          <button
            type="button"
            aria-label="Remove photo"
            onClick={handleRemovePhoto}
            disabled={pending}
            className="absolute top-2 right-2 size-11 flex items-center justify-center rounded-full bg-background/80 hover:bg-background"
          >
            <X className="size-4" aria-hidden />
          </button>
          {/* D-07 #2 / #3: Retake (camera) OR Choose another (upload) */}
          {mediaSource === 'camera' ? (
            <button
              type="button"
              onClick={handleRetake}
              disabled={pending}
              className="mt-2 text-xs font-semibold text-accent underline"
            >
              Retake
            </button>
          ) : (
            <button
              type="button"
              onClick={handleChooseAnother}
              disabled={pending}
              className="mt-2 text-xs font-semibold text-accent underline"
            >
              Choose another
            </button>
          )}
        </div>
      ) : cameraStream ? (
        /* CAMERA LIVE PREVIEW */
        <CameraCaptureView
          stream={cameraStream}
          onPhotoReady={handleCameraPhotoReady}
          onError={(m) => {
            setError(m)
            handleCancelCamera()
          }}
          onCancel={handleCancelCamera}
          disabled={pending}
        />
      ) : (
        /* PRE-CAPTURE CHOOSER — visible Take wrist shot + Upload photo, both
            inside the dashed border so they read as a single "pick a photo
            source" zone (UI-SPEC §Copywriting Contract / D-06; WR-03 fix —
            previously the Upload button rendered outside the dashed box
            below). The Upload button here is a visual MIRROR that proxies
            taps through the always-mounted PhotoUploader's openPicker(); the
            real PhotoUploader is rendered sr-only below so its ref stays
            stable across state transitions for the D-07 "Choose another"
            re-open path. */
        <div className="flex flex-col items-center gap-2 py-8 border-2 border-dashed border-border rounded-md bg-muted/30">
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTapCamera}
              disabled={pending}
              className="min-h-11"
            >
              Take wrist shot
            </Button>
            {supportsVideoCapture && (
              <Button
                type="button"
                variant="outline"
                onClick={handleTapVideoCamera}
                disabled={pending}
                className="min-h-11"
              >
                Record video
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => photoUploaderRef.current?.openPicker()}
              disabled={pending}
              className="min-h-11"
            >
              Upload photo
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Photo optional</p>
        </div>
      )}

      {/* Persistent PhotoUploader — kept mounted in sr-only across ALL
          photo-zone states so photoUploaderRef stays alive (the "Choose
          another" link in the post-capture preview path needs to call
          openPicker() imperatively). The visible Upload photo button now
          lives inside the dashed chooser above and proxies through this
          ref — the rendered PhotoUploader's own button is intentionally
          inaccessible (sr-only + aria-hidden) so we never show two file
          chooser buttons stacked. (WR-03.) */}
      <div className="sr-only" aria-hidden>
        <PhotoUploader
          ref={photoUploaderRef}
          onPhotoReady={handleUploadReady}
          onError={setError}
          disabled={pending}
        />
      </div>

      {/* Note (D-11) — collapsed by default to save space; expands on tap.
          0/200 counter remains destructive at 200 once expanded. */}
      {noteOpen ? (
        <div>
          <Textarea
            ref={noteRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Add a note…"
            disabled={pending}
            className="resize-none text-sm"
            aria-label="Wear note"
          />
          <p
            className={cn(
              'mt-1 text-right text-xs',
              counterAt200
                ? 'text-destructive font-semibold'
                : 'text-muted-foreground font-normal',
            )}
          >
            {note.length}/200
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setNoteOpen(true)}
          disabled={pending}
          className="text-xs font-semibold text-accent underline underline-offset-2"
        >
          + Add a note
        </button>
      )}

      {/* Visibility (D-12) */}
      <VisibilitySegmentedControl
        value={visibility}
        onChange={setVisibility}
        disabled={pending}
      />

      {/* Inline error banner — surface server + camera + upload failures */}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          type="button"
          onClick={onChange}
          disabled={pending}
        >
          Keep browsing
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={pending}>
          {pending ? 'Logging…' : 'Log wear'}
        </Button>
      </div>
    </div>
  )
}
