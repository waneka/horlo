// src/components/explore/CollectorArchetypes.tsx
//
// Collector Archetypes chip rail — Phase 46 EXPL-05.
//
// Renders one chip per primary_archetype that has ≥1 catalog watch. Zero-count
// archetypes are hidden per EXPL-02 (absent-not-empty): tool/hybrid currently
// have thin/no catalog coverage — a v5.2 catalog-expansion data gap, not a
// code bug. They reappear automatically when v5.2 adds more catalog watches.
// Viewer-independent: no viewerId prop, no getCurrentUser() inside this component
// — count data is globally cached per the 'use cache' +
// cacheTag('explore', 'explore:archetypes') scope (RESEARCH Pitfall 2).
//
// Returns null when counts array is empty OR when no archetype has ≥1 watch
// (EXPL-02 null-hide guard).
//
// Pattern: TrendingWatches 'use cache' + null-hide + section/h2 skeleton.

import { cacheLife, cacheTag } from 'next/cache'
import Link from 'next/link'

import { getBrowseArchetypeCounts } from '@/data/browse'
import { ARCHETYPE_CONFIG } from '@/lib/archetype-config'
import type { PrimaryArchetype } from '@/lib/types'
import { Badge } from '@/components/ui/badge'

// ARCHETYPE_CONFIG insertion order is the canonical display order (D-15).
const ARCHETYPE_ORDER = Object.keys(ARCHETYPE_CONFIG) as PrimaryArchetype[]

interface Props {
  // Optional: inject counts for testing without a DB connection.
  // When omitted, counts are fetched via getBrowseArchetypeCounts().
  counts?: Array<{ archetype: string; count: number }>
}

export async function CollectorArchetypes({ counts: propCounts }: Props = {}) {
  'use cache'
  cacheTag('explore', 'explore:archetypes')
  cacheLife('hours')

  const counts = propCounts ?? (await getBrowseArchetypeCounts())
  if (counts.length === 0) return null

  // Build a count lookup map; absent archetypes get 0 (D-15).
  const countMap = new Map(counts.map((row) => [row.archetype, row.count]))

  // Filter to archetypes with ≥1 watch (EXPL-02: hide zero-count archetypes).
  const visibleArchetypes = ARCHETYPE_ORDER.filter(
    (value) => (countMap.get(value) ?? 0) >= 1,
  )

  // If no archetype has coverage, hide the whole rail (EXPL-02 absent-not-empty).
  if (visibleArchetypes.length === 0) return null

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold leading-tight text-foreground">
          Collector Archetypes
        </h2>
        <p className="text-sm text-muted-foreground">
          Browse the catalog by the kind of collector each watch speaks to.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {visibleArchetypes.map((value) => {
          const config = ARCHETYPE_CONFIG[value]
          const count = countMap.get(value) ?? 0
          return (
            <Link
              key={value}
              href={`/search?tab=watches&archetype=${value}`}
            >
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary min-h-[44px] py-2.5 px-4 text-sm font-semibold text-secondary-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              >
                <span>{config.displayName}</span>
                <Badge variant="secondary" className="text-xs font-normal">
                  {count}
                </Badge>
              </button>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
