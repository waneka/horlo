// @vitest-environment node
//
// This guard reads source files from the filesystem (readFileSync). It MUST
// run in the `node` vitest environment — under jsdom (the default for this
// project), vite externalizes `node:fs` and `readFileSync` becomes undefined.
// That difference is environment-dependent: the guard passes locally under
// jsdom but FAILS the Vercel prebuild build (cost a failed Phase 59 prod
// deploy, retrofitted across Phase 71). MEMORY project_vitest_static_node_env
// records the recurrence — the `// @vitest-environment node` header on
// line 1 is load-bearing.
//
// Phase 74 MOB-01 D-11 — viewport meta static regression guard.
//
// Durable rule (from .planning/phases/74-.../74-CONTEXT.md D-08 + D-11):
//   The `src/app/layout.tsx` viewport export must NOT contain `maximumScale`,
//   `userScalable`, or `minimumScale`. Adding `maximum-scale=1` (or the
//   equivalent Next.js Viewport keys) would defeat pinch-zoom accessibility
//   — ROADMAP Phase 74 success criterion #3 explicitly forbids that as the
//   "wrong fix" for iOS Safari input auto-zoom. REQUIREMENTS.md MOB-01 says
//   the same thing.
//
// The right fix for input auto-zoom is the @layer base font-size floor on
// native form controls (src/app/globals.css D-06) + the targeted text-sm →
// text-base md:text-sm rewrites on the 3 user-facing offenders (D-07). This
// guard is the durable enforcement layer that fires a CI tripwire if a
// future contributor tries the wrong fix.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('MOB-01 D-11 — viewport meta does not forbid pinch-zoom', () => {
  const LAYOUT_PATH = join(__dirname, '..', '..', 'src', 'app', 'layout.tsx')
  const content = readFileSync(LAYOUT_PATH, 'utf8')

  // Extract the viewport export object body. The shape we expect is:
  //   export const viewport: Viewport = { ...keys... }
  // A regex match on the object body is sufficient (no AST parser needed).
  const viewportMatch = content.match(
    /export\s+const\s+viewport\s*:\s*Viewport\s*=\s*\{([^}]*)\}/,
  )

  it('viewport export exists with the expected shape', () => {
    // If the shape changes, this guard needs to be updated — fail loudly
    // rather than silently passing because the regex no longer matches.
    expect(viewportMatch).not.toBeNull()
  })

  it('viewport export body is non-empty (guard is still meaningful)', () => {
    expect(viewportMatch).not.toBeNull()
    const body = viewportMatch![1]
    expect(body.trim().length).toBeGreaterThan(0)
  })

  it('viewport export does NOT contain maximumScale', () => {
    expect(viewportMatch).not.toBeNull()
    const body = viewportMatch![1]
    expect(body).not.toMatch(/maximumScale/i)
  })

  it('viewport export does NOT contain userScalable', () => {
    expect(viewportMatch).not.toBeNull()
    const body = viewportMatch![1]
    expect(body).not.toMatch(/userScalable/i)
  })

  it('viewport export does NOT contain minimumScale', () => {
    expect(viewportMatch).not.toBeNull()
    const body = viewportMatch![1]
    expect(body).not.toMatch(/minimumScale/i)
  })

  // Defense-in-depth: also reject the raw HTML meta-tag form, in case a
  // future contributor smuggles `<meta name="viewport" content="...">` in
  // via dangerouslySetInnerHTML somewhere in layout.tsx.
  it('layout.tsx does NOT contain raw `maximum-scale=` HTML', () => {
    expect(content).not.toMatch(/maximum-scale\s*=/)
  })

  it('layout.tsx does NOT contain raw `user-scalable=` HTML', () => {
    expect(content).not.toMatch(/user-scalable\s*=/)
  })
})
