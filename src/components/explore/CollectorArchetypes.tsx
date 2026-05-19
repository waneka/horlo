// src/components/explore/CollectorArchetypes.tsx
//
// Collector Archetypes chip rail — Phase 46 EXPL-05.
//
// 10 chips, one per primary_archetype, each with an editorial display name and
// a count badge. Links to /search prefiltered by archetype. Viewer-independent:
// no viewerId prop, no getCurrentUser() inside this component — count data is
// globally cached per the 'use cache' + cacheTag('explore', 'explore:archetypes')
// scope (RESEARCH Pitfall 2: getCurrentUser inside 'use cache' would break the
// shared cache contract).
//
// Returns null when counts array is empty (EXPL-02 null-hide guard). In practice,
// Phase 44 verified all 10 archetypes resolve to ≥1 result.
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

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold leading-tight text-foreground">
        Collector Archetypes
      </h2>
      <div className="flex flex-wrap gap-2">
        {ARCHETYPE_ORDER.map((value) => {
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
