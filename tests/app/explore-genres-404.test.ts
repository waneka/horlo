import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Phase 49.1 Wave 0 — /explore/genres route deletion smoke test.
 *
 * Analog: `tests/no-evaluate-route.test.ts:1-16` (filesystem-absence idiom).
 *
 * Asserts the deleted route file is absent on disk. This is a static
 * smoke test — no live HTTP needed.
 *
 * Expected lifecycle:
 *   - Pre Plan 03 (today): FAILS — `src/app/explore/genres/page.tsx` still exists.
 *   - Post Plan 03:        PASSES — the route directory is deleted.
 *
 * The test file MUST parse today; the failing assertion is the Wave 0 contract.
 */

// Resolve from this test file location up to the project root. This file is at
// `<repo>/tests/app/explore-genres-404.test.ts`, so `../..` reaches `<repo>`.
const PROJECT_ROOT = resolve(__dirname, '..', '..')
const GENRES_PAGE = resolve(PROJECT_ROOT, 'src/app/explore/genres/page.tsx')
const GENRES_DIR = resolve(PROJECT_ROOT, 'src/app/explore/genres')

describe('/explore/genres route deletion', () => {
  it('page.tsx is absent — route returns 404', () => {
    // Primary assertion — the route file is gone.
    expect(existsSync(GENRES_PAGE)).toBe(false)

    // Secondary: the parent directory either does not exist, OR exists but
    // contains no `page.tsx` (whichever path Plan 03 takes — full directory
    // delete vs file-only delete are both acceptable post-removal states).
    if (existsSync(GENRES_DIR)) {
      const entries = readdirSync(GENRES_DIR)
      expect(entries.includes('page.tsx')).toBe(false)
    }
  })
})
