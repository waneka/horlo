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

interface RailListCardList {
  id: string
  title: string
  curatorName: string
  coverUrl: string | null
  publishedAt: Date | null
}

// Relative timestamp via Intl.RelativeTimeFormat — "today", "3 days ago", etc.
// Returns empty string when publishedAt is null.
function getRelativeTimestamp(publishedAt: Date | null): string {
  if (!publishedAt) return ''
  const diffMs = Date.now() - publishedAt.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (diffDays < 1) return 'Today'
  if (diffDays < 7) return rtf.format(-diffDays, 'day')
  if (diffDays < 30) return rtf.format(-Math.floor(diffDays / 7), 'week')
  return rtf.format(-Math.floor(diffDays / 30), 'month')
}

// D-01: "New" badge window = 7 days (Claude's Discretion, resolved in UI-SPEC).
function isNew(publishedAt: Date | null): boolean {
  if (!publishedAt) return false
  return Date.now() - publishedAt.getTime() < 7 * 24 * 60 * 60 * 1000
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
