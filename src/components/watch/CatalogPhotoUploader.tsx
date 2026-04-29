'use client'

// src/components/watch/CatalogPhotoUploader.tsx
//
// Phase 19.1 D-19: reusable photo-pipeline component for the WatchForm Reference
// Photo card (and any future surface). Mirrors @/components/wywt/PhotoUploader's
// signature deliberately — copy-paste compatible — but writes NOTHING to any
// bucket. The parent receives the EXIF-stripped, ≤1080px JPEG Blob via
// onPhotoReady and is responsible for upload (Plan 05 wires WatchForm.handleSubmit
// to call uploadCatalogSourcePhoto from src/lib/storage/catalogSourcePhotos.ts).
//
// State machine (UI-SPEC.md §"Photo Upload Field — Interaction States"):
//   Empty → Processing → Preview ↔ Empty (via Remove via onClear)
//                     └─ Error → Empty (next file pick)
//
// Remove contract: Option A — separate onClear callback. Parent's setPhotoBlob(null)
// lives there. Single-responsibility: onPhotoReady always receives a valid Blob.
//
// Security (T-19.1-03-01): every selected file routes through stripAndResize
// (canvas re-encode) before reaching onPhotoReady — drops EXIF unconditionally.

import { useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export interface CatalogPhotoUploaderCopy {
  cardTitle?: string
  cardDescription?: string
  emptyButtonLabel?: string
  processingLabel?: string
  formatsCaption?: string
  photoReadyCaption?: string
  chooseAnotherLabel?: string
  removeAriaLabel?: string
  errorTooLarge?: string
  errorHeicConvert?: string
  errorGeneric?: string
}

const DEFAULT_COPY: Required<CatalogPhotoUploaderCopy> = {
  cardTitle: 'Reference Photo',
  cardDescription:
    "Optional, but strongly encouraged — vintage pieces especially benefit. Used as the catalog's reference image.",
  emptyButtonLabel: 'Choose photo',
  processingLabel: 'Processing…',
  formatsCaption: 'JPG, PNG, or HEIC up to 8 MB',
  photoReadyCaption: 'Photo ready',
  chooseAnotherLabel: 'Choose another',
  removeAriaLabel: 'Remove photo',
  errorTooLarge: 'Photo is too large. Please choose a file under 8 MB.',
  errorHeicConvert: 'Could not convert HEIC photo. Please try another image.',
  errorGeneric: 'Could not process photo. Please try another image.',
}

const MAX_FILE_BYTES = 8 * 1024 * 1024

function isHeicFile(file: File): boolean {
  // MIME alone is unreliable (many Android browsers report empty or
  // 'image/*'); fall back to filename extension. (Pitfall 6.)
  const mimeOk = file.type === 'image/heic' || file.type === 'image/heif'
  const ext = file.name.toLowerCase()
  return mimeOk || ext.endsWith('.heic') || ext.endsWith('.heif')
}

async function convertHeic(file: File): Promise<Blob> {
  const worker = new Worker(
    new URL('../../lib/exif/heic-worker.ts', import.meta.url),
    { type: 'module' },
  )
  const buffer = await file.arrayBuffer()
  return new Promise<Blob>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent) => {
      const { buffer: ab, type } = e.data as { buffer: ArrayBuffer; type: string }
      worker.terminate()
      resolve(new Blob([ab], { type }))
    }
    worker.onerror = (err) => {
      worker.terminate()
      reject(err)
    }
    worker.postMessage({ buffer, toType: 'image/jpeg', quality: 0.85 }, [buffer])
  })
}

export interface CatalogPhotoUploaderProps {
  /** Called with the EXIF-stripped, ≤1080px JPEG Blob when processing succeeds. */
  onPhotoReady: (jpeg: Blob) => void
  /** Called with a user-facing message when any step fails. */
  onError: (message: string) => void
  /**
   * Called when the user clicks Remove (X). The parent should clear its
   * photoBlob state (e.g. setPhotoBlob(null)). Option A: separate callback
   * so onPhotoReady always receives a valid Blob (never null).
   */
  onClear?: () => void
  /** Disable all interaction (e.g., during form submission). */
  disabled?: boolean
  /** Optional copy overrides — defaults match UI-SPEC.md verbatim. */
  copy?: CatalogPhotoUploaderCopy
}

export function CatalogPhotoUploader({
  onPhotoReady,
  onError,
  onClear,
  disabled = false,
  copy: copyOverride,
}: CatalogPhotoUploaderProps) {
  const copy: Required<CatalogPhotoUploaderCopy> = { ...DEFAULT_COPY, ...copyOverride }

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Revoke object URL on unmount to avoid memory leak.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function emitError(message: string) {
    setErrorMsg(message)
    setBusy(false)
    onError(message)
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file after Remove
    if (!file) return

    setErrorMsg(null)
    setBusy(true)

    if (file.size > MAX_FILE_BYTES) {
      emitError(copy.errorTooLarge)
      return
    }

    try {
      let blob: Blob = file
      if (isHeicFile(file)) {
        try {
          blob = await convertHeic(file)
        } catch {
          emitError(copy.errorHeicConvert)
          return
        }
      }
      // Lazy-import to keep canvas worker out of initial bundle.
      const { stripAndResize } = await import('@/lib/exif/strip')
      const result = await stripAndResize(blob)

      // Revoke any previous preview before swapping.
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(result.blob))
      setBusy(false)
      onPhotoReady(result.blob)
    } catch {
      emitError(copy.errorGeneric)
    }
  }

  function handleRemove() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setErrorMsg(null)
    onClear?.()
  }

  function openPicker() {
    inputRef.current?.click()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.cardTitle}</CardTitle>
        <CardDescription>{copy.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          onChange={handleChange}
          disabled={busy || disabled}
          className="sr-only"
          aria-label="Upload reference photo"
        />

        {previewUrl ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Reference photo preview"
                  className="h-24 w-24 rounded-md object-cover"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleRemove}
                  disabled={busy || disabled}
                  aria-label={copy.removeAriaLabel}
                  className="absolute right-1 top-1 h-8 w-8 bg-background/80 hover:bg-muted"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">{copy.photoReadyCaption}</span>
            </div>
            <button
              type="button"
              onClick={openPicker}
              disabled={busy || disabled}
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              {copy.chooseAnotherLabel}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              onClick={openPicker}
              disabled={busy || disabled}
            >
              {busy ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" />
                  {copy.processingLabel}
                </>
              ) : (
                <>
                  <ImageIcon aria-hidden="true" />
                  {copy.emptyButtonLabel}
                </>
              )}
            </Button>
            {errorMsg ? (
              <p className="text-sm text-destructive">{errorMsg}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{copy.formatsCaption}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
