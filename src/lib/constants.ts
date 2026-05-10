import type { MovementType } from './types'

// Style: What TYPE of watch is this? (functional category)
export const STYLE_TAGS = [
  'diver',
  'dress',
  'field',
  'pilot',
  'chronograph',
  'gmt',
  'sport',
  'tool',
] as const

// Design: What does it LOOK like? (visual/aesthetic traits)
export const DESIGN_TRAITS = [
  'heritage',
  'vintage-inspired',
  'modern',
  'minimalist',
  'bold',
  'refined',
  'utilitarian',
  'textured-dial',
  'applied-indices',
] as const

// Role: How do YOU use this watch? (personal use case)
export const ROLE_TAGS = [
  'daily',
  'gada',
  'travel',
  'weekend',
  'formal',
  'beater',
  'special-occasion',
  'sentimental',
  'grail',
  'fun',
] as const

export const COMPLICATIONS = [
  'date',
  'day-date',
  'gmt',
  'chrono',
  'moon-phase',
  'power-reserve',
  'world-time',
] as const

export const DIAL_COLORS = [
  'black',
  'white',
  'blue',
  'navy',
  'sky blue',
  'green',
  'teal',
  'silver',
  'grey',
  'cream',
  'champagne',
  'salmon',
  'red',
  'burgundy',
  'orange',
  'yellow',
  'brown',
  'bronze',
  'other',
] as const

// Phase 35 D-03a: 4-value DB-canonical enum (matches movement_type_enum in src/db/schema.ts).
// Replaces the legacy 5-value list (automatic, spring-drive, other removed).
export const MOVEMENT_TYPES = ['auto', 'manual', 'quartz', 'spring_drive'] as const

// Phase 35 D-03a: display labels for UI rendering only — never persisted.
// WatchForm uses MOVEMENT_LABELS[v] for display; persists raw enum values.
export const MOVEMENT_LABELS: Record<MovementType, string> = {
  auto:         'Automatic',
  manual:       'Manual',
  quartz:       'Quartz',
  spring_drive: 'Spring Drive',
}

// Phase 35 D-10: case material suggested-label list. Free text in DB (no CHECK constraint).
// Specialty alloys (e.g., 'ceramic-titanium-hybrid') flow through as freeform strings.
// Variant-level material variation lives on Phase 36 watch_variants.
export const CASE_MATERIALS_SUGGESTED = [
  'steel',
  'gold-yellow',
  'gold-rose',
  'gold-white',
  'two-tone-steel-gold',
  'titanium',
  'ceramic',
  'bronze',
  'platinum',
  'carbon-fiber',
] as const

// Phase 35 D-11: bracelet config suggested-label list. Free text in DB (no CHECK constraint).
// Multi-bracelet variants (Daytona Oysterflex vs Oyster) live on Phase 36 watch_variants.
export const BRACELET_CONFIGS_SUGGESTED = [
  'integrated-bracelet',  // AP Royal Oak, PP Nautilus
  'bracelet-only',        // Sub on Oyster only
  'leather-strap-only',   // Speedy Pro on leather
  'rubber-strap-only',    // Daytona Oysterflex variant
  'bracelet-and-strap',   // Ships with both
  'nato-strap',
  'bund-strap',
] as const

export const STRAP_TYPES = [
  'bracelet',
  'leather',
  'rubber',
  'nato',
  'other',
] as const

export const CRYSTAL_TYPES = [
  'sapphire',
  'mineral',
  'acrylic',
  'hesalite',
  'hardlex',
] as const

export const WATCH_STATUSES = [
  'owned',
  'wishlist',
  'sold',
  'grail',
] as const

export type StyleTag = (typeof STYLE_TAGS)[number]
export type DesignTrait = (typeof DESIGN_TRAITS)[number]
export type RoleTag = (typeof ROLE_TAGS)[number]
export type Complication = (typeof COMPLICATIONS)[number]
export type DialColor = (typeof DIAL_COLORS)[number]
