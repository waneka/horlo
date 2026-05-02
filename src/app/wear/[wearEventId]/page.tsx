import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getWearEventByIdForViewer } from '@/data/wearEvents'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { WearDetailHero } from '@/components/wear/WearDetailHero'
import { WearDetailMetadata } from '@/components/wear/WearDetailMetadata'
import { WearPhotoClient } from '@/components/wear/WearPhotoClient'
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
 * Anonymous viewers (no session) are allowed — the DAL returns wears
 * marked visibility='public' on profile_public=true actors for null viewer.
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
        />
      </Suspense>
      <WearDetailMetadata
        username={wear.username}
        displayName={wear.displayName}
        avatarUrl={wear.avatarUrl}
        brand={wear.brand}
        model={wear.model}
        watchImageUrl={wear.watchImageUrl}
        note={wear.note}
        createdAt={wear.createdAt}
      />
    </article>
  )
}

/**
 * Streamed server child — owns the signed-URL mint so it runs INSIDE the
 * Suspense boundary (the parent's await on getWearEventByIdForViewer is
 * not enough to suspend without an explicit boundary around the slow
 * subtree). 60-min TTL, never cached. Pitfall F-2.
 */
async function WearPhotoStreamed({
  photoUrl,
  watchImageUrl,
  brand,
  model,
  altText,
}: {
  photoUrl: string | null
  watchImageUrl: string | null
  brand: string
  model: string
  altText: string
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
      />
    )
  }
  return (
    <WearDetailHero
      watchImageUrl={watchImageUrl}
      brand={brand}
      model={model}
      altText={altText}
    />
  )
}
