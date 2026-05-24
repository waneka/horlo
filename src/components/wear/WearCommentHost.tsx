'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CommentList } from '@/components/comment/CommentList'
import type { CommentAuthor, CommentWithAuthor } from '@/components/comment/types'

/**
 * Discriminated union: the bottom-sheet variant REQUIRES open + onOpenChange
 * so the sheet can never become stuck open (no missing-handler footgun).
 * The inline variant must NOT receive those props.
 *
 * Phase 57 Plan 05: both variants now accept comment-thread + gate props
 * so the server parent (WearPhotoStreamed / wears page) can resolve
 * initialComments + gate signals and pass them in. WearCommentHost is a
 * CLIENT component — it cannot await — so the server parent must enrich
 * authors and resolve the CommentWithAuthor[] before passing.
 */
type WearCommentHostProps =
  | {
      variant: 'bottom-sheet'
      wearEventId: string
      open: boolean
      onOpenChange: (v: boolean) => void
      initialComments: CommentWithAuthor[]
      canComment: boolean
      ownerFollowsViewer: boolean
      viewerIsFollowing: boolean
      ownerUserId: string
      ownerUsername: string
      viewerId: string | null
      viewerAuthor: CommentAuthor | null
      /** SC-5 (Phase 57.1): optional count-change callback threaded from WearCard local state */
      onCountChange?: (delta: number) => void
    }
  | {
      variant: 'inline'
      wearEventId: string
      open?: never
      onOpenChange?: never
      initialComments: CommentWithAuthor[]
      canComment: boolean
      ownerFollowsViewer: boolean
      viewerIsFollowing: boolean
      ownerUserId: string
      ownerUsername: string
      viewerId: string | null
      viewerAuthor: CommentAuthor | null
      /** SC-5 (Phase 57.1): optional count-change callback threaded from WearCard local state */
      onCountChange?: (delta: number) => void
    }

/**
 * Comment host shell — bottom-sheet + inline variants (D-10).
 *
 * Phase 56A ships an empty placeholder body ("No comments yet.") with full
 * chrome (bottom-sheet open/close/swipe-pause hook + inline section).
 * Phase 57 Plan 05: the shared CommentList is now rendered at both seams.
 *
 * Bottom-sheet: Sheet with SheetContent side="bottom" (UI-SPEC §5).
 * Inline: <section id="wear-comments"> for smooth-scroll from detail page (UI-SPEC §6).
 *
 * CSS-chain assertions (T-57-14):
 *   - Sheet content keeps bg-background SOLID (NOT /80 opacity) + z-50 + max-h-[60vh] overflow-y-auto.
 *   - No 'use cache' directive (Phase 55 D-06 privacy guarantee).
 */
export function WearCommentHost({
  variant,
  wearEventId,
  open,
  onOpenChange,
  initialComments,
  canComment,
  ownerFollowsViewer,
  viewerIsFollowing,
  ownerUserId,
  ownerUsername,
  viewerId,
  viewerAuthor,
  onCountChange,
}: WearCommentHostProps) {
  const target = { type: 'wear' as const, id: wearEventId }

  if (variant === 'bottom-sheet') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="bg-background max-h-[60vh] overflow-y-auto z-50">
          {/* SC-1 + SC-4 (Phase 57.1): inner wrapper centers content at 640px on desktop;
              px-4 keeps content off the screen edges on mobile (57.1 UAT Test 2 fix — SheetContent
              has no side padding); pb-[calc(1.5rem+env(safe-area-inset-bottom))] clears the iPhone home indicator. */}
          <div className="mx-auto w-full max-w-[640px] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <SheetHeader>
              <SheetTitle>Comments</SheetTitle>
            </SheetHeader>
            <CommentList
              initialComments={initialComments}
              target={target}
              canComment={canComment}
              ownerFollowsViewer={ownerFollowsViewer}
              viewerIsFollowing={viewerIsFollowing}
              ownerUserId={ownerUserId}
              ownerUsername={ownerUsername}
              viewerId={viewerId}
              viewerAuthor={viewerAuthor}
              onCountChange={onCountChange}
            />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // variant === 'inline'
  return (
    <section
      id="wear-comments"
      className="border-t border-border px-4 pt-4 pb-6 md:max-w-[600px] md:mx-auto"
    >
      <h2 className="text-sm font-semibold text-foreground mb-3">Comments</h2>
      <CommentList
        initialComments={initialComments}
        target={target}
        canComment={canComment}
        ownerFollowsViewer={ownerFollowsViewer}
        viewerIsFollowing={viewerIsFollowing}
        ownerUserId={ownerUserId}
        ownerUsername={ownerUsername}
        viewerId={viewerId}
        viewerAuthor={viewerAuthor}
        onCountChange={onCountChange}
      />
    </section>
  )
}
