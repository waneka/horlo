// @vitest-environment node
// Wave 0 RED stub — Phase 78 / 78-01-PLAN.md
//
// Static fs-walking guard for src/db/schema.ts. Asserts that the additive v8.4
// columns (CANON-03, CANON-04) are declared in the Drizzle schema:
//   - brands.needsReview: boolean(...).notNull().default(false)
//   - watchFamilies.aliases: text(...).array().notNull().default([])
//   - watchFamilies.needsReview: boolean(...).notNull().default(false)
//
// This file MUST run under the node environment (per `[[vitest-static-node-env]]`)
// so node:fs readFileSync is available on the Vercel prebuild build. Under the
// jsdom default, fs is externalized and readFileSync becomes undefined.
//
// Plan 02 (Wave 1) will green these it.todo entries by adding the columns to
// src/db/schema.ts and replacing each it.todo with a real readFileSync + grep.

import { describe, it, expect } from 'vitest'

describe('Phase 78 — schema shape guard (static)', () => {
  it('Wave 0 stub registers in vitest discovery', () => {
    expect(true).toBe(true)
  })

  it.todo('src/db/schema.ts brands declares needsReview: boolean(...).notNull().default(false) (CANON-04)')
  it.todo('src/db/schema.ts watchFamilies declares aliases: text(...).array().notNull().default(...) (CANON-03)')
  it.todo('src/db/schema.ts watchFamilies declares needsReview: boolean(...).notNull().default(false) (CANON-04)')
})
