import { extractStructuredData, extractRawJsonLd } from './structured'
import { extractFromHtml } from './html'
import { extractWithLlm } from './llm'
import { safeFetch } from '@/lib/ssrf'
import {
  type ExtractedWatchData,
  type ExtractionResult,
  mergeExtractedData,
  countPopulatedFields,
} from './types'

export type { ExtractedWatchData, ExtractionResult }

const NON_AMBIGUOUS_FIELDS: (keyof ExtractedWatchData)[] = [
  'brand', 'model', 'reference', 'imageUrl', 'marketPrice',
  'caseSizeMm', 'lugToLugMm', 'waterResistanceM',
]

export async function extractWatchData(html: string): Promise<ExtractionResult> {
  // Step 1: Extract non-ambiguous fields from structured data + HTML
  const structuredData = extractStructuredData(html)
  const htmlData = extractFromHtml(html)
  const staticData = mergeExtractedData(structuredData, htmlData)

  // Step 2: Get raw JSON-LD for LLM context
  const rawJsonLd = extractRawJsonLd(html)

  // Step 3: Always run LLM — it handles ambiguous fields and gets
  // structured data as context to cross-reference
  const llmData = await extractWithLlm(html, rawJsonLd || undefined)

  // Step 4: Merge — non-ambiguous fields prefer static extraction,
  // ambiguous fields prefer LLM
  const merged: ExtractedWatchData = { ...llmData }
  for (const field of NON_AMBIGUOUS_FIELDS) {
    const staticValue = staticData[field]
    if (staticValue !== undefined) {
      ;(merged as Record<string, unknown>)[field] = staticValue
    }
  }

  const allFields = [
    ...new Set([
      ...Object.keys(staticData).filter(k => staticData[k as keyof ExtractedWatchData] !== undefined),
      ...Object.keys(llmData).filter(k => llmData[k as keyof ExtractedWatchData] !== undefined),
    ]),
  ]

  const fieldCount = countPopulatedFields(merged)
  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (fieldCount >= 8) {
    confidence = 'high'
  } else if (fieldCount >= 5) {
    confidence = 'medium'
  }

  return {
    data: merged,
    source: 'merged',
    confidence,
    fieldsExtracted: allFields,
    llmUsed: true,
  }
}

export async function fetchAndExtract(url: string): Promise<ExtractionResult> {
  const response = await safeFetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; WatchCollectionBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  return extractWatchData(html)
}
