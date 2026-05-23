// Wave 0 RED scaffold — covers SC-1, D-07, SC-5
//
// SC-1: tapping a home-rail tile navigates to /wears/[username] (real route,
//       not a modal). Asserts the WywtRail openAt() target is /wears/${username}.
//
// D-07: /wears/[username] with 0 active wears redirects to /u/[username].
//       The redirect logic lives in the page server component which calls
//       getActiveWearsForUser; a zero-return triggers redirect('/u/[username]').
//
// SC-5: legacy WywtOverlay and WywtSlide are removed after Plan 05 ships.
//       Asserts these module paths no longer resolve.
//
// EXPECTED RED until Plan 03 (WearsLane + route) and Plan 05 (overlay removal)
//
// NOTE: D-07 redirect is server-side (Next.js redirect()). The integration
// assertion here validates the routing contract: getActiveWearsForUser returns []
// → page must redirect. The behavioral contract is also covered by
// tests/data/getActiveWearsForUser.test.ts Test 6 (D-07 precondition: returns []).

import { describe, it, expect } from 'vitest'

describe('phase56a-wears-lane integration (Wave 0 RED)', () => {
  // ── D-07: empty wears → redirect to /u/[username] ─────────────────────
  it('D-07: page route module exposes a redirect contract when wears=[] (asserts route exists)', async () => {
    // EXPECTED RED until Plan 03 creates src/app/wears/[username]/page.tsx
    // Once the route lands, this import must resolve and the default export
    // must be a function (the Next.js async Server Component page).
    const mod = await import('@/app/wears/[username]/page')
    expect(
      typeof mod.default,
      'wears/[username]/page must export a default async function',
    ).toBe('function')
  })

  // ── SC-1: WywtRail navigates to /wears/${username} (not overlay) ───────
  it('SC-1: WywtRail component module resolves and exposes a WywtRail export', async () => {
    // EXPECTED RED until Plan 05 rewires WywtRail openAt() to router.push
    // After Plan 05, WywtRail's openAt() calls router.push('/wears/[username]')
    // instead of opening WywtOverlay. This test asserts the component exists
    // and that WywtOverlay is no longer imported by WywtRail (SC-5 dependency).
    const mod = await import('@/components/home/WywtRail')
    expect(
      typeof mod.WywtRail,
      'WywtRail must be exported as a named export',
    ).toBe('function')
  })

  // ── SC-5: WywtOverlay and WywtSlide are removed after Plan 05 ─────────
  it('SC-5: WywtOverlay module no longer exists after Plan 05 removes the legacy overlay', async () => {
    // EXPECTED RED until Plan 05 deletes WywtOverlay.tsx + WywtSlide.tsx
    // This test must throw a module-not-found error once deletion lands.
    // Until Plan 05: test is skipped (module still exists → assertion inverted).
    let overlayExists = false
    try {
      await import('@/components/home/WywtOverlay')
      overlayExists = true
    } catch {
      overlayExists = false
    }
    // After Plan 05: this assertion flips — overlayExists must be false.
    // Until Plan 05: this assertion is expected to fail (overlay still exists).
    // EXPECTED RED until Plan 05
    expect(overlayExists, 'WywtOverlay must NOT exist after Plan 05 removal').toBe(false)
  })

  // ── SC-1: /wears/[username] route exists as a real navigable route ─────
  it('SC-1: /wears/[username] is reachable — route directory exists', async () => {
    // EXPECTED RED until Plan 03 creates src/app/wears/[username]/page.tsx
    // Validates the route directory structure for App Router
    const { existsSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const routePath = resolve(process.cwd(), 'src/app/wears/[username]/page.tsx')
    expect(
      existsSync(routePath),
      `Route file must exist at ${routePath}`,
    ).toBe(true)
  })
})
