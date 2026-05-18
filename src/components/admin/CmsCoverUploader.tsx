'use client'

// D-14 / D-15: Cover image uploader for curated lists.
//
// Pipeline:
//   1. File pick — 4 MB guard (UI-SPEC: "Image is too large. Maximum size is 4 MB.")
//   2. EXIF-strip + canvas re-encode via stripAndResize (rectangular, no crop)
//   3. Upload — uploadCmsCover writes to cms-covers bucket
//   4. onUpload(publicUrl) prop fired on success
//
// CSS chain assertion (UI-SPEC §CSS Chain Assertions 1):
//   Container: aspect-video (produces 16:9 ratio)
//   Image:     object-cover w-full h-full (fills container without stretching)
// Both classes co-present — do NOT rely on intrinsic image dimensions.
//
// D-15: NO crop step — rectangular covers, no circular-crop or crop widget.
// The circular avatar crop from AvatarUploader is not reusable here.

import { useEffect, useRef, useState } from 'react'
import { ImageIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { uploadCmsCover } from '@/lib/storage/cmsCovers'
import { toast } from 'sonner'

const MAX_FILE_BYTES = 4 * 1024 * 1024 // 4 MB — UI-SPEC cover guard

export interface CmsCoverUploaderProps {
  listId: string
  initialUrl?: string | null
  onUpload: (publicUrl: string) => void
  onRemove?: () => void
  disabled?: boolean
}

export function CmsCoverUploader({
  listId,
  initialUrl,
  onUpload,
  onRemove,
  disabled = false,
}: CmsCoverUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl ?? null)
  const [processing, setProcessing] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Keep preview in sync if initialUrl changes (e.g. after a successful save).
  useEffect(() => {
    if (initialUrl) setPreviewUrl(initialUrl)
  }, [initialUrl])

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return

    // UI-SPEC: 4 MB guard
    if (file.size > MAX_FILE_BYTES) {
      toast.error('Image is too large. Maximum size is 4 MB.')
      return
    }

    setProcessing(true)
    try {
      // EXIF-strip + canvas re-encode (rectangular — no crop, D-15).
      // Lazy import keeps canvas worker out of the initial bundle.
      const { stripAndResize } = await import('@/lib/exif/strip')
      const { blob: jpeg } = await stripAndResize(file)

      const result = await uploadCmsCover(listId, jpeg)
      if ('error' in result) {
        toast.error('Upload failed. Please try again.')
        return
      }

      setPreviewUrl(result.publicUrl)
      onUpload(result.publicUrl)
    } catch {
      toast.error('Upload failed. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  function handleRemove() {
    setPreviewUrl(null)
    onRemove?.()
  }

  // Processing state: Skeleton of the same aspect-video container dimensions.
  if (processing) {
    return (
      <Skeleton className="aspect-video w-full rounded-lg" />
    )
  }

  return (
    <div className="space-y-2">
      {/* Hidden file input — only JPEG, PNG, WebP accepted */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        disabled={disabled || processing}
        className="sr-only"
        aria-label="Upload cover image"
      />

      {previewUrl ? (
        // State B: image uploaded — render in fixed 16:9 container with remove button.
        // CSS chain assertion: aspect-video + object-cover w-full h-full (D-15).
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Cover image"
            className="object-cover w-full h-full"
          />
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleRemove}
            disabled={disabled}
            className="absolute top-2 right-2 bg-background/80 hover:bg-muted"
            aria-label="Remove cover image"
          >
            <X className="size-3" aria-hidden="true" />
            Remove
          </Button>
        </div>
      ) : (
        // State A: drop zone — dashed border, centered ImageIcon.
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="aspect-video w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted text-muted-foreground hover:bg-muted/70 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          aria-label="Upload cover image"
        >
          <ImageIcon className="size-8" aria-hidden="true" />
          <span className="text-sm">Upload cover image</span>
        </button>
      )}
    </div>
  )
}
