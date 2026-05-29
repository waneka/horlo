'use client'

import type { SearchCatalogWatchResult } from '@/lib/searchTypes'

/**
 * Phase 69 (CLNP-07): cross-mount catalog typeahead cache.
 *
 * Storage is MODULE-SCOPED (not React useState) so the cache survives
 * AddWatchFlow remounts triggered by the per-request UUID `key` prop on
 * /watch/new. Mirror primitive of `useUrlExtractCache` — same module-scope
 * shape, additional `viewerUserId`-keyed invalidation per Phase 69 D-06.
 *
 * Key: caller-normalized search query (D-Discretion: `query.trim().toLowerCase()`).
 * The hook itself is key-shape-agnostic (treats `key: string` as opaque) —
 * SearchEntry owns the normalization so the cache key matches the catalog DAL
 * natural-key normalization (see project_local_catalog_natural_key_drift).
 * Value: array of catalog search results from `searchCatalogForAddFlow`.
 *
 * Invalidation policy (Phase 69 D-06): viewer-keyed. On viewerUserId switch
 * (e.g., signOut → signIn-as-different-user) the cache is fully dropped via
 * an in-render sync mutation. This is intentional sync mutation in render
 * (NOT setState) — module state has no React-tracked subscribers, so this
 * is a deterministic same-render reset. Mirrors
 * `useWatchSearchVerdictCache.ts:42-45` byte-for-byte.
 */

let moduleCache: Map<string, SearchCatalogWatchResult[]> = new Map()
let moduleUserId = ''

/**
 * Test-only: reset module state. Call from `beforeEach()` in any test
 * that exercises the cache to keep tests deterministic regardless of
 * execution order. Production code MUST NOT call this — it bypasses
 * viewer-keyed invalidation semantics. Used by the Plan 06 integration
 * test (`AddWatchFlow.test.tsx`).
 */
export function __resetCatalogSearchCacheForTests(): void {
  moduleCache = new Map()
  moduleUserId = ''
}

export function useCatalogSearchCache(viewerUserId: string) {
  // Drop cache when viewerUserId changes. This is intentional sync mutation
  // in render (NOT setState) — module state has no React-tracked subscribers,
  // so this is a deterministic same-render reset.
  if (moduleUserId !== viewerUserId) {
    moduleCache = new Map()
    moduleUserId = viewerUserId
  }

  return {
    get: (key: string): SearchCatalogWatchResult[] | undefined => moduleCache.get(key),
    set: (key: string, results: SearchCatalogWatchResult[]): void => {
      // Stale-write guard: if viewerUserId moved during an in-flight fetch
      // (e.g., a stale closure from the previous user), ignore the set so
      // the new user's cache stays uncontaminated.
      if (moduleUserId !== viewerUserId) return
      moduleCache.set(key, results)
    },
  }
}
