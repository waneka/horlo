import * as cheerio from 'cheerio'
import type { ExtractedWatchData } from './types'

/**
 * Extracts non-ambiguous watch fields from HTML structure.
 * Spec tables, definition lists, and meta tags provide reliable
 * numeric/factual data. Ambiguous fields (complications, movement,
 * style, etc.) are left to the LLM.
 */
export function extractFromHtml(html: string): ExtractedWatchData {
  const $ = cheerio.load(html)
  const data: ExtractedWatchData = {}

  // Extract from title
  const title = $('title').text() || $('h1').first().text()
  if (title) {
    extractFromTitle(title, data)
  }

  // Look for spec tables
  $('table').each((_, table) => {
    $(table).find('tr').each((_, row) => {
      const cells = $(row).find('td, th')
      if (cells.length >= 2) {
        const label = $(cells[0]).text().toLowerCase().trim()
        const value = $(cells[1]).text().trim()
        parseSpecRow(label, value, data)
      }
    })
  })

  // Look for definition lists
  $('dl').each((_, dl) => {
    $(dl).find('dt').each((_, dt) => {
      const label = $(dt).text().toLowerCase().trim()
      const dd = $(dt).next('dd')
      if (dd.length) {
        const value = dd.text().trim()
        parseSpecRow(label, value, data)
      }
    })
  })

  // Extract from meta tags
  const ogImage = $('meta[property="og:image"]').attr('content')
  if (ogImage && !data.imageUrl) {
    data.imageUrl = ogImage
  }

  const ogTitle = $('meta[property="og:title"]').attr('content')
  if (ogTitle && !data.brand) {
    extractFromTitle(ogTitle, data)
  }

  // Look for product images
  if (!data.imageUrl) {
    const productImg = $('[class*="product"] img, [class*="gallery"] img, [class*="main"] img').first()
    if (productImg.length) {
      data.imageUrl = productImg.attr('src') || productImg.attr('data-src')
    }
  }

  // Extract numeric specs from page text
  const pageText = $('body').text().toLowerCase().replace(/\s+/g, ' ')
  extractNumericSpecs(pageText, data)

  return data
}

function extractFromTitle(title: string, data: ExtractedWatchData): void {
  const brands = [
    'Rolex', 'Omega', 'Tudor', 'Seiko', 'Grand Seiko', 'Casio', 'G-Shock',
    'Tissot', 'Hamilton', 'Longines', 'Tag Heuer', 'Breitling', 'IWC',
    'Panerai', 'Cartier', 'Jaeger-LeCoultre', 'Audemars Piguet', 'Patek Philippe',
    'Vacheron Constantin', 'A. Lange & Söhne', 'Blancpain', 'Zenith', 'Oris',
    'Nomos', 'Sinn', 'Baltic', 'Mido', 'Certina', 'Frederique Constant',
    'Maurice Lacroix', 'Rado', 'Junghans', 'Glycine', 'Alpina', 'Ball',
    'Christopher Ward', 'Lorier', 'Farer', 'Monta', 'Halios', 'Doxa',
    'Squale', 'Steinhart', 'Orient', 'Citizen', 'Bulova', 'Timex', 'Mondaine'
  ]

  for (const brand of brands) {
    if (title.toLowerCase().includes(brand.toLowerCase())) {
      data.brand = brand

      const brandIndex = title.toLowerCase().indexOf(brand.toLowerCase())
      const afterBrand = title.substring(brandIndex + brand.length).trim()
      if (afterBrand && !data.model) {
        const model = afterBrand.split(/[-–|•]/)[0].trim()
        if (model.length > 0 && model.length < 50) {
          data.model = model
        }
      }
      break
    }
  }
}

function parseSpecRow(label: string, value: string, data: ExtractedWatchData): void {
  if (label.includes('case') && (label.includes('size') || label.includes('diameter'))) {
    const match = value.match(/(\d+(?:\.\d+)?)\s*mm/i)
    if (match) {
      const size = parseFloat(match[1])
      if (size >= 20 && size <= 55) {
        data.caseSizeMm = size
      }
    }
  }

  if (label.includes('lug') && label.includes('lug')) {
    const match = value.match(/(\d+(?:\.\d+)?)\s*mm/i)
    if (match) {
      data.lugToLugMm = parseFloat(match[1])
    }
  }

  if (label.includes('water') || label.includes('wr')) {
    const match = value.match(/(\d+)\s*m/i)
    if (match) {
      const wr = parseInt(match[1])
      if (wr >= 30 && wr <= 2000) {
        data.waterResistanceM = wr
      }
    }
  }

  if (label.includes('reference') || label.includes('ref') || label.includes('model number')) {
    if (value.length > 0 && value.length < 30) {
      data.reference = value
    }
  }
}

function extractNumericSpecs(text: string, data: ExtractedWatchData): void {
  if (!data.caseSizeMm) {
    const patterns = [
      /case\s*(?:size|diameter)[:\s]*(\d{2}(?:\.\d)?)\s*mm/i,
      /(\d{2}(?:\.\d)?)\s*mm\s*(?:case|diameter)/i,
      /diameter[:\s]*(\d{2}(?:\.\d)?)\s*mm/i,
    ]
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        const size = parseFloat(match[1])
        if (size >= 20 && size <= 55) {
          data.caseSizeMm = size
          break
        }
      }
    }
  }

  if (!data.waterResistanceM) {
    const patterns = [
      /water\s*resist[^:]*[:\s]*(\d+)\s*(?:m|meters|metres)/i,
      /(\d+)\s*(?:m|meters|metres)\s*water/i,
      /wr\s*(\d+)/i,
    ]
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        const wr = parseInt(match[1])
        if (wr >= 30 && wr <= 2000) {
          data.waterResistanceM = wr
          break
        }
      }
    }
  }
}
