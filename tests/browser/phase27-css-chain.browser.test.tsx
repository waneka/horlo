// tests/browser/phase27-css-chain.browser.test.tsx
//
// Phase 27 CSS-chain assertions (DEBT-10 D-07/D-08).
//
// Checks computed styles in real Chromium — NOT class names.
// D-08 requirement: computed-style assertions for visual surfaces touched by Phase 27.
//
// Visual surfaces covered:
//   - ProfileWatchCard: `relative aspect-[4/5] bg-muted` card image wrapper
//   - CollectionTabContent / WishlistTabContent: `grid grid-cols-2 gap-4` layout grid
//
// Note: The Next.js <Image fill> internals (position: absolute; width: 100%; height: 100%)
// are out of scope here — the assertions target the Tailwind CSS chain on plain elements,
// not the Next.js Image component internals. The aspect-ratio + grid layout is what Phase 27
// shipped; those computed values are the regression surface.
//
// References:
//   - 27-CONTEXT.md (watch-card-collection-render-polish)
//   - 42-validation-backfill/27-VALIDATION.md (backfilled artifact)
//
// Source: ProfileWatchCard.tsx line 61, CollectionTabContent.tsx line 170

import { describe, it, expect } from 'vitest'

describe('Phase 27 CSS-chain: ProfileWatchCard + grid layout (DEBT-10)', () => {
  it('aspect-[4/5] card wrapper computes correct height-to-width ratio (height > 0)', () => {
    const wrapper = document.createElement('div')
    // Exact class string from ProfileWatchCard.tsx:61
    wrapper.className = 'relative aspect-[4/5] bg-muted'
    // Anchor width to 180px → expected computed height ≈ 225px (1.25 × 180)
    wrapper.style.width = '180px'
    document.body.appendChild(wrapper)

    const style = window.getComputedStyle(wrapper)
    const w = parseFloat(style.width)
    const h = parseFloat(style.height)

    expect(h).toBeGreaterThan(0)
    // aspect-[4/5] → h = w × (5/4) = w × 1.25
    expect(Math.abs(h - w * 1.25)).toBeLessThanOrEqual(1)

    document.body.removeChild(wrapper)
  })

  it('grid-cols-2 container renders two equal-width columns each > 100px at 360px container width', () => {
    const grid = document.createElement('div')
    // Exact class string from CollectionTabContent.tsx:170 (base classes only — sm:/lg: breakpoints
    // do not fire at 360px test width)
    grid.className = 'grid grid-cols-2 gap-4'
    grid.style.width = '360px'

    const card1 = document.createElement('div')
    const card2 = document.createElement('div')
    grid.appendChild(card1)
    grid.appendChild(card2)
    document.body.appendChild(grid)

    const s1 = window.getComputedStyle(card1)
    const s2 = window.getComputedStyle(card2)
    const w1 = parseFloat(s1.width)
    const w2 = parseFloat(s2.width)

    // Each column should be roughly half the 360px container minus the gap
    expect(w1).toBeGreaterThan(100)
    expect(w2).toBeGreaterThan(100)
    // Both columns should be equal width (within 1px rounding tolerance)
    expect(Math.abs(w1 - w2)).toBeLessThanOrEqual(1)

    document.body.removeChild(grid)
  })
})
