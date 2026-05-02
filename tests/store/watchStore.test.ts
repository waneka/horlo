import { describe, it, expect, beforeEach } from 'vitest'
import { useWatchStore } from '@/store/watchStore'

const initialState = useWatchStore.getState()

describe('useWatchStore — filter reducer (TEST-04)', () => {
  beforeEach(() => {
    // Replace mode (`true` second arg) — fully reset state, not merge.
    useWatchStore.setState(initialState, true)
  })

  describe('setFilter', () => {
    it('sets status filter to a non-default value', () => {
      useWatchStore.getState().setFilter('status', 'owned')
      expect(useWatchStore.getState().filters.status).toBe('owned')
    })

    it('replaces the styleTags array (not merge)', () => {
      useWatchStore.getState().setFilter('styleTags', ['dressy'])
      useWatchStore.getState().setFilter('styleTags', ['sport'])
      expect(useWatchStore.getState().filters.styleTags).toEqual(['sport'])
    })

    it('preserves other slices when setting one', () => {
      useWatchStore.getState().setFilter('styleTags', ['dressy'])
      useWatchStore.getState().setFilter('status', 'wishlist')
      const f = useWatchStore.getState().filters
      expect(f.styleTags).toEqual(['dressy'])
      expect(f.status).toBe('wishlist')
    })

    it('updates priceRange compound slice', () => {
      useWatchStore.getState().setFilter('priceRange', { min: 1000, max: 5000 })
      expect(useWatchStore.getState().filters.priceRange).toEqual({ min: 1000, max: 5000 })
    })

    it('updates roleTags slice', () => {
      useWatchStore.getState().setFilter('roleTags', ['daily'])
      expect(useWatchStore.getState().filters.roleTags).toEqual(['daily'])
    })

    it('updates dialColors slice with multiple values', () => {
      useWatchStore.getState().setFilter('dialColors', ['blue', 'black'])
      expect(useWatchStore.getState().filters.dialColors).toEqual(['blue', 'black'])
    })
  })

  describe('resetFilters', () => {
    it('returns filters to defaults after multiple sets', () => {
      const store = useWatchStore.getState()
      store.setFilter('status', 'owned')
      store.setFilter('styleTags', ['dressy'])
      store.setFilter('priceRange', { min: 100, max: 9999 })
      store.resetFilters()
      expect(useWatchStore.getState().filters).toEqual({
        status: 'all',
        styleTags: [],
        roleTags: [],
        dialColors: [],
        priceRange: { min: null, max: null },
      })
    })
  })
})
