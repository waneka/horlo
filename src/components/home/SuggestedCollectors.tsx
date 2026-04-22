import { getSuggestedCollectors } from '@/data/suggestions'
import { SuggestedCollectorRow } from '@/components/home/SuggestedCollectorRow'
import { LoadMoreSuggestionsButton } from '@/components/home/LoadMoreSuggestionsButton'

/**
 * SuggestedCollectors — "Collectors to follow" home section
 * (CONTEXT.md S-01..S-04).
 *
 * Server Component: awaits `getSuggestedCollectors(viewerId, { limit: 5 })`
 * and renders the initial page + a LoadMoreSuggestionsButton when the DAL
 * returns a non-null `nextCursor` (S-03 LOCKED — Load More REVEALS more
 * rows, it does not replace).
 *
 * The outer section carries `id="suggested-collectors"` so the Plan 05
 * FeedEmptyState CTA anchor (`<a href="#suggested-collectors">`) scrolls
 * here when the feed is quiet.
 *
 * Empty state copy per UI-SPEC § Empty States:
 *   heading: "You're already following everyone we can suggest"
 *   body:    "Check back as more collectors join."
 *
 * Private profiles are never reachable — the DAL enforces
 * `eq(profileSettings.profilePublic, true)` (T-10-04-02).
 */
export async function SuggestedCollectors({
  viewerId,
}: {
  viewerId: string
}) {
  const { collectors, nextCursor } = await getSuggestedCollectors(viewerId, {
    limit: 5,
  })

  if (collectors.length === 0) {
    return (
      <section id="suggested-collectors" className="space-y-4">
        <h2 className="text-xl font-semibold leading-tight text-foreground">Collectors to follow</h2>
        <div className="py-8 text-center space-y-2">
          <p className="text-base font-semibold">
            You&apos;re already following everyone we can suggest
          </p>
          <p className="text-sm text-muted-foreground">
            Check back as more collectors join.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section id="suggested-collectors" className="space-y-4">
      <h2 className="text-xl font-semibold leading-tight text-foreground">Collectors to follow</h2>
      <div className="space-y-2">
        {collectors.map((c) => (
          <SuggestedCollectorRow
            key={c.userId}
            collector={c}
            viewerId={viewerId}
          />
        ))}
      </div>
      {nextCursor && (
        <LoadMoreSuggestionsButton
          initialCursor={nextCursor}
          viewerId={viewerId}
        />
      )}
    </section>
  )
}
