import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Phase 22 D-15 — /preferences → /settings#preferences server-side redirect.
// Next.js 16 redirect() preserves the URL fragment in the Location header
// per RFC 7231 §7.1.2 (verified in 22-RESEARCH.md).
// ---------------------------------------------------------------------------

describe('GET /preferences — Phase 22 D-15 redirect to /settings#preferences', () => {
  it('redirects with hash preserved — Location header = /settings#preferences', async () => {
    // next/navigation's redirect() throws NEXT_REDIRECT with the URL embedded
    // in error.digest. Asserting against the digest gives us the strongest
    // guarantee that the literal `/settings#preferences` reaches the
    // framework's redirect machinery.
    const PreferencesPage = (await import('@/app/preferences/page')).default

    let captured: unknown = null
    try {
      ;(PreferencesPage as () => never)()
    } catch (e) {
      captured = e
    }

    expect(captured).not.toBeNull()
    const digest = (captured as { digest?: string; message?: string })
    const stringForm = String(digest?.digest ?? digest?.message ?? captured)
    expect(stringForm).toContain('NEXT_REDIRECT')
    expect(stringForm).toContain('/settings#preferences')
  })

  it('uses Next.js redirect() (server-side, not Client Component)', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/preferences/page.tsx'),
      'utf-8',
    )
    expect(source).not.toContain("'use client'")
    expect(source).toMatch(/from ['"]next\/navigation['"]/)
    expect(source).toMatch(/redirect\(['"]\/settings#preferences['"]\)/)
  })
})
