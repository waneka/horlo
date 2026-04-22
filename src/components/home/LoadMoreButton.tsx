'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ActivityRow } from '@/components/home/ActivityRow'
import { AggregatedActivityRow } from '@/components/home/AggregatedActivityRow'
import { loadMoreFeed } from '@/app/actions/feed'
import type { FeedCursor, FeedRow } from '@/lib/feedTypes'

/**
 * LoadMoreButton — F-04 keyset pagination on the client.
 *
 * State machine:
 *   idle → clicked → pending (disabled + spinner + sr-only "Loading more activity")
 *        ├── success + nextCursor === null → append rows, setCursor(null) → button unmounts
 *        ├── success + nextCursor !== null → append rows, setCursor(new), back to idle
 *        └── failure                         → keep cursor, flip label to retry copy
 *   retry → clicked again → clears error, re-enters pending
 *
 * Uses useTransition (not useOptimistic): this component owns compound state
 * (cursor + appendedRows + error) that must roll back atomically on failure.
 * Mirrors the FollowButton pattern from Phase 9 (D-06 reference).
 *
 * T-10-05-03 (DoS via spam-click): `disabled={pending}` blocks duplicate
 * in-flight calls. T-10-05-01 (cursor tampering): the Server Action re-validates
 * cursor shape via Zod; no client-side enforcement needed here.
 */
export function LoadMoreButton({
  initialCursor,
}: {
  initialCursor: FeedCursor
}) {
  const [cursor, setCursor] = useState<FeedCursor | null>(initialCursor)
  const [appendedRows, setAppendedRows] = useState<FeedRow[]>([])
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleClick = () => {
    if (!cursor) return
    setError(null)
    startTransition(async () => {
      const result = await loadMoreFeed({ cursor })
      if (!result.success) {
        setError(result.error)
        return
      }
      setAppendedRows((prev) => [...prev, ...result.data.rows])
      setCursor(result.data.nextCursor)
    })
  }

  const ariaLabel = pending
    ? 'Loading more activity'
    : error
      ? 'Retry loading more activity'
      : 'Load more'

  return (
    <>
      {appendedRows.map((row) =>
        row.kind === 'aggregated' ? (
          <AggregatedActivityRow
            key={`agg-${row.userId}-${row.firstCreatedAt}`}
            row={row}
          />
        ) : (
          <ActivityRow key={row.id} row={row} />
        ),
      )}
      {cursor !== null && (
        <div className="pt-4 flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={handleClick}
            aria-label={ariaLabel}
          >
            {pending && (
              <Loader2
                className="size-4 animate-spin text-accent mr-2"
                aria-hidden
              />
            )}
            {error ? "Couldn't load more. Tap to retry." : 'Load more'}
          </Button>
        </div>
      )}
    </>
  )
}
