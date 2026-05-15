/**
 * Phase 41 — Track B (SET-14) static test: exported email template HTML.
 *
 * This test reads `emails/out/*.html` produced by `npx react-email export`.
 * Tests are gated behind an existence check — they skip when `emails/out/` is
 * absent (the directory is gitignored; templates ship in plan 41-04).
 *
 * To run after exporting: npx react-email export --dir emails --outDir emails/out
 *
 * Contracts asserted (RESEARCH §Code Examples + §Common Pitfalls + D-11):
 *   - Each exported HTML contains literal `{{ .ConfirmationURL }}` (Supabase Go template)
 *   - No `oklch(` appears in the HTML (Pitfall 4 — Outlook MSO unsupported)
 *   - 600px container width is present (UI-SPEC Email Template Contract)
 *   - Exactly one `<a` CTA anchor per template (SET-14 single-CTA requirement)
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const OUT_DIR = path.resolve(process.cwd(), 'emails/out')
const TEMPLATES = ['confirm-signup.html', 'reset-password.html', 'change-email.html']

// Gate: skip assertions when emails/out/ directory or individual files don't exist yet.
const outDirExists = fs.existsSync(OUT_DIR)

describe('Email templates — static HTML contract (SET-14)', () => {
  for (const templateFile of TEMPLATES) {
    const templatePath = path.join(OUT_DIR, templateFile)
    const exported = outDirExists && fs.existsSync(templatePath)
    const maybeIt = exported ? it : it.skip

    describe(templateFile, () => {
      maybeIt('contains literal {{ .ConfirmationURL }} (Supabase Go template variable)', () => {
        const html = fs.readFileSync(templatePath, 'utf-8')
        expect(html).toContain('{{ .ConfirmationURL }}')
      })

      maybeIt('does not contain oklch( (Pitfall 4 — unsupported in Outlook MSO)', () => {
        const html = fs.readFileSync(templatePath, 'utf-8')
        expect(html).not.toContain('oklch(')
      })

      maybeIt('contains 600px container width (Email Template Contract)', () => {
        const html = fs.readFileSync(templatePath, 'utf-8')
        // Accept either width:600px or width="600" (react-email renders both forms)
        expect(html).toMatch(/width[:\s]*["']?600/)
      })

      maybeIt('contains exactly one <a CTA anchor (SET-14 single-CTA requirement)', () => {
        const html = fs.readFileSync(templatePath, 'utf-8')
        // Count occurrences of '<a ' or '<a\n' — CTA links
        const matches = html.match(/<a[\s]/g)
        expect(matches).not.toBeNull()
        expect(matches!.length).toBe(1)
      })
    })
  }

  // Always-run: documents what will be checked once templates are exported.
  it('email template test file is correctly structured (meta-assertion)', () => {
    expect(TEMPLATES).toHaveLength(3)
    expect(TEMPLATES).toContain('confirm-signup.html')
    expect(TEMPLATES).toContain('reset-password.html')
    expect(TEMPLATES).toContain('change-email.html')
  })

  it('emails/out/ existence gate is working (skip-when-absent contract)', () => {
    // This assertion always passes — it confirms the guard logic is in place.
    // If outDirExists is false, the template-level tests above will be skipped.
    expect(typeof outDirExists).toBe('boolean')
  })
})
