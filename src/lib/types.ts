export type WatchStatus = 'owned' | 'wishlist' | 'sold' | 'grail'

export type MovementType = 'auto' | 'manual' | 'quartz' | 'spring_drive'

// Phase 35 D-09: factual era classification — independent of era_signal (Phase 19.1).
export type WatchEra =
  | '1900-1910' | '1910-1920' | '1920-1930' | '1930-1940' | '1940-1950'
  | '1950-1960' | '1960-1970' | '1970-1980' | '1980-1990' | '1990-2000'
  | '2000-2010' | '2010-2020' | '2020-2030'

export type StrapType = 'bracelet' | 'leather' | 'rubber' | 'nato' | 'other'

export type CrystalType = 'sapphire' | 'mineral' | 'acrylic' | 'hesalite' | 'hardlex'

// Phase 37 D-02: collector-grade condition pgEnum mirror (CAT-18)
export type ConditionGrade =
  | 'mint' | 'near_mint' | 'excellent' | 'good' | 'fair' | 'poor'

// Phase 37 D-03 / D-04: currency code pgEnum mirror (CAT-18)
// Covers 99%+ of watch-collecting transactions per D-03 rationale.
export type CurrencyCode =
  | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF'
  | 'AUD' | 'CAD' | 'HKD' | 'SGD' | 'CNY'

// Phase 37 D-05: box/papers documentation pgEnum mirror (CAT-18)
// ROADMAP-locked 4 values verbatim.
export type BoxPapersStatus =
  | 'none' | 'box_only' | 'papers_only' | 'full_set'

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

  movement?: MovementType
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

  // Phase 37 D-01..D-08 — collector provenance fields (all nullable; CAT-18)
  serial?: string
  yearOfAcquisition?: number
  condition?: ConditionGrade
  boxPapers?: BoxPapersStatus
  serviceHistory?: string
  paidCurrency?: CurrencyCode
  purchaseDate?: string   // ISO date string 'YYYY-MM-DD' — matches <input type="date"> + Postgres date type

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

/**
 * Phase 37 D-09 — divestments row (CAT-18).
 * Records the user's sale of a watch with timestamp / price / replacement / notes.
 * Future recommender (SEED-002) reads `divestedAt` for temporal decay; v6.0
 * market-value engine reads `salePrice` + `saleCurrency`.
 * Linked to watches_catalog (not watches) per D-13 — cross-collector queries
 * are intentional ("how many people sold this Sub?"). 1:1 with the sold watch
 * is a soft convention only — no UNIQUE constraint in the DB.
 */
export interface Divestment {
  id: string
  catalogId: string
  userId: string
  divestedAt: string                       // ISO timestamp string from Postgres timestamptz
  replacedByCatalogId?: string | null
  salePrice?: number | null
  saleCurrency?: CurrencyCode | null
  notes?: string | null
  createdAt: string
  updatedAt: string
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
  // Phase 35 D-03: structured movement (replaces free-text movement column)
  movementType: MovementType | null
  movementCaliber: string | null
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
