import { getCurrentUser } from '@/lib/auth'
import { getFollowerCounts } from '@/data/profiles'
import { getWearEventsCountByUser } from '@/data/wearEvents'
import { ExploreHero } from '@/components/explore/ExploreHero'
import { PopularCollectors } from '@/components/explore/PopularCollectors'
import { TrendingWatches } from '@/components/explore/TrendingWatches'
import { GainingTractionWatches } from '@/components/explore/GainingTractionWatches'

export const metadata = {
  title: 'Explore — Horlo',
}

/**
 * /explore — Server Component shell (DISC-03 / D-06 / D-07 / D-09).
 *
 * Composition mirrors src/app/page.tsx (home Promise.all + L-01 fixed order).
 *
 * Hero render gate (D-06): `followingCount < 3 && wearEventsCount < 1`. The
 * gate runs OUTSIDE any 'use cache' scope — per-viewer state must always win
 * (RESEARCH §Pattern 3). The two count fetches run in parallel.
 *
 * Rails always render (D-07). Each rail manages its own cache scope (Plan 02);
 * cache hit returns instantly, so no Suspense leaves are needed at the page
 * level (mirror src/app/page.tsx — no nested Suspense).
 *
 * Auth: src/proxy.ts redirects unauth viewers to /login before this page
 * renders. getCurrentUser() throws UnauthorizedError on the rare race; let it
 * propagate to the framework error UI (matches home-page convention).
 */
export default async function ExplorePage() {
  const user = await getCurrentUser()

  const [{ following: followingCount }, wearEventsCount] = await Promise.all([
    getFollowerCounts(user.id),
    getWearEventsCountByUser(user.id),
  ])

  const showHero = followingCount < 3 && wearEventsCount < 1

  return (
    <main className="container mx-auto px-4 md:px-8 py-8 space-y-8 md:space-y-12 max-w-6xl">
      {showHero && <ExploreHero />}
      <PopularCollectors viewerId={user.id} />
      <TrendingWatches />
      <GainingTractionWatches />
    </main>
  )
}
