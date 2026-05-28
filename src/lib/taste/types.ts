// src/lib/taste/types.ts
//
// Module-local types. Public CatalogTasteAttributes lives in src/lib/types.ts
// (Plan 01) and is re-exported from vocab.ts for convenience.

import type { CatalogTasteAttributes } from '@/lib/types'

// Phase 66 (EXTR-04 / D-03): added 'structured-input' for the structured-INPUT
// LLM extraction path (user-supplied {brand, model, reference?, year?}). Additive
// extension — all existing callers using 'manual' / 'url-extract' / 'backfill'
// remain valid. No exhaustive switch consumers, no signature ripple.
export type EnrichmentSource = 'manual' | 'url-extract' | 'backfill' | 'structured-input'
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
