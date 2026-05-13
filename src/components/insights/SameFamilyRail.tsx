import { DiscoveryWatchCard } from '@/components/explore/DiscoveryWatchCard'
import type { SameFamilyWatch } from '@/data/hierarchy'

/**
 * Phase 39b NSV-02 — Same family rail (D-39b-15).
 *
 * Pure Server Component. Renders a horizontal-scroll DiscoveryWatchCard rail
 * of siblings of the input catalogId's family, ranked by live owners count.
 *
 * Layout:
 * - Header copy: "Same family" (UI-SPEC §Copywriting Contract)
 * - Typography: text-xl font-semibold (UI-SPEC drafted a lighter weight, but
 *   tests/no-raw-palette.test.ts forbids that weight — auto-fix applies the
 *   same Rule 1 flip as 39b-02 c205617 / 39b-03 049b3f4)
 * - Scroll container: matches TrendingWatches.tsx scroll vocab verbatim
 *   (UI-SPEC §Rail layout / §Spacing exception)
 * - Card sublabel: "1 collector" (singular) / "{N} collectors" (plural)
 *
 * Hide-if-empty per D-39b-07 — when rows.length === 0, returns null and
 * the section is entirely absent from the DOM.
 *
 * D-39b-17: caller is expected to cap rows at 6 via getSameFamilyForCatalog
 * default LIMIT; "See all in family" link deferred to v5.x (TODO below).
 */
interface SameFamilyRailProps {
  rows: SameFamilyWatch[]
}

export function SameFamilyRail({ rows }: SameFamilyRailProps) {
  if (rows.length === 0) return null  // D-39b-07 hide-if-empty
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-tight text-foreground">
          Same family
        </h2>
        {/* TODO v5.x: "See all in family" link → /catalog?family={familyId} (D-39b-17 deferred) */}
      </header>
      <div className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2">
        {rows.map((w) => {
          const sublabel = w.ownersCount === 1 ? '1 collector' : `${w.ownersCount} collectors`
          return (
            <div key={w.id} className="snap-start">
              <DiscoveryWatchCard
                watch={{ id: w.id, brand: w.brand, model: w.model, imageUrl: w.imageUrl }}
                sublabel={sublabel}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
