import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractWatchData } from '@/lib/extractors'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, '../fixtures/pages', name), 'utf-8')
}

describe('extractWatchData merge precedence', () => {
  it('prefers structured data over HTML fallback when both present', async () => {
    const html = loadFixture('partial.html')
    const result = await extractWatchData(html, { useLlmFallback: false })
    // Structured JSON-LD says brand=Omega; HTML div says "WRONG BRAND FROM HTML"
    expect(result.data.brand).toBe('Omega')
    expect(result.data.brand).not.toMatch(/WRONG/i)
  })

  it('returns a result object with data and metadata for a structured fixture', async () => {
    const html = loadFixture('structured-jsonld.html')
    const result = await extractWatchData(html, { useLlmFallback: false })
    expect(result).toHaveProperty('data')
    expect(result.data.brand).toBe('Rolex')
    expect(result.llmUsed).toBe(false)
    expect(result.fieldsExtracted.length).toBeGreaterThanOrEqual(1)
  })

  it('does not call LLM when useLlmFallback is false', async () => {
    // No network is hit; the call completes without ANTHROPIC_API_KEY.
    const html = loadFixture('html-only.html')
    const result = await extractWatchData(html, { useLlmFallback: false })
    expect(result).toBeDefined()
    expect(result.llmUsed).toBe(false)
  })
})
