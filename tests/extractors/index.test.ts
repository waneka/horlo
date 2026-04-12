import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractStructuredData, extractRawJsonLd } from '@/lib/extractors/structured'
import { extractFromHtml } from '@/lib/extractors/html'
import { mergeExtractedData } from '@/lib/extractors/types'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, '../fixtures/pages', name), 'utf-8')
}

describe('offline extraction (structured + HTML merge)', () => {
  it('prefers structured data over HTML fallback when both present', () => {
    const html = loadFixture('partial.html')
    const structured = extractStructuredData(html)
    const htmlData = extractFromHtml(html)
    const merged = mergeExtractedData(structured, htmlData)
    expect(merged.brand).toBe('Omega')
    expect(merged.brand).not.toMatch(/WRONG/i)
  })

  it('extracts brand and fields from structured JSON-LD fixture', () => {
    const html = loadFixture('structured-jsonld.html')
    const structured = extractStructuredData(html)
    expect(structured.brand).toBe('Rolex')
    expect(structured.marketPrice).toBeDefined()
    expect(structured.imageUrl).toBeDefined()
  })

  it('extracts fields from HTML-only fixture', () => {
    const html = loadFixture('html-only.html')
    const htmlData = extractFromHtml(html)
    expect(htmlData).toBeDefined()
    expect(Object.keys(htmlData).length).toBeGreaterThan(0)
  })

  it('extractRawJsonLd returns raw JSON-LD text for LLM context', () => {
    const html = loadFixture('structured-jsonld.html')
    const raw = extractRawJsonLd(html)
    expect(raw).toContain('Rolex')
    expect(raw).toContain('JSON-LD')
  })

  it('extractRawJsonLd returns empty string when no JSON-LD present', () => {
    const html = loadFixture('html-only.html')
    const raw = extractRawJsonLd(html)
    expect(raw).toBe('')
  })
})
