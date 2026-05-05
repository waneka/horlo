'use client'

import type { VerdictBundle } from '@/lib/verdict/types'

/**
 * Phase 20 D-06 + Phase 29 FORM-04 gap closure: cross-mount verdict cache.
 *
 * Storage is MODULE-SCOPED (not React useState) so the cache survives
 * AddWatchFlow remounts triggered by the per-request UUID `key` prop on
 * /watch/new. The hook is a thin readout over the module variables.
 *
 * Keyed by viewer's collection-revision (passed as prop from the server).
 * When the revision changes, the module Map is replaced with an empty Map
 * and the moduleRevision counter is updated. The clear-on-revision-change
 * is performed inline in render (React docs: "Storing information from
 * previous renders" pattern; setState-in-render guidance does NOT apply
 * here because we are not calling setState — we are mutating module state).
 *
 * Public API ({revision, get, set}) is byte-identical to the pre-fix hook
 * so AddWatchFlow.tsx:114 and WatchSearchRowsAccordion.tsx:47 call sites
 * are UNCHANGED.
 */

let moduleCache: Map<string, VerdictBundle> = new Map()
let moduleRevision = 0

/**
 * Test-only: reset module state. Call from `beforeEach()` in any test that
 * exercises the cache to keep tests deterministic regardless of execution
 * order. Production code MUST NOT call this — it bypasses revision-keyed
 * invalidation semantics.
 */
export function __resetVerdictCacheForTests(): void {
  moduleCache = new Map()
  moduleRevision = 0
}

export function useWatchSearchVerdictCache(collectionRevision: number) {
  // Drop cache when revision changes. This is intentional sync mutation in
  // render (NOT setState) — module state has no React-tracked subscribers,
  // so this is a deterministic same-render reset.
  if (moduleRevision !== collectionRevision) {
    moduleCache = new Map()
    moduleRevision = collectionRevision
  }

  return {
    revision: moduleRevision,
    get: (id: string): VerdictBundle | undefined => moduleCache.get(id),
    set: (id: string, bundle: VerdictBundle): void => {
      // Stale-write guard: if revision moved during an in-flight verdict
      // compute, ignore the set (mirrors pre-fix Phase 20 D-06 behavior).
      if (moduleRevision !== collectionRevision) return
      moduleCache.set(id, bundle)
    },
  }
}
