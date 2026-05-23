import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'

import { getCurrentUser } from '@/lib/auth'
import { getProfileByUsername } from '@/data/profiles'
import { getActiveWearsForUser, getWearRailForViewer } from '@/data/wearEvents'
import { getLikesForTargetCached } from '@/data/reactions'
import { getWatchesByUser } from '@/data/watches'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { WearsLane } from '@/components/wears/WearsLane'
import { PhotoSkeleton } from '@/components/wear/PhotoSkeleton'
import type { WearSlide } from '@/components/wears/WearsLane'

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
  searchParams: Promise<{ from?: string }>
}) {
  const { username } = await params
  const { from: fromWearEventId } = await searchParams

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

  // Build the initial slide index (D-05 "open at oldest unviewed").
  // Wears are already oldest-first. If ?from is provided, find its index.
  // T-56A-07: `from` is used only as an index lookup within `wears` (already
  // filtered by getActiveWearsForUser's three-tier gate). A `from` not in the
  // gated set falls back to index 0 — no IDOR exposure.
  let initialSlideIndex = 0
  if (fromWearEventId) {
    const idx = wears.findIndex((w) => w.id === fromWearEventId)
    if (idx !== -1) initialSlideIndex = idx
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
    }
  })

  return (
    <Suspense fallback={<PhotoSkeleton />}>
      <WearsLane
        slides={slides}
        initialSlideIndex={initialSlideIndex}
        viewerId={viewerId}
        railUsernames={railUsernames}
        railIndex={railIndex}
      />
    </Suspense>
  )
}
