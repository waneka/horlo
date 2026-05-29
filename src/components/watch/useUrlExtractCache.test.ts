import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useUrlExtractCache,
  __resetUrlExtractCacheForTests,
  type ExtractCacheEntry,
} from '@/components/watch/useUrlExtractCache'
import type { ExtractedWatchData } from '@/lib/extractors'

// Test fixture — minimal ExtractCacheEntry the cache can store.
// ExtractedWatchData is a wide-open partial shape; the cache hook treats
// the value as opaque so only catalogId / catalogIdError need to be
// well-formed for assertion identity.
const fakeExtracted: ExtractedWatchData = {
  brand: 'Omega',
  model: 'Speedmaster',
  reference: '3135',
}

const fakeEntry: ExtractCacheEntry = {
  catalogId: 'cat-abc',
  extracted: fakeExtracted,
  catalogIdError: null,
}

describe('useUrlExtractCache — CLNP-07 retrofit user-switch invalidation (Phase 69 D-06/D-07/D-08)', () => {
  beforeEach(() => {
    __resetUrlExtractCacheForTests()
  })

  it('set() then get() returns the cached entry for the same viewerUserId', () => {
    const { result } = renderHook(() => useUrlExtractCache('user-a'))
    act(() => result.current.set('https://omega.example/3135', fakeEntry))
    expect(result.current.get('https://omega.example/3135')).toEqual(fakeEntry)
  })

  it('switching viewerUserId across renders clears the cache — get() returns undefined', () => {
    const { result, rerender } = renderHook(
      ({ uid }) => useUrlExtractCache(uid),
      { initialProps: { uid: 'user-a' } },
    )
    act(() => result.current.set('https://omega.example/3135', fakeEntry))
    expect(result.current.get('https://omega.example/3135')).toEqual(fakeEntry)
    rerender({ uid: 'user-b' })
    expect(result.current.get('https://omega.example/3135')).toBeUndefined()
  })

  it('stale-write guard — set() called from the old user closure after user-switch does NOT pollute the new cache', () => {
    const { result, rerender } = renderHook(
      ({ uid }) => useUrlExtractCache(uid),
      { initialProps: { uid: 'user-a' } },
    )
    // Capture the hook return for user-a BEFORE the rerender — this closes
    // over the old viewerUserId. The stale-write guard inside set() must
    // detect that moduleUserId has moved to user-b and skip the mutation.
    const staleCache = result.current
    rerender({ uid: 'user-b' })
    act(() => staleCache.set('https://omega.example/3135', fakeEntry))
    // user-b's view of the cache must remain empty
    expect(result.current.get('https://omega.example/3135')).toBeUndefined()
  })

  it('__resetUrlExtractCacheForTests() resets BOTH moduleCache AND moduleUserId', () => {
    const { result } = renderHook(() => useUrlExtractCache('user-a'))
    act(() => result.current.set('https://omega.example/3135', fakeEntry))
    expect(result.current.get('https://omega.example/3135')).toEqual(fakeEntry)

    __resetUrlExtractCacheForTests()

    // A fresh hook call with the SAME viewerUserId now sees an empty cache
    // (moduleCache was wiped) AND the reset-block re-fires as if first render
    // (moduleUserId was reset to ''). The cache stays empty.
    const { result: result2 } = renderHook(() => useUrlExtractCache('user-a'))
    expect(result2.current.get('https://omega.example/3135')).toBeUndefined()
  })
})
