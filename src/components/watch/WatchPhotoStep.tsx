'use client'

// src/components/watch/WatchPhotoStep.tsx
//
// Phase 61 Plan 03 — Lean add-flow photo step for AddWatchFlow (PHOTO-09 / D-15/D-16).
//
// This is the lighter add-flow variant (Claude's Discretion) — NOT the full
// detail-page filmstrip. Provides:
//   - "Add your photos" heading + "Show how it looks in person." subheading
//   - PhotoDropzone (reused from Plan 02) for multi-file selection + upload
//   - 3-column per-file progress grid (Processing…/success thumbnails)
//   - Primary CTA: "Add photos" (0 uploads) → "Continue" (≥1 upload complete)
//   - Secondary: "Skip for now" plain <button>, not a shadcn Button (D-16 friction)
//
// Security:
//   - T-61-13: 10-photo cap enforced by PhotoDropzone + DAL backstop
//   - T-61-15: EXIF stripped via stripAndResize inside PhotoDropzone pipeline
//   - T-61-14: Activity-hide cleanup in AddWatchFlow resets photos-pending → idle
//
// D-16: "Skip for now" NEVER blocks saving. onDone/onSkip both route to
// destination immediately. No confirm-on-skip dialog.

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PhotoDropzone } from './PhotoDropzone'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UploadedPhoto {
  id: string
  previewUrl?: string
}

export interface WatchPhotoStepProps {
  /** The just-created watch row's id (used by PhotoDropzone → addWatchPhotoAction). */
  watchId: string
  /**
   * Viewer's user id — threaded from the RSC (/watch/new/page.tsx via AddWatchFlow).
   * WR-03 fix: no longer resolved client-side via useEffect/getUser() to avoid the
   * disabled-placeholder flash and the session-expiry edge case.
   */
  userId: string
  /** Called when the user presses "Continue" (≥1 upload) or has no uploads and
   *  presses the primary CTA after choosing photos. */
  onDone: () => void
  /** Called when the user taps "Skip for now". Never blocks save. */
  onSkip: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WatchPhotoStep({ watchId, userId, onDone, onSkip }: WatchPhotoStepProps) {
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([])

  // Called by PhotoDropzone when one or more files have completed the upload pipeline.
  function handlePhotosAdded(newIds: string[]) {
    setUploadedPhotos((prev) => [
      ...prev,
      ...newIds.map((id) => ({ id })),
    ])
  }

  const uploadedCount = uploadedPhotos.length
  const hasPrimary = uploadedCount >= 1

  return (
    <div className="space-y-4">
      {/* Heading + subheading — locked copy per UI-SPEC.md Copywriting Contract */}
      <div>
        <h2 className="text-lg font-semibold">Add your photos</h2>
        <p className="text-sm text-muted-foreground">Show how it looks in person.</p>
      </div>

      {/* PhotoDropzone — reuses full upload pipeline from Plan 02:
          HEIC→convertHeic, lazy stripAndResize, uploadWatchPhoto, addWatchPhotoAction.
          Sequential processing avoids sort_order race (RESEARCH Pitfall 4).
          Cap of 10 enforced client-side + DAL backstop (T-61-13).
          WR-03: userId is now a prop (threaded from RSC), so the dropzone is
          always enabled on mount — no placeholder flash. */}
      <PhotoDropzone
        watchId={watchId}
        userId={userId}
        currentPhotoCount={uploadedCount}
        onPhotosAdded={handlePhotosAdded}
      />

      {/* Per-file progress grid — 3-column thumbnails for uploaded photos.
          UI-SPEC: "Processing…" pending label, silent on success (thumbnail fills in).
          Kept simple for the lean add-flow step. */}
      {uploadedCount > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {uploadedPhotos.map((photo, i) => (
            <div
              key={photo.id}
              className="aspect-square rounded-md bg-muted flex items-center justify-center overflow-hidden"
            >
              {photo.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.previewUrl}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs text-muted-foreground">Processing…</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Primary CTA:
          - 0 uploads: "Add photos" (Button variant="default") — opens file picker
            via PhotoDropzone's programmatic trigger when user has selected files;
            clicking the dropzone itself opens the picker, this button is a
            prominent affordance above "Skip for now".
          - ≥1 upload: "Continue" (Button variant="default") — calls onDone.
          UI-SPEC: Button variant="default", full-width. */}
      <Button
        variant="default"
        className="w-full"
        onClick={hasPrimary ? onDone : undefined}
        type="button"
      >
        {hasPrimary ? 'Continue' : 'Add photos'}
      </Button>

      {/* Secondary CTA: "Skip for now" — plain <button>, NOT a shadcn Button.
          D-16: smaller, lower-contrast, clearly the lesser path. Never blocks saving.
          UI-SPEC: text-sm text-muted-foreground, NOT Button component. */}
      <button
        type="button"
        onClick={onSkip}
        className={cn(
          'w-full text-sm text-muted-foreground',
          'underline-offset-4 hover:underline hover:text-foreground',
          'mt-2',
        )}
      >
        Skip for now
      </button>
    </div>
  )
}
