// src/app/explore/eras/page.tsx
//
// /explore/eras — Eras index page (EXPL-03, D-18).
//
// 3 rows (vintage-leaning / modern / contemporary), plain list with counts.
// Deep-links to /search?tab=watches&era={value}.
//
// Auth: getCurrentUser() as auth assertion only; not passed to Browse DAL.

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getCurrentUser } from '@/lib/auth'
import { getBrowseEraCounts } from '@/data/browse'

export const metadata = {
  title: 'Eras — Horlo',
}

// Era display name mapping (UI-SPEC § "Era display names").
const ERA_DISPLAY_NAMES: Record<string, string> = {
  'vintage-leaning': 'Vintage Leaning',
  modern: 'Modern',
  contemporary: 'Contemporary',
}

export default async function ErasPage() {
  // Auth assertion — must stay OUTSIDE any 'use cache' boundary.
  await getCurrentUser()

  const eras = await getBrowseEraCounts()
  const hasEras = eras.length > 0

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
        Eras
      </h1>

      {!hasEras ? (
        <div className="py-8 text-center space-y-2">
          <p className="text-base font-semibold text-foreground">No eras yet</p>
          <p className="text-sm text-muted-foreground">
            Catalog enrichment adds era data automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {eras.map((row) => {
            const displayName = ERA_DISPLAY_NAMES[row.era] ?? row.era
            return (
              <Link
                key={row.era}
                href={`/search?tab=watches&era=${row.era}`}
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
