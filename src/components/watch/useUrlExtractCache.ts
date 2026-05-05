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
 * Invalidation policy: NONE. URL → scraped catalog data is stable across
 * the user's collection state (a watch's brand/model/reference doesn't
 * change because the user added another watch). The downstream verdict
 * cache (`useWatchSearchVerdictCache`) still handles collection-side
 * invalidation via `collectionRevision`.
 */

export type ExtractCacheEntry = {
  catalogId: string
  extracted: ExtractedWatchData
  catalogIdError: string | null
}

let moduleCache: Map<string, ExtractCacheEntry> = new Map()

/**
 * Test-only: reset module state. Call from `beforeEach()` in any test
 * that exercises the cache to keep tests deterministic regardless of
 * execution order. Production code MUST NOT call this.
 */
export function __resetUrlExtractCacheForTests(): void {
  moduleCache = new Map()
}

export function useUrlExtractCache() {
  return {
    get: (url: string): ExtractCacheEntry | undefined => moduleCache.get(url),
    set: (url: string, entry: ExtractCacheEntry): void => {
      moduleCache.set(url, entry)
    },
  }
}
