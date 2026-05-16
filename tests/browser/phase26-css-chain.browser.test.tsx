// tests/browser/phase26-css-chain.browser.test.tsx
//
// Phase 26 CSS-chain assertions (DEBT-10 D-07/D-08).
//
// Checks computed styles in real Chromium — NOT class names.
// Phase 26 uses the same h-full + object-cover pattern as Phase 30 (CameraCaptureView).
// If h-full were dropped from the img element, object-cover would have no height to
// cover against, producing the same class of layout failure as the Phase 30 black bar.
//
// Visual surfaces covered:
//   - WearDetailHero: `w-full aspect-[4/5] overflow-hidden bg-muted` wrapper
//   - WearDetailHero: `w-full h-full object-cover` img element
//
// References:
//   - 26-CONTEXT.md (wear-detail-hero phase)
//   - 42-validation-backfill/26-VALIDATION.md (backfilled artifact)
//
// Source: WearDetailHero.tsx lines 33-40

import { describe, it, expect } from 'vitest'

describe('Phase 26 CSS-chain: WearDetailHero photo layout (DEBT-10)', () => {
  it('aspect-[4/5] wrapper + h-full object-cover image chain resolves correctly', () => {
    const wrapper = document.createElement('div')
    // Exact class string from WearDetailHero.tsx:33 (responsive classes stripped — they
    // fire at md: breakpoint and do not affect the base ratio assertion)
    wrapper.className = 'w-full aspect-[4/5] overflow-hidden bg-muted'
    // Anchor width so aspect-ratio math has a resolved reference length
    wrapper.style.width = '360px'

    const img = document.createElement('img')
    // Exact class string from WearDetailHero.tsx:38
    img.className = 'w-full h-full object-cover'
    wrapper.appendChild(img)
    document.body.appendChild(wrapper)

    const wStyle = window.getComputedStyle(wrapper)
    const iStyle = window.getComputedStyle(img)

    const w = parseFloat(wStyle.width)
    const h = parseFloat(wStyle.height)

    // aspect-[4/5] → height = width × (5/4) = 1.25 × width
    // At 360px width: expected height = 450px
    expect(h).toBeGreaterThan(0)
    expect(Math.abs(h - w * 1.25)).toBeLessThanOrEqual(1)

    // img: h-full → fills the aspect-[4/5] wrapper → height > 0
    expect(parseFloat(iStyle.height)).toBeGreaterThan(0)
    // object-cover → computed objectFit is 'cover'
    expect(iStyle.objectFit).toBe('cover')

    document.body.removeChild(wrapper)
  })
})
