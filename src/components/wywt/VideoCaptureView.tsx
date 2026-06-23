'use client'

// src/components/wywt/VideoCaptureView.tsx
//
// Live video capture view for the WYWT video flow (Phase 77 — VID-02, VID-03).
//
// CRITICAL: Like CameraCaptureView, this component does NOT call getUserMedia
// itself. The parent's tap handler MUST acquire the MediaStream synchronously
// on the user gesture (FIRST await after tap, no preceding awaits) and pass
// the resolved stream as a prop. Stream-as-prop architecture makes the iOS
// gesture-context discipline impossible to violate from this file.
//
// 3.0s auto-stop via setTimeout (not MediaRecorder timeslice — that would
// fragment the recording per Pitfall 2 in 77-RESEARCH.md). Cancel during
// recording sets a ref guard so the onstop handler skips poster extraction
// and reports nothing to the parent.
//
// References:
// - 77-UI-SPEC.md §Live Recording Surface (VideoCaptureView)
// - 77-PATTERNS.md §src/components/wywt/VideoCaptureView.tsx
// - 77-RESEARCH.md §Capture Pipeline

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { WristOverlaySvg } from '@/components/wywt/WristOverlaySvg'
import { extractPosterBlob } from '@/lib/video/extractPosterBlob'

export interface VideoCaptureViewProps {
  /**
   * MediaStream pre-acquired by the parent's tap handler. Stream-as-prop is
   * the architectural guarantee against iOS gesture-context loss.
   */
  stream: MediaStream
  /**
   * MIME type chosen by useMediaCapability (Plan 04). Passed verbatim to
   * `new MediaRecorder(stream, { mimeType })`.
   */
  preferredMimeType: string
  /** Called with the recorded video Blob + extracted poster Blob on success. */
  onVideoReady: (result: { videoBlob: Blob; posterBlob: Blob }) => void
  /** Called with a user-facing error string when recording or extraction fails. */
  onError: (message: string) => void
  /** Called when the user taps Cancel while NOT recording — parent should unmount this view. */
  onCancel: () => void
  /** When true, both buttons are disabled. */
  disabled?: boolean
}

export function VideoCaptureView({
  stream,
  preferredMimeType,
  onVideoReady,
  onError,
  onCancel,
  disabled,
}: VideoCaptureViewProps) {
  const [recording, setRecording] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelledRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

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

  // Unmount cleanup: clear any pending 4s timer + stop recorder if active.
  useEffect(
    () => () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
      const r = recorderRef.current
      if (r && r.state !== 'inactive') r.stop()
    },
    [],
  )

  function handleStartRecording() {
    cancelledRef.current = false
    chunksRef.current = []
    // 6 Mbps bitrate keeps 4s portrait-720p clips at ~3 MB — comfortable
    // margin under the 5 MB server cap (Phase 76 VID-09). Quality drop is
    // visually imperceptible for wrist-rotation content (mostly static
    // watch + moderate rotation); H.264 compresses this regime efficiently.
    const recorder = new MediaRecorder(stream, {
      mimeType: preferredMimeType,
      videoBitsPerSecond: 6_000_000,
    })
    recorderRef.current = recorder

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      // Cancel-during-recording guard: skip extraction and emit nothing.
      if (cancelledRef.current) {
        setRecording(false)
        return
      }
      setRecording(false)
      setExtracting(true)
      const videoBlob = new Blob(chunksRef.current, { type: preferredMimeType })
      try {
        const posterBlob = await extractPosterBlob(videoBlob)
        setExtracting(false)
        onVideoReady({ videoBlob, posterBlob })
      } catch {
        setExtracting(false)
        onError('Could not process the clip — please re-record.')
      }
    }

    recorder.start()
    setRecording(true)
    stopTimerRef.current = setTimeout(() => recorder.stop(), 4000)
  }

  function handleCancelRecording() {
    cancelledRef.current = true
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
    const r = recorderRef.current
    if (r && r.state !== 'inactive') r.stop()
    // onstop will fire and short-circuit on cancelledRef.current
  }

  function handleCancel() {
    if (recording) {
      handleCancelRecording()
      return
    }
    onCancel()
  }

  return (
    <div>
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
        {recording && (
          <div
            role="status"
            aria-label="Recording in progress"
            className="absolute top-3 left-3 z-20"
            style={{ width: 40, height: 40 }}
          >
            {/* Progress ring — 40px outer, 3px stroke, fills clockwise over the
                recording window. Circumference = 2π × 17 ≈ 107 (radius 17 keeps
                the stroke inside the 40px box without clipping). */}
            <svg
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              viewBox="0 0 40 40"
              width="40"
              height="40"
              style={{ transform: 'rotate(-90deg)' }}
            >
              <circle
                cx="20"
                cy="20"
                r="17"
                fill="none"
                stroke="white"
                strokeWidth="3"
                className="ring-fill-animation"
                strokeDasharray="107"
                strokeDashoffset="107"
                style={{ ['--ring-circumference' as string]: 107 }}
              />
            </svg>
            {/* Red dot centered inside the ring */}
            <span
              aria-hidden="true"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-3 rounded-full bg-destructive dark:bg-destructive animate-pulse"
            />
          </div>
        )}
        <span className="sr-only" aria-live="polite">
          {recording ? 'Recording started' : extracting ? 'Recording complete' : ''}
        </span>
      </div>
      <div className="mt-3 flex justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={disabled || extracting}
          className="min-h-11"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleStartRecording}
          disabled={disabled || recording || extracting}
          aria-label="Record video"
          className="min-h-11"
        >
          {extracting ? 'Processing…' : recording ? 'Recording…' : 'Record 4s'}
        </Button>
      </div>
    </div>
  )
}
