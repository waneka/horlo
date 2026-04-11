import type { MovementType, StrapType, CrystalType } from '@/lib/types'

export interface ExtractedWatchData {
  brand?: string
  model?: string
  reference?: string
  movement?: MovementType
  complications?: string[]
  caseSizeMm?: number
  lugToLugMm?: number
  waterResistanceM?: number
  strapType?: StrapType
  crystalType?: CrystalType
  dialColor?: string
  styleTags?: string[]
  designTraits?: string[]
  pricePaid?: number
  marketPrice?: number
  imageUrl?: string
  notes?: string
}

export interface ExtractionResult {
  data: ExtractedWatchData
  source: 'structured' | 'html' | 'llm' | 'merged'
  confidence: 'high' | 'medium' | 'low'
  fieldsExtracted: string[]
  llmUsed: boolean
}

export function countPopulatedFields(data: ExtractedWatchData): number {
  let count = 0
  if (data.brand) count++
  if (data.model) count++
  if (data.reference) count++
  if (data.movement) count++
  if (data.complications?.length) count++
  if (data.caseSizeMm) count++
  if (data.lugToLugMm) count++
  if (data.waterResistanceM) count++
  if (data.strapType) count++
  if (data.dialColor) count++
  if (data.styleTags?.length) count++
  if (data.designTraits?.length) count++
  if (data.marketPrice) count++
  if (data.imageUrl) count++
  return count
}

export function isDataComplete(data: ExtractedWatchData): boolean {
  // Must have brand and model, plus at least 3 other fields
  const hasBrand = !!data.brand
  const hasModel = !!data.model
  const otherFields = countPopulatedFields(data) - (hasBrand ? 1 : 0) - (hasModel ? 1 : 0)

  return hasBrand && hasModel && otherFields >= 3
}

export function mergeExtractedData(
  primary: ExtractedWatchData,
  secondary: ExtractedWatchData
): ExtractedWatchData {
  return {
    brand: primary.brand || secondary.brand,
    model: primary.model || secondary.model,
    reference: primary.reference || secondary.reference,
    movement: primary.movement || secondary.movement,
    complications: primary.complications?.length ? primary.complications : secondary.complications,
    caseSizeMm: primary.caseSizeMm || secondary.caseSizeMm,
    lugToLugMm: primary.lugToLugMm || secondary.lugToLugMm,
    waterResistanceM: primary.waterResistanceM || secondary.waterResistanceM,
    strapType: primary.strapType || secondary.strapType,
    dialColor: primary.dialColor || secondary.dialColor,
    styleTags: primary.styleTags?.length ? primary.styleTags : secondary.styleTags,
    designTraits: primary.designTraits?.length ? primary.designTraits : secondary.designTraits,
    marketPrice: primary.marketPrice || secondary.marketPrice,
    imageUrl: primary.imageUrl || secondary.imageUrl,
    notes: primary.notes || secondary.notes,
  }
}
