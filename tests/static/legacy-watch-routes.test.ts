/**
 * Phase 59 — Legacy watch-detail route guard.
 *
 * ROUTE-02: Asserts that legacy route page files no longer exist (they are
 *   deleted as part of Plan 03). These tests will be RED until Plan 03 deletes
 *   the files — that is expected and correct.
 *
 * ROUTE-03: Source-scan CI guard that fails the build if any internal link
 *   literal still targets the legacy watch-detail paths /watch/<id> or
 *   /catalog/<id>. Wired into the Vercel build via the `prebuild` npm hook.
 *
 *   This test WILL be RED at the end of Plan 01 and Plan 02 — the 26 legacy
 *   link literals still exist until Plan 03 re-points them. The gate is proven
 *   to detect before it is satisfied.
 *
 *   ALLOWLISTED paths (will NOT trigger a failure):
 *     - /watch/new  (D-10: add-watch flow stays at this path)
 *     - /watch/[id] and /catalog/[catalogId] in path-segment form (comments/docs)
 *     - Pure comment lines (// ...) and JSDoc lines (* ...)
 *
 *   FALSE-FLAG EXCLUSIONS (verified by construction):
 *     - /explore/lists/... — contains 'lists/', not 'watch/' or 'catalog/'
 *     - /admin/lists/...  — same
 *     - /wear/[id]        — contains 'wear/', not 'watch/' or 'catalog/'
 *     These paths do not match any FORBIDDEN pattern and will not be flagged.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Helper: recursively collect all .ts/.tsx source files under a directory,
// excluding test files (*.test.ts, *.test.tsx).
// ---------------------------------------------------------------------------
function collectSourceFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      results.push(...collectSourceFiles(fullPath))
    } else if (
      /\.(tsx?|jsx?)$/.test(entry) &&
      !entry.includes('.test.')
    ) {
      results.push(fullPath)
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// ROUTE-02: Legacy route page files must not exist.
// (RED until Plan 03 deletes them — expected by design.)
// ---------------------------------------------------------------------------
describe('ROUTE-02: legacy watch-detail route files are deleted', () => {
  it('src/app/watch/[id]/page.tsx does not exist', () => {
    expect(existsSync('src/app/watch/[id]/page.tsx')).toBe(false)
  })

  it('src/app/watch/[id]/edit/page.tsx does not exist', () => {
    expect(existsSync('src/app/watch/[id]/edit/page.tsx')).toBe(false)
  })

  it('src/app/catalog/[catalogId]/page.tsx does not exist', () => {
    expect(existsSync('src/app/catalog/[catalogId]/page.tsx')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ROUTE-03: No internal link literals targeting legacy watch-detail paths.
// (RED until Plan 03 re-points all 26 link literals — expected by design.)
//
// FORBIDDEN patterns (D-11/D-12):
//   1. Template literal detail:  `/watch/${...}` (not /watch/new, not /edit suffix)
//   2. Template literal edit:    `/watch/${...}/edit`
//   3. Template literal catalog: `/catalog/${...}`
//   4. Computed deep-link:       return `/watch/${...}`  (D-12 — NotificationRow)
//   5. Router push:              router.push(`/watch/${...}`) (not /new)
//   6. Static href detail:       href="/watch/   (not href="/watch/new)
//   7. Static href catalog:      href="/catalog/
// ---------------------------------------------------------------------------
describe('ROUTE-03: no internal links to legacy watch-detail paths', () => {
  const srcFiles = collectSourceFiles('src')

  // Patterns that indicate a legacy watch-detail link.
  const FORBIDDEN: Array<{ pattern: RegExp; label: string }> = [
    {
      // Template literal detail link: `/watch/${...}`
      // Must NOT match /watch/new (allowlisted) or /watch/${...}/edit (caught separately)
      pattern: /`\/watch\/\$\{/,
      label: '/watch/${...} template literal (detail or edit)',
    },
    {
      // Template literal catalog link: `/catalog/${...}`
      pattern: /`\/catalog\/\$\{/,
      label: '/catalog/${...} template literal',
    },
    {
      // Computed deep-link: return `/watch/${...}` — D-12 (NotificationRow.resolveHref)
      pattern: /return\s+`\/watch\/\$\{/,
      label: 'return `/watch/${...}` computed deep-link (D-12)',
    },
    {
      // router.push(`/watch/${...}`) — not /watch/new
      pattern: /router\.push\(`\/watch\/\$\{/,
      label: 'router.push(`/watch/${...}`) computed navigation',
    },
    {
      // Static href: href="/watch/ (not /watch/new)
      pattern: /href="\/watch\/(?!new)/,
      label: 'static href="/watch/..." (not /watch/new)',
    },
    {
      // Static href: href="/catalog/
      pattern: /href="\/catalog\//,
      label: 'static href="/catalog/..."',
    },
  ]

  // Lines that are allowlisted — never flag these.
  const ALLOWLIST: RegExp[] = [
    /\/watch\/new/,           // D-10: /watch/new stays at current path (D-13)
    /\/watch\/\[id\]/,        // path-segment form in comments or docs
    /\/catalog\/\[catalogId\]/, // path-segment form in comments or docs
    /^\s*\/\//,               // pure comment lines
    /^\s*\*/,                 // JSDoc / block-comment lines
  ]

  for (const file of srcFiles) {
    it(`${file} has no legacy watch-detail links`, () => {
      const lines = readFileSync(file, 'utf8').split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Skip allowlisted lines entirely.
        if (ALLOWLIST.some((al) => al.test(line))) continue

        for (const { pattern, label } of FORBIDDEN) {
          expect(
            pattern.test(line),
            `${file}:${i + 1} — ${label}: ${line.trim()}`,
          ).toBe(false)
        }
      }
    })
  }
})
