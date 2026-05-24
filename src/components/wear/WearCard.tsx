'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'

import { WearPhotoClient } from '@/components/wear/WearPhotoClient'
import { WearDetailHero } from '@/components/wear/WearDetailHero'
import { LikeButton } from '@/components/shared/LikeButton'
import { WearCommentHost } from '@/components/wear/WearCommentHost'
import { WearOverflowMenu } from '@/components/wear/WearOverflowMenu'
import type { CommentAuthor, CommentWithAuthor } from '@/components/comment/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WearCardProps {
  signedUrl: string | null
  watchImageUrl: string | null
  altText: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  createdAt: Date
  brand: string
  model: string
  /** brand/model → /watch/[watchId] link */
  watchId: string
  viewerId: string | null
  wearEventId: string
  initialLiked: boolean
  initialCount: number
  /** 'bottom-sheet' = stories lane; 'inline' = detail page */
  commentHostVariant: 'bottom-sheet' | 'inline'
  /** false on own wear / already-owned / already-wishlisted (D-09) */
  showAddToWishlist: boolean
  /** /wear/{wearEventId} (D-01) */
  permalinkUrl: string
  /**
   * Optional: called when the bottom-sheet comment host opens or closes.
   * The stories lane (Plan 03) uses this to pause embla swipe.
   */
  onCommentOpenChange?: (open: boolean) => void

  // Phase 57 Plan 05: comment-thread + gate props (server-resolved)
  initialComments: CommentWithAuthor[]
  canComment: boolean
  ownerFollowsViewer: boolean
  viewerIsFollowing: boolean
  ownerUserId: string
  ownerUsername: string
  viewerAuthor: CommentAuthor | null
  /** CMNT-09: comment count badge — hidden at zero in both engagement rows */
  commentCount: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Shared wear-content card used by both /wears/[username] and /wear/[id] (D-12, SC-4).
 *
 * Wraps the existing signed-URL (WearPhotoClient) or fallback (WearDetailHero)
 * photo layers — both already render WearPhotoOverlays internally (D-08). No
 * second overlay is added here. Native <img> NOT next/image (Pitfall F-2).
 *
 * Folds in:
 *   - WearOverflowMenu (absolute top-3 right-3 z-20 over the photo)
 *   - engagement row: comment trigger (left) + LikeButton (right)
 *   - WearCommentHost (bottom-sheet or inline, driven by commentHostVariant)
 *
 * Phase 57 Plan 05: comment-thread props threaded through to WearCommentHost;
 * CMNT-09 count badge added next to the comment trigger in both engagement rows.
 */
export function WearCard({
  signedUrl,
  watchImageUrl,
  altText,
  username,
  displayName,
  avatarUrl,
  createdAt,
  brand,
  model,
  watchId,
  viewerId,
  wearEventId,
  initialLiked,
  initialCount,
  commentHostVariant,
  showAddToWishlist,
  permalinkUrl,
  onCommentOpenChange,
  initialComments,
  canComment,
  ownerFollowsViewer,
  viewerIsFollowing,
  ownerUserId,
  ownerUsername,
  viewerAuthor,
  commentCount,
}: WearCardProps) {
  // Bottom-sheet variant: WearCard owns the open state and exposes it for swipe-pause.
  const [commentOpen, setCommentOpen] = useState(false)

  const handleCommentOpenChange = (open: boolean) => {
    setCommentOpen(open)
    onCommentOpenChange?.(open)
  }

  const handleOpenComments = () => {
    handleCommentOpenChange(true)
  }

  const handleScrollToComments = () => {
    document.getElementById('wear-comments')?.scrollIntoView({ behavior: 'smooth' })
  }

  const hasPhoto = signedUrl !== null || watchImageUrl !== null

  return (
    <div className="w-full">
      {/* Photo layer + overflow menu anchor */}
      <div className="relative w-full">
        {signedUrl !== null ? (
          <WearPhotoClient
            signedUrl={signedUrl}
            altText={altText}
            watchImageUrl={watchImageUrl}
            brand={brand}
            model={model}
            username={username}
            displayName={displayName}
            avatarUrl={avatarUrl}
            createdAt={createdAt}
            watchId={watchId}
          />
        ) : (
          <WearDetailHero
            watchImageUrl={watchImageUrl}
            brand={brand}
            model={model}
            altText={altText}
            username={username}
            displayName={displayName}
            avatarUrl={avatarUrl}
            createdAt={createdAt}
            watchId={watchId}
          />
        )}

        {/* Overflow "…" menu — absolute top-right over the photo (z-20 above scrims at z-10) */}
        <div className="absolute top-3 right-3 z-20">
          <WearOverflowMenu
            wearEventId={wearEventId}
            permalinkUrl={permalinkUrl}
            showAddToWishlist={showAddToWishlist}
            onPhoto={hasPhoto}
            showGoToPost={commentHostVariant === 'bottom-sheet'}
          />
        </div>
      </div>

      {/* Engagement row — variant-driven */}
      {commentHostVariant === 'bottom-sheet' ? (
        /* Stories lane: safe-area bottom padding, no border */
        <div className="flex items-center px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {/* Comment trigger — left slot (CMNT-09: count badge hidden at zero) */}
          <button
            type="button"
            aria-label="Open comments"
            onClick={handleOpenComments}
            className="inline-flex items-center gap-1 justify-center min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground"
          >
            <MessageCircle className="size-5" aria-hidden />
            {commentCount > 0 && (
              <span className="text-sm tabular-nums text-muted-foreground">{commentCount}</span>
            )}
          </button>
          <div className="flex-1" />
          {/* LikeButton — right slot */}
          <LikeButton
            viewerId={viewerId}
            target={{ type: 'wear', id: wearEventId }}
            initialLiked={initialLiked}
            initialCount={initialCount}
          />
        </div>
      ) : (
        /* Detail page: border-t, text-muted-foreground, md constrained */
        <div className="flex items-center px-4 py-3 border-t border-border md:max-w-[600px] md:mx-auto">
          {/* Comment trigger — scrolls to inline section (CMNT-09: count badge hidden at zero) */}
          <button
            type="button"
            aria-label="View comments"
            onClick={handleScrollToComments}
            className="inline-flex items-center gap-1 justify-center min-h-[44px] min-w-[44px]"
          >
            <MessageCircle className="size-5 text-muted-foreground" aria-hidden />
            {commentCount > 0 && (
              <span className="text-sm tabular-nums text-muted-foreground">{commentCount}</span>
            )}
          </button>
          <div className="flex-1" />
          {/* LikeButton — right slot */}
          <LikeButton
            viewerId={viewerId}
            target={{ type: 'wear', id: wearEventId }}
            initialLiked={initialLiked}
            initialCount={initialCount}
          />
        </div>
      )}

      {/* Comment host */}
      {commentHostVariant === 'bottom-sheet' ? (
        <WearCommentHost
          variant="bottom-sheet"
          wearEventId={wearEventId}
          open={commentOpen}
          onOpenChange={handleCommentOpenChange}
          initialComments={initialComments}
          canComment={canComment}
          ownerFollowsViewer={ownerFollowsViewer}
          viewerIsFollowing={viewerIsFollowing}
          ownerUserId={ownerUserId}
          ownerUsername={ownerUsername}
          viewerId={viewerId}
          viewerAuthor={viewerAuthor}
        />
      ) : (
        <WearCommentHost
          variant="inline"
          wearEventId={wearEventId}
          initialComments={initialComments}
          canComment={canComment}
          ownerFollowsViewer={ownerFollowsViewer}
          viewerIsFollowing={viewerIsFollowing}
          ownerUserId={ownerUserId}
          ownerUsername={ownerUsername}
          viewerId={viewerId}
          viewerAuthor={viewerAuthor}
        />
      )}
    </div>
  )
}
