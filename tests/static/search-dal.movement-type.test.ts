// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Phase 40 ROADMAP SC#4 — SRCH-16 DAL must reference `movement_type` pgEnum column
 * (watches_catalog.movementType), NOT the deprecated free-text `movement` column.
 *
 * Pattern basis: tests/static/CollectionFitCard.no-engine.test.ts
 *
 * The positive assertion (movementType reference) PASSES vacuously today because
 * mapRowToCatalogEntry already touches movementType at line 61. The load-bearing
 * guard is the NEGATIVE assertion: it fires if any future code adds a bare
 * `watchesCatalog.movement` (no T/C/a suffix) reference to the file.
 *
 * Character class explanation for the negative regex:
 *   /watchesCatalog\.movement[^TCa]/
 *   - Matches `watchesCatalog.movement` followed by any char EXCEPT T, C, or a.
 *   - movementType (T), movementCaliber (C), movements (wrong but starts 's' — not T/C/a).
 *   - The deprecated free-text column was just `movement` — the pattern catches
 *     `watchesCatalog.movement` followed by whitespace, comma, ), etc.
 */
describe('Phase 40 SC#4 — searchCatalogWatches references movement_type pgEnum column', () => {
  const dalSrc = readFileSync('src/data/catalog.ts', 'utf8')

  it('references watchesCatalog.movementType (pgEnum movement_type column)', () => {
    expect(dalSrc).toMatch(/movementType/)
  })

  it('does NOT reference deprecated free-text movement column directly', () => {
    // watchesCatalog.movement (no T/C/a suffix) would be the old free-text column.
    // movementType (T), movementCaliber (C), and 'movements' (a) are all acceptable.
    expect(dalSrc).not.toMatch(/watchesCatalog\.movement[^TCa]/)
  })
})
