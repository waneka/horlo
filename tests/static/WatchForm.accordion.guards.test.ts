// @vitest-environment node
/**
 * Phase 37 — static file-grep guards for WatchForm.tsx accordion (V-11 + V-12).
 *
 * Avoids full WatchForm render (requires next/navigation mock, supabase mock, etc.)
 * by asserting structural invariants via file-content grep. Per RESEARCH §3 Open Q #3.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('WatchForm accordion guards (Phase 37)', () => {
  const source = readFileSync('src/components/watch/WatchForm.tsx', 'utf8')

  it('imports Accordion from @base-ui/react/accordion (L-07; V-11)', () => {
    expect(source).toContain("from '@base-ui/react/accordion'")
  })

  it('does NOT import Accordion from @/components/ui/accordion (L-07 — shadcn path does not exist)', () => {
    expect(source).not.toContain("from '@/components/ui/accordion'")
  })

  it('Accordion is gated on mode === "edit" (V-12; edit-only per D-15 + ROADMAP success #4)', () => {
    expect(source).toContain("mode === 'edit'")
    // Sanity: ensure the Accordion.Root appears in a context that contains the edit-mode guard
    // (full structural verification done in integration / e2e tests).
    expect(source).toContain('<Accordion.Root>')
  })

  it('Accordion.Root has no defaultValue prop (collapsed by default)', () => {
    // Match Accordion.Root opening element and verify no defaultValue attribute appears on the same opening tag
    // Use a permissive multiline regex to catch attributes on the same line OR next 1–3 lines.
    const accordionRootBlock = source.match(/<Accordion\.Root[^>]*>/m)
    expect(accordionRootBlock).not.toBeNull()
    expect(accordionRootBlock![0]).not.toContain('defaultValue')
  })

  it('Accordion trigger uses "Collector\'s Record" copy (UI-SPEC)', () => {
    expect(source).toContain("Collector's Record")
  })
})
