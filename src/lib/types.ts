export type WatchStatus = 'owned' | 'wishlist' | 'sold' | 'grail'

export type MovementType = 'automatic' | 'manual' | 'quartz' | 'spring-drive' | 'other'

export type StrapType = 'bracelet' | 'leather' | 'rubber' | 'nato' | 'other'

export type CrystalType = 'sapphire' | 'mineral' | 'acrylic' | 'hesalite' | 'hardlex'

export type OverlapTolerance = 'low' | 'medium' | 'high'

export type CollectionGoal =
  | 'balanced'
  | 'specialist'
  | 'variety-within-theme'
  | 'brand-loyalist'

export interface Watch {
  id: string

  brand: string
  model: string
  reference?: string

  status: WatchStatus

  pricePaid?: number
  targetPrice?: number
  marketPrice?: number

  movement: MovementType
  complications: string[]

  caseSizeMm?: number
  lugToLugMm?: number
  waterResistanceM?: number

  strapType?: StrapType
  crystalType?: CrystalType

  dialColor?: string

  styleTags: string[]
  designTraits: string[]
  roleTags: string[]

  acquisitionDate?: string

  productionYear?: number   // 4-digit year, optional; manual entry only in Phase 2
  isFlaggedDeal?: boolean   // Wishlist-only manual "good deal" override (FEAT-04)
  isChronometer?: boolean   // COSC or equivalent chronometer certification

  notes?: string
  notesPublic?: boolean       // Per-note visibility (D-13). Defaults to true server-side.
  notesUpdatedAt?: string     // ISO timestamp string for the most recent notes change.
  imageUrl?: string

  // Phase 17: FK to watches_catalog (CAT-08). Nullable — backfill not guaranteed on all rows.
  // Used by Phase 20 composer to look up catalog taste attributes for the verdict bundle.
  catalogId?: string | null

  // Phase 27 — sort_order for wishlist drag-reorder (D-01).
  // Optional in domain type; DB-side default 0 ensures it's always present
  // post-migration. Used by getWatchesByUser ORDER BY and the WishlistTabContent
  // optimistic state in Plan 05.
  sortOrder?: number
}

/** Watch with computed wear data from wear_events table */
export interface WatchWithWear extends Watch {
  lastWornDate?: string  // computed from most recent wear_events row
}

export interface UserPreferences {
  preferredStyles: string[]
  dislikedStyles: string[]

  preferredDesignTraits: string[]
  dislikedDesignTraits: string[]

  preferredComplications: string[]
  complicationExceptions: string[]

  preferredDialColors: string[]
  dislikedDialColors: string[]

  preferredCaseSizeRange?: {
    min: number
    max: number
  }

  overlapTolerance: OverlapTolerance

  collectionGoal?: CollectionGoal

  notes?: string
}

export type SimilarityLabel =
  | 'core-fit'
  | 'familiar-territory'
  | 'role-duplicate'
  | 'taste-expansion'
  | 'outlier'
  | 'hard-mismatch'

export interface SimilarityResult {
  label: SimilarityLabel
  score: number
  mostSimilarWatches: Array<{ watch: Watch; score: number }>
  roleOverlap: boolean
  reasoning: string[]
}

export type { GapFillResult } from './gapFill'

// Phase 17 — canonical watches catalog (D-04, D-06)
export type CatalogSource = 'user_promoted' | 'url_extracted' | 'admin_curated'
export type ImageSourceQuality = 'official' | 'retailer' | 'unknown' | 'user_uploaded'

export interface CatalogEntry {
  id: string
  brand: string
  model: string
  reference: string | null
  source: CatalogSource
  imageUrl: string | null
  imageSourceUrl: string | null
  imageSourceQuality: ImageSourceQuality | null
  movement: string | null
  caseSizeMm: number | null
  lugToLugMm: number | null
  waterResistanceM: number | null
  crystalType: string | null
  dialColor: string | null
  isChronometer: boolean | null
  productionYear: number | null
  productionYearIsEstimate: boolean
  styleTags: string[]
  designTraits: string[]
  roleTags: string[]
  complications: string[]
  ownersCount: number
  wishlistCount: number
  // Phase 19.1 D-01 taste attributes
  formality: number | null
  sportiness: number | null
  heritageScore: number | null
  primaryArchetype: PrimaryArchetype | null
  eraSignal: EraSignal | null
  designMotifs: string[]
  confidence: number | null
  extractedFromPhoto: boolean
  createdAt: string
  updatedAt: string
}

// Phase 19.1 D-01: LLM-derived taste attributes cached on watches_catalog.
// Per-row, computed once at catalog write time, refreshed only via
// `npm run db:reenrich-taste --force` (D-13).
export interface CatalogTasteAttributes {
  formality: number | null         // 0..1
  sportiness: number | null        // 0..1
  heritageScore: number | null     // 0..1
  primaryArchetype: PrimaryArchetype | null
  eraSignal: EraSignal | null
  designMotifs: string[]           // closed vocab from src/lib/taste/vocab.ts (validated at write)
  confidence: number | null        // 0..1
  extractedFromPhoto: boolean
}

// Vocab-aligned literal unions for taste categoricals (D-02).
// Source of truth: src/lib/taste/vocab.ts (Plan 02). Duplicated here for type-system
// consumption without circular import; keep in sync.
export type PrimaryArchetype =
  | 'dress' | 'dive' | 'field' | 'pilot' | 'chrono'
  | 'gmt' | 'racing' | 'sport' | 'tool' | 'hybrid'
export type EraSignal = 'vintage-leaning' | 'modern' | 'contemporary'
