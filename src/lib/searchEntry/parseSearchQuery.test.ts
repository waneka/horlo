/**
 * Phase 69 Plan 01 — parseSearchQuery unit tests (D-12 algorithm)
 *
 * The 6 canonical CONTEXT.md cases (a–f) MUST pass verbatim, plus three edge
 * cases to pin tricky behaviors:
 *   7. empty input
 *   8. whitespace collapse (multi-space + leading/trailing)
 *   9. length-DESC sort sanity (Tag Heuer must win over Tag even when Tag is
 *      listed FIRST in the catalogBrands array)
 *
 * Pure function — no React imports, no @testing-library/react.
 */
import { describe, it, expect } from 'vitest'

import { parseSearchQuery } from '@/lib/searchEntry/parseSearchQuery'

type Case = {
  desc: string
  query: string
  brands: string[]
  expected: { brand: string; model: string; reference: string }
}

const CASES: Case[] = [
  // (a) D-12 — brand hit, model, reference
  {
    desc: 'D-12 (a): omega speedmaster 3135 → Omega/Speedmaster/3135',
    query: 'omega speedmaster 3135',
    brands: ['Omega', 'Rolex'],
    expected: { brand: 'Omega', model: 'Speedmaster', reference: '3135' },
  },
  // (b) D-12 — multi-word brand, length-DESC sort wins Tag Heuer over Tag
  {
    desc: 'D-12 (b): tag heuer monaco 1133b → Tag Heuer/Monaco/1133b (multi-word brand)',
    query: 'tag heuer monaco 1133b',
    brands: ['Tag', 'Tag Heuer', 'Rolex'],
    expected: { brand: 'Tag Heuer', model: 'Monaco', reference: '1133b' },
  },
  // (c) D-12 — brand hit, no reference (no digit-bearing token)
  {
    desc: 'D-12 (c): rolex datejust → Rolex/Datejust/""',
    query: 'rolex datejust',
    brands: ['Rolex'],
    expected: { brand: 'Rolex', model: 'Datejust', reference: '' },
  },
  // (d) D-12 — brand only
  {
    desc: 'D-12 (d): omega → Omega/""/""',
    query: 'omega',
    brands: ['Omega'],
    expected: { brand: 'Omega', model: '', reference: '' },
  },
  // (e) D-12 — brand miss → naive fallback, preserve user casing
  {
    desc: 'D-12 (e): cartier 4329xx (brand miss) → cartier/""/4329xx (naive fallback)',
    query: 'cartier 4329xx',
    brands: ['Omega', 'Rolex'],
    expected: { brand: 'cartier', model: '', reference: '4329xx' },
  },
  // (f) D-12 — single token, no digit, brand miss
  {
    desc: 'D-12 (f): speedmaster (brand miss) → speedmaster/""/""',
    query: 'speedmaster',
    brands: ['Omega'],
    expected: { brand: 'speedmaster', model: '', reference: '' },
  },
  // (7) edge: empty input
  {
    desc: 'edge: empty input → all empty',
    query: '',
    brands: ['Omega'],
    expected: { brand: '', model: '', reference: '' },
  },
  // (8) edge: whitespace collapse around and within the query
  {
    desc: 'edge: whitespace collapse — "  omega   speedmaster  3135  "',
    query: '  omega   speedmaster  3135  ',
    brands: ['Omega'],
    expected: { brand: 'Omega', model: 'Speedmaster', reference: '3135' },
  },
  // (9) length-DESC sort sanity — Tag listed FIRST but Tag Heuer still wins
  {
    desc: 'length-DESC sort sanity: Tag listed before Tag Heuer still resolves to Tag Heuer',
    query: 'tag heuer monaco',
    brands: ['Tag', 'Tag Heuer'],
    expected: { brand: 'Tag Heuer', model: 'Monaco', reference: '' },
  },
]

describe('parseSearchQuery — D-12 algorithm (SRCH-26)', () => {
  it.each(CASES)('$desc', ({ query, brands, expected }) => {
    const result = parseSearchQuery(query, brands)
    expect(result.brand).toBe(expected.brand)
    expect(result.model).toBe(expected.model)
    expect(result.reference).toBe(expected.reference)
  })

  it('return shape contains exactly brand, model, reference (year NOT returned)', () => {
    const result = parseSearchQuery('omega speedmaster 3135', ['Omega'])
    expect(Object.keys(result).sort()).toEqual(['brand', 'model', 'reference'].sort())
  })
})
