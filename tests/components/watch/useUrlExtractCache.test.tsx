import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useUrlExtractCache,
  __resetUrlExtractCacheForTests,
  type ExtractCacheEntry,
} from '@/components/watch/useUrlExtractCache'
import type { ExtractedWatchData } from '@/lib/extractors'

const fakeExtracted: ExtractedWatchData = {
  brand: 'Omega',
  model: 'Speedmaster',
  reference: '310.30.42.50.01.001',
}

const entryFor = (catalogId: string): ExtractCacheEntry => ({
  catalogId,
  extracted: fakeExtracted,
  catalogIdError: null,
})

describe('FORM-04 Gap 3 useUrlExtractCache', () => {
  beforeEach(() => {
    __resetUrlExtractCacheForTests()
  })

  it('get() returns undefined for an unknown URL', () => {
    const { result } = renderHook(() => useUrlExtractCache())
    expect(result.current.get('https://example.com/never-pasted')).toBeUndefined()
  })

  it('set() then get() returns the same entry', () => {
    const { result } = renderHook(() => useUrlExtractCache())
    const entry = entryFor('cat-1')
    act(() => result.current.set('https://example.com/a', entry))
    expect(result.current.get('https://example.com/a')).toEqual(entry)
  })

  it('cache survives remount (set in mount A, get in mount B)', () => {
    const { result: a } = renderHook(() => useUrlExtractCache())
    const entry = entryFor('cat-1')
    act(() => a.current.set('https://example.com/a', entry))

    // Simulate AddWatchFlow remount by spinning up a fresh hook instance.
    // Module-scoped storage means the new instance must see the prior set.
    const { result: b } = renderHook(() => useUrlExtractCache())
    expect(b.current.get('https://example.com/a')).toEqual(entry)
  })

  it('cache holds multiple distinct URLs independently', () => {
    const { result } = renderHook(() => useUrlExtractCache())
    const entryA = entryFor('cat-a')
    const entryB = entryFor('cat-b')
    act(() => {
      result.current.set('https://example.com/a', entryA)
      result.current.set('https://example.com/b', entryB)
    })
    expect(result.current.get('https://example.com/a')).toEqual(entryA)
    expect(result.current.get('https://example.com/b')).toEqual(entryB)
  })
})
