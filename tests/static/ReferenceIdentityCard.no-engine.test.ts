// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

/**
 * Phase 39b D-39b-01: <ReferenceIdentityCard> is a pure renderer. It MUST NOT
 * import the similarity engine, the verdict composer, server-only modules, or
 * carry a `'use client'` directive. Mirrors the CollectionFitCard import-boundary
 * pattern (tests/static/CollectionFitCard.no-engine.test.ts).
 *
 * Plan 39b-02 Task 2 creates the file; this guard runs at all times. While the
 * file does not yet exist, each assertion passes vacuously (skip via existsSync)
 * so the test transitions from vacuous-green (Task 1) to non-vacuously green
 * (Task 2 — TDD RED → GREEN).
 */
describe('Phase 39b D-39b-01 — <ReferenceIdentityCard> pure-renderer invariant', () => {
  const cardPath = 'src/components/insights/ReferenceIdentityCard.tsx'

  it('does not import @/lib/similarity', () => {
    if (!existsSync(cardPath)) return
    const src = readFileSync(cardPath, 'utf8')
    expect(src).not.toMatch(/from ['"]@\/lib\/similarity['"]/)
    expect(src).not.toMatch(/analyzeSimilarity\s*\(/)
  })

  it('does not import @/lib/verdict/composer', () => {
    if (!existsSync(cardPath)) return
    const src = readFileSync(cardPath, 'utf8')
    expect(src).not.toMatch(/from ['"]@\/lib\/verdict\/composer['"]/)
    expect(src).not.toMatch(/composeVerdictCopy\s*\(/)
    expect(src).not.toMatch(/computeVerdictBundle\s*\(/)
  })

  it('does not import server-only modules into the client bundle', () => {
    if (!existsSync(cardPath)) return
    const src = readFileSync(cardPath, 'utf8')
    expect(src).not.toMatch(/from ['"]server-only['"]/)
    expect(src).not.toMatch(/from ['"]@\/lib\/verdict\/viewerTasteProfile['"]/)
  })

  it('is a server component (no use client directive)', () => {
    if (!existsSync(cardPath)) return
    const src = readFileSync(cardPath, 'utf8')
    expect(src).not.toMatch(/^['"]use client['"]/m)
  })
})
