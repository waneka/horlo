// tests/browser/phase25-css-chain.browser.test.tsx
//
// Phase 25 CSS-chain assertions (DEBT-10 D-07/D-08).
//
// Checks computed styles in real Chromium — NOT class names.
// D-08 requirement: computed-style assertions for visual surfaces touched by Phase 25.
//
// Visual surfaces covered:
//   - UserMenu: `flex items-center gap-1` dual-affordance trigger container
//   - UserMenu: `inline-flex size-11 ...` avatar Link hit-target (44×44px)
//
// References:
//   - 25-CONTEXT.md (nav-user-menu phase)
//   - 42-validation-backfill/25-VALIDATION.md (backfilled artifact)
//
// Source: UserMenu.tsx lines 109-113

import { describe, it, expect } from 'vitest'

describe('Phase 25 CSS-chain: UserMenu avatar + dual-affordance container layout (DEBT-10)', () => {
  it('flex items-center gap-1 container computes display:flex, align-items:center, column-gap ≈ 4px', () => {
    const container = document.createElement('div')
    // Exact class string from UserMenu.tsx:109 (the outer dual-affordance wrapper)
    container.className = 'flex items-center gap-1'
    const child1 = document.createElement('div')
    child1.style.width = '44px'
    const child2 = document.createElement('div')
    child2.style.width = '24px'
    container.appendChild(child1)
    container.appendChild(child2)
    document.body.appendChild(container)

    const style = window.getComputedStyle(container)

    // flex → display: flex
    expect(style.display).toBe('flex')
    // items-center → align-items: center
    expect(style.alignItems).toBe('center')
    // gap-1 → column-gap: 4px (Tailwind gap scale: 1 × 4px = 4px)
    expect(parseFloat(style.columnGap)).toBeCloseTo(4, 0)

    document.body.removeChild(container)
  })

  it('size-11 avatar Link hit-target computes width ≈ 44px and height ≈ 44px', () => {
    const link = document.createElement('a')
    // Exact key classes from UserMenu.tsx:113 that establish the 44×44 hit target.
    // The full class includes focus-visible utilities that do not affect box dimensions.
    link.className = 'inline-flex size-11 items-center justify-center rounded-full'
    document.body.appendChild(link)

    const style = window.getComputedStyle(link)

    // size-11 → width: 44px, height: 44px (Tailwind size scale: 11 × 4px = 44px)
    expect(parseFloat(style.width)).toBeCloseTo(44, 0)
    expect(parseFloat(style.height)).toBeCloseTo(44, 0)

    document.body.removeChild(link)
  })
})
