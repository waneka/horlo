'use client'

import { useState } from 'react'
import type { VerdictBundle } from '@/lib/verdict/types'

/**
 * Phase 20 D-06: per-mount verdict cache for the FIT-04 search-row inline expand.
 *
 * Keyed by viewer's collection-revision. The revision is passed as a prop from
 * the server (Plan 05 wires src/app/search/page.tsx to pass viewer.collection.length).
 * When the revision changes (viewer added/removed/edited a watch and the page
 * re-rendered), the cache is replaced with an empty Map. Cache only persists
 * across renders WITHIN the same revision — and across navigation away/back, the
 * SearchPageClient unmounts and the cache is fresh anyway.
 *
 * Why a snapshot integer instead of a fancier counter: the server page has the
 * truth; client-side only-cares-about-changed (not the absolute value).
 *
 * Trade-off (documented per plan): edits that don't change collection length
 * won't invalidate the cache automatically. Users can navigate away and back to
 * refresh. When add-watch flow lands, router.refresh() + count change will
 * naturally invalidate.
 */
export function useWatchSearchVerdictCache(collectionRevision: number) {
  const [state, setState] = useState<{ rev: number; map: Map<string, VerdictBundle> }>(
    () => ({ rev: collectionRevision, map: new Map() }),
  )

  // Drop cache when revision changes. setState in render is acceptable here
  // (React docs: "Storing information from previous renders" pattern).
  if (state.rev !== collectionRevision) {
    setState({ rev: collectionRevision, map: new Map() })
  }

  return {
    revision: state.rev,
    get: (id: string): VerdictBundle | undefined => state.map.get(id),
    set: (id: string, bundle: VerdictBundle): void => {
      setState((prev) => {
        if (prev.rev !== collectionRevision) {
          // Stale write attempted; ignore (revision moved).
          return prev
        }
        const next = new Map(prev.map)
        next.set(id, bundle)
        return { rev: prev.rev, map: next }
      })
    },
  }
}
