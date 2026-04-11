import * as cheerio from 'cheerio'
import type { ExtractedWatchData } from './types'
import type { MovementType, StrapType } from '@/lib/types'
import { DIAL_COLORS, MOVEMENT_TYPES, STRAP_TYPES } from '@/lib/constants'

interface JsonLdProduct {
  '@type'?: string
  name?: string
  brand?: { name?: string } | string
  model?: string
  sku?: string
  mpn?: string
  description?: string
  image?: string | string[] | { url?: string }
  offers?: {
    price?: number | string
    priceCurrency?: string
  } | Array<{ price?: number | string }>
}

export function extractStructuredData(html: string): ExtractedWatchData {
  const $ = cheerio.load(html)
  const data: ExtractedWatchData = {}

  // Find JSON-LD scripts
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}')
      const products = findProducts(json)

      for (const product of products) {
        // Brand
        if (product.brand) {
          data.brand = typeof product.brand === 'string'
            ? product.brand
            : product.brand.name
        }

        // Model / Name
        if (product.model) {
          data.model = product.model
        } else if (product.name && !data.model) {
          // Try to extract model from name (often "Brand Model Reference")
          const name = product.name
          if (data.brand && name.startsWith(data.brand)) {
            data.model = name.replace(data.brand, '').trim()
          } else {
            data.model = name
          }
        }

        // Reference number
        if (product.sku) {
          data.reference = product.sku
        } else if (product.mpn) {
          data.reference = product.mpn
        }

        // Image
        if (product.image) {
          if (typeof product.image === 'string') {
            data.imageUrl = product.image
          } else if (Array.isArray(product.image)) {
            data.imageUrl = product.image[0]
          } else if (product.image.url) {
            data.imageUrl = product.image.url
          }
        }

        // Price
        if (product.offers) {
          const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers
          if (offer.price) {
            const price = typeof offer.price === 'string' ? parseFloat(offer.price) : offer.price
            if (!isNaN(price)) {
              data.marketPrice = price
            }
          }
        }

        // Try to extract specs from description
        if (product.description) {
          extractFromDescription(product.description, data)
        }
      }
    } catch {
      // Invalid JSON, skip
    }
  })

  return data
}

function findProducts(json: unknown): JsonLdProduct[] {
  const products: JsonLdProduct[] = []

  if (Array.isArray(json)) {
    for (const item of json) {
      products.push(...findProducts(item))
    }
  } else if (typeof json === 'object' && json !== null) {
    const obj = json as Record<string, unknown>

    if (obj['@type'] === 'Product' || obj['@type'] === 'Watch') {
      products.push(obj as JsonLdProduct)
    }

    // Check @graph
    if (Array.isArray(obj['@graph'])) {
      products.push(...findProducts(obj['@graph']))
    }
  }

  return products
}

function extractFromDescription(description: string, data: ExtractedWatchData): void {
  const desc = description.toLowerCase()

  // Case size
  const caseSizeMatch = desc.match(/(\d{2})\s*mm\s*(case|diameter)/i)
    || desc.match(/case\s*(size|diameter)[:\s]*(\d{2})\s*mm/i)
  if (caseSizeMatch) {
    const size = parseInt(caseSizeMatch[1] || caseSizeMatch[2])
    if (size >= 20 && size <= 55) {
      data.caseSizeMm = size
    }
  }

  // Water resistance
  const wrMatch = desc.match(/(\d+)\s*m\s*(water|wr)/i)
    || desc.match(/water\s*resist[^:]*[:\s]*(\d+)\s*m/i)
  if (wrMatch) {
    const wr = parseInt(wrMatch[1])
    if (wr >= 30 && wr <= 2000) {
      data.waterResistanceM = wr
    }
  }

  // Movement
  for (const movement of MOVEMENT_TYPES) {
    if (desc.includes(movement)) {
      data.movement = movement as MovementType
      break
    }
  }

  // Dial color
  for (const color of DIAL_COLORS) {
    if (desc.includes(color + ' dial')) {
      data.dialColor = color
      break
    }
  }

  // Strap type
  for (const strap of STRAP_TYPES) {
    if (desc.includes(strap)) {
      data.strapType = strap as StrapType
      break
    }
  }
}
