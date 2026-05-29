'use client'

import type { ExtractedWatchData } from '@/lib/extractors'

/**
 * FORM-04 Gap 3 (post-29-05/06 UAT): cross-mount URL → extract cache.
 *
 * Storage is MODULE-SCOPED (not React useState) so the cache survives
 * AddWatchFlow remounts triggered by the per-request UUID `key` prop on
 * /watch/new. Mirror primitive of `useWatchSearchVerdictCache` — same
 * module-scope shape, different invalidation policy.
 *
 * Key: trimmed URL string (raw — no normalization).
 * Value: the subset of /api/extract-watch's successful response that
 * AddWatchFlow.handleExtract needs downstream — `{catalogId, extracted,
 * catalogIdError}`. Only successful responses with a non-null `catalogId`
 * are cached; failures are intentionally NOT cached so the user can
 * retry a malformed URL after fixing it.
 *
 * Invalidation policy (Phase 69 D-06 — CLNP-07 retrofit): viewer-keyed.
 * On viewerUserId switch (e.g., signOut → signIn-as-different-user) the
 * cache is fully dropped via an in-render sync mutation. This closes the
 * pre-existing cross-user-leak hazard alongside the Plan 02 NEW caches.
 * `viewerUserId` is a REQUIRED positional arg (Phase 69 D-08) so
 * TypeScript surfaces every caller in the same compile — see
 * AddWatchFlow.tsx prop-drill plumbing (Phase 69 D-07).
 */

export type ExtractCacheEntry = {
  catalogId: string
  extracted: ExtractedWatchData
  catalogIdError: string | null
}

let moduleCache: Map<string, ExtractCacheEntry> = new Map()
let moduleUserId = ''

/**
 * Test-only: reset module state. Call from `beforeEach()` in any test
 * that exercises the cache to keep tests deterministic regardless of
 * execution order. Production code MUST NOT call this — it bypasses
 * viewer-keyed invalidation semantics. Used by the Plan 06 integration
 * test (`AddWatchFlow.test.tsx`).
 */
export function __resetUrlExtractCacheForTests(): void {
  moduleCache = new Map()
  moduleUserId = ''
}

export function useUrlExtractCache(viewerUserId: string) {
  // Drop cache when viewerUserId changes. This is intentional sync mutation
  // in render (NOT setState) — module state has no React-tracked subscribers,
  // so this is a deterministic same-render reset.
  if (moduleUserId !== viewerUserId) {
    moduleCache = new Map()
    moduleUserId = viewerUserId
  }

  return {
    get: (url: string): ExtractCacheEntry | undefined => moduleCache.get(url),
    set: (url: string, entry: ExtractCacheEntry): void => {
      // Stale-write guard: if viewerUserId moved during an in-flight extract
      // (e.g., a stale closure from the previous user), ignore the set so
      // the new user's cache stays uncontaminated.
      if (moduleUserId !== viewerUserId) return
      moduleCache.set(url, entry)
    },
  }
}
