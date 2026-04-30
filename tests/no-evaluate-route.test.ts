import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'

describe('Phase 20 success criterion 5 — /evaluate route does not exist', () => {
  it('src/app/evaluate/ directory does not exist', () => {
    expect(existsSync('src/app/evaluate')).toBe(false)
  })

  it('src/app/evaluate/page.tsx does not exist', () => {
    expect(existsSync('src/app/evaluate/page.tsx')).toBe(false)
  })

  it('src/app/evaluate/route.ts does not exist', () => {
    expect(existsSync('src/app/evaluate/route.ts')).toBe(false)
  })
})
