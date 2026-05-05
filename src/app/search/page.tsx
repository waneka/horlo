import { Suspense } from 'react'

import { getCurrentUser } from '@/lib/auth'
import { getSuggestedCollectors } from '@/data/suggestions'
import { getWatchesByUser } from '@/data/watches'
import { getProfileById } from '@/data/profiles'
import { SuggestedCollectorRow } from '@/components/home/SuggestedCollectorRow'
import { SearchPageClient } from '@/components/search/SearchPageClient'

/**
 * Phase 16 /search route (SRCH-01..SRCH-07).
 *
 * Server Component wrapper that:
 *   1. Resolves viewerId via getCurrentUser() (proxy.ts redirects unauth
 *      users to /login before reaching here — auth gate already in place
 *      from Phase 14 D-21/D-22).
 *   2. Renders SuggestedCollectorsForSearch as a Server Component child
 *      passed via the `children` prop into <SearchPageClient> (D-29).
 *      The Client Component decides WHEN to show the children
 *      (pre-query state — D-11; no-results state — D-10).
 *   3. Wraps the Client Component in <Suspense> so useSearchParams() does
 *      not cause prerender bailout (Pitfall 4 — verified in Next 16 docs).
 *
 * Per Open Question 3 in research, the suggested-collectors block on
 * /search renders a fixed limit of 8 with NO LoadMore button — the empty
 * state should feel light, not feed-like. (SuggestedCollectors home
 * component renders limit 5 + LoadMore; we deliberately fork here.)
 */
export default async function SearchPage() {
  const user = await getCurrentUser()
  // Plan 20 D-06: viewer collection length is the cache-invalidation key for
  // the verdict cache in WatchSearchRowsAccordion. Coarse signal — when viewer
  // adds/removes a watch the count changes, dropping all cached verdicts.
  // Trade-off: edits that don't change count won't auto-invalidate; user can
  // navigate away and back to refresh (acceptable at v4.0 scale).
  // Phase 28 D-02 / UX-09 — viewer username for inline Wishlist commit toast
  // destination. Resolved server-side here; threaded through SearchPageClient
  // to WatchSearchRowsAccordion as a typed `viewerUsername: string | null`
  // prop. Null is a soft alarm — at v4.0+ every authenticated user has a
  // username via signup trigger, so the action slot fallback rarely fires.
  // Folded into Promise.all to keep the fetch parallel with getWatchesByUser.
  const [viewerCollection, viewerProfile] = await Promise.all([
    getWatchesByUser(user.id),
    getProfileById(user.id),
  ])
  const viewerUsername = viewerProfile?.username ?? null
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-3xl px-4 py-8" />}>
      <SearchPageClient
        viewerId={user.id}
        collectionRevision={viewerCollection.length}
        viewerUsername={viewerUsername}
      >
        {/* D-29 Server Component child — renders inside Client Component's
            pre-query (D-11) and no-results (D-10) states. */}
        <SuggestedCollectorsForSearch viewerId={user.id} />
      </SearchPageClient>
    </Suspense>
  )
}

/**
 * Server Component variant of SuggestedCollectors specifically for /search:
 *   - Fixed limit of 8 (vs home's 5 + Load More — Open Question 3 resolution)
 *   - NO Load-More button (Open Question 3)
 *   - Same DAL (getSuggestedCollectors) so the home and search empty states
 *     stay visually consistent
 */
async function SuggestedCollectorsForSearch({ viewerId }: { viewerId: string }) {
  const { collectors } = await getSuggestedCollectors(viewerId, { limit: 8 })

  if (collectors.length === 0) {
    return (
      <div className="py-8 text-center space-y-2">
        <p className="text-base font-semibold">
          You&apos;re already following everyone we can suggest
        </p>
        <p className="text-sm text-muted-foreground">
          Check back as more collectors join.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {collectors.map((c) => (
        <SuggestedCollectorRow key={c.userId} collector={c} viewerId={viewerId} />
      ))}
    </div>
  )
}
