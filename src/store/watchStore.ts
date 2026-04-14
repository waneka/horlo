import { create } from 'zustand'
import type { WatchStatus } from '@/lib/types'

export interface WatchFilters {
  status: 'all' | WatchStatus
  styleTags: string[]
  roleTags: string[]
  dialColors: string[]
  priceRange: { min: number | null; max: number | null }
}

interface WatchFilterStore {
  filters: WatchFilters
  setFilter: <K extends keyof WatchFilters>(key: K, value: WatchFilters[K]) => void
  resetFilters: () => void
}

const defaultFilters: WatchFilters = {
  status: 'all',
  styleTags: [],
  roleTags: [],
  dialColors: [],
  priceRange: { min: null, max: null },
}

export const useWatchStore = create<WatchFilterStore>()((set) => ({
  filters: defaultFilters,
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: defaultFilters }),
}))
