import { cacheLife } from 'next/cache'

import { getRecommendationsForViewer } from '@/data/recommendations'
import { RecommendationCard } from '@/components/home/RecommendationCard'

/**
 * CollectorsLikeYou — "From collectors like you" home section (C-01..C-07).
 *
 * CRITICAL (Pitfall 7 / T-10-07-01): viewerId MUST flow as a function
 * argument. Do NOT resolve the viewer identity inside this cached scope —
 * that would produce a cache key that omits the viewer, causing cross-user
 * rec leakage. The parent Server Component (src/app/page.tsx in Plan
 * 10-08) resolves the viewer via the auth layer and passes it down as a
 * prop so Next.js serializes it into the cache key.
 *
 * Cache profile: 'minutes' (5min stale / 1min revalidate / 1hr expire).
 * Balances freshness against the per-request tasteOverlap cost.
 *
 * Empty-recs fallback (C-02): when the DAL returns zero recs the component
 * renders `null`, hiding the section entirely. The home layout is a
 * vertical space-y-8 stack, so a null section collapses cleanly.
 */
export async function CollectorsLikeYou({ viewerId }: { viewerId: string }) {
  'use cache'
  cacheLife('minutes')

  const recs = await getRecommendationsForViewer(viewerId)
  if (recs.length === 0) return null

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold leading-tight text-foreground">
        From collectors like you
      </h2>
      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2">
        {recs.map((rec) => (
          <RecommendationCard key={rec.representativeWatchId} rec={rec} />
        ))}
      </div>
    </section>
  )
}
