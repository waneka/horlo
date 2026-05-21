import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Phase 51 — Profile route PPR opt-out (recurrence-3 fix).
 *
 * Source-grep-style structural assertions. These tests pin the
 * recurrence-4 prevention contract:
 *   - Test 1 (REQ-51-04): layout MUST NOT contain `<Suspense>` — that
 *     pattern (Suspense over an awaited cookie-reading shell) is the PPR
 *     qualification source per cache-components.md. ProfileGate
 *     composition may live in layout (restored 2026-05-21 post-merge for
 *     tab-UX) as long as no Suspense wraps it.
 *   - Test 2 (REQ-51-05): ProfileGate accepts viewerId as a prop — fixed by 51-02
 *   - Test 3 (REQ-51-06): ProfileShellResolver remains cached with the profile tag — already met
 *
 * Pattern mirrors `tests/no-evaluate-route.test.ts` — pure fs.readFileSync
 * source inspection, no DOM render, no component import.
 */

describe('Phase 51 — profile route PPR opt-out', () => {
  it('layout has no Suspense over an awaited shell (REQ-51-04)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/u/[username]/layout.tsx'),
      'utf8',
    )

    // The PPR qualification source per
    // node_modules/next/dist/docs/01-app/02-guides/cache-components.md is
    // `<Suspense fallback={...}>` wrapping an awaited cookie-reading
    // shell. The original recurrence-3 bug had ProfileShellSkeleton as
    // the fallback identity; this stricter check generalizes the rule
    // to any Suspense in layout, period — if a future change adds one,
    // recurrence-4 is one step away and the contract forces re-justification.
    expect(/<Suspense[^>]*fallback={<ProfileShellSkeleton/s.test(source)).toBe(false)
    expect(/<Suspense\b/.test(source)).toBe(false)

    // Layout owns the persistent chrome wrapper (`<main>`) — this is the
    // anchor that survives across sibling tab navs. Without this, every
    // tab click would re-render the whole page including chrome, which
    // is the "full reload feel" symptom that motivated the 2026-05-21
    // post-merge restoration of ProfileGate at the layout level.
    expect(source.includes('<main')).toBe(true)
  })

  it('ProfileGate accepts viewerId as a prop (REQ-51-05; Phase 39c Pitfall 1)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/u/[username]/profile-gate.tsx'),
      'utf8',
    )

    // After plan 51-02 the gate signature destructures `viewerId` from props.
    expect(
      /export\s+async\s+function\s+ProfileGate\s*\(\s*\{[^}]*viewerId/s.test(source),
    ).toBe(true)

    // The cookie read (getCurrentUser invocation) MUST move out of the gate
    // and into the page — Phase 39c Pitfall 1 reinforcement.
    expect(source.includes('getCurrentUser()')).toBe(false)

    // No import of getCurrentUser from @/lib/auth — the gate is no longer the
    // cookie-reading boundary.
    const hasAuthImport = /from ['"]@\/lib\/auth['"]/.test(source)
    const importsGetCurrentUser = source.includes('getCurrentUser')
    expect(hasAuthImport && importsGetCurrentUser).toBe(false)
  })

  it('ProfileShellResolver remains cached with the profile cacheTag (REQ-51-06; Phase 39c invariant)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/u/[username]/profile-shell-resolver.tsx'),
      'utf8',
    )

    // 'use cache' directive must remain (per D-39c-03).
    expect(source.includes("'use cache'")).toBe(true)

    // cacheTag call with the username template literal. Use two substring
    // checks instead of a regex containing backticks + ${} (which is
    // ambiguous in JS regex literals — see NOTE in 51-01-PLAN.md).
    expect(source.includes('cacheTag(')).toBe(true)
    expect(source.includes('profile:${username}')).toBe(true)

    // cacheLife revalidate window unchanged (300s).
    expect(source.includes('cacheLife({ revalidate: 300 })')).toBe(true)
  })
})
