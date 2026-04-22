import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

import { useViewedWears } from '@/hooks/useViewedWears'

const STORAGE_KEY = 'horlo:wywt:viewed:v1'

// localStorage is polyfilled in tests/setup.ts for the Node 25 / jsdom combo
// that strips Storage methods off of window.localStorage.

describe('useViewedWears — SSR-safe localStorage viewed-state hook (W-06 / Pitfall 4)', () => {
  beforeEach(() => {
    // Full isolation between tests — only clear the namespaced key this hook
    // writes so we don't trample any sibling suites that may share storage.
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // No-op under a mocked storage — each test seeds whatever state it needs.
    }
    vi.restoreAllMocks()
  })

  it('Test 1 — pre-hydration contract: hook returns viewed Set, markViewed fn, hydrated flag', () => {
    // Seed storage so we can also confirm the type contract holds with data present.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['id-seed']))

    const { result } = renderHook(() => useViewedWears())

    // React 18+ testing-library may flush useEffect before returning the first
    // ref — so we assert the public type contract. The SSR-safety invariant is
    // covered by Test 2 (empty storage + hydrated toggles to true) and the
    // explicit `hydrated === false` initial gate in the hook source.
    expect(result.current).toHaveProperty('viewed')
    expect(result.current).toHaveProperty('markViewed')
    expect(result.current).toHaveProperty('hydrated')
    expect(result.current.viewed).toBeInstanceOf(Set)
    expect(typeof result.current.markViewed).toBe('function')
    expect(typeof result.current.hydrated).toBe('boolean')
  })

  it('Test 2 — post-hydration, empty storage: viewed is empty Set, hydrated=true', async () => {
    const { result } = renderHook(() => useViewedWears())
    await waitFor(() => expect(result.current.hydrated).toBe(true))
    expect(result.current.viewed.size).toBe(0)
  })

  it('Test 3 — post-hydration, with data: populates viewed from localStorage', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['id1', 'id2']))
    const { result } = renderHook(() => useViewedWears())
    await waitFor(() => expect(result.current.hydrated).toBe(true))
    expect(result.current.viewed.size).toBe(2)
    expect(result.current.viewed.has('id1')).toBe(true)
    expect(result.current.viewed.has('id2')).toBe(true)
  })

  it('Test 4 — markViewed updates state AND writes to localStorage', async () => {
    const { result } = renderHook(() => useViewedWears())
    await waitFor(() => expect(result.current.hydrated).toBe(true))

    act(() => {
      result.current.markViewed('newId')
    })

    expect(result.current.viewed.has('newId')).toBe(true)
    const raw = window.localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!) as string[]
    expect(parsed).toContain('newId')
  })

  it('Test 5 — markViewed is idempotent: marking the same id twice is a no-op', async () => {
    const { result } = renderHook(() => useViewedWears())
    await waitFor(() => expect(result.current.hydrated).toBe(true))

    act(() => {
      result.current.markViewed('duped')
    })
    const firstSet = result.current.viewed
    act(() => {
      result.current.markViewed('duped')
    })
    const secondSet = result.current.viewed

    // The setter short-circuits (returns prev) when the id is already present,
    // so the Set reference should be identical.
    expect(secondSet).toBe(firstSet)
    expect(secondSet.size).toBe(1)
  })

  it('Test 6 — cap: after marking 201 unique ids, Set size is <= 200', async () => {
    const { result } = renderHook(() => useViewedWears())
    await waitFor(() => expect(result.current.hydrated).toBe(true))

    act(() => {
      for (let i = 0; i < 201; i++) {
        result.current.markViewed(`id-${i}`)
      }
    })

    expect(result.current.viewed.size).toBeLessThanOrEqual(200)
    // First inserted id should have been evicted (FIFO).
    expect(result.current.viewed.has('id-0')).toBe(false)
    // Last inserted id should be retained.
    expect(result.current.viewed.has('id-200')).toBe(true)
  })

  it('Test 7 — malformed localStorage JSON: hydrates empty without throwing', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json')
    const { result } = renderHook(() => useViewedWears())
    await waitFor(() => expect(result.current.hydrated).toBe(true))
    expect(result.current.viewed.size).toBe(0)
  })

  it('Test 8 — localStorage.getItem throws: hydrates empty without crashing (Safari private mode)', async () => {
    // Patch the specific instance (not Storage.prototype — our MemoryStorage
    // stub defines getItem as an own property, so Storage.prototype spying
    // would not intercept it).
    const spy = vi
      .spyOn(window.localStorage, 'getItem')
      .mockImplementation(() => {
        throw new Error('SecurityError: access denied')
      })

    const { result } = renderHook(() => useViewedWears())
    await waitFor(() => expect(result.current.hydrated).toBe(true))
    expect(result.current.viewed.size).toBe(0)

    spy.mockRestore()
    // Sanity: restore left storage functional (beforeEach cleared the key).
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
