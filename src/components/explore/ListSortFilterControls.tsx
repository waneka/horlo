'use client'

// src/components/explore/ListSortFilterControls.tsx
// Phase 47 Plan 02 — Client-side sort controls for /explore/lists (D-04).
//
// Renders a sort select ("Newest" / "Most watches") above a responsive grid of
// RailListCard elements. Sort state is local — no URL params, no Zustand store.
// (Claude's Discretion resolved in UI-SPEC: local state avoids full page re-nav
//  per RESEARCH Pitfall 7.)
//
// Receives list data from the Server Component parent (/explore/lists/page.tsx)
// and re-sorts in the browser on each sort change — no server round-trip.
//
// RailListCard is a pure Server Component (no server-only imports) so it can be
// imported and rendered inside this client component.

import { useState, useMemo } from 'react'

import { RailListCard } from '@/components/explore/RailListCard'

type SortKey = 'newest' | 'most-watches'

interface ListWithCount {
  id: string
  title: string
  curatorName: string
  coverUrl: string | null
  publishedAt: Date | null
  itemCount: number
}

export function ListSortFilterControls({ lists }: { lists: ListWithCount[] }) {
  const [sort, setSort] = useState<SortKey>('newest')

  const sorted = useMemo(() => {
    if (sort === 'newest') {
      // Sort by publishedAt desc; nulls last
      return [...lists].sort((a, b) => {
        if (!a.publishedAt && !b.publishedAt) return 0
        if (!a.publishedAt) return 1
        if (!b.publishedAt) return -1
        return b.publishedAt.getTime() - a.publishedAt.getTime()
      })
    }
    // 'most-watches': sort by itemCount desc
    return [...lists].sort((a, b) => b.itemCount - a.itemCount)
  }, [lists, sort])

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Sort by:</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="text-sm rounded-md border border-border bg-background px-3 py-1.5"
        >
          <option value="newest">Newest</option>
          <option value="most-watches">Most watches</option>
        </select>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
        {sorted.map((list) => (
          <RailListCard key={list.id} list={list} watchCount={list.itemCount} />
        ))}
      </div>
    </>
  )
}
