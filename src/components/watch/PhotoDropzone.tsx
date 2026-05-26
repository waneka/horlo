'use client'

// src/components/watch/PhotoDropzone.tsx
//
// Phase 61 Plan 02 — Multi-file photo upload drop zone for WatchPhotoSection.
//
// Extends CatalogPhotoUploader's single-file pattern to multiple files with:
// - `multiple` file input, triggered programmatically from user-gesture handlers
// - Desktop HTML5 drag-and-drop zone (onDragOver/onDragLeave/onDrop)
// - Cap enforcement: remaining = 10 - currentPhotoCount; accepts up to remaining,
//   rejects extras with locked batch-overflow toast (no silent drop)
// - SEQUENTIAL processing to avoid sort_order race (RESEARCH Pitfall 4)
// - HEIC detection + convertHeic worker (verbatim from CatalogPhotoUploader)
// - Lazy stripAndResize import (keeps canvas worker out of initial bundle)
// - uploadWatchPhoto → addWatchPhotoAction pipeline (verbatim, reused)
// - Input value reset after each batch (allows re-selecting the same file)
//
// Security:
// - Drop zone reads e.dataTransfer.files (File objects) only — never fetches URLs (T-61-08)
// - Cap enforced client-side here + DAL backstop in addWatchPhotoAction (T-61-04)
// - EXIF strip via stripAndResize unconditionally (T-61-10)

import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { uploadWatchPhoto } from '@/lib/storage/watchPhotos'
import { addWatchPhotoAction } from '@/app/actions/watchPhotos'

const MAX_PHOTOS = 10

// ---------------------------------------------------------------------------
// HEIC detection + conversion — copied verbatim from CatalogPhotoUploader.tsx
// lines 58-84. Same logic, same Worker URL pattern.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface PhotoDropzoneProps {
  watchId: string
  userId: string
  currentPhotoCount: number
  onPhotosAdded: (newIds: string[]) => void
  /** Disable all interaction (e.g., while a parent transition is in flight) */
  disabled?: boolean
  /** id for the root element (used by the filmstrip +Add tile to trigger the picker) */
  id?: string
}

export function PhotoDropzone({
  watchId,
  userId,
  currentPhotoCount,
  onPhotosAdded,
  disabled = false,
  id,
}: PhotoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [busy, setBusy] = useState(false)

  const atCap = currentPhotoCount >= MAX_PHOTOS

  // ---------------------------------------------------------------------------
  // Core file processing pipeline — sequential to avoid sort_order race.
  // CatalogPhotoUploader analog: lazy stripAndResize import + HEIC branch.
  // ---------------------------------------------------------------------------

  async function processSingleFile(file: File): Promise<string | null> {
    try {
      let blob: Blob = file

      // HEIC → JPEG via worker (copied from CatalogPhotoUploader lines 145-151)
      if (isHeicFile(file)) {
        blob = await convertHeic(file)
      }

      // Lazy-import to keep canvas worker out of initial bundle (CatalogPhotoUploader line 154)
      const { stripAndResize } = await import('@/lib/exif/strip')
      const result = await stripAndResize(blob)

      // Client-direct upload to watch-photos bucket (RLS folder-scoped {userId}/...)
      const photoId = crypto.randomUUID()
      const uploadResult = await uploadWatchPhoto(userId, photoId, result.blob)

      if ('error' in uploadResult) {
        console.error('[PhotoDropzone] upload failed:', uploadResult.error)
        return null
      }

      // Record the DB row via server action
      const actionResult = await addWatchPhotoAction({
        watchId,
        storagePath: uploadResult.path,
      })

      if (!actionResult.success) {
        console.error('[PhotoDropzone] addWatchPhotoAction failed:', actionResult.error)
        return null
      }

      return actionResult.data?.id ?? null
    } catch (err) {
      console.error('[PhotoDropzone] processSingleFile error:', err)
      return null
    }
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return

    const remaining = MAX_PHOTOS - currentPhotoCount
    const batch = files.slice(0, remaining)
    const rejected = files.length - batch.length

    // Batch overflow: surface warning immediately, before processing
    if (rejected > 0) {
      const n = batch.length
      toast.warning(
        `Added ${n} photo${n !== 1 ? 's' : ''}. ${rejected} skipped — you've reached the 10-photo limit.`,
      )
    }

    if (batch.length === 0) return

    setBusy(true)
    const addedIds: string[] = []

    // SEQUENTIAL processing — parallel causes sort_order race (RESEARCH Pitfall 4:
    // DAL computes nextSort = max(sortOrder)+1; parallel uploads may both compute
    // the same nextSort, creating duplicate sort_order values).
    for (const file of batch) {
      const id = await processSingleFile(file)
      if (id) addedIds.push(id)
    }

    setBusy(false)

    if (addedIds.length > 0) {
      onPhotosAdded(addedIds)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    // CRITICAL: reset value so same files can be re-selected after batch
    // (mirrors CatalogPhotoUploader.tsx line 132 + PhotoUploader.tsx line 103)
    e.target.value = ''
    void handleFiles(files)
  }

  function openPicker() {
    inputRef.current?.click()
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    if (!atCap && !disabled) setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (atCap || disabled) return
    const files = Array.from(e.dataTransfer.files)
    void handleFiles(files)
  }

  // At-cap state: show cap message, disabled drop zone
  if (atCap) {
    return (
      <div
        role="button"
        tabIndex={-1}
        aria-disabled="true"
        aria-label="Upload photos — at the 10-photo limit"
        className="border-dashed border-2 rounded-lg p-4 text-center min-h-[64px] bg-muted opacity-50 cursor-not-allowed flex items-center justify-center"
      >
        <p className="text-sm text-muted-foreground">10 photos — at the limit.</p>
      </div>
    )
  }

  return (
    <>
      {/* Hidden file input — multiple, triggered programmatically */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.heic,.heif"
        onChange={handleChange}
        disabled={busy || disabled}
        className="sr-only"
        aria-label="Upload photos from device"
      />

      {/* Desktop drop zone + programmatic trigger */}
      {/* gap #2: id prop allows the filmstrip +Add tile to trigger this picker */}
      <div
        id={id}
        role="button"
        tabIndex={0}
        aria-label="Upload photos — drop files here or press Enter to browse"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={disabled || busy ? undefined : openPicker}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && !busy) {
            e.preventDefault()
            openPicker()
          }
        }}
        className={cn(
          'border-dashed border-2 rounded-lg p-4 text-center min-h-[64px] bg-muted transition-colors cursor-pointer',
          isDragOver && 'ring-2 ring-ring',
          (disabled || busy) && 'opacity-50 cursor-not-allowed',
        )}
      >
        <div className="flex flex-col items-center gap-1">
          {busy ? (
            <>
              <Loader2 className="size-5 text-muted-foreground animate-spin" aria-hidden />
              <p className="text-sm text-muted-foreground">Processing…</p>
            </>
          ) : (
            <>
              <Camera className="size-5 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">Drop photos here or tap to choose</p>
            </>
          )}
        </div>
      </div>
    </>
  )
}
