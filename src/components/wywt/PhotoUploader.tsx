'use client'

// src/components/wywt/PhotoUploader.tsx
//
// File-picker upload path for the WYWT photo flow.
//
// Pipeline:
//   1. User selects a file via the hidden <input type="file">.
//   2. If the file is HEIC/HEIF, dispatch to the heic-worker (lazy WASM)
//      to convert → JPEG. Non-HEIC files SKIP the worker entirely.
//   3. Pipe the resulting blob through stripAndResize() so EXIF is
//      stripped and the longest edge is <= 1080px (Pitfall 5: every path
//      crosses the EXIF-strip boundary).
//   4. Invoke onPhotoReady(jpegBlob).
//
// References:
// - 15-RESEARCH.md §Pattern 4 (Worker), §Pattern 5 (canvas re-encode)
// - 15-RESEARCH.md §Pitfall 6 (HEIC MIME detection unreliable)
// - 15-CONTEXT.md D-09 (HEIC lazy in worker; non-HEIC skips worker)
// - 15-UI-SPEC.md §Copywriting Contract

import { useRef, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { stripAndResize } from '@/lib/exif/strip'

export function isHeicFile(file: File): boolean {
  // MIME alone is unreliable (many Android browsers report empty or
  // 'image/*'); fall back to filename extension. (Pitfall 6.)
  const mimeOk = file.type === 'image/heic' || file.type === 'image/heif'
  const ext = file.name.toLowerCase()
  const extOk = ext.endsWith('.heic') || ext.endsWith('.heif')
  return mimeOk || extOk
}

/**
 * Convert a HEIC file to a JPEG blob via a one-shot Web Worker.
 *
 * The worker is constructed with `new URL('./heic-worker.ts',
 * import.meta.url)` so the bundler emits heic2any as a separate chunk.
 * Worker is terminated on both resolve and reject paths.
 */
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
    worker.postMessage(
      { buffer, toType: 'image/jpeg', quality: 0.85 },
      [buffer],
    )
  })
}

export interface PhotoUploaderProps {
  onPhotoReady: (jpeg: Blob) => void
  onError: (message: string) => void
  disabled?: boolean
}

export function PhotoUploader({
  onPhotoReady,
  onError,
  disabled,
}: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset the input so the same file can be re-selected after Remove.
    e.target.value = ''
    if (!file) return

    setBusy(true)
    try {
      let blob: Blob = file
      if (isHeicFile(file)) {
        try {
          blob = await convertHeic(file)
        } catch {
          onError('Could not convert HEIC photo. Please try another image.')
          setBusy(false)
          return
        }
      }
      const result = await stripAndResize(blob)
      onPhotoReady(result.blob)
    } catch {
      onError('Could not process photo. Please try another image.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        onChange={handleFileChange}
        disabled={disabled || busy}
        className="sr-only"
        aria-label="Upload photo from device"
      />
      <Button
        type="button"
        variant="outline"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        <ImageIcon aria-hidden="true" />
        {busy ? 'Processing…' : 'Upload photo'}
      </Button>
    </>
  )
}
