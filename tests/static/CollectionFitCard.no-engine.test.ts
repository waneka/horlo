import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

/**
 * Phase 20 D-04 + Pitfall 1: <CollectionFitCard> is a pure renderer. It MUST NOT
 * import the similarity engine or the verdict composer (both pull non-trivial
 * code into client bundles when transitively reached from a 'use client' file).
 *
 * Plan 03 creates the file; this guard runs at all times. While the file does
 * not yet exist, the test passes vacuously (skip via existsSync).
 */
describe('Phase 20 D-04 — <CollectionFitCard> pure-renderer invariant', () => {
  const cardPath = 'src/components/insights/CollectionFitCard.tsx'

  // Forbids: from '@/lib/similarity'
  it('does not import @/lib/similarity', () => {
    if (!existsSync(cardPath)) {
      // Vacuous pass until Plan 03 creates the file.
      return
    }
    const src = readFileSync(cardPath, 'utf8')
    expect(src).not.toMatch(/from ['"]@\/lib\/similarity['"]/)
    expect(src).not.toMatch(/analyzeSimilarity\s*\(/)
  })

  // Forbids: from '@/lib/verdict/composer'
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
})
