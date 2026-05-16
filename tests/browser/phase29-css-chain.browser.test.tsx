// tests/browser/phase29-css-chain.browser.test.tsx
//
// Phase 29 CSS-chain assertions (DEBT-10 D-07/D-08).
//
// Checks computed styles in real Chromium — NOT class names.
// jsdom cannot resolve computed overflow values — it always returns browser defaults
// regardless of the class applied. Browser mode is required for this test even though
// Phase 29 was already `nyquist_compliant: true`; the existing unit test in
// tests/components/profile/ProfileTabs.test.tsx checks class-name presence, which
// passes in jsdom but does not prove the CSS chain resolves correctly.
//
// Visual surfaces covered:
//   - ProfileTabs TabsList: `overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none]
//     [&::-webkit-scrollbar]:hidden` scroll overflow chain
//
// References:
//   - 29-CONTEXT.md (nav-profile-chrome-cleanup)
//   - 42-validation-backfill/29-VALIDATION.md (Phase 29 compliant exemplar, backfilled)
//
// Source: ProfileTabs.tsx line 65

import { describe, it, expect } from 'vitest'

describe('Phase 29 CSS-chain: ProfileTabs scroll overflow (DEBT-10)', () => {
  it('overflow-x-auto computes to auto or scroll; overflow-y-hidden computes to hidden; pb-2 computes paddingBottom > 0', () => {
    const tabsList = document.createElement('div')
    // Exact class string from ProfileTabs.tsx:65 (w-full and justify-start are layout helpers
    // that do not affect the overflow assertion; included for fidelity to the source)
    tabsList.className =
      'w-full justify-start gap-2 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
    tabsList.style.width = '320px'
    document.body.appendChild(tabsList)

    const style = window.getComputedStyle(tabsList)

    // overflow-x-auto → computed overflowX = 'auto' (or 'scroll' on some Chromium builds)
    // jsdom cannot produce this value — browser mode is required
    expect(['auto', 'scroll']).toContain(style.overflowX)
    // overflow-y-hidden → computed overflowY = 'hidden'
    expect(style.overflowY).toBe('hidden')
    // pb-2 → computed paddingBottom = 8px (Tailwind p scale: 2 × 4px = 8px)
    expect(parseFloat(style.paddingBottom)).toBeGreaterThan(0)

    document.body.removeChild(tabsList)
  })
})
