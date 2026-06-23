import { getCurrentUser } from '@/lib/auth'
import { getWatchesByUser } from '@/data/watches'
import { getWearRailForViewer } from '@/data/wearEvents'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { signCoverUrls } from '@/lib/storage/signCoverUrls'
import { WywtRail } from '@/components/home/WywtRail'
import { CollectorsLikeYou } from '@/components/home/CollectorsLikeYou'
import { NetworkActivityFeed } from '@/components/home/NetworkActivityFeed'
import { PersonalInsightsGrid } from '@/components/home/PersonalInsightsGrid'
import { SuggestedCollectors } from '@/components/home/SuggestedCollectors'

/**
 * Home — the 5-section network home (CONTEXT.md L-01 LOCKED order).
 *
 * Sections, top → bottom:
 *   1. WYWT rail            (Plan 10-06) — daily-retention hook, focal point
 *   2. Collectors Like You  (Plan 10-07) — rule-based recs, `'use cache'`
 *   3. Network Activity     (Plan 10-05) — keyset-paginated feed
 *   4. Personal Insights    (Plan 10-07) — up to 4 cards; hides on empty collection (I-04)
 *   5. Suggested Collectors (Plan 10-07) — follow CTAs, LoadMore
 *
 * `getCurrentUser()` redirects unauthenticated viewers to /login via the
 * existing middleware / auth layer — no new unauth path. The two parent
 * fetches (watches for WywtRail.ownedWatches, wear-rail tiles) run in
 * parallel via `Promise.all`; each section below owns its own DAL reads.
 */
export default async function Home() {
  const user = await getCurrentUser()
  // `let` on railData (rather than destructuring directly) — we replace its
  // tiles below with signed-URL versions of any photo paths.
  const [watchesRaw, railDataRaw] = await Promise.all([
    getWatchesByUser(user.id),
    getWearRailForViewer(user.id),
  ])
  // Phase 61 Plan 04: sign owner-photo cover paths so grid/rail card thumbnails render.
  // The viewer IS the owner on the home page — their session can sign their own files.
  const watches = await signCoverUrls(watchesRaw)
  let railData = railDataRaw

  // Phase 15 UAT: mint signed URLs for any tile that has a wrist-shot photo.
  //
  // The DAL returns `tile.photoUrl` as the RAW Storage path (Pitfall F-2 —
  // signed URLs MUST live outside any cached DAL function). We sign here,
  // per-request, with a 60-min TTL — mirrors the inline pattern in
  // src/app/wear/[wearEventId]/page.tsx. Supabase Smart CDN keys each token
  // as a separate cache entry, so per-request minting is both free and
  // correct (a cached signed URL would either leak across users or expire
  // mid-render). Deliberately NOT wrapped in `cache()` / `'use cache'`.
  const tilesWithPhotos = railData.tiles.filter((t) => t.photoUrl)
  // Phase 77 (VID-13, T-77-03): mint poster signed URLs for video tiles in
  // parallel with the existing photo mint. Same admin client, same 60-min TTL.
  const tilesWithVideos = railData.tiles.filter(
    (t) => t.mediaType === 'video' && t.posterPath,
  )
  if (tilesWithPhotos.length > 0 || tilesWithVideos.length > 0) {
    const supabase = await createSupabaseServerClient()
    const [photoSigned, videoPosterSigned] = await Promise.all([
      Promise.all(
        tilesWithPhotos.map(async (t) => {
          const { data } = await supabase.storage
            .from('wear-photos')
            .createSignedUrl(t.photoUrl as string, 60 * 60)
          return { wearEventId: t.wearEventId, signedUrl: data?.signedUrl ?? null }
        }),
      ),
      Promise.all(
        tilesWithVideos.map(async (t) => {
          const { data } = await supabase.storage
            .from('wear-photos')
            .createSignedUrl(t.posterPath as string, 60 * 60)
          return {
            wearEventId: t.wearEventId,
            signedPosterUrl: data?.signedUrl ?? null,
          }
        }),
      ),
    ])
    const byId = new Map(photoSigned.map((s) => [s.wearEventId, s.signedUrl]))
    const posterById = new Map(
      videoPosterSigned.map((s) => [s.wearEventId, s.signedPosterUrl]),
    )
    railData = {
      ...railData,
      tiles: railData.tiles.map((t) => {
        const next = { ...t }
        if (t.photoUrl) next.photoUrl = byId.get(t.wearEventId) ?? null
        if (t.mediaType === 'video') {
          next.signedPosterUrl = posterById.get(t.wearEventId) ?? null
        }
        return next
      }),
    }
  }

  const ownedWatches = watches.filter((w) => w.status === 'owned')

  return (
    <main className="container mx-auto px-4 md:px-8 py-8 space-y-8 md:space-y-12 max-w-6xl">
      {/* L-01 Section order: WYWT → Collectors Like You → Network Activity → Personal Insights → Suggested Collectors */}
      <WywtRail data={railData} ownedWatches={ownedWatches} />
      <CollectorsLikeYou viewerId={user.id} />
      <NetworkActivityFeed viewerId={user.id} />
      <PersonalInsightsGrid viewerId={user.id} />
      <SuggestedCollectors viewerId={user.id} />
    </main>
  )
}
