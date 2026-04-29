// src/lib/taste/types.ts
//
// Module-local types. Public CatalogTasteAttributes lives in src/lib/types.ts
// (Plan 01) and is re-exported from vocab.ts for convenience.

import type { CatalogTasteAttributes } from '@/lib/types'

export type EnrichmentSource = 'manual' | 'url-extract' | 'backfill'
export type EnrichmentMode = 'text' | 'vision'

export interface EnrichmentSpecInput {
  brand: string
  model: string
  reference: string | null
  movement: string | null
  caseSizeMm: number | null
  lugToLugMm: number | null
  waterResistanceM: number | null
  crystalType: string | null
  dialColor: string | null
  isChronometer: boolean | null
  productionYear: number | null
  complications: string[]
}

export interface EnrichmentInput {
  catalogId: string
  source: EnrichmentSource
  spec: EnrichmentSpecInput
  // When set, enricher fetches via signed URL + runs vision mode (D-08).
  photoSourcePath?: string | null
}

// Result type (camelCase). Wraps CatalogTasteAttributes for API ergonomics.
export type EnrichmentResult = CatalogTasteAttributes | null
