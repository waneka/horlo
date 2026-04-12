import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractFromHtml } from '@/lib/extractors/html'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, '../fixtures/pages', name), 'utf-8')
}

describe('extractFromHtml', () => {
  it('extracts populated fields from an HTML-only fixture', () => {
    const html = loadFixture('html-only.html')
    const data = extractFromHtml(html)
    const populated = Object.values(data).filter((v) => {
      if (v === undefined || v === null || v === '') return false
      if (Array.isArray(v)) return v.length > 0
      return true
    })
    expect(populated.length).toBeGreaterThanOrEqual(1)
  })

  it('picks up the brand from the og:title / title tag on the html-only fixture', () => {
    const html = loadFixture('html-only.html')
    const data = extractFromHtml(html)
    expect(data.brand).toBe('Omega')
  })

  it('returns an object for an empty/minimal HTML input', () => {
    const data = extractFromHtml('<!doctype html><html><body></body></html>')
    expect(typeof data).toBe('object')
  })
})
