import { getCurrentUser } from '@/lib/auth'
import { getWeekIndex } from '@/lib/weekIndex'
import { HeroModule } from '@/components/explore/HeroModule'
import { CollectorArchetypes } from '@/components/explore/CollectorArchetypes'
import { BrowseModule } from '@/components/explore/BrowseModule'
import { CuratedListsRail } from '@/components/explore/CuratedListsRail'
import { WhereCollectionsGo } from '@/components/explore/WhereCollectionsGo'

export const metadata = {
  title: 'Explore — Horlo',
}

/**
 * /explore — 5-module Server Component shell (Phase 46 EXPL-01 through EXPL-05).
 *
 * Auth: proxy.ts redirects unauthenticated viewers to /login before this page
 * renders. getCurrentUser() throws UnauthorizedError on the rare race; let it
 * propagate to the framework error UI (matches home-page convention).
 *
 * Module layout: stacked (mobile) → 2-column grid (desktop ≥768px).
 * Phase-47 slots (HeroModule, CuratedListsRail, WhereCollectionsGo) return null
 * in Phase 46 — EXPL-02: absent modules leave no empty container.
 *
 * Browse/Archetypes modules are viewer-independent; getCurrentUser() result is
 * NOT passed to them (RESEARCH Pitfall 2: per-viewer data must not enter
 * globally-shared 'use cache' scopes).
 */
export default async function ExplorePage() {
  // Auth assertion — must stay OUTSIDE any 'use cache' boundary.
  await getCurrentUser()

  // WR-02: compute the week index OUTSIDE the cached modules and pass it in,
  // so it becomes a cache-KEY input — the Hero and Where Collections Go
  // rotations advance deterministically on the 7-day boundary instead of
  // freezing whenever the cache entry was last populated.
  const weekIndex = getWeekIndex(new Date())

  return (
    <main className="container mx-auto px-4 md:px-8 py-8 max-w-6xl">
      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:gap-8">
        {/* Phase-47: Hero spans full width on desktop (EXPL-08 / UI-SPEC Discretion) */}
        <div className="md:col-span-2">
          <HeroModule weekIndex={weekIndex} />
        </div>
        {/* md:col-span-1 left — live in Phase 46 */}
        <CollectorArchetypes />
        {/* md:col-span-1 right — live in Phase 46 */}
        <BrowseModule />
        {/* Phase-47: CuratedListsRail is a horizontal-scroll rail — md:col-span-2
            so cards have room to scroll. md:col-span-1 cramped it on desktop. */}
        <div className="md:col-span-2">
          <CuratedListsRail />
        </div>
        {/* Phase-47: WhereCollectionsGo wired in Plan 03 (this plan).
            Promoted to md:col-span-2 in quick-260614-f82 so 5-node paths
            (seed + 4 follow-ons) render comfortably on desktop. PathCard
            nodes are flex-1 max-w-[208px]; col-span-1 cramps 5 nodes to
            ~77px each within the 2-col grid. */}
        <div className="md:col-span-2">
          <WhereCollectionsGo weekIndex={weekIndex} />
        </div>
      </div>
    </main>
  )
}
