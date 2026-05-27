// @vitest-environment node
//
// This guard reads source files from the filesystem (readFileSync).
// It MUST run in the node environment — under jsdom (the default), vite
// externalizes node:fs and readFileSync becomes undefined. That difference is
// environment-dependent: passes locally under jsdom but FAILS the Vercel
// prebuild build.
// See MEMORY project_vitest_static_node_env.
//
// PAGE-01/02/03/04 IA child-order + B1-invariant guard.
//
// This guard will be RED until Plan 02 (WatchDetailHero.tsx) and Plan 04
// (page.tsx child re-ordering) land. That is expected — this is the TDD
// ordering for the Phase 64 IA redesign.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Helper: extract "active code" line numbers for a given pattern.
// "Active code" = not a pure comment line (//…), not an import line,
// not a blank line, not a JSDoc line ( *…). This prevents prose in comment
// blocks that mention the pattern from self-invalidating the guard.
// ---------------------------------------------------------------------------
function activeLineNumbers(lines: string[], pattern: RegExp): number[] {
  return lines.reduce<number[]>((acc, line, idx) => {
    const trimmed = line.trim()
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('import ') ||
      trimmed === ''
    ) {
      return acc
    }
    if (pattern.test(trimmed)) {
      acc.push(idx + 1)  // 1-indexed line number for error messages
    }
    return acc
  }, [])
}

const PAGE_TSX = join('src', 'app', 'w', '[ref]', 'page.tsx')
const HERO_TSX = join('src', 'components', 'watch', 'WatchDetailHero.tsx')

describe('PAGE-01/02: watch-detail IA child order in page.tsx', () => {
  const content = readFileSync(PAGE_TSX, 'utf8')
  const lines = content.split('\n')

  it('WatchDetailHero renders before CommentThread', () => {
    const heroLines = activeLineNumbers(lines, /WatchDetailHero/)
    const commentLines = activeLineNumbers(lines, /CommentThread/)
    expect(heroLines.length).toBeGreaterThan(0)
    expect(commentLines.length).toBeGreaterThan(0)
    expect(heroLines[0]).toBeLessThan(commentLines[0])
  })

  it('CommentThread renders before WatchDetailTrailing', () => {
    const commentLines = activeLineNumbers(lines, /CommentThread/)
    const trailingLines = activeLineNumbers(lines, /WatchDetailTrailing/)
    expect(trailingLines.length).toBeGreaterThan(0)
    expect(commentLines[0]).toBeLessThan(trailingLines[0])
  })

  it('WatchDetailTrailing renders before SameFamilyRail', () => {
    const trailingLines = activeLineNumbers(lines, /WatchDetailTrailing/)
    const railLines = activeLineNumbers(lines, /SameFamilyRail/)
    expect(railLines.length).toBeGreaterThan(0)
    expect(trailingLines[0]).toBeLessThan(railLines[0])
  })
})

describe('PAGE-03: WatchDetailHero does not import CommentThread', () => {
  let content: string
  try {
    content = readFileSync(HERO_TSX, 'utf8')
  } catch {
    // WatchDetailHero.tsx does not exist yet — it lands in Plan 02.
    content = ''
  }

  it('WatchDetailHero.tsx has no import of CommentThread', () => {
    if (content === '') {
      // Clean descriptive failure: file not yet created.
      expect.fail('WatchDetailHero.tsx not found — lands in Plan 02')
    }
    expect(content).not.toMatch(/import.*CommentThread/)
  })
})

describe('PAGE-04: WatchDetailHero includes WatchPhotoSection', () => {
  let content: string
  try {
    content = readFileSync(HERO_TSX, 'utf8')
  } catch {
    // WatchDetailHero.tsx does not exist yet — it lands in Plan 02.
    content = ''
  }

  it('WatchDetailHero.tsx imports or renders WatchPhotoSection', () => {
    if (content === '') {
      expect.fail('WatchDetailHero.tsx not found — lands in Plan 02')
    }
    expect(content).toMatch(/WatchPhotoSection/)
  })
})
