import { cacheLife, cacheTag } from 'next/cache'
import Link from 'next/link'

import { getMostFollowedCollectors } from '@/data/discovery'
import { PopularCollectorRow } from '@/components/explore/PopularCollectorRow'

/**
 * PopularCollectors — most-followed public profiles rail (DISC-04 / D-11).
 *
 * CRITICAL (Pitfall 1): viewerId MUST be an explicit prop. Do NOT call
 * getCurrentUser() inside this cached scope — the cache key would omit the
 * viewer and leak state across users. Mirrors NotificationBell.tsx pattern.
 *
 * Cache profile: per-viewer 5min (UI-SPEC § Component Inventory). Fan-out
 * tag `explore` covers cross-cutting addWatch/follow invalidations from
 * Plan 05; per-viewer suffix targets just-followed-someone refresh.
 *
 * Empty-state policy (UI-SPEC § Empty States): hide-on-empty for non-
 * Gaining-Traction rails — return null so the page composer omits the
 * section entirely.
 */
export async function PopularCollectors({ viewerId }: { viewerId: string }) {
  'use cache'
  cacheTag('explore', `explore:popular-collectors:viewer:${viewerId}`)
  cacheLife({ revalidate: 300 })

  const collectors = await getMostFollowedCollectors(viewerId, { limit: 5 })
  if (collectors.length === 0) return null

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-tight text-foreground">
          Popular collectors
        </h2>
        <Link
          href="/explore/collectors"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          See all
        </Link>
      </header>
      <div className="space-y-2">
        {collectors.map((c) => (
          <PopularCollectorRow key={c.userId} collector={c} viewerId={viewerId} />
        ))}
      </div>
    </section>
  )
}
