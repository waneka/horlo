// src/app/explore/genres/page.tsx
//
// /explore/genres — Genres index page (EXPL-03, D-17).
//
// Plain utility list: 10 rows (one per primary_archetype value), showing genre
// display name and watch count. Deep-links to /search?tab=watches&genre={value}.
//
// Intentionally titled "Genres" (NOT "Archetypes") and uses plain utility labels
// (e.g. "Dive", not "Dive Watch Devotee") — editorial distinction from the
// Collector Archetypes chip rail on /explore (D-17).
//
// Auth: getCurrentUser() as auth assertion only; not passed to Browse DAL.

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getCurrentUser } from '@/lib/auth'
import { getBrowseGenreCounts } from '@/data/browse'

export const metadata = {
  title: 'Genres — Horlo',
}

// Genre display names — plain utility labels, not identity copy (D-17).
// UI-SPEC § "Genre display names": GMT stays uppercase; others title-case.
const GENRE_DISPLAY_NAMES: Record<string, string> = {
  dress: 'Dress',
  dive: 'Dive',
  field: 'Field',
  pilot: 'Pilot',
  chrono: 'Chrono',
  gmt: 'GMT',
  racing: 'Racing',
  sport: 'Sport',
  tool: 'Tool',
  hybrid: 'Hybrid',
}

export default async function GenresPage() {
  // Auth assertion — must stay OUTSIDE any 'use cache' boundary.
  await getCurrentUser()

  const genres = await getBrowseGenreCounts()
  const hasGenres = genres.length > 0

  return (
    <main className="container mx-auto px-4 md:px-8 py-8 max-w-2xl">
      {/* Back link */}
      <Link
        href="/explore"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Explore
      </Link>

      <h1 className="text-xl font-semibold leading-tight text-foreground mt-2 mb-6">
        Genres
      </h1>

      {!hasGenres ? (
        <div className="py-8 text-center space-y-2">
          <p className="text-base font-semibold text-foreground">No genres yet</p>
          <p className="text-sm text-muted-foreground">
            Catalog enrichment adds genre data automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {genres.map((row) => {
            const displayName = GENRE_DISPLAY_NAMES[row.genre] ?? row.genre
            return (
              <Link
                key={row.genre}
                href={`/search?tab=watches&genre=${row.genre}`}
              >
                <div className="flex items-center justify-between py-3 px-1 hover:bg-muted rounded-md transition-colors">
                  <span className="text-sm text-foreground">{displayName}</span>
                  <span className="text-xs text-muted-foreground">{row.count}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
