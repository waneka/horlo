'use client'

// src/components/profile/AvatarUploader.tsx
//
// Phase 43 PLSH-06 (D-09, D-10, D-11): Avatar upload with interactive circular crop.
//
// Pipeline:
//   1. File pick — 8 MB guard + HEIC conversion
//   2. Crop UI — react-easy-crop with circular mask (aspect=1, cropShape="round")
//   3. Confirm crop — canvas extract → stripAndResize (512px) → uploadAvatarPhoto
//   4. Write URL — updateProfile({ avatarUrl })
//
// Mirrors CatalogPhotoUploader patterns: MAX_FILE_BYTES, isHeicFile, convertHeic,
// object-URL revoke useEffect, lazy stripAndResize import, inline error display.

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import { uploadAvatarPhoto } from '@/lib/storage/avatarPhotos'
import { updateProfile } from '@/app/actions/profile'
import { toast } from 'sonner'

interface AvatarUploaderProps {
  userId: string
  initialUrl?: string | null
  onUploadComplete?: (url: string) => void
}

const MAX_FILE_BYTES = 8 * 1024 * 1024 // 8 MB — same as CatalogPhotoUploader

function isHeicFile(file: File): boolean {
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

async function getCroppedBlob(src: string, cropArea: Area): Promise<Blob> {
  const image = new window.Image()
  image.src = src
  await new Promise<void>((r) => {
    image.onload = () => r()
  })
  const canvas = document.createElement('canvas')
  canvas.width = cropArea.width
  canvas.height = cropArea.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    cropArea.width,
    cropArea.height,
  )
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error('toBlob returned null'))),
      'image/jpeg',
      0.9,
    ),
  )
}

export function AvatarUploader({ userId, initialUrl, onUploadComplete }: AvatarUploaderProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [uploading, setUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Revoke object URL on imageSrc change to avoid memory leaks.
  useEffect(() => {
    return () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc)
    }
  }, [imageSrc])

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    setErrorMsg(null)

    if (file.size > MAX_FILE_BYTES) {
      setErrorMsg('Photo too large. Maximum size is 8 MB.')
      return
    }

    try {
      let blob: Blob = file
      if (isHeicFile(file)) {
        try {
          blob = await convertHeic(file)
        } catch {
          setErrorMsg('Could not convert HEIC photo. Please try another image.')
          return
        }
      }
      // Show crop UI — do NOT stripAndResize yet (crop comes first per D-11).
      if (imageSrc) URL.revokeObjectURL(imageSrc)
      setImageSrc(URL.createObjectURL(blob))
    } catch {
      setErrorMsg('Could not process photo. Please try another image.')
    }
  }

  async function handleConfirmCrop() {
    if (!imageSrc || !croppedAreaPixels) return
    setUploading(true)
    try {
      const raw = await getCroppedBlob(imageSrc, croppedAreaPixels)
      // Lazy-import to keep the canvas worker out of the initial bundle.
      const { stripAndResize } = await import('@/lib/exif/strip')
      const { blob: jpeg } = await stripAndResize(raw, 512)
      const result = await uploadAvatarPhoto(userId, jpeg)
      if ('error' in result) {
        setErrorMsg('Upload failed. Please try again.')
        return
      }
      await updateProfile({ avatarUrl: result.publicUrl })
      if (imageSrc) URL.revokeObjectURL(imageSrc)
      setImageSrc(null)
      toast.success('Profile photo updated')
      onUploadComplete?.(result.publicUrl)
    } catch {
      setErrorMsg('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function handleDiscardCrop() {
    if (imageSrc) URL.revokeObjectURL(imageSrc)
    setImageSrc(null)
    setErrorMsg(null)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        onChange={handleChange}
        className="sr-only"
        aria-label="Upload profile photo"
      />

      {imageSrc ? (
        /* State B/C — crop UI */
        <div>
          <div className="relative h-[300px] bg-black">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, areaPixels) => setCroppedAreaPixels(areaPixels)}
            />
          </div>
          <div className="flex gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleDiscardCrop}
              disabled={uploading}
            >
              Discard crop
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleConfirmCrop}
              disabled={uploading || !croppedAreaPixels}
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Uploading…
                </>
              ) : (
                'Confirm crop'
              )}
            </Button>
          </div>
          {errorMsg && (
            <p className="text-sm text-destructive mt-2">{errorMsg}</p>
          )}
        </div>
      ) : (
        /* State A — idle: preview + upload button */
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            {initialUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={initialUrl}
                alt="Current profile photo"
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <span className="text-muted-foreground text-xs">Photo</span>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
            >
              Upload photo
            </Button>
          </div>
          {errorMsg && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}
        </div>
      )}
    </div>
  )
}
