import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useCatalogSearchCache,
  __resetCatalogSearchCacheForTests,
} from '@/components/watch/useCatalogSearchCache'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'

// Test fixture — a single SearchCatalogWatchResult value the cache can store.
// Shape verified against src/lib/searchTypes.ts:35-44.
const fakeResults: SearchCatalogWatchResult[] = [
  {
    catalogId: 'cat-1',
    brand: 'Omega',
    model: 'Speedmaster',
    reference: '3135',
    imageUrl: null,
    ownersCount: 47,
    wishlistCount: 12,
    viewerState: null,
  },
]

describe('useCatalogSearchCache — CLNP-07 user-switch invalidation (Phase 69 D-06/D-07)', () => {
  beforeEach(() => {
    __resetCatalogSearchCacheForTests()
  })

  it('set() then get() returns the cached entry for the same viewerUserId', () => {
    const { result } = renderHook(() => useCatalogSearchCache('user-a'))
    act(() => result.current.set('omega', fakeResults))
    expect(result.current.get('omega')).toEqual(fakeResults)
  })

  it('switching viewerUserId across renders clears the cache — get() returns undefined', () => {
    const { result, rerender } = renderHook(
      ({ uid }) => useCatalogSearchCache(uid),
      { initialProps: { uid: 'user-a' } },
    )
    act(() => result.current.set('omega', fakeResults))
    expect(result.current.get('omega')).toEqual(fakeResults)
    rerender({ uid: 'user-b' })
    expect(result.current.get('omega')).toBeUndefined()
  })

  it('stale-write guard — set() called from the old user closure after user-switch does NOT pollute the new cache', () => {
    const { result, rerender } = renderHook(
      ({ uid }) => useCatalogSearchCache(uid),
      { initialProps: { uid: 'user-a' } },
    )
    // Capture the hook return for user-a BEFORE the rerender — this closes
    // over the old viewerUserId. The stale-write guard inside set() must
    // detect that moduleUserId has moved to user-b and skip the mutation.
    const staleCache = result.current
    rerender({ uid: 'user-b' })
    act(() => staleCache.set('omega', fakeResults))
    // user-b's view of the cache must remain empty
    expect(result.current.get('omega')).toBeUndefined()
  })

  it('__resetCatalogSearchCacheForTests() resets BOTH moduleCache AND moduleUserId', () => {
    const { result } = renderHook(() => useCatalogSearchCache('user-a'))
    act(() => result.current.set('omega', fakeResults))
    expect(result.current.get('omega')).toEqual(fakeResults)

    __resetCatalogSearchCacheForTests()

    // A fresh hook call with the SAME viewerUserId now sees an empty cache
    // (moduleCache was wiped) AND the reset-block re-fires as if first render
    // (moduleUserId was reset to ''). The cache stays empty.
    const { result: result2 } = renderHook(() => useCatalogSearchCache('user-a'))
    expect(result2.current.get('omega')).toBeUndefined()
  })
})
