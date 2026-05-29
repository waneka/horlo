import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useStructuredExtractCache,
  __resetStructuredExtractCacheForTests,
} from '@/components/watch/useStructuredExtractCache'
import type { ExtractCacheEntry } from '@/components/watch/useUrlExtractCache'

// D-18 cache key: per-field trim().toLowerCase() + JSON.stringify
// The hook is key-shape-agnostic — callers build this key. Tests build
// it both for writer and reader, asserting symmetric normalization.
const D18Key = (brand: string, model: string, reference: string | null, year: number | null): string =>
  JSON.stringify({
    brand: brand.trim().toLowerCase(),
    model: model.trim().toLowerCase(),
    reference: (reference ?? '').trim().toLowerCase(),
    year: year ?? null,
  })

const fakeEntry: ExtractCacheEntry = {
  catalogId: 'cat-uuid-1',
  extracted: {
    brand: 'Omega',
    model: 'Speedmaster',
    reference: '3135',
  },
  catalogIdError: null,
}

describe('useStructuredExtractCache — CLNP-07 + D-18 key shape (Phase 69)', () => {
  beforeEach(() => {
    __resetStructuredExtractCacheForTests()
  })

  it('set() then get() with the same D-18 key returns the cached entry for the same viewerUserId', () => {
    const { result } = renderHook(() => useStructuredExtractCache('user-a'))
    const key = D18Key('Omega', 'Speedmaster', '3135', null)
    act(() => result.current.set(key, fakeEntry))
    expect(result.current.get(key)).toEqual(fakeEntry)
  })

  it('switching viewerUserId across renders clears the cache — get() returns undefined', () => {
    const { result, rerender } = renderHook(
      ({ uid }) => useStructuredExtractCache(uid),
      { initialProps: { uid: 'user-a' } },
    )
    const key = D18Key('Omega', 'Speedmaster', '3135', null)
    act(() => result.current.set(key, fakeEntry))
    expect(result.current.get(key)).toEqual(fakeEntry)
    rerender({ uid: 'user-b' })
    expect(result.current.get(key)).toBeUndefined()
  })

  it('D-18 key format — writer and reader produce identical JSON.stringify output for symmetric normalization', () => {
    const { result } = renderHook(() => useStructuredExtractCache('user-a'))
    // Writer normalizes
    const writeKey = D18Key('  OMEGA  ', '  Speedmaster  ', '  3135  ', null)
    act(() => result.current.set(writeKey, fakeEntry))
    // Reader reproduces the same normalization from a different-cased input
    const readKey = D18Key('omega', 'speedmaster', '3135', null)
    expect(readKey).toBe(writeKey)
    expect(result.current.get(readKey)).toEqual(fakeEntry)
  })

  it('__resetStructuredExtractCacheForTests() resets BOTH moduleCache AND moduleUserId', () => {
    const { result } = renderHook(() => useStructuredExtractCache('user-a'))
    const key = D18Key('Omega', 'Speedmaster', '3135', null)
    act(() => result.current.set(key, fakeEntry))
    expect(result.current.get(key)).toEqual(fakeEntry)

    __resetStructuredExtractCacheForTests()

    // Fresh hook call with same viewerUserId sees empty cache (moduleCache
    // wiped) AND the reset-block re-fires as if first render (moduleUserId
    // reset to ''); cache stays empty.
    const { result: result2 } = renderHook(() => useStructuredExtractCache('user-a'))
    expect(result2.current.get(key)).toBeUndefined()
  })

  it('stale-write guard — set() called from old-user closure after user-switch does NOT pollute the new cache', () => {
    const { result, rerender } = renderHook(
      ({ uid }) => useStructuredExtractCache(uid),
      { initialProps: { uid: 'user-a' } },
    )
    const staleCache = result.current
    rerender({ uid: 'user-b' })
    const key = D18Key('Omega', 'Speedmaster', '3135', null)
    act(() => staleCache.set(key, fakeEntry))
    expect(result.current.get(key)).toBeUndefined()
  })
})
