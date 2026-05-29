import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useWatchSearchVerdictCache,
  __resetVerdictCacheForTests,
} from '@/components/search/useWatchSearchVerdictCache'
import type { VerdictBundle } from '@/lib/verdict/types'

// Test fixture — minimal VerdictBundle. The cache hook treats the value
// as opaque; assertion identity only needs a unique recognizable shape.
const fakeVerdict = {
  label: 'core-fit',
  score: 0.82,
  topMatches: [],
  rationale: { topDimensions: [], thresholdsUsed: {} },
  collectionFingerprint: { size: 3 },
} as unknown as VerdictBundle

describe('useWatchSearchVerdictCache — CLNP-07 retrofit user-switch invalidation (Phase 69 D-06/D-07/D-08)', () => {
  beforeEach(() => {
    __resetVerdictCacheForTests()
  })

  it('set() then get() returns the cached entry for the same (revision, viewerUserId)', () => {
    const { result } = renderHook(() => useWatchSearchVerdictCache(3, 'user-a'))
    act(() => result.current.set('cat-1', fakeVerdict))
    expect(result.current.get('cat-1')).toEqual(fakeVerdict)
  })

  it('switching viewerUserId across renders clears the cache AND resets moduleRevision (inner guard re-fires)', () => {
    const { result, rerender } = renderHook(
      ({ rev, uid }) => useWatchSearchVerdictCache(rev, uid),
      { initialProps: { rev: 3, uid: 'user-a' } },
    )
    act(() => result.current.set('cat-1', fakeVerdict))
    expect(result.current.get('cat-1')).toEqual(fakeVerdict)

    // User-switch: cache MUST clear. With user-b's first call the outer
    // guard fires (moduleUserId mismatch) AND resets moduleRevision to 0.
    // We then come back into the hook body, and the inner revision guard
    // sees moduleRevision === 0 vs incoming 3 — it ALSO fires (a second
    // empty-cache reset, harmless) and re-syncs moduleRevision to 3.
    // Both guards firing is the point: the cache stays empty for user-b.
    rerender({ rev: 3, uid: 'user-b' })
    expect(result.current.get('cat-1')).toBeUndefined()
    // After the rerender the hook's `revision` reflects user-b's pass —
    // confirms the inner guard ran fresh for the new user.
    expect(result.current.revision).toBe(3)
  })

  it('existing revision-change behavior is PRESERVED — switching collectionRevision (same user) clears the cache', () => {
    const { result, rerender } = renderHook(
      ({ rev }) => useWatchSearchVerdictCache(rev, 'user-a'),
      { initialProps: { rev: 3 } },
    )
    act(() => result.current.set('cat-1', fakeVerdict))
    expect(result.current.get('cat-1')).toEqual(fakeVerdict)

    rerender({ rev: 4 })
    expect(result.current.get('cat-1')).toBeUndefined()
    expect(result.current.revision).toBe(4)
  })

  it('user-switch THEN revision-change in sequence — both guards fire correctly; cache stays empty for the new user', () => {
    const { result, rerender } = renderHook(
      ({ rev, uid }) => useWatchSearchVerdictCache(rev, uid),
      { initialProps: { rev: 3, uid: 'user-a' } },
    )
    act(() => result.current.set('cat-1', fakeVerdict))

    rerender({ rev: 3, uid: 'user-b' })
    expect(result.current.get('cat-1')).toBeUndefined()

    rerender({ rev: 4, uid: 'user-b' })
    expect(result.current.get('cat-1')).toBeUndefined()
    expect(result.current.revision).toBe(4)
  })

  it('__resetVerdictCacheForTests() resets ALL THREE module vars (moduleCache, moduleRevision, moduleUserId)', () => {
    const { result } = renderHook(() => useWatchSearchVerdictCache(3, 'user-a'))
    act(() => result.current.set('cat-1', fakeVerdict))
    expect(result.current.get('cat-1')).toEqual(fakeVerdict)

    __resetVerdictCacheForTests()

    // After reset, a fresh hook call with the SAME (revision, viewerUserId)
    // sees an empty cache; moduleUserId is back to '' so the outer guard
    // re-fires on first call, and moduleRevision is back to 0 so the inner
    // guard re-fires too. Cache stays empty.
    const { result: result2 } = renderHook(() => useWatchSearchVerdictCache(3, 'user-a'))
    expect(result2.current.get('cat-1')).toBeUndefined()
  })

  it('stale-write guard — set() called from the old user closure after user-switch does NOT pollute the new cache', () => {
    const { result, rerender } = renderHook(
      ({ uid }) => useWatchSearchVerdictCache(3, uid),
      { initialProps: { uid: 'user-a' } },
    )
    // Capture user-a's hook closure BEFORE the rerender. The stale-write
    // guard must detect the moduleUserId / moduleRevision mismatch and
    // skip the mutation.
    const staleCache = result.current
    rerender({ uid: 'user-b' })
    act(() => staleCache.set('cat-1', fakeVerdict))
    expect(result.current.get('cat-1')).toBeUndefined()
  })
})
