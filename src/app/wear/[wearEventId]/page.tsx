import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { getCurrentUser } from '@/lib/auth'
import { getWearEventByIdForViewer } from '@/data/wearEvents'
import { getLikesForTargetCached } from '@/data/reactions'
import { getWatchesByUser } from '@/data/watches'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { WearCard } from '@/components/wear/WearCard'
import { WearDetailMetadata } from '@/components/wear/WearDetailMetadata'
import { PhotoSkeleton } from '@/components/wear/PhotoSkeleton'

/**
 * Wear detail page (WYWT-17, WYWT-18, WYWT-21).
 *
 * Phase 26 Plan 01 (D-02): the photo render is wrapped in
 * <Suspense fallback={<PhotoSkeleton />}> via a streamed server child
 * (WearPhotoStreamed). The rest of the page (metadata) renders
 * immediately; the photo block streams in once the signed URL is minted.
 *
 * DAL applies three-tier visibility gate; page calls notFound() uniformly
 * for missing OR denied — mirrors Phase 8 notes-IDOR mitigation precedent
 * (indistinguishable 404 on missing vs denied leaks no existence signal).
 *
 * Signed URL is minted INLINE in the streamed child (NOT in the DAL,
 * NOT cached). Pitfall F-2: signed URLs are per-request and per-user;
 * caching them across either axis is a security + freshness bug.
 *
 * Phase 56A EN-6: both wear routes are auth-only — the proxy redirects
 * unauthenticated users to /login. The anon sentinel and the anonymous-viewer
 * try/catch have been removed (56A EN-6); getCurrentUser() throws
 * UnauthorizedError for anon users, which is not caught here.
 *
 * Phase 56A SC-4: refactored to render the shared WearCard
 * (commentHostVariant="inline") in place of the bespoke inline hero +
 * footer action row. Visual and behavioral parity with the stories lane.
 *
 * Phase 56 D-04/05/06/07: footer action row with LikeButton is now
 * owned by WearCard.
 */
export default async function WearDetailPage({
  params,
}: {
  // Next.js 16 App Router: params is a Promise, must be awaited.
  params: Promise<{ wearEventId: string }>
}) {
  const { wearEventId } = await params

  // Auth-only, no anon sentinel (EN-6). Proxy redirects anon to /login.
  // Do NOT wrap in try/catch for UnauthorizedError.
  const user = await getCurrentUser()
  const viewerId = user.id

  const wear = await getWearEventByIdForViewer(viewerId, wearEventId)
  if (!wear) notFound()

  // Real viewerId — no sentinel needed (EN-6 cleanup).
  const likeState = await getLikesForTargetCached(viewerId, { type: 'wear', id: wearEventId })

  const altText = wear.username
    ? `${wear.username} wearing ${wear.brand} ${wear.model}`
    : `Watch on wrist — ${wear.brand} ${wear.model}`

  // D-09: showAddToWishlist is false when:
  //   1. The wear belongs to the viewer (own wear).
  //   2. The viewer already has the watch (owned or wishlist) matched by brand+model.
  // Matches the same logic as the stories lane (Plan 03).
  const viewerWatches = await getWatchesByUser(viewerId)
  const viewerOwnedOrWishlist = viewerWatches.filter(
    (v) => v.status === 'owned' || v.status === 'wishlist',
  )
  const viewerHasWatch = (brand: string, model: string): boolean =>
    viewerOwnedOrWishlist.some(
      (v) =>
        v.brand.toLowerCase() === brand.toLowerCase() &&
        v.model.toLowerCase() === model.toLowerCase(),
    )
  const showAddToWishlist =
    wear.userId !== viewerId && !viewerHasWatch(wear.brand, wear.model)

  return (
    <article className="flex flex-col gap-4 pt-4">
      <Suspense fallback={<PhotoSkeleton />}>
        <WearPhotoStreamed
          photoUrl={wear.photoUrl}
          watchImageUrl={wear.watchImageUrl}
          brand={wear.brand}
          model={wear.model}
          altText={altText}
          username={wear.username}
          displayName={wear.displayName}
          avatarUrl={wear.avatarUrl}
          createdAt={wear.createdAt}
          watchId={wear.watchId}
          viewerId={viewerId}
          wearEventId={wearEventId}
          initialLiked={likeState.viewerHasLiked}
          initialCount={likeState.count}
          showAddToWishlist={showAddToWishlist}
          permalinkUrl={`/wear/${wearEventId}`}
        />
      </Suspense>
      <WearDetailMetadata
        note={wear.note}
      />
    </article>
  )
}

/**
 * Streamed server child — owns the signed-URL mint so it runs INSIDE the
 * Suspense boundary (the parent's await on getWearEventByIdForViewer is
 * not enough to suspend without an explicit boundary around the slow
 * subtree). 60-min TTL, never cached. Pitfall F-2.
 *
 * Phase 56A SC-4: returns the shared WearCard (commentHostVariant="inline")
 * instead of WearPhotoClient/WearDetailHero directly. WearCard owns the
 * photo layer, overlays, engagement row (LikeButton + comment trigger),
 * overflow menu, and the inline comment host section.
 */
async function WearPhotoStreamed({
  photoUrl,
  watchImageUrl,
  brand,
  model,
  altText,
  username,
  displayName,
  avatarUrl,
  createdAt,
  watchId,
  viewerId,
  wearEventId,
  initialLiked,
  initialCount,
  showAddToWishlist,
  permalinkUrl,
}: {
  photoUrl: string | null
  watchImageUrl: string | null
  brand: string
  model: string
  altText: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  createdAt: Date
  watchId: string
  viewerId: string
  wearEventId: string
  initialLiked: boolean
  initialCount: number
  showAddToWishlist: boolean
  permalinkUrl: string
}) {
  let signedUrl: string | null = null
  if (photoUrl) {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.storage
      .from('wear-photos')
      .createSignedUrl(photoUrl, 60 * 60)
    signedUrl = data?.signedUrl ?? null
  }

  return (
    <WearCard
      signedUrl={signedUrl}
      watchImageUrl={watchImageUrl}
      altText={altText}
      username={username}
      displayName={displayName}
      avatarUrl={avatarUrl}
      createdAt={createdAt}
      brand={brand}
      model={model}
      watchId={watchId}
      viewerId={viewerId}
      wearEventId={wearEventId}
      initialLiked={initialLiked}
      initialCount={initialCount}
      commentHostVariant="inline"
      showAddToWishlist={showAddToWishlist}
      permalinkUrl={permalinkUrl}
    />
  )
}
