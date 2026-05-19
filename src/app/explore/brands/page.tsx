// src/app/explore/brands/page.tsx
//
// /explore/brands — Brands index page with A–Z jump navigation (EXPL-03, EXPL-04, D-07).
//
// Auth: getCurrentUser() is called as an auth assertion only. The returned user.id
// is NOT passed to the Browse DAL (viewer-independent catalog data). proxy.ts already
// redirects unauthenticated requests before this page renders.
//
// Page is uncached at the page level (getCurrentUser() must stay outside any
// 'use cache' boundary per RESEARCH Pitfall 2). Counts are fetched via
// getBrowseBrandCounts() which has its own 'use cache' scope.

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getCurrentUser } from '@/lib/auth'
import { getBrowseBrandCounts } from '@/data/browse'

export const metadata = {
  title: 'Brands — Horlo',
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export default async function BrandsPage() {
  // Auth assertion — must stay OUTSIDE any 'use cache' boundary.
  await getCurrentUser()

  const brands = await getBrowseBrandCounts()

  // Group brands by first letter (A–Z). Brands are already sorted A–Z by
  // name_normalized from the DAL, so we preserve that order.
  const byLetter = new Map<string, typeof brands>()
  for (const brand of brands) {
    const letter = brand.name[0]?.toUpperCase() ?? '#'
    if (!byLetter.has(letter)) byLetter.set(letter, [])
    byLetter.get(letter)!.push(brand)
  }

  const hasBrands = brands.length > 0

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
        Brands
      </h1>

      {!hasBrands ? (
        <div className="py-8 text-center space-y-2">
          <p className="text-base font-semibold text-foreground">No brands yet</p>
          <p className="text-sm text-muted-foreground">
            Check back after the catalog is expanded.
          </p>
        </div>
      ) : (
        <>
          {/* A–Z sticky jump navigation (D-07, EXPL-04) */}
          <nav
            aria-label="Jump to letter"
            className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border py-2 mb-4"
          >
            <div className="flex gap-1 overflow-x-auto scrollbar-none">
              {ALPHABET.map((letter) => {
                const hasContent = byLetter.has(letter)
                return (
                  <a
                    key={letter}
                    href={hasContent ? `#letter-${letter}` : undefined}
                    className={[
                      'text-xs font-semibold px-2 py-1 rounded transition-colors shrink-0 min-w-[28px] text-center',
                      hasContent
                        ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        : 'opacity-30 pointer-events-none text-muted-foreground',
                    ].join(' ')}
                  >
                    {letter}
                  </a>
                )
              })}
            </div>
          </nav>

          {/* Letter sections */}
          <div className="space-y-6">
            {ALPHABET.filter((l) => byLetter.has(l)).map((letter) => {
              const letterBrands = byLetter.get(letter)!
              return (
                <section
                  key={letter}
                  id={`letter-${letter}`}
                  className="scroll-mt-12 space-y-1"
                >
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide py-2 border-b border-border">
                    {letter}
                  </h2>
                  {letterBrands.map((brand) => (
                    <Link
                      key={brand.brandId}
                      href={`/search?tab=watches&brand=${brand.slug}`}
                    >
                      <div className="flex items-center justify-between py-3 px-1 hover:bg-muted rounded-md transition-colors">
                        <span className="text-sm text-foreground">{brand.name}</span>
                        <span className="text-xs text-muted-foreground">{brand.count}</span>
                      </div>
                    </Link>
                  ))}
                </section>
              )
            })}
          </div>
        </>
      )}
    </main>
  )
}
