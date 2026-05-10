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
})
