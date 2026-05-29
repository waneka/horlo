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
 * Phase 69 CLNP-07 retrofit (D-06/D-07/D-08): a SECOND outer guard keyed by
 * `viewerUserId` runs BEFORE the existing revision guard. On user-switch
 * the cache is dropped AND `moduleRevision` is reset to 0 so the inner
 * revision check also fires fresh for the new user (defense against the
 * coincidental-revision-match case). `viewerUserId` is a REQUIRED second
 * positional arg so TypeScript surfaces every caller in the same compile —
 * this closes the pre-existing tech-debt leak called out in Phase 69
 * success criterion #5 (the same change that lands the new caches).
 */

let moduleCache: Map<string, VerdictBundle> = new Map()
let moduleRevision = 0
let moduleUserId = ''

/**
 * Test-only: reset module state. Call from `beforeEach()` in any test that
 * exercises the cache to keep tests deterministic regardless of execution
 * order. Production code MUST NOT call this — it bypasses revision-keyed
 * and viewer-keyed invalidation semantics.
 */
export function __resetVerdictCacheForTests(): void {
  moduleCache = new Map()
  moduleRevision = 0
  moduleUserId = ''
}

export function useWatchSearchVerdictCache(
  collectionRevision: number,
  viewerUserId: string,
) {
  // Phase 69 D-06 outer guard — user-switch reset runs BEFORE the revision
  // guard. Resetting moduleRevision to 0 inside this block guarantees the
  // inner revision check also fires fresh for the new user even if the new
  // viewer's revision happens to match the previous moduleRevision value.
  // Intentional sync mutation in render (NOT setState) — module state has
  // no React-tracked subscribers, so this is a deterministic same-render reset.
  if (moduleUserId !== viewerUserId) {
    moduleCache = new Map()
    moduleUserId = viewerUserId
    moduleRevision = 0
  }
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
      // Phase 69 D-06 — second stale-write guard for the user-switch case:
      // an in-flight verdict compute from the previous user's closure must
      // not pollute the new user's cache even if its revision matches.
      if (moduleUserId !== viewerUserId) return
      moduleCache.set(id, bundle)
    },
  }
}
