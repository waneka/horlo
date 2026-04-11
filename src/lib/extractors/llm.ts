import Anthropic from '@anthropic-ai/sdk'
import * as cheerio from 'cheerio'
import type { ExtractedWatchData } from './types'
import type { MovementType, StrapType, CrystalType } from '@/lib/types'
import {
  STYLE_TAGS,
  DESIGN_TRAITS,
  ROLE_TAGS,
  COMPLICATIONS,
  DIAL_COLORS,
  MOVEMENT_TYPES,
  STRAP_TYPES,
  CRYSTAL_TYPES,
} from '@/lib/constants'

const EXTRACTION_PROMPT = `You are extracting watch specifications from a product page. Extract as much information as possible from the provided text.

Return a JSON object with these fields (omit fields if not found):
{
  "brand": "string - watch brand/manufacturer",
  "model": "string - model name",
  "reference": "string - reference number",
  "movement": "automatic|manual|quartz|spring-drive|other",
  "complications": ["array of: ${COMPLICATIONS.join(', ')}"],
  "caseSizeMm": number (just the number, e.g., 42),
  "lugToLugMm": number,
  "waterResistanceM": number (in meters),
  "strapType": "bracelet|leather|rubber|nato|other",
  "crystalType": "one of: ${CRYSTAL_TYPES.join(', ')}",
  "dialColor": "one of: ${DIAL_COLORS.join(', ')}",
  "styleTags": ["array of: ${STYLE_TAGS.join(', ')}"],
  "designTraits": ["array of: ${DESIGN_TRAITS.join(', ')}"],
  "marketPrice": number (USD, no currency symbol)
}

Important:
- Only include fields you're confident about
- styleTags should describe what TYPE of watch it is (diver, dress, field, etc.)
- designTraits should describe visual/aesthetic characteristics
- For complications, only include features VISIBLE on the dial:
  - "power-reserve" means a power reserve INDICATOR on the dial, NOT just "50hr power reserve" as a movement spec
  - "date" means a date window/aperture on the dial
  - "chrono" means chronograph pushers and subdials
- Return ONLY valid JSON, no explanation

Page content:
`

export async function extractWithLlm(html: string): Promise<ExtractedWatchData> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  // Extract readable text from HTML
  const pageText = extractReadableText(html)

  // Truncate if too long (keep first ~8k chars to stay within token limits)
  const truncatedText = pageText.length > 8000
    ? pageText.substring(0, 8000) + '...[truncated]'
    : pageText

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: EXTRACTION_PROMPT + truncatedText,
      },
    ],
  })

  // Extract text from response
  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from LLM')
  }

  // Parse JSON from response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in LLM response')
  }

  const parsed = JSON.parse(jsonMatch[0])
  return validateAndCleanData(parsed)
}

function extractReadableText(html: string): string {
  const $ = cheerio.load(html)

  // Remove non-content elements
  $('script, style, nav, footer, header, aside, .menu, .navigation, .sidebar, .ad, .advertisement').remove()

  // Get title
  const title = $('title').text().trim()

  // Get main content text
  const mainContent = $('main, article, [role="main"], .product, .content, #content')
    .first()
    .text()

  // If no main content found, get body text
  const bodyText = mainContent || $('body').text()

  // Clean up whitespace
  const cleanText = bodyText
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim()

  return `Title: ${title}\n\n${cleanText}`
}

function validateAndCleanData(data: Record<string, unknown>): ExtractedWatchData {
  const cleaned: ExtractedWatchData = {}

  if (typeof data.brand === 'string' && data.brand.length > 0) {
    cleaned.brand = data.brand
  }

  if (typeof data.model === 'string' && data.model.length > 0) {
    cleaned.model = data.model
  }

  if (typeof data.reference === 'string' && data.reference.length > 0) {
    cleaned.reference = data.reference
  }

  if (typeof data.movement === 'string' && MOVEMENT_TYPES.includes(data.movement as typeof MOVEMENT_TYPES[number])) {
    cleaned.movement = data.movement as MovementType
  }

  if (Array.isArray(data.complications)) {
    const validComps = data.complications.filter(
      (c): c is string => typeof c === 'string' && COMPLICATIONS.includes(c as typeof COMPLICATIONS[number])
    )
    if (validComps.length > 0) {
      cleaned.complications = validComps
    }
  }

  if (typeof data.caseSizeMm === 'number' && data.caseSizeMm >= 20 && data.caseSizeMm <= 55) {
    cleaned.caseSizeMm = data.caseSizeMm
  }

  if (typeof data.lugToLugMm === 'number' && data.lugToLugMm >= 30 && data.lugToLugMm <= 60) {
    cleaned.lugToLugMm = data.lugToLugMm
  }

  if (typeof data.waterResistanceM === 'number' && data.waterResistanceM >= 30) {
    cleaned.waterResistanceM = data.waterResistanceM
  }

  if (typeof data.strapType === 'string' && STRAP_TYPES.includes(data.strapType as typeof STRAP_TYPES[number])) {
    cleaned.strapType = data.strapType as StrapType
  }

  if (typeof data.crystalType === 'string' && CRYSTAL_TYPES.includes(data.crystalType as typeof CRYSTAL_TYPES[number])) {
    cleaned.crystalType = data.crystalType as CrystalType
  }

  if (typeof data.dialColor === 'string' && DIAL_COLORS.includes(data.dialColor as typeof DIAL_COLORS[number])) {
    cleaned.dialColor = data.dialColor
  }

  if (Array.isArray(data.styleTags)) {
    const validTags = data.styleTags.filter(
      (t): t is string => typeof t === 'string' && STYLE_TAGS.includes(t as typeof STYLE_TAGS[number])
    )
    if (validTags.length > 0) {
      cleaned.styleTags = validTags
    }
  }

  if (Array.isArray(data.designTraits)) {
    const validTraits = data.designTraits.filter(
      (t): t is string => typeof t === 'string' && DESIGN_TRAITS.includes(t as typeof DESIGN_TRAITS[number])
    )
    if (validTraits.length > 0) {
      cleaned.designTraits = validTraits
    }
  }

  if (typeof data.marketPrice === 'number' && data.marketPrice > 0) {
    cleaned.marketPrice = data.marketPrice
  }

  return cleaned
}
