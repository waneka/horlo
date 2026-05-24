import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'

import { getCurrentUser } from '@/lib/auth'
import { getProfileByUsername, getProfilesByIds } from '@/data/profiles'
import { getActiveWearsForUser, getWearRailForViewer } from '@/data/wearEvents'
import { getLikesForTargetCached } from '@/data/reactions'
import { getWatchesByUser } from '@/data/watches'
import { getCommentsForTarget } from '@/data/comments'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { WearsLane } from '@/components/wears/WearsLane'
import { PhotoSkeleton } from '@/components/wear/PhotoSkeleton'
import type { WearSlide } from '@/components/wears/WearsLane'
import type { CommentAuthor, CommentWithAuthor } from '@/components/comment/types'

/**
 * /wears/[username] — Stories lane server page (SC-1, D-04..D-07, D-09).
 *
 * Auth-only (EN-6): getCurrentUser() throws UnauthorizedError for anon;
 * the proxy redirects to /login. No try/catch for auth here.
 *
 * D-07: 0 active wears → redirect to /u/[username] OUTSIDE any try/catch
 * (redirect() throws NEXT_REDIRECT; wrapping in try/catch swallows it).
 *
 * Pitfall F-2: signed URLs minted per-request at page level via Promise.all,
 * never in a DAL function or 'use cache' scope. 60-min TTL.
 *
 * D-06/Pitfall 3: user→user swipe order derived from a fresh getWearRailForViewer
 * read — never taken from a client-supplied URL parameter.
 *
 * D-09: showAddToWishlist gated per wear: false when viewing own wear, or when
 * the viewer already has the watch with status 'owned' or 'wishlist'. Match on
 * (brand, model) case-insensitively (catalog-id-divergence: no shared watch id).
 */
export default async function WearsPage({
  params,
  searchParams,
}: {
  // Next.js 16 App Router: params and searchParams are Promises — must be awaited.
  params: Promise<{ username: string }>
  searchParams: Promise<{ from?: string; at?: string }>
}) {
  const { username } = await params
  const { from: fromWearEventId, at } = await searchParams

  // Auth-only, no anon sentinel (EN-6). Proxy redirects anon to /login.
  // Do NOT wrap in try/catch for UnauthorizedError.
  const user = await getCurrentUser()
  const viewerId = user.id

  // Resolve actor — case-insensitive lookup; returns full profile row or null.
  const actor = await getProfileByUsername(username)
  if (!actor) notFound()

  // Fetch active wears (48h window, visibility-gated, oldest-first per D-05).
  const wears = await getActiveWearsForUser(viewerId, actor.id)

  // D-07: redirect to /u/[username] when there are no active wears.
  // MUST be outside any try/catch — redirect() throws NEXT_REDIRECT.
  if (wears.length === 0) {
    redirect(`/u/${username}`)
  }

  // Rail order for user→user swipe (D-06/Pitfall 3):
  // Re-fetch fresh so the order is never taken from a client-supplied parameter.
  // railUsernames defines the cross-user swipe sequence.
  // Cross-user advance is a follow-on seam — data is server-fresh and available here.
  const railData = await getWearRailForViewer(viewerId)
  const railUsernames = railData.tiles.map((t) => t.username)
  // Case-insensitive match to mirror getProfileByUsername's lookup semantics (Pitfall 3).
  const railIndex = railUsernames.findIndex(
    (u) => u?.toLowerCase() === username.toLowerCase(),
  )

  // Per-wear like state.
  const likeStates = await Promise.all(
    wears.map((w) => getLikesForTargetCached(viewerId, { type: 'wear', id: w.id })),
  )

  // Per-wear comment reads (Phase 57 Plan 05).
  // BOUNDED-FANOUT NOTE (vs DISP-01): This Promise.all over getCommentsForTarget is acceptable
  // and NOT a DISP-01 violation. DISP-01 targets the 500-watch profile-collection grid (Plan 06)
  // where a per-card query would scale with collection size. Here the fan-out is over the
  // ACTIVE-WEARS set (~48h window, typically <10 wears) — the same shape as the already-approved
  // per-slide likeStates Promise.all above. Author enrichment is collapsed into ONE getProfilesByIds
  // batch across all slides (not per-slide). Wear targets are ungated (GATE-01): canComment=true,
  // ownerFollowsViewer=false, viewerIsFollowing=false.
  const rawCommentLists = await Promise.all(
    wears.map((w) => getCommentsForTarget(viewerId, { type: 'wear', id: w.id })),
  )

  // Batch-resolve author profiles for all comment authors across ALL slides in ONE query.
  // Collect unique authorIds across all slides + include viewerId for optimistic insert.
  const allAuthorIds = [
    ...new Set([
      ...rawCommentLists.flatMap((comments) => comments.map((c) => c.authorId)),
      viewerId,
    ]),
  ]
  const profileMap = await getProfilesByIds(allAuthorIds)

  const fallbackAuthor: CommentAuthor = { username: 'unknown', displayName: null, avatarUrl: null }
  const viewerAuthor: CommentAuthor | null = profileMap.get(viewerId) ?? null

  // Build enriched CommentWithAuthor[] per slide.
  const commentLists: CommentWithAuthor[][] = rawCommentLists.map((rawComments) =>
    rawComments.map((c) => ({
      ...c,
      author: profileMap.get(c.authorId) ?? fallbackAuthor,
    })),
  )

  // Viewer's watches for wishlist applicability (D-09).
  const viewerWatches = await getWatchesByUser(viewerId)
  const viewerOwnedOrWishlist = viewerWatches.filter(
    (v) => v.status === 'owned' || v.status === 'wishlist',
  )

  // Wishlist helper: case-insensitive brand+model match.
  // Per the catalog-id-divergence note: match by (brand, model), not by watch id.
  const viewerHasWatch = (brand: string, model: string): boolean =>
    viewerOwnedOrWishlist.some(
      (v) =>
        v.brand.toLowerCase() === brand.toLowerCase() &&
        v.model.toLowerCase() === model.toLowerCase(),
    )

  // Per-wear signed URLs (Pitfall F-2) — minted per-request at page level.
  // Mirrors src/app/page.tsx lines 36-63 (bulk Promise.all sign pattern).
  const supabase = await createSupabaseServerClient()
  const signedUrls = await Promise.all(
    wears.map(async (w) => {
      if (!w.photoUrl) return null
      const { data } = await supabase.storage
        .from('wear-photos')
        .createSignedUrl(w.photoUrl, 60 * 60) // 60-min TTL, Pitfall F-2
      return data?.signedUrl ?? null
    }),
  )

  // Build the initial slide index.
  //
  // Priority order:
  //   1. ?from=<wearEventId> — opens the lane at the specific wear (e.g. home rail tap).
  //      T-56A-07: `from` is used only as an index lookup within `wears` (already
  //      filtered by getActiveWearsForUser's three-tier gate). A `from` not in the
  //      gated set falls back to index 0 — no IDOR exposure.
  //   2. ?at=last — opens the lane at the last slide (backward cross-user nav, R3 fix).
  //      goToNeighbor('prev') in WearsLane.tsx appends ?at=last so that the
  //      backward-crossed lane opens at its last slide. Without this, all cross-user
  //      nav landed at slide 0, and forward-cross (isLast condition) was never met
  //      after a backward crossing → stuck for multi-wear users.
  //   3. Default → slide 0 (first/oldest wear).
  let initialSlideIndex = 0
  if (fromWearEventId) {
    const idx = wears.findIndex((w) => w.id === fromWearEventId)
    if (idx !== -1) initialSlideIndex = idx
  } else if (at === 'last') {
    initialSlideIndex = wears.length - 1
  }

  // Build WearSlide array.
  const slides: WearSlide[] = wears.map((w, i) => {
    const altText = w.username
      ? `${w.username} wearing ${w.brand} ${w.model}`
      : `Watch on wrist — ${w.brand} ${w.model}`

    // D-09: showAddToWishlist is false when:
    //   1. The wear belongs to the viewer (own wear).
    //   2. The viewer already has the watch (owned or wishlist) matched by brand+model.
    const showAddToWishlist =
      w.userId !== viewerId && !viewerHasWatch(w.brand, w.model)

    return {
      wearEventId: w.id,
      signedUrl: signedUrls[i],
      watchImageUrl: w.watchImageUrl,
      altText,
      username: w.username,
      displayName: w.displayName,
      avatarUrl: w.avatarUrl,
      createdAt: w.createdAt,
      brand: w.brand,
      model: w.model,
      watchId: w.watchId,
      initialLiked: likeStates[i].viewerHasLiked,
      initialCount: likeStates[i].count,
      showAddToWishlist,
      permalinkUrl: `/wear/${w.id}`,
      // Phase 57 Plan 05: comment-thread + gate props (server-resolved).
      // Wear targets are ungated (GATE-01).
      initialComments: commentLists[i],
      canComment: true,
      ownerFollowsViewer: false,
      viewerIsFollowing: false,
      ownerUserId: w.userId,
      ownerUsername: w.username ?? '',
      viewerAuthor,
      commentCount: commentLists[i].length,
    }
  })

  return (
    <Suspense fallback={<PhotoSkeleton />}>
      {/*
       * W1 fix: key={username} forces a full remount of WearsLane when the
       * route changes to a different user (router.replace on same dynamic
       * segment). Without the key, the App Router reuses the same instance
       * across /wears/A → /wears/B, leaving navigated.current=true (stuck)
       * and embla carrying the previous user's slide state.
       */}
      <WearsLane
        key={username}
        slides={slides}
        initialSlideIndex={initialSlideIndex}
        viewerId={viewerId}
        railUsernames={railUsernames}
        railIndex={railIndex}
      />
    </Suspense>
  )
}
