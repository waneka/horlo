// CRITICAL: NO 'use client' AND NO 'use cache' on this component.
// This is an uncached async Server Component — the absence of 'use cache' is
// the privacy guarantee for comments (src/data/comments.ts PRIVACY LAYER NOTE).

import { getCommentsForTarget } from '@/data/comments'
import type { CommentTarget } from '@/data/comments'
import { getProfilesByIds } from '@/data/profiles'
import type { CommentAuthor, CommentWithAuthor } from './types'
import { CommentList } from './CommentList'

interface CommentThreadProps {
  viewerId: string | null
  target: CommentTarget
  canComment: boolean
  /** true when the watch owner follows the viewer (needed for GATE-03 locked-state copy) */
  ownerFollowsViewer: boolean
  ownerUserId: string
  ownerUsername: string
  /** Whether the viewer is already following the owner — needed for GATE-03 state selection */
  viewerIsFollowing: boolean
  /**
   * SC-6 (Phase 57.1 Plan 03): pass-through to CommentList — suppresses compose slot for the
   * owner on /watch/[id]. WearCommentHost never passes this prop (stays undefined → falsy).
   */
  suppressCompose?: boolean
}

export async function CommentThread({
  viewerId,
  target,
  canComment,
  ownerFollowsViewer,
  ownerUserId,
  ownerUsername,
  viewerIsFollowing,
  suppressCompose,
}: CommentThreadProps) {
  // Gated viewers (non-mutual-follow on wishlist) get [] from the DAL (D-04/D-06).
  // Pass '' for anon — the DAL handles the non-mutual path; wear targets are always open.
  const rawComments = await getCommentsForTarget(viewerId ?? '', target)

  // Batch-enrich authors: collect unique authorIds + include viewerId for optimistic insert.
  const authorIds = [...new Set(rawComments.map((c) => c.authorId))]
  if (viewerId && !authorIds.includes(viewerId)) {
    authorIds.push(viewerId)
  }
  const profileMap = await getProfilesByIds(authorIds)

  const fallbackAuthor: CommentAuthor = {
    username: 'unknown',
    displayName: null,
    avatarUrl: null,
  }

  const initialComments: CommentWithAuthor[] = rawComments.map((c) => ({
    ...c,
    author: profileMap.get(c.authorId) ?? fallbackAuthor,
  }))

  // Viewer's own author info — used for optimistic comment insert in CommentList.
  const viewerAuthor: CommentAuthor | null = viewerId
    ? (profileMap.get(viewerId) ?? null)
    : null

  return (
    <section id="comments" className="mt-6">
      <h2 className="text-sm font-semibold mb-4">Comments</h2>
      <CommentList
        initialComments={initialComments}
        target={target}
        canComment={canComment}
        ownerFollowsViewer={ownerFollowsViewer}
        ownerUserId={ownerUserId}
        ownerUsername={ownerUsername}
        viewerId={viewerId}
        viewerAuthor={viewerAuthor}
        viewerIsFollowing={viewerIsFollowing}
        suppressCompose={suppressCompose}
        // D-01: CommentThread is the /watch/[id] surface — enable RSC refresh on post
        // success so the count badge updates. Wears hosts (WearCommentHost) never set this.
        refreshRouteOnMutation
      />
    </section>
  )
}
