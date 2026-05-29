'use client'

import type { ExtractCacheEntry } from '@/components/watch/useUrlExtractCache'

/**
 * Phase 69 (CLNP-07): cross-mount structured-input extract cache.
 *
 * Storage is MODULE-SCOPED (not React useState) so the cache survives
 * AddWatchFlow remounts triggered by the per-request UUID `key` prop on
 * /watch/new. Mirror primitive of `useUrlExtractCache` / `useCatalogSearchCache`
 * with two differences from `useUrlExtractCache`:
 *
 * 1. Value type re-uses `ExtractCacheEntry` from `useUrlExtractCache` (single
 *    source of truth — if `ExtractedWatchData` shape changes, this hook
 *    follows automatically; no type-duplication drift).
 *
 * 2. Cache key (D-18): caller builds a JSON-tuple key with per-field
 *    `trim().toLowerCase()` normalization plus a nullable year:
 *
 *      const key = JSON.stringify({
 *        brand: brand.trim().toLowerCase(),
 *        model: model.trim().toLowerCase(),
 *        reference: (reference ?? '').trim().toLowerCase(),
 *        year: year ?? null,
 *      })
 *
 *    This aligns with the catalog DAL's natural-key normalization (see
 *    project_local_catalog_natural_key_drift). The hook itself is
 *    key-shape-agnostic (treats `key: string` as opaque) — StructuredEntryPanel
 *    owns the normalization so the cache reads and writes stay symmetric.
 *
 * Invalidation policy (Phase 69 D-06): viewer-keyed. On viewerUserId switch
 * (e.g., signOut → signIn-as-different-user) the cache is fully dropped via
 * an in-render sync mutation. This is intentional sync mutation in render
 * (NOT setState) — module state has no React-tracked subscribers, so this
 * is a deterministic same-render reset. Mirrors
 * `useWatchSearchVerdictCache.ts:42-45` byte-for-byte.
 */

let moduleCache: Map<string, ExtractCacheEntry> = new Map()
let moduleUserId = ''

/**
 * Test-only: reset module state. Call from `beforeEach()` in any test
 * that exercises the cache to keep tests deterministic regardless of
 * execution order. Production code MUST NOT call this — it bypasses
 * viewer-keyed invalidation semantics. Used by the Plan 06 integration
 * test (`AddWatchFlow.test.tsx`).
 */
export function __resetStructuredExtractCacheForTests(): void {
  moduleCache = new Map()
  moduleUserId = ''
}

export function useStructuredExtractCache(viewerUserId: string) {
  // Drop cache when viewerUserId changes. This is intentional sync mutation
  // in render (NOT setState) — module state has no React-tracked subscribers,
  // so this is a deterministic same-render reset.
  if (moduleUserId !== viewerUserId) {
    moduleCache = new Map()
    moduleUserId = viewerUserId
  }

  return {
    get: (key: string): ExtractCacheEntry | undefined => moduleCache.get(key),
    set: (key: string, entry: ExtractCacheEntry): void => {
      // Stale-write guard: if viewerUserId moved during an in-flight extract
      // (e.g., a stale closure from the previous user), ignore the set so
      // the new user's cache stays uncontaminated.
      if (moduleUserId !== viewerUserId) return
      moduleCache.set(key, entry)
    },
  }
}
