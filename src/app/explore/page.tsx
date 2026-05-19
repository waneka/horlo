import { getCurrentUser } from '@/lib/auth'
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

  return (
    <main className="container mx-auto px-4 md:px-8 py-8 max-w-6xl">
      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:gap-8">
        {/* Phase-47: Hero spans full width on desktop (EXPL-08 / UI-SPEC Discretion) */}
        <div className="md:col-span-2">
          <HeroModule />
        </div>
        {/* md:col-span-1 left — live in Phase 46 */}
        <CollectorArchetypes />
        {/* md:col-span-1 right — live in Phase 46 */}
        <BrowseModule />
        {/* Phase-47 slots: CuratedListsRail returns null until Plan 02 wires it */}
        <CuratedListsRail />
        {/* Phase-47: WhereCollectionsGo wired in Plan 03 (this plan) */}
        <WhereCollectionsGo />
      </div>
    </main>
  )
}
