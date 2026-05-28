// @vitest-environment node
//
// Phase 65 Plan 02 / PAGE-03 preserve — FollowedOwnersModule RSC guard.
//
// This guard reads the source file from the filesystem (readFileSync). It
// MUST run in the `node` vitest environment — under jsdom (the default for
// this project), vite externalizes `node:fs` and `readFileSync` becomes
// undefined. That difference is environment-dependent: the test passes
// locally under jsdom (where the readFileSync polyfill happens to exist)
// but FAILS the Vercel prebuild build. MEMORY project_vitest_static_node_env
// records a Phase 59 prod-deploy failure caused by exactly this omission —
// the `// @vitest-environment node` header on line 1 is load-bearing.
//
// What this guard enforces (and WHY):
//
//   `src/components/insights/FollowedOwnersModule.tsx` MUST stay pure RSC.
//   Adding either `'use client'` or `'use cache'` to this file would corrupt
//   the Phase 51/52/61 PPR boundary on `/w/[ref]` once Plan 03 wires the
//   component into the hero — the React #419 + 404 soft-nav family would
//   silently regress in prod (verifiable only after cache fill — local
//   build cannot reproduce, per project_ppr_dynamic_before_use_cache).
//
// The specific pitfall this guards against is a future "client conversion"
// refactor (e.g. adding hover state, click handlers, or a useEffect-based
// reveal on the "and N more" caption). Such a change MUST go through a
// design review that explicitly accepts the boundary impact — the static
// test fires as a tripwire.
//
// Directive-detection pattern: trim-and-equality on the first 5 lines, NOT
// a fuzzy `content.includes("'use client'")`. The fuzzy form would
// false-positive on prose inside JSDoc comments (e.g. the JSDoc header
// already mentions the directive names in prose — same false-positive class
// previously hit Phase 64 WatchDetailTrailing per STATE.md, "comment
// reworded to avoid grep false-positive").
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('PAGE-03 (Phase 65): FollowedOwnersModule.tsx is pure RSC', () => {
  const FILE = join(
    'src',
    'components',
    'insights',
    'FollowedOwnersModule.tsx',
  )
  const content = readFileSync(FILE, 'utf8')

  it('does not contain "use client" directive in the first 5 lines', () => {
    const top = content.split('\n').slice(0, 5)
    const hasDirective = top.some((line) => line.trim() === "'use client'")
    expect(hasDirective).toBe(false)
  })

  it('does not contain "use cache" directive in the first 5 lines', () => {
    const top = content.split('\n').slice(0, 5)
    const hasDirective = top.some((line) => line.trim() === "'use cache'")
    expect(hasDirective).toBe(false)
  })

  it('exports FollowedOwnersModule as a named function', () => {
    expect(content).toMatch(/export function FollowedOwnersModule/)
  })
})
