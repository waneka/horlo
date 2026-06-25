// @vitest-environment node
// Phase 78 / 78-02-PLAN.md — Wave 1 GREEN static schema-shape guard.
//
// Asserts the additive v8.4 columns (CANON-03, CANON-04) are declared in the
// Drizzle schema source text:
//   - brands.needsReview: boolean('needs_review').notNull().default(false)
//   - watchFamilies.aliases: text('aliases').array().notNull().default(...)
//   - watchFamilies.needsReview: boolean('needs_review').notNull().default(false)
//
// This file MUST run under the node environment (per `[[vitest-static-node-env]]`)
// so node:fs readFileSync is available on the Vercel prebuild build. Under the
// jsdom default, fs is externalized and readFileSync becomes undefined.
//
// Strategy: read src/db/schema.ts once, slice the substring for each pgTable()
// declaration (from `export const <name> = pgTable(` to the next top-level
// `export const` or end-of-file), then grep the substring for the column
// builder literal (whitespace-collapsed).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SCHEMA_PATH = join(process.cwd(), 'src/db/schema.ts')
const schemaSource = readFileSync(SCHEMA_PATH, 'utf8')

/**
 * Extract the source-text slice for a single `export const <name> = pgTable(...)`
 * declaration. Returns the substring from `export const <name>` up to the next
 * `export const ` (or end-of-file). Whitespace-collapsed for grep stability.
 */
function tableSlice(name: string): string {
  const startMarker = `export const ${name} = pgTable(`
  const startIdx = schemaSource.indexOf(startMarker)
  if (startIdx === -1) {
    throw new Error(`Could not find "${startMarker}" in src/db/schema.ts`)
  }
  // Find the next top-level export after this one (signals end of the table).
  const nextExportIdx = schemaSource.indexOf('\nexport const ', startIdx + startMarker.length)
  const endIdx = nextExportIdx === -1 ? schemaSource.length : nextExportIdx
  const raw = schemaSource.slice(startIdx, endIdx)
  return raw.replace(/\s+/g, ' ')
}

describe('Phase 78 — schema shape guard (static)', () => {
  it('src/db/schema.ts brands declares needsReview: boolean(...).notNull().default(false) (CANON-04)', () => {
    const slice = tableSlice('brands')
    expect(slice).toContain(
      "needsReview: boolean('needs_review').notNull().default(false)",
    )
  })

  it('src/db/schema.ts watchFamilies declares aliases: text(...).array().notNull().default(...) (CANON-03)', () => {
    const slice = tableSlice('watchFamilies')
    expect(slice).toContain(
      "aliases: text('aliases').array().notNull().default(",
    )
  })

  it('src/db/schema.ts watchFamilies declares needsReview: boolean(...).notNull().default(false) (CANON-04)', () => {
    const slice = tableSlice('watchFamilies')
    expect(slice).toContain(
      "needsReview: boolean('needs_review').notNull().default(false)",
    )
  })
})
