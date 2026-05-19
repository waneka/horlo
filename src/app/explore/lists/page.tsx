// src/app/explore/lists/page.tsx
// Phase 47 Plan 02 — /explore/lists see-all page (D-04).
//
// Renders every published curated list in a responsive grid with client-side
// sort/filter controls (Newest / Most watches).
//
// Auth: getCurrentUser() is the FIRST statement in the page body, called outside
// any 'use cache' boundary (per RESEARCH Pattern 7, Pitfall 1).
// proxy.ts already redirects unauthenticated requests.

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getCurrentUser } from '@/lib/auth'
import { getPublishedLists, getListItemCount } from '@/data/curatedLists'
import { ListSortFilterControls } from '@/components/explore/ListSortFilterControls'

export const metadata = {
  title: 'Curated Lists — Horlo',
}

export default async function CuratedListsPage() {
  // Auth assertion — must stay OUTSIDE any 'use cache' boundary.
  await getCurrentUser()

  // Fetch all published lists (capped at 100 — acceptable at current scale, T-47-09)
  const lists = await getPublishedLists(100)

  // Fetch item counts for each list concurrently
  const listsWithCounts = await Promise.all(
    lists.map(async (list) => ({
      ...list,
      itemCount: await getListItemCount(list.id),
    }))
  )

  return (
    <main className="container mx-auto px-4 md:px-8 py-8 max-w-6xl">
      {/* Back link */}
      <Link
        href="/explore"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Explore
      </Link>

      <h1 className="text-2xl font-semibold text-foreground mt-4 mb-6">
        Curated Lists
      </h1>

      {/* Client component: sort select + responsive grid */}
      <ListSortFilterControls lists={listsWithCounts} />
    </main>
  )
}
