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
  'domed-crystal',
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

export const MOVEMENT_TYPES = [
  'automatic',
  'manual',
  'quartz',
  'spring-drive',
  'other',
] as const

export const STRAP_TYPES = [
  'bracelet',
  'leather',
  'rubber',
  'nato',
  'other',
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
