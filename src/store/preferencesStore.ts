import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserPreferences } from '@/lib/types'

interface PreferencesStore {
  preferences: UserPreferences
  updatePreferences: (updates: Partial<UserPreferences>) => void
  resetPreferences: () => void
}

const defaultPreferences: UserPreferences = {
  preferredStyles: [],
  dislikedStyles: [],
  preferredDesignTraits: [],
  dislikedDesignTraits: [],
  preferredComplications: [],
  complicationExceptions: [],
  preferredDialColors: [],
  dislikedDialColors: [],
  preferredCaseSizeRange: undefined,
  overlapTolerance: 'medium',
  collectionGoal: undefined,
  notes: undefined,
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      preferences: defaultPreferences,

      updatePreferences: (updates) => {
        set((state) => ({
          preferences: { ...state.preferences, ...updates },
        }))
      },

      resetPreferences: () => {
        set({ preferences: defaultPreferences })
      },
    }),
    {
      name: 'user-preferences',
    }
  )
)
