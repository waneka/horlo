// src/components/explore/CuratedListsRail.tsx
// Phase 47 Plan 02 — Curated Lists Rail (EXPL-06).
//
// Horizontally-scrollable rail of up to 12 published curated lists.
// Each card shows cover, title, curator name, watch count, and freshness indicator (D-01).
// "View all" link leads to /explore/lists (D-04).
//
// Viewer-independent: globally cached 'use cache' scope tagged 'explore:lists'.
// Per EXPL-02: returns null (not an empty container) when no published lists exist.
//
// Do NOT call getCurrentUser() here — auth is asserted in src/app/explore/page.tsx.
// Per RESEARCH Pitfall 1: calling getCurrentUser() inside 'use cache' would poison
// the globally-shared cache entry with the first viewer's identity.
//
// Pattern: CollectorArchetypes 'use cache' + null-hide + section/h2 + "View all" link.

import { cacheLife, cacheTag } from 'next/cache'
import Link from 'next/link'

import { getPublishedLists, getListItemCount } from '@/data/curatedLists'
import { RailListCard } from '@/components/explore/RailListCard'

export async function CuratedListsRail() {
  'use cache'
  // CR-01: tag is 'explore:lists' ONLY. The former 'explore' umbrella tag was
  // never fired by any CMS Server Action — it implied invalidation coverage
  // that did not exist. Every list mutation (publish/unpublish/update/delete/
  // reorder/item-change) now fires revalidateTag('explore:lists', 'max').
  cacheTag('explore:lists')
  cacheLife('hours')

  const lists = await getPublishedLists(12)
  if (lists.length === 0) return null // EXPL-02: absent-not-empty

  // Fetch watch counts for each card concurrently (N+1 is acceptable for ≤12 lists)
  const listsWithCounts = await Promise.all(
    lists.map(async (list) => ({
      list,
      watchCount: await getListItemCount(list.id),
    }))
  )

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-tight text-foreground">
          Curated Lists
        </h2>
        <Link
          href="/explore/lists"
          className="text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          View all
        </Link>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scroll-smooth">
        {listsWithCounts.map(({ list, watchCount }) => (
          <RailListCard key={list.id} list={list} watchCount={watchCount} />
        ))}
      </div>
    </section>
  )
}
