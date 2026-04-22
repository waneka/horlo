import { getCurrentUser } from '@/lib/auth'
import { getWatchesByUser } from '@/data/watches'
import { getWearRailForViewer } from '@/data/wearEvents'
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
  const [watches, railData] = await Promise.all([
    getWatchesByUser(user.id),
    getWearRailForViewer(user.id),
  ])
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
