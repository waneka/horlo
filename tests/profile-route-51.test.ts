import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Phase 51 — Profile route PPR opt-out (recurrence-3 fix).
 *
 * Source-grep-style structural assertions. These tests MUST initially fail
 * against current main (regression contract — recurrence-4 gate):
 *   - Test 1 (REQ-51-04): layout no longer Suspense-wraps ProfileGate — fixed by 51-03
 *   - Test 2 (REQ-51-05): ProfileGate accepts viewerId as a prop — fixed by 51-02
 *   - Test 3 (REQ-51-06): ProfileShellResolver remains cached with the profile tag — already met
 *
 * Pattern mirrors `tests/no-evaluate-route.test.ts` — pure fs.readFileSync
 * source inspection, no DOM render, no component import.
 */

describe('Phase 51 — profile route PPR opt-out', () => {
  it('layout does not Suspense-wrap ProfileGate (REQ-51-04)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/u/[username]/layout.tsx'),
      'utf8',
    )

    // The layout-level Suspense wrapping the gate must be gone after plan 51-03.
    expect(/<Suspense[^>]*fallback={<ProfileShellSkeleton/s.test(source)).toBe(false)

    // After plan 51-03 the layout no longer composes the gate — composition
    // moves down into the page so the page becomes the runtime-API consumer.
    expect(source.includes('ProfileGate')).toBe(false)

    // Layout still owns the chrome wrapper (`<main>` element stays here).
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
