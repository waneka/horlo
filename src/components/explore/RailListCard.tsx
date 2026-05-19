// src/components/explore/RailListCard.tsx
// Phase 47 Plan 02 — Rail card for CuratedListsRail (EXPL-06, D-01).
//
// Renders a single curated list card with:
//   - Cover image (aspect-square, object-cover CSS chain per UI-SPEC)
//   - "New" badge when publishedAt is within 7 days (accent color per UI-SPEC)
//   - Title, curator name, watch count, relative timestamp metadata
//
// Pattern: DiscoveryWatchCard (same image CSS chain — verified working).
// Sub-component: consumed only by CuratedListsRail.

import Link from 'next/link'

// WR-06: getRelativeTimestamp and isNew are now a single shared definition in
// src/lib/relativeTime.ts (were copy-pasted verbatim here and in the list
// detail page). See that module for the cache-granularity caveat — this card
// renders inside CuratedListsRail's 'use cache' scope, so the default `now`
// reference is frozen to hours-level accuracy (accepted for v1).
import { getRelativeTimestamp, isNew } from '@/lib/relativeTime'

interface RailListCardList {
  id: string
  title: string
  curatorName: string
  coverUrl: string | null
  publishedAt: Date | null
}

export function RailListCard({
  list,
  watchCount,
}: {
  list: RailListCardList
  watchCount: number
}) {
  const newBadge = isNew(list.publishedAt)
  const timestamp = getRelativeTimestamp(list.publishedAt)

  return (
    <Link
      href={`/explore/lists/${list.id}`}
      className="block w-44 md:w-52 shrink-0 space-y-2"
    >
      {/* Cover image — UI-SPEC CSS Chain: aspect-square + overflow-hidden + w-full h-full object-cover */}
      <div className="aspect-square rounded-md bg-muted overflow-hidden relative">
        {/* Only render img when coverUrl is non-null — empty src triggers a full page re-download (Wave 2 fix) */}
        {list.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={list.coverUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
        {/* "New" badge — accent color; absolutely positioned top-left (D-01) */}
        {newBadge && (
          <span className="absolute top-2 left-2 rounded-full bg-accent text-accent-foreground text-xs font-semibold px-2 py-0.5">
            New
          </span>
        )}
      </div>

      {/* Metadata */}
      <div>
        <p className="text-sm font-semibold text-foreground truncate">{list.title}</p>
        <p className="text-sm text-muted-foreground truncate">{list.curatorName}</p>
        <p className="text-sm text-muted-foreground">{watchCount} watches</p>
        {timestamp && (
          <p className="text-sm text-muted-foreground">{timestamp}</p>
        )}
      </div>
    </Link>
  )
}
