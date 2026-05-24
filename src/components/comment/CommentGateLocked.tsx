'use client'

import { FollowButton } from '@/components/profile/FollowButton'

interface CommentGateLockedProps {
  /** The watch/wear target owner's display name */
  ownerUsername: string
  /** The watch/wear target owner's userId */
  ownerUserId: string
  /** true when the owner is already following the viewer (owner→viewer direction) */
  ownerFollowsViewer: boolean
  /** null for unauthenticated viewer */
  viewerId: string | null
  /** true when the viewer is already following the owner (viewer→owner direction) */
  viewerIsFollowing: boolean
}

/**
 * GATE-03 two-state locked container — shown instead of CommentCompose when
 * canComment is false (non-mutual-follow on a wishlist watch).
 *
 * State 1 (viewer has not followed owner): "Follow {owner} to comment" + FollowButton inline
 * State 2 (viewer follows, owner has not followed back): "{owner} needs to follow you back before you can comment" — no button
 * State 3 (signals say mutual but the server gate rejected — a stale-gate race):
 *   show a refresh affordance so the viewer is never stranded with no compose box and no message (WR-05).
 *
 * Copy strings MUST match 57-UI-SPEC Copywriting Contract exactly.
 * FollowButton is REUSED (not re-implemented) — handles anon bounce + optimistic toggle.
 */
export function CommentGateLocked({
  ownerUsername,
  ownerUserId,
  ownerFollowsViewer,
  viewerId,
  viewerIsFollowing,
}: CommentGateLockedProps) {
  // State 1: viewer has not followed the owner yet
  if (!viewerIsFollowing) {
    return (
      <div className="rounded-md bg-muted px-4 py-4 flex flex-col gap-2 border border-border">
        <p className="text-sm font-semibold text-foreground">
          Follow {ownerUsername} to comment
        </p>
        <div className="self-start">
          <FollowButton
            variant="inline"
            viewerId={viewerId}
            targetUserId={ownerUserId}
            targetDisplayName={ownerUsername}
            initialIsFollowing={false}
          />
        </div>
      </div>
    )
  }

  // State 2: viewer follows, but owner has not followed back yet
  if (!ownerFollowsViewer) {
    return (
      <div className="rounded-md bg-muted px-4 py-4 flex flex-col gap-2 border border-border">
        <p className="text-sm font-semibold text-foreground">
          {ownerUsername} needs to follow you back before you can comment
        </p>
      </div>
    )
  }

  // State 3: client signals say mutual but the server gate flipped canComment=false
  // (stale-gate race, e.g. a just-completed follow-back). Never strand the viewer with
  // a silently-disappeared compose box — offer an explicit refresh path (WR-05).
  return (
    <div className="rounded-md bg-muted px-4 py-4 flex flex-col gap-2 border border-border">
      <p className="text-sm font-semibold text-foreground">
        Refresh the page to comment
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="self-start text-sm font-medium text-primary underline-offset-2 hover:underline"
      >
        Refresh
      </button>
    </div>
  )
}
