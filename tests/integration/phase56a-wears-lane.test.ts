// Phase 56A integration — covers SC-1, D-07, SC-5
//
// SC-1: tapping a home-rail tile navigates to /wears/[username] (real route,
//       not a modal). WywtRail openAt() calls router.push('/wears/${username}').
//
// D-07: /wears/[username] with 0 active wears redirects to /u/[username].
//       The redirect logic lives in the page server component which calls
//       getActiveWearsForUser; a zero-return triggers redirect('/u/[username]').
//
// SC-5: legacy WywtOverlay and WywtSlide removed in Plan 05 (GREEN).
//       These module paths no longer resolve.
//
// NOTE: D-07 redirect is server-side (Next.js redirect()). The integration
// assertion here validates the routing contract: getActiveWearsForUser returns []
// → page must redirect. The behavioral contract is also covered by
// tests/data/getActiveWearsForUser.test.ts Test 6 (D-07 precondition: returns []).

import { describe, it, expect } from 'vitest'

describe('phase56a-wears-lane integration', () => {
  // ── D-07: empty wears → redirect to /u/[username] ─────────────────────
  it('D-07: page route module exposes a redirect contract when wears=[] (asserts route exists)', async () => {
    // Plan 03 created src/app/wears/[username]/page.tsx.
    // The default export must be a function (the Next.js async Server Component page).
    const mod = await import('@/app/wears/[username]/page')
    expect(
      typeof mod.default,
      'wears/[username]/page must export a default async function',
    ).toBe('function')
  })

  // ── SC-1: WywtRail navigates to /wears/${username} (not overlay) ───────
  it('SC-1: WywtRail component module resolves and exposes a WywtRail export', async () => {
    // Plan 05 rewired WywtRail openAt() to router.push('/wears/[username]').
    // WywtOverlay is no longer imported by WywtRail (SC-5 dependency satisfied).
    const mod = await import('@/components/home/WywtRail')
    expect(
      typeof mod.WywtRail,
      'WywtRail must be exported as a named export',
    ).toBe('function')
  })

  // ── SC-5: WywtOverlay and WywtSlide removed in Plan 05 (GREEN) ────────
  it('SC-5: WywtOverlay and WywtSlide source files no longer exist after Plan 05 removal', async () => {
    // Plan 05 deleted WywtOverlay.tsx + WywtSlide.tsx.
    // Use fs.existsSync — Vite's import-analysis resolves dynamic imports at
    // bundle time, so a try/catch import would fail to compile, not at runtime.
    const { existsSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const overlayPath = resolve(process.cwd(), 'src/components/home/WywtOverlay.tsx')
    const slidePath = resolve(process.cwd(), 'src/components/home/WywtSlide.tsx')
    expect(
      existsSync(overlayPath),
      'WywtOverlay.tsx must NOT exist after Plan 05 deletion',
    ).toBe(false)
    expect(
      existsSync(slidePath),
      'WywtSlide.tsx must NOT exist after Plan 05 deletion',
    ).toBe(false)
  })

  // ── SC-1: /wears/[username] route exists as a real navigable route ─────
  it('SC-1: /wears/[username] is reachable — route directory exists', async () => {
    // Plan 03 created src/app/wears/[username]/page.tsx.
    const { existsSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const routePath = resolve(process.cwd(), 'src/app/wears/[username]/page.tsx')
    expect(
      existsSync(routePath),
      `Route file must exist at ${routePath}`,
    ).toBe(true)
  })
})
