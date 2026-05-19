// src/lib/archetype-config.ts
//
// Phase 46 D-15 / D-16: editorial archetype config for the Collector Archetypes
// chip rail and the /search archetype editorial header.
//
// 10-entry static lookup — one entry per PRIMARY_ARCHETYPES value. Display names
// and descriptions are editorial content (D-16); proposed defaults below are the
// locked-in working values per planner discretion (owner reviews at UAT).
// No zod schema — this is a static lookup; values never change without a code deploy.

import type { PrimaryArchetype } from '@/lib/types'

export interface ArchetypeConfig {
  value: PrimaryArchetype
  displayName: string
  description: string
}

export const ARCHETYPE_CONFIG: Record<PrimaryArchetype, ArchetypeConfig> = {
  dress: {
    value: 'dress',
    displayName: 'Dress Watch Devotee',
    description: 'Minimal dials, precious metals, and movements worth showing off',
  },
  dive: {
    value: 'dive',
    displayName: 'Dive Watch Devotee',
    description: 'Built for depth, worn everywhere',
  },
  field: {
    value: 'field',
    displayName: 'Field Watch Devotee',
    description: 'Legible, robust, and built for real conditions',
  },
  pilot: {
    value: 'pilot',
    displayName: 'Pilot Watch Devotee',
    description: 'Large cases, clean dials, and a history that earns its place',
  },
  chrono: {
    value: 'chrono',
    displayName: 'Chronograph Collector',
    description: 'The complication that started most collections',
  },
  gmt: {
    value: 'gmt',
    displayName: 'GMT Traveler',
    description: 'Two time zones, one wrist',
  },
  racing: {
    value: 'racing',
    displayName: 'Racing Watch Fan',
    description: 'Tachymeters, pulsometers, and the smell of gasoline',
  },
  sport: {
    value: 'sport',
    displayName: 'Sport Watch Enthusiast',
    description: 'Versatile, tough, and ready for whatever the day brings',
  },
  tool: {
    value: 'tool',
    displayName: 'Tool Watch Purist',
    description: 'No unnecessary details — just function, executed perfectly',
  },
  hybrid: {
    value: 'hybrid',
    displayName: 'Genre Crosser',
    description: "The watches that don't stay in one lane",
  },
}
