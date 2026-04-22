'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SuggestedCollectorRow } from '@/components/home/SuggestedCollectorRow'
import { loadMoreSuggestions } from '@/app/actions/suggestions'
import type { SuggestedCollector } from '@/lib/discoveryTypes'
import type { SuggestionCursor } from '@/data/suggestions'

/**
 * LoadMoreSuggestionsButton — S-03 LOCKED "Load more" for Suggested
 * Collectors. Mirrors Plan 05's LoadMoreButton behavior so both Load More
 * surfaces on the home feel identical.
 *
 * State machine:
 *   idle → clicked → pending (disabled + spinner + aria-label
 *     "Loading more collectors")
 *     ├── success + nextCursor === null → append rows, setCursor(null) →
 *     │   button unmounts (no more pages)
 *     ├── success + nextCursor !== null → append rows, setCursor(new),
 *     │   back to idle
 *     └── failure                         → keep cursor, flip label to
 *         "Couldn't load more. Tap to retry."
 *   retry → clicked → clears error, re-enters pending
 *
 * Uses `useTransition` (not `useOptimistic`) because this component owns
 * compound state (cursor + appendedRows + error) that must roll back
 * atomically on failure.
 */
export function LoadMoreSuggestionsButton({
  initialCursor,
  viewerId,
}: {
  initialCursor: SuggestionCursor
  viewerId: string
}) {
  const [cursor, setCursor] = useState<SuggestionCursor | null>(initialCursor)
  const [appended, setAppended] = useState<SuggestedCollector[]>([])
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleClick = () => {
    if (!cursor) return
    setError(null)
    startTransition(async () => {
      const result = await loadMoreSuggestions({ cursor })
      if (!result.success) {
        setError(result.error)
        return
      }
      setAppended((prev) => [...prev, ...result.data.collectors])
      setCursor(result.data.nextCursor)
    })
  }

  const ariaLabel = pending
    ? 'Loading more collectors'
    : error
      ? 'Retry loading more collectors'
      : 'Load more'

  return (
    <>
      {appended.map((c) => (
        <SuggestedCollectorRow
          key={c.userId}
          collector={c}
          viewerId={viewerId}
        />
      ))}
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
