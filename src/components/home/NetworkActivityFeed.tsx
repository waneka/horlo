import { getFeedForUser } from '@/data/activities'
import { aggregateFeed } from '@/lib/feedAggregate'
import { ActivityRow } from '@/components/home/ActivityRow'
import { AggregatedActivityRow } from '@/components/home/AggregatedActivityRow'
import { LoadMoreButton } from '@/components/home/LoadMoreButton'
import { FeedEmptyState } from '@/components/home/FeedEmptyState'

/**
 * NetworkActivityFeed — Server Component for the Network Activity section on
 * the home (`/`). Renders the first page of 20 rows (F-04 / FEED-03) through
 * the keyset-paginated DAL and runs the F-08 time-window aggregator before
 * handing off to pure-render children.
 *
 * Empty-state gate: rows.length === 0 AND nextCursor === null → FeedEmptyState.
 * A non-null cursor with zero rows on the first page should never happen in
 * practice (the DAL's limit+1 sentinel guarantees at least one row when a
 * next page exists), but the explicit gate keeps the contract unambiguous.
 *
 * LoadMoreButton is mounted ONLY when nextCursor !== null — F-04 says the
 * action exists for page 2+, so the first render should never display an
 * orphaned button on terminal pages.
 */
export async function NetworkActivityFeed({
  viewerId,
}: {
  viewerId: string
}) {
  const page = await getFeedForUser(viewerId, null, 20)
  const aggregated = aggregateFeed(page.rows)
  const isEmpty = aggregated.length === 0 && page.nextCursor === null

  return (
    <section id="network-activity" className="space-y-4">
      <h2 className="text-xl font-semibold leading-tight text-foreground">
        Network activity
      </h2>
      {isEmpty ? (
        <FeedEmptyState />
      ) : (
        <>
          <div className="space-y-2">
            {aggregated.map((row) =>
              row.kind === 'aggregated' ? (
                <AggregatedActivityRow
                  key={`agg-${row.userId}-${row.firstCreatedAt}`}
                  row={row}
                />
              ) : (
                <ActivityRow key={row.id} row={row} />
              ),
            )}
          </div>
          {page.nextCursor && (
            <LoadMoreButton initialCursor={page.nextCursor} />
          )}
        </>
      )}
    </section>
  )
}
