// src/lib/archetype-config.test.ts
//
// Wave 0 test scaffold for Phase 46 archetype config (Task 1).
// Verifies ARCHETYPE_CONFIG covers all 10 PRIMARY_ARCHETYPES with
// editorial displayNames and descriptions distinct from raw values.

import { describe, it, expect } from 'vitest'
import { PRIMARY_ARCHETYPES } from '@/lib/taste/vocab'
import { ARCHETYPE_CONFIG } from './archetype-config'

describe('ARCHETYPE_CONFIG', () => {
  it('has a key for every value in PRIMARY_ARCHETYPES (all 10 covered)', () => {
    for (const archetype of PRIMARY_ARCHETYPES) {
      expect(ARCHETYPE_CONFIG).toHaveProperty(archetype)
    }
    expect(Object.keys(ARCHETYPE_CONFIG)).toHaveLength(10)
  })

  it('each entry has a non-empty displayName and description', () => {
    for (const [key, config] of Object.entries(ARCHETYPE_CONFIG)) {
      expect(typeof config.displayName).toBe('string')
      expect(config.displayName.trim().length).toBeGreaterThan(0)
      expect(typeof config.description).toBe('string')
      expect(config.description.trim().length).toBeGreaterThan(0)
      // suppress unused key warning
      expect(key).toBeDefined()
    }
  })

  it('each entry value field equals its key in PRIMARY_ARCHETYPES', () => {
    for (const archetype of PRIMARY_ARCHETYPES) {
      expect(ARCHETYPE_CONFIG[archetype].value).toBe(archetype)
    }
  })

  it('no raw archetype value appears verbatim as a displayName', () => {
    // displayNames are editorial labels — they must differ from the raw value
    for (const archetype of PRIMARY_ARCHETYPES) {
      const { displayName } = ARCHETYPE_CONFIG[archetype]
      // displayName must not be identical to the raw value (e.g. "chrono", "gmt")
      expect(displayName).not.toBe(archetype)
    }
  })
})
