import * as cheerio from 'cheerio'
import type { ExtractedWatchData } from './types'

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

/**
 * Extracts non-ambiguous watch fields from JSON-LD structured data.
 * Ambiguous fields (complications, movement, style, etc.) are left
 * to the LLM which receives the raw JSON-LD as context.
 */
export function extractStructuredData(html: string): ExtractedWatchData {
  const $ = cheerio.load(html)
  const data: ExtractedWatchData = {}

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}')
      const products = findProducts(json)

      for (const product of products) {
        if (product.brand) {
          data.brand = typeof product.brand === 'string'
            ? product.brand
            : product.brand.name
        }

        if (product.model) {
          data.model = product.model
        } else if (product.name && !data.model) {
          const name = product.name
          if (data.brand && name.startsWith(data.brand)) {
            data.model = name.replace(data.brand, '').trim()
          } else {
            data.model = name
          }
        }

        if (product.sku) {
          data.reference = product.sku
        } else if (product.mpn) {
          data.reference = product.mpn
        }

        if (product.image) {
          if (typeof product.image === 'string') {
            data.imageUrl = product.image
          } else if (Array.isArray(product.image)) {
            data.imageUrl = product.image[0]
          } else if (product.image.url) {
            data.imageUrl = product.image.url
          }
        }

        if (product.offers) {
          const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers
          if (offer.price) {
            const price = typeof offer.price === 'string' ? parseFloat(offer.price) : offer.price
            if (!isNaN(price)) {
              data.marketPrice = price
            }
          }
        }
      }
    } catch {
      // Invalid JSON, skip
    }
  })

  return data
}

/**
 * Returns raw JSON-LD blocks as a string for LLM context.
 * The LLM can cross-reference this against the page text.
 */
export function extractRawJsonLd(html: string): string {
  const $ = cheerio.load(html)
  const blocks: string[] = []

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html()
      if (raw) {
        const parsed = JSON.parse(raw)
        blocks.push(JSON.stringify(parsed, null, 2))
      }
    } catch {
      // Invalid JSON, skip
    }
  })

  return blocks.length > 0
    ? `Structured data (JSON-LD) found on page:\n${blocks.join('\n\n')}`
    : ''
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

    if (Array.isArray(obj['@graph'])) {
      products.push(...findProducts(obj['@graph']))
    }
  }

  return products
}
