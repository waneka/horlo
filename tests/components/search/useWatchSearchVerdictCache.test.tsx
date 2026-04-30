import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWatchSearchVerdictCache } from '@/components/search/useWatchSearchVerdictCache'
import type { VerdictBundle } from '@/lib/verdict/types'

const fakeBundle: VerdictBundle = {
  framing: 'cross-user',
  label: 'core-fit',
  headlinePhrasing: 'Core Fit',
  contextualPhrasings: ['ok'],
  mostSimilar: [],
  roleOverlap: false,
}

describe('D-06 useWatchSearchVerdictCache (Plan 05)', () => {
  it('get() returns undefined for a never-set catalogId', () => {
    const { result } = renderHook(() => useWatchSearchVerdictCache(3))
    expect(result.current.get('unknown')).toBeUndefined()
  })

  it('set() then get() returns the same VerdictBundle', () => {
    const { result } = renderHook(() => useWatchSearchVerdictCache(3))
    act(() => result.current.set('cat-1', fakeBundle))
    expect(result.current.get('cat-1')).toEqual(fakeBundle)
  })

  it('changing collectionRevision prop drops all cached entries', () => {
    const { result, rerender } = renderHook(
      ({ rev }) => useWatchSearchVerdictCache(rev),
      { initialProps: { rev: 3 } },
    )
    act(() => result.current.set('cat-1', fakeBundle))
    expect(result.current.get('cat-1')).toEqual(fakeBundle)
    rerender({ rev: 4 })
    expect(result.current.get('cat-1')).toBeUndefined()
  })

  it('hook does not refetch on re-render when revision is unchanged', () => {
    const { result, rerender } = renderHook(
      ({ rev }) => useWatchSearchVerdictCache(rev),
      { initialProps: { rev: 3 } },
    )
    act(() => result.current.set('cat-1', fakeBundle))
    rerender({ rev: 3 })  // same revision
    expect(result.current.get('cat-1')).toEqual(fakeBundle)
  })
})
