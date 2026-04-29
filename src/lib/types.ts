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

// Phase 19.1 — catalog taste enrichment attributes (D-01, D-11)
export type PrimaryArchetype =
  | 'dress' | 'dive' | 'field' | 'pilot' | 'chrono'
  | 'gmt' | 'racing' | 'sport' | 'tool' | 'hybrid'

export type EraSignal = 'vintage-leaning' | 'modern' | 'contemporary'

export interface CatalogTasteAttributes {
  formality: number | null
  sportiness: number | null
  heritageScore: number | null
  primaryArchetype: PrimaryArchetype | null
  eraSignal: EraSignal | null
  designMotifs: string[]
  confidence: number | null
  extractedFromPhoto: boolean
}

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
  createdAt: string
  updatedAt: string
}
