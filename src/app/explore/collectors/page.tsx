import { getCurrentUser } from '@/lib/auth'
import { getMostFollowedCollectors } from '@/data/discovery'
import { PopularCollectorRow } from '@/components/explore/PopularCollectorRow'

export const metadata = {
  title: 'Popular collectors — Horlo',
}

/**
 * /explore/collectors — See-all overflow surface (DISC-07).
 *
 * LIMIT 50 cap, no pagination (D-10 + PROJECT MVP constraint). Auth-gated
 * by src/proxy.ts (NOT in PUBLIC_PATHS).
 *
 * Empty + cap-reached copy locked by 18-UI-SPEC.md § Empty / partial-data states.
 */
export default async function CollectorsSeeAllPage() {
  const user = await getCurrentUser()
  const collectors = await getMostFollowedCollectors(user.id, { limit: 50 })
  const atCap = collectors.length === 50

  return (
    <main className="container mx-auto px-4 md:px-8 py-8 space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold leading-tight text-foreground">
        Popular collectors
      </h1>
      {collectors.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <p className="text-base font-semibold">No collectors to suggest right now.</p>
          <p className="text-sm text-muted-foreground">Check back as more collectors join Horlo.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {collectors.map((c) => (
              <PopularCollectorRow key={c.userId} collector={c} viewerId={user.id} />
            ))}
          </div>
          {atCap && (
            <p className="text-sm text-muted-foreground text-center pt-4">
              Showing top 50 collectors.
            </p>
          )}
        </>
      )}
    </main>
  )
}
