import type { Watch, UserPreferences, CollectionGoal } from '@/lib/types'

let idCounter = 0
/** Deterministic id for test stability (no crypto.randomUUID). */
function nextId(): string {
  idCounter += 1
  return `test-${idCounter}`
}

export function makeWatch(overrides: Partial<Watch> = {}): Watch {
  return {
    id: nextId(),
    brand: 'TestBrand',
    model: 'Model',
    status: 'owned',
    movement: 'automatic',
    complications: [],
    styleTags: [],
    designTraits: [],
    roleTags: [],
    ...overrides,
  }
}

export const emptyPreferences: UserPreferences = {
  preferredStyles: [],
  dislikedStyles: [],
  preferredDesignTraits: [],
  dislikedDesignTraits: [],
  preferredComplications: [],
  complicationExceptions: [],
  preferredDialColors: [],
  dislikedDialColors: [],
  overlapTolerance: 'medium',
}

export function preferencesWithGoal(goal: CollectionGoal): UserPreferences {
  return { ...emptyPreferences, collectionGoal: goal }
}

/** Scenario fixtures per 02-CONTEXT.md TEST-02 list. */
export const fixtures = {
  empty: (): Watch[] => [],

  oneWatch: (): Watch[] => [
    makeWatch({ brand: 'Rolex', model: 'Submariner', styleTags: ['dive'], roleTags: ['daily'], dialColor: 'black' }),
  ],

  /** 3 watches sharing the 'dive' style — triggers specialist detection. */
  threeSameStyle: (): Watch[] => [
    makeWatch({ brand: 'Rolex', model: 'Submariner', styleTags: ['dive'], roleTags: ['daily'], dialColor: 'black' }),
    makeWatch({ brand: 'Omega', model: 'Seamaster', styleTags: ['dive'], roleTags: ['sport'], dialColor: 'blue' }),
    makeWatch({ brand: 'Tudor', model: 'Pelagos', styleTags: ['dive'], roleTags: ['travel'], dialColor: 'black' }),
  ],

  /** 3 watches sharing brand 'Rolex' — triggers brand-loyalist (100% > 30%). */
  threeSameBrand: (): Watch[] => [
    makeWatch({ brand: 'Rolex', model: 'Submariner', styleTags: ['dive'], roleTags: ['daily'], dialColor: 'black' }),
    makeWatch({ brand: 'Rolex', model: 'Datejust', styleTags: ['dress'], roleTags: ['formal'], dialColor: 'silver' }),
    makeWatch({ brand: 'Rolex', model: 'Explorer', styleTags: ['sport'], roleTags: ['travel'], dialColor: 'black' }),
  ],

  /** 5 mixed watches — no specialty or brand dominance. Balanced fallback. */
  fiveMixed: (): Watch[] => [
    makeWatch({ brand: 'Rolex', model: 'Submariner', styleTags: ['dive'], roleTags: ['daily'], dialColor: 'black' }),
    makeWatch({ brand: 'Omega', model: 'Speedmaster', styleTags: ['chrono'], roleTags: ['sport'], dialColor: 'black', complications: ['chronograph'] }),
    makeWatch({ brand: 'Grand Seiko', model: 'SBGA211', styleTags: ['dress'], roleTags: ['formal'], dialColor: 'white' }),
    makeWatch({ brand: 'Cartier', model: 'Tank', styleTags: ['dress'], roleTags: ['formal'], dialColor: 'silver' }),
    makeWatch({ brand: 'Seiko', model: 'SKX', styleTags: ['dive'], roleTags: ['travel'], dialColor: 'blue' }),
  ],
}
