'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CommentCompose } from '@/components/comment/CommentCompose'
import { addCommentAction } from '@/app/actions/comments'
import { getSafeImageUrl } from '@/lib/images'
import type { Watch } from '@/lib/types'

interface WatchCommentSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  watch: Watch
  viewerId: string | null
  onSuccess: () => void
}

/**
 * Compose-only bottom sheet for posting a comment on a watch from the grid.
 *
 * GRID-04 compose-only boundary: this component renders ONLY the watch identity
 * header (thumbnail + brand + model) and CommentCompose. No thread rendering —
 * reading the thread is detail-page-only.
 *
 * Pattern: composeKey re-mount clears the textarea on success only (D-08).
 * The parent owns: closing the sheet, bumping commentCount, firing 'Comment posted'
 * toast. This component fires toast.error on failure (D-08) and delegates success
 * signaling to onSuccess() (D-07).
 */
export function WatchCommentSheet({
  open,
  onOpenChange,
  watch,
  viewerId,
  onSuccess,
}: WatchCommentSheetProps) {
  // composeKey re-mounts CommentCompose on success — mirrors the re-mount pattern in the comment system
  const [composeKey, setComposeKey] = useState(0)
  const [pending, startTransition] = useTransition()
  const safeUrl = getSafeImageUrl(watch.imageUrl)

  function handleSubmit(body: string) {
    startTransition(async () => {
      const result = await addCommentAction({ type: 'watch', id: watch.id, body })
      if (!result.success) {
        // D-08: keep typed text — do NOT increment composeKey; fire failure toast
        toast.error('Failed to post comment. Please try again.')
        console.error('[WatchCommentSheet] action failed:', result.error)
        return
      }
      // D-07: success — clear textarea (re-mount) then call parent success handler
      // Parent closes the sheet, bumps commentCount, and fires 'Comment posted' toast
      setComposeKey((k) => k + 1)
      onSuccess()
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-background z-50">
        {/* Inner wrapper: centers at 640px on desktop; px-4 keeps off screen edges;
            pb-[calc(1.5rem+env(safe-area-inset-bottom))] clears iPhone home indicator.
            Mirrors WearCommentHost:95 — omitting max-h-[60vh] overflow-y-auto since
            compose-only content is short and never needs scroll. */}
        <div className="mx-auto w-full max-w-[640px] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader>
            {/* sr-only title for screen reader announcement on sheet open (UI-SPEC) */}
            <SheetTitle className="sr-only">Add a comment</SheetTitle>
            {/* Watch identity header — thumbnail + brand + model (UI-SPEC §WatchCommentSheet) */}
            <div className="flex items-center gap-3 pb-2">
              <div className="relative w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                {safeUrl ? (
                  <Image
                    src={safeUrl}
                    alt={`${watch.brand} ${watch.model}`}
                    fill
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground truncate">{watch.brand}</p>
                <p className="text-base font-semibold leading-tight truncate">{watch.model}</p>
              </div>
            </div>
          </SheetHeader>
          {/* GRID-04 compose-only boundary: CommentCompose ONLY — no thread rendering */}
          <CommentCompose
            key={composeKey}
            viewerId={viewerId}
            pending={pending}
            onSubmit={handleSubmit}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
