import { notFound } from 'next/navigation'

import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getWearEventByIdForViewer } from '@/data/wearEvents'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { WearDetailHero } from '@/components/wear/WearDetailHero'
import { WearDetailMetadata } from '@/components/wear/WearDetailMetadata'

/**
 * Wear detail page (WYWT-17, WYWT-18).
 *
 * DAL applies three-tier visibility gate; page calls notFound() uniformly
 * for missing OR denied — mirrors Phase 8 notes-IDOR mitigation precedent
 * (indistinguishable 404 on missing vs denied leaks no existence signal).
 *
 * Signed URL is minted INLINE here (NOT in the DAL). Pitfall F-2: signed
 * URLs are per-request and per-user; caching them across either axis is
 * a security + freshness bug. Supabase Smart CDN keys each token as a
 * separate cache entry so per-request minting is both free and correct.
 *
 * Deliberately NOT cache-wrapped — no Cache Components directive on this page.
 *
 * Anonymous viewers (no session) are allowed — the DAL returns wears
 * marked visibility='public' on profile_public=true actors for null viewer.
 * The UnauthorizedError catch below preserves that branch without leaking
 * other auth errors.
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

  // Signed URL mint per-request, 60-min TTL (CONTEXT.md D-23 / plan Discretion).
  // Never cached across requests or users — Pitfall F-2.
  let signedUrl: string | null = null
  if (wear.photoUrl) {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.storage
      .from('wear-photos')
      .createSignedUrl(wear.photoUrl, 60 * 60)
    signedUrl = data?.signedUrl ?? null
  }

  const altText = wear.username
    ? `${wear.username} wearing ${wear.brand} ${wear.model}`
    : `Watch on wrist — ${wear.brand} ${wear.model}`

  return (
    <article className="flex flex-col gap-4 pt-4">
      <WearDetailHero
        signedUrl={signedUrl}
        watchImageUrl={wear.watchImageUrl}
        brand={wear.brand}
        model={wear.model}
        altText={altText}
      />
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
