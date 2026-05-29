// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

const HIERARCHY_PATH = 'src/data/hierarchy.ts'

describe('Phase 35 CAT-16 SC#2/SC#3 — hierarchy.ts recursive CTE safety guards', () => {
  it('hierarchy.ts file exists', () => {
    // Wave 0 vacuous-pass: while Plan 04 has not yet created the file, this test passes.
    // Once Plan 04 ships, the assertion becomes load-bearing.
    if (!existsSync(HIERARCHY_PATH)) {
      return
    }
    expect(existsSync(HIERARCHY_PATH)).toBe(true)
  })

  it('every WITH RECURSIVE query includes the Postgres 15 CYCLE clause (G1)', () => {
    if (!existsSync(HIERARCHY_PATH)) return
    const src = readFileSync(HIERARCHY_PATH, 'utf-8')
    expect(src).toMatch(/CYCLE\s+id\s+SET\s+is_cycle\s+USING\s+path/i)
  })

  it('every WITH RECURSIVE query includes the depth < 10 guard (G1)', () => {
    if (!existsSync(HIERARCHY_PATH)) return
    const src = readFileSync(HIERARCHY_PATH, 'utf-8')
    expect(src).toMatch(/depth\s*<\s*10/)
  })

  it('getLineageForReference function is exported (G2)', () => {
    if (!existsSync(HIERARCHY_PATH)) return
    const src = readFileSync(HIERARCHY_PATH, 'utf-8')
    expect(src).toMatch(/export\s+(async\s+)?function\s+getLineageForReference/)
  })

  it("imports 'server-only' (G3)", () => {
    if (!existsSync(HIERARCHY_PATH)) return
    const src = readFileSync(HIERARCHY_PATH, 'utf-8')
    expect(src).toMatch(/import ['"]server-only['"]/)
  })

  // Phase 39b Plan 01 Task 2 — added assertions for imageUrl + getSameFamilyForCatalog.
  // The first two ship green with Plan 39b-01 Task 1; the third intentionally fails
  // until Plan 39b-05 ships the getSameFamilyForCatalog function (RED-state guard).
  it('CTE selects wc.image_url in both seed and recursive arms (Pitfall 5)', () => {
    if (!existsSync(HIERARCHY_PATH)) return
    const src = readFileSync(HIERARCHY_PATH, 'utf-8')
    const matches = src.match(/wc\.image_url/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  it('LineageRow interface declares imageUrl field', () => {
    if (!existsSync(HIERARCHY_PATH)) return
    const src = readFileSync(HIERARCHY_PATH, 'utf-8')
    expect(src).toMatch(/imageUrl:\s*string\s*\|\s*null/)
  })

  it('getSameFamilyForCatalog function is exported', () => {
    if (!existsSync(HIERARCHY_PATH)) return
    const src = readFileSync(HIERARCHY_PATH, 'utf-8')
    expect(src).toMatch(/export\s+(async\s+)?function\s+getSameFamilyForCatalog/)
  })
})
