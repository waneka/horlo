// @vitest-environment node
//
// This guard walks the filesystem (readdirSync/statSync) and reads source files.
// It MUST run in the node environment — under the config default (jsdom), vite
// externalizes node:fs "for browser compatibility" and readdirSync becomes
// undefined. That difference is environment-dependent: it passed locally but
// failed Vercel's build (prebuild hook) with "readdirSync is not a function".
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

/**
 * Phase 71 CLNP-02 + Pitfall 1: AddWatchFlow.tsx MUST NOT import the deleted
 * verdict-flow components (VerdictStep, WishlistRationalePanel, PasteSection).
 * These files are deleted in Plan 71-02. This guard prevents reintroduction.
 *
 * While AddWatchFlow.tsx does not exist, the test passes vacuously.
 */
describe('Phase 71 CLNP-02 — AddWatchFlow no-verdict-step invariant', () => {
  const flowPath = 'src/components/watch/AddWatchFlow.tsx'

  it('does not import VerdictStep', () => {
    if (!existsSync(flowPath)) return
    const src = readFileSync(flowPath, 'utf8')
    expect(src).not.toMatch(/from ['"](?:.*\/)?VerdictStep['"]/)
  })

  it('does not import WishlistRationalePanel', () => {
    if (!existsSync(flowPath)) return
    const src = readFileSync(flowPath, 'utf8')
    expect(src).not.toMatch(/from ['"](?:.*\/)?WishlistRationalePanel['"]/)
  })

  it('does not import PasteSection', () => {
    if (!existsSync(flowPath)) return
    const src = readFileSync(flowPath, 'utf8')
    expect(src).not.toMatch(/from ['"](?:.*\/)?PasteSection['"]/)
  })
})
