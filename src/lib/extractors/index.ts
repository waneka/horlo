import { extractStructuredData } from './structured'
import { extractFromHtml } from './html'
import { extractWithLlm } from './llm'
import {
  type ExtractedWatchData,
  type ExtractionResult,
  isDataComplete,
  mergeExtractedData,
  countPopulatedFields,
} from './types'

export type { ExtractedWatchData, ExtractionResult }

export interface ExtractionOptions {
  useLlmFallback?: boolean
  forceLlm?: boolean
}

export async function extractWatchData(
  html: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const { useLlmFallback = true, forceLlm = false } = options

  // Step 1: Try structured data extraction
  const structuredData = extractStructuredData(html)
  const structuredFields = Object.keys(structuredData).filter(
    (k) => structuredData[k as keyof ExtractedWatchData] !== undefined
  )

  // Step 2: Try HTML pattern extraction
  const htmlData = extractFromHtml(html)
  const htmlFields = Object.keys(htmlData).filter(
    (k) => htmlData[k as keyof ExtractedWatchData] !== undefined
  )

  // Merge structured + HTML (structured takes precedence)
  let mergedData = mergeExtractedData(structuredData, htmlData)
  let allFields = [...new Set([...structuredFields, ...htmlFields])]

  // Step 3: Check if we need LLM
  const needsLlm = forceLlm || (useLlmFallback && !isDataComplete(mergedData))
  let llmUsed = false

  if (needsLlm) {
    try {
      const llmData = await extractWithLlm(html)
      const llmFields = Object.keys(llmData).filter(
        (k) => llmData[k as keyof ExtractedWatchData] !== undefined
      )

      // Merge: existing data takes precedence, LLM fills gaps
      mergedData = mergeExtractedData(mergedData, llmData)
      allFields = [...new Set([...allFields, ...llmFields])]
      llmUsed = true
    } catch (error) {
      // LLM failed, continue with what we have
      console.error('LLM extraction failed:', error)
    }
  }

  // Determine confidence
  const fieldCount = countPopulatedFields(mergedData)
  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (fieldCount >= 8) {
    confidence = 'high'
  } else if (fieldCount >= 5) {
    confidence = 'medium'
  }

  return {
    data: mergedData,
    source: 'merged',
    confidence,
    fieldsExtracted: allFields,
    llmUsed,
  }
}

export async function fetchAndExtract(
  url: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  // Fetch the page
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; WatchCollectionBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  return extractWatchData(html, options)
}
