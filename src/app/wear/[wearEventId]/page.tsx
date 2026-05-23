import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getWearEventByIdForViewer } from '@/data/wearEvents'
import { getLikesForTargetCached } from '@/data/reactions'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { WearDetailHero } from '@/components/wear/WearDetailHero'
import { WearDetailMetadata } from '@/components/wear/WearDetailMetadata'
import { WearPhotoClient } from '@/components/wear/WearPhotoClient'
import { PhotoSkeleton } from '@/components/wear/PhotoSkeleton'
import { LikeButton } from '@/components/shared/LikeButton'

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
 * Anonymous viewers (no session) are allowed — the DAL returns wears
 * marked visibility='public' on profile_public=true actors for null viewer.
 *
 * Phase 56 D-04/05/06/07: footer action row with LikeButton added.
 * Overlay content props (username/displayName/avatarUrl/createdAt) threaded
 * through WearPhotoStreamed into WearPhotoClient and WearDetailHero.
 * Anon sentinel '__anon__' used for getLikesForTargetCached when viewerId is null.
 */
export default async function WearDetailPage({
  params,
}: {
  // Next.js 16 App Router: params is a Promise, must be awaited.
  params: Promise<{ wearEventId: string }>
}) {
  const { wearEventId } = await params

  let viewerId: string | null = null
  try {
    const user = await getCurrentUser()
    viewerId = user.id
  } catch (err) {
    // Anonymous viewer is an allowed path for public wear events on
    // profile_public profiles. Any non-auth error still surfaces.
    if (!(err instanceof UnauthorizedError)) throw err
  }

  const wear = await getWearEventByIdForViewer(viewerId, wearEventId)
  if (!wear) notFound()

  // Anon sentinel: getLikesForTargetCached expects a non-null string.
  // '__anon__' is never a real UUID, so bool_or(userId='__anon__') = false
  // for all real rows — viewerHasLiked is always false for anon (correct).
  // The count is still correct (not viewer-filtered).
  const ANON_SENTINEL = '__anon__'
  const likeState = await getLikesForTargetCached(viewerId ?? ANON_SENTINEL, { type: 'wear', id: wearEventId })

  const altText = wear.username
    ? `${wear.username} wearing ${wear.brand} ${wear.model}`
    : `Watch on wrist — ${wear.brand} ${wear.model}`

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
        />
      </Suspense>
      <WearDetailMetadata
        note={wear.note}
      />
      {/* Phase 56 D-04: footer action row — [reserved comment slot] [LikeButton right] */}
      <div className="flex items-center px-4 py-3 border-t border-border md:max-w-[600px] md:mx-auto">
        {/* Reserved for Phase 57 comment input — sized to accept a textarea without re-layout */}
        <div className="flex-1 min-h-[44px]" aria-hidden />
        <LikeButton
          viewerId={viewerId}
          target={{ type: 'wear', id: wearEventId }}
          initialLiked={likeState.viewerHasLiked}
          initialCount={likeState.count}
        />
      </div>
    </article>
  )
}

/**
 * Streamed server child — owns the signed-URL mint so it runs INSIDE the
 * Suspense boundary (the parent's await on getWearEventByIdForViewer is
 * not enough to suspend without an explicit boundary around the slow
 * subtree). 60-min TTL, never cached. Pitfall F-2.
 *
 * Phase 56: receives overlay content props (username/displayName/avatarUrl/
 * createdAt) and forwards them to WearPhotoClient and WearDetailHero so the
 * overlays render on all photo paths including the no-photo fallback.
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
}) {
  let signedUrl: string | null = null
  if (photoUrl) {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.storage
      .from('wear-photos')
      .createSignedUrl(photoUrl, 60 * 60)
    signedUrl = data?.signedUrl ?? null
  }

  // If we have a signed URL, hand off to the Client retry component (D-02).
  // If we don't (no photo or mint failed), fall back to the server hero
  // which renders the watchImageUrl branch or the no-photo placeholder.
  if (signedUrl) {
    return (
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
      />
    )
  }
  return (
    <WearDetailHero
      watchImageUrl={watchImageUrl}
      brand={brand}
      model={model}
      altText={altText}
      username={username}
      displayName={displayName}
      avatarUrl={avatarUrl}
      createdAt={createdAt}
    />
  )
}
