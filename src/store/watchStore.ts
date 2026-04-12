import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Watch, WatchStatus } from '@/lib/types'

export interface WatchFilters {
  status: 'all' | WatchStatus
  styleTags: string[]
  roleTags: string[]
  dialColors: string[]
}

interface WatchStore {
  watches: Watch[]
  filters: WatchFilters

  addWatch: (watch: Omit<Watch, 'id'>) => void
  updateWatch: (id: string, updates: Partial<Watch>) => void
  deleteWatch: (id: string) => void
  markAsWorn: (id: string) => void

  setFilter: <K extends keyof WatchFilters>(key: K, value: WatchFilters[K]) => void
  resetFilters: () => void

  getWatchById: (id: string) => Watch | undefined
  getFilteredWatches: () => Watch[]
}

const defaultFilters: WatchFilters = {
  status: 'all',
  styleTags: [],
  roleTags: [],
  dialColors: [],
}

function generateId(): string {
  return crypto.randomUUID()
}

export const useWatchStore = create<WatchStore>()(
  persist(
    (set, get) => ({
      watches: [],
      filters: defaultFilters,

      addWatch: (watchData) => {
        const watch: Watch = {
          ...watchData,
          id: generateId(),
        }
        set((state) => ({ watches: [...state.watches, watch] }))
      },

      updateWatch: (id, updates) => {
        set((state) => ({
          watches: state.watches.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
        }))
      },

      deleteWatch: (id) => {
        set((state) => ({
          watches: state.watches.filter((w) => w.id !== id),
        }))
      },

      markAsWorn: (id) => {
        const today = new Date().toISOString().split('T')[0]
        set((state) => ({
          watches: state.watches.map((w) =>
            w.id === id ? { ...w, lastWornDate: today } : w
          ),
        }))
      },

      setFilter: (key, value) => {
        set((state) => ({
          filters: { ...state.filters, [key]: value },
        }))
      },

      resetFilters: () => {
        set({ filters: defaultFilters })
      },

      getWatchById: (id) => {
        return get().watches.find((w) => w.id === id)
      },

      getFilteredWatches: () => {
        const { watches, filters } = get()

        return watches.filter((watch) => {
          // Status filter
          if (filters.status !== 'all' && watch.status !== filters.status) {
            return false
          }

          // Style tags filter (any match)
          if (
            filters.styleTags.length > 0 &&
            !filters.styleTags.some((tag) => watch.styleTags.includes(tag))
          ) {
            return false
          }

          // Role tags filter (any match)
          if (
            filters.roleTags.length > 0 &&
            !filters.roleTags.some((tag) => watch.roleTags.includes(tag))
          ) {
            return false
          }

          // Dial colors filter (any match)
          if (
            filters.dialColors.length > 0 &&
            watch.dialColor &&
            !filters.dialColors.includes(watch.dialColor)
          ) {
            return false
          }

          return true
        })
      },
    }),
    {
      name: 'watch-collection',
    }
  )
)
