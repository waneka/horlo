import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractStructuredData } from '@/lib/extractors/structured'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, '../fixtures/pages', name), 'utf-8')
}

describe('extractStructuredData', () => {
  it('extracts brand and model from a JSON-LD Product block', () => {
    const html = loadFixture('structured-jsonld.html')
    const data = extractStructuredData(html)
    expect(data.brand).toBe('Rolex')
    expect(data.model).toMatch(/Submariner/i)
  })

  it('returns an object (even empty) when no JSON-LD is present', () => {
    const html = loadFixture('html-only.html')
    const data = extractStructuredData(html)
    expect(typeof data).toBe('object')
    // brand may be undefined — that's fine for this pipeline stage
  })

  it('extracts at least one additional field (reference, marketPrice, or imageUrl) alongside brand/model', () => {
    const html = loadFixture('structured-jsonld.html')
    const data = extractStructuredData(html)
    const extras = [data.reference, data.marketPrice, data.imageUrl].filter((v) => v !== undefined)
    expect(extras.length).toBeGreaterThanOrEqual(1)
    // Our fixture includes sku + offer price + image, so all three should come through
    expect(data.reference).toBe('126610LN')
    expect(data.imageUrl).toBe('https://example.com/sub.jpg')
    expect(data.marketPrice).toBe(9550)
  })
})
