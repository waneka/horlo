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
  lastWornDate?: string

  productionYear?: number   // 4-digit year, optional; manual entry only in Phase 2
  isFlaggedDeal?: boolean   // Wishlist-only manual "good deal" override (FEAT-04)

  notes?: string
  imageUrl?: string
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
