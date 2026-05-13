import { DiscoveryWatchCard } from '@/components/explore/DiscoveryWatchCard'
import { Badge } from '@/components/ui/badge'
import type { LineageRow } from '@/data/hierarchy'

/**
 * Phase 39b NSV-16 — Lineage rail (D-39b-16).
 *
 * Pure Server Component. Renders a horizontal-scroll DiscoveryWatchCard rail
 * of lineage neighbors (predecessor / successor / remake / tribute / homage)
 * for the input catalogId, sourced from watch_lineage_edges via
 * getLineageForReference.
 *
 * D-39b-16 relationship_type → display label map:
 *   predecessor → "Predecessor"
 *   successor   → "Successor"
 *   remake      → "Modern remake"
 *   tribute     → "Tribute to"
 *   homage      → "Homage to"
 * Each card carries a <Badge variant="outline">{label}</Badge> sublabel.
 * Unknown relationship_type values fall through to the raw string (auto-escaped
 * React text node — no XSS surface per threat register).
 *
 * Layout matches SameFamilyRail; cap 6 cards per D-39b-17.
 * Hide-if-empty per D-39b-07 — when rows.length === 0, returns null.
 */

// D-39b-16 — relationship_type → human-readable label map
const RELATIONSHIP_LABELS: Record<string, string> = {
  predecessor: 'Predecessor',
  successor: 'Successor',
  remake: 'Modern remake',
  tribute: 'Tribute to',
  homage: 'Homage to',
}

interface LineageRailProps {
  rows: LineageRow[]
}

export function LineageRail({ rows }: LineageRailProps) {
  if (rows.length === 0) return null  // D-39b-07 hide-if-empty
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-tight text-foreground">
          Lineage
        </h2>
      </header>
      <div className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2">
        {rows.slice(0, 6).map((r) => {  // D-39b-17 cap 6
          const label = RELATIONSHIP_LABELS[r.relationship_type] ?? r.relationship_type
          return (
            <div key={r.id} className="snap-start">
              <DiscoveryWatchCard
                watch={{ id: r.id, brand: r.brand, model: r.model, imageUrl: r.imageUrl }}
                sublabel={<Badge variant="outline">{label}</Badge>}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
