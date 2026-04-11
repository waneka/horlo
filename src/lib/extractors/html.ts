import * as cheerio from 'cheerio'
import type { ExtractedWatchData } from './types'
import type { MovementType, StrapType } from '@/lib/types'
import { DIAL_COLORS, MOVEMENT_TYPES, STRAP_TYPES, COMPLICATIONS } from '@/lib/constants'

export function extractFromHtml(html: string): ExtractedWatchData {
  const $ = cheerio.load(html)
  const data: ExtractedWatchData = {}

  // Get page text for pattern matching
  const pageText = $('body').text().toLowerCase()
  const pageTextNormalized = pageText.replace(/\s+/g, ' ')

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

  // Look for labeled spans/divs (common pattern)
  $('[class*="spec"], [class*="detail"], [class*="feature"]').each((_, el) => {
    const text = $(el).text()
    parseSpecText(text, data)
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

  // Extract specs from page text patterns
  extractFromPageText(pageTextNormalized, data)

  // Try to identify complications
  extractComplications(pageTextNormalized, data)

  return data
}

function extractFromTitle(title: string, data: ExtractedWatchData): void {
  // Common watch brands
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

      // Try to extract model (text after brand)
      const brandIndex = title.toLowerCase().indexOf(brand.toLowerCase())
      const afterBrand = title.substring(brandIndex + brand.length).trim()
      if (afterBrand && !data.model) {
        // Take first part before common separators
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
  // Case size / diameter
  if (label.includes('case') && (label.includes('size') || label.includes('diameter'))) {
    const match = value.match(/(\d+(?:\.\d+)?)\s*mm/i)
    if (match) {
      const size = parseFloat(match[1])
      if (size >= 20 && size <= 55) {
        data.caseSizeMm = size
      }
    }
  }

  // Lug to lug
  if (label.includes('lug') && label.includes('lug')) {
    const match = value.match(/(\d+(?:\.\d+)?)\s*mm/i)
    if (match) {
      data.lugToLugMm = parseFloat(match[1])
    }
  }

  // Water resistance
  if (label.includes('water') || label.includes('wr')) {
    const match = value.match(/(\d+)\s*m/i)
    if (match) {
      const wr = parseInt(match[1])
      if (wr >= 30 && wr <= 2000) {
        data.waterResistanceM = wr
      }
    }
  }

  // Movement / Caliber
  if (label.includes('movement') || label.includes('caliber') || label.includes('calibre')) {
    const valueLower = value.toLowerCase()
    for (const movement of MOVEMENT_TYPES) {
      if (valueLower.includes(movement)) {
        data.movement = movement as MovementType
        break
      }
    }
  }

  // Dial
  if (label.includes('dial')) {
    const valueLower = value.toLowerCase()
    for (const color of DIAL_COLORS) {
      if (valueLower.includes(color)) {
        data.dialColor = color
        break
      }
    }
  }

  // Strap / Bracelet
  if (label.includes('strap') || label.includes('bracelet') || label.includes('band')) {
    const valueLower = value.toLowerCase()
    for (const strap of STRAP_TYPES) {
      if (valueLower.includes(strap)) {
        data.strapType = strap as StrapType
        break
      }
    }
  }

  // Reference / Model number
  if (label.includes('reference') || label.includes('ref') || label.includes('model number')) {
    if (value.length > 0 && value.length < 30) {
      data.reference = value
    }
  }
}

function parseSpecText(text: string, data: ExtractedWatchData): void {
  const textLower = text.toLowerCase()

  // Case size pattern: "42mm" or "42 mm"
  const caseSizeMatch = textLower.match(/(\d{2})\s*mm/)
  if (caseSizeMatch && !data.caseSizeMm) {
    const size = parseInt(caseSizeMatch[1])
    if (size >= 30 && size <= 50) {
      data.caseSizeMm = size
    }
  }
}

function extractFromPageText(text: string, data: ExtractedWatchData): void {
  // Case size patterns
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

  // Water resistance patterns
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

  // Movement
  if (!data.movement) {
    if (text.includes('automatic') || text.includes('self-winding') || text.includes('self winding')) {
      data.movement = 'automatic'
    } else if (text.includes('manual') || text.includes('hand-wound') || text.includes('hand wound')) {
      data.movement = 'manual'
    } else if (text.includes('quartz')) {
      data.movement = 'quartz'
    } else if (text.includes('spring drive')) {
      data.movement = 'spring-drive'
    }
  }
}

function extractComplications(text: string, data: ExtractedWatchData): void {
  const found: string[] = []

  const complicationPatterns: Record<string, string[]> = {
    'date': ['date', 'day-date', 'date window', 'date display'],
    'day-date': ['day-date', 'day and date', 'day/date'],
    'gmt': ['gmt', 'dual time', 'second timezone', 'second time zone'],
    'chrono': ['chronograph', 'chrono', 'stopwatch'],
    'moon-phase': ['moon phase', 'moonphase', 'moon-phase'],
    'power-reserve': ['power reserve', 'power-reserve'],
    'world-time': ['world time', 'worldtime', 'world-time'],
  }

  for (const [complication, patterns] of Object.entries(complicationPatterns)) {
    for (const pattern of patterns) {
      if (text.includes(pattern)) {
        if (!found.includes(complication)) {
          found.push(complication)
        }
        break
      }
    }
  }

  if (found.length > 0) {
    data.complications = found
  }
}
