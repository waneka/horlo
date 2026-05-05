'use client'

// src/components/wywt/CameraCaptureView.tsx
//
// Camera capture view for the WYWT photo flow.
//
// CRITICAL: This component does NOT call getUserMedia itself. The parent's
// tap handler MUST acquire the MediaStream synchronously on the user
// gesture (the FIRST `await` after the tap, with no preceding awaits) and
// pass the resolved stream as a prop. iOS Safari consumes the gesture
// context if any await runs before getUserMedia — see Pitfall 1. By
// taking the stream as a prop we make the gesture-context discipline
// architecturally enforced: there's no way for this component to
// accidentally call getUserMedia after a microtask boundary.
//
// References:
// - 15-RESEARCH.md §Pitfall 1 — iOS gesture context
// - 15-RESEARCH.md §Pitfall 2 — MediaStream cleanup
// - 15-RESEARCH.md §Pitfall 5 — uniform EXIF strip on all paths
// - 15-RESEARCH.md §Common Operation 1 (stop tracks) + §Common Operation 2 (capture frame)
// - 15-UI-SPEC.md §CameraCaptureView — aria-labels + copywriting

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { stripAndResize } from '@/lib/exif/strip'
import { WristOverlaySvg } from '@/components/wywt/WristOverlaySvg'

export interface CameraCaptureViewProps {
  /**
   * MediaStream pre-acquired by the parent's tap handler. The parent MUST
   * call navigator.mediaDevices.getUserMedia as the first await after the
   * user gesture, then pass the resolved stream here. Pitfall 1 enforced.
   */
  stream: MediaStream
  /** Called with a 1080px-capped, EXIF-stripped JPEG after capture. */
  onPhotoReady: (jpeg: Blob) => void
  /** Called with a user-facing error string when capture fails. */
  onError: (message: string) => void
  /** Called when the user taps Cancel — parent should unmount this view. */
  onCancel: () => void
  /** When true, capture and cancel buttons are disabled. */
  disabled?: boolean
}

export function CameraCaptureView({
  stream,
  onPhotoReady,
  onError,
  onCancel,
  disabled,
}: CameraCaptureViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [busy, setBusy] = useState(false)

  // Wire the stream into <video> on mount; stop all tracks + null
  // srcObject on unmount. Pitfall 2 — every exit path stops tracks.
  useEffect(() => {
    const video = videoRef.current
    if (video) video.srcObject = stream
    return () => {
      stream.getTracks().forEach((t) => t.stop())
      if (video) video.srcObject = null
    }
  }, [stream])

  async function handleCapture() {
    const video = videoRef.current
    const wrapper = wrapperRef.current
    if (!video || !wrapper || video.videoWidth === 0 || video.videoHeight === 0) {
      onError('Camera not ready — please try again.')
      return
    }
    setBusy(true)
    try {
      // Step 1: capture the current frame to a JPEG blob, cropping to the
      // visible wrapper rect (WYSIWYG). With <video class="object-cover"> the
      // browser scales the stream so its short edge fills the square wrapper
      // and clips the long-edge overflow. The capture canvas reproduces that
      // exact visible region by reading only the source rect that maps to
      // the wrapper, so the saved JPEG matches what the user saw under the
      // wrist overlay (WYWT-22; D-01, D-02, D-05).
      const { width: wrapperW, height: wrapperH } = wrapper.getBoundingClientRect()
      const { sx, sy, sw, sh } = computeObjectCoverSourceRect(
        video.videoWidth,
        video.videoHeight,
        wrapperW,
        wrapperH,
      )
      const captureCanvas = document.createElement('canvas')
      captureCanvas.width = wrapperW
      captureCanvas.height = wrapperH
      const ctx = captureCanvas.getContext('2d')
      if (!ctx) throw new Error('Canvas 2D context unavailable')
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, wrapperW, wrapperH)
      const captured = await new Promise<Blob | null>((resolve) =>
        captureCanvas.toBlob(resolve, 'image/jpeg', 0.85),
      )
      if (!captured) throw new Error('Could not capture frame')

      // Step 2: pipe through stripAndResize for the uniform EXIF-strip +
      // 1080px-cap pipeline (Pitfall 5). Camera frames have no EXIF, but
      // we run them through the same helper so a future contributor can
      // never accidentally bypass the strip step.
      const result = await stripAndResize(captured)
      onPhotoReady(result.blob)
    } catch {
      onError('Could not capture photo. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {/* Video + overlay share their own relative wrapper so the overlay's
          inset-0 maps to the video bounds, not the buttons strip below. Keeps
          the wrist-overlay SVG centered over the actual camera frame regardless
          of stream aspect ratio. */}
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
          className="block w-full object-cover"
        />
        <WristOverlaySvg className="pointer-events-none absolute inset-0" />
      </div>
      <div className="mt-3 flex justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={disabled || busy}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleCapture}
          disabled={disabled || busy}
          aria-label="Capture photo"
          className="min-h-11"
        >
          {busy ? 'Capturing…' : 'Capture'}
        </Button>
      </div>
    </div>
  )
}

/**
 * Pure helper — exported for testing.
 *
 * Maps the visible, object-cover-cropped wrapper rect back to stream
 * coordinates. With `object-cover`, the stream scales so its short edge fills
 * the wrapper, the long edge overflows, and the centered slice is what the
 * user sees. The source rect (sx, sy, sw, sh) is the slice in stream coords;
 * passing it to ctx.drawImage's 9-argument form draws exactly that region.
 *
 * Phase 30 D-07 contract — see tests/components/wywt/CameraCaptureView.test.tsx
 * for the four math assertions this satisfies (1920×1080, 1280×720, 1080×1080,
 * bounds check) at ±1px tolerance.
 */
export function computeObjectCoverSourceRect(
  streamW: number,
  streamH: number,
  wrapperW: number,
  wrapperH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const videoScale = Math.max(wrapperW / streamW, wrapperH / streamH)
  const sw = wrapperW / videoScale
  const sh = wrapperH / videoScale
  const sx = (streamW - sw) / 2
  const sy = (streamH - sh) / 2
  return { sx, sy, sw, sh }
}
