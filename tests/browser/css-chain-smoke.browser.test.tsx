// tests/browser/css-chain-smoke.browser.test.tsx
//
// DEBT-10 Wave 0 smoke test: confirms Tailwind CSS reaches the browser iframe.
//
// Verifies assumption A3 from 42-RESEARCH.md: the Vite dev server used by
// @vitest/browser@2.1.9 processes postcss.config.mjs and serves Tailwind 4
// CSS to the Chromium iframe where tests run.
//
// D-07/D-08 requirement: assertions check computed styles, NOT class names.
// If either assertion returns an empty string, the CSS chain is not wired and
// a CSS import must be added to the browser project setupFiles in vitest.workspace.ts.
//
// References:
//   - 42-01-PLAN.md Task 3
//   - 42-RESEARCH.md §Open Questions item 3 (A3 assumption)
//   - 42-RESEARCH.md §Common Pitfalls Pitfall 2 (empty-string failure mode)
//   - 42-PATTERNS.md §Browser Test DOM-Only Pattern

import { describe, it, expect } from 'vitest'

describe('Wave 0 smoke test: Tailwind CSS computed styles in browser iframe', () => {
  it('bg-black resolves to rgb(0, 0, 0) background-color', () => {
    const el = document.createElement('div')
    el.className = 'bg-black'
    document.body.appendChild(el)

    const style = window.getComputedStyle(el)
    const bg = style.backgroundColor

    // If bg is '' (empty string), Tailwind CSS is NOT served to the iframe.
    // The fix: add a CSS import for src/app/globals.css to browser project setupFiles.
    expect(bg).not.toBe('')
    expect(bg).toBe('rgb(0, 0, 0)')

    document.body.removeChild(el)
  })

  it('aspect-square resolves a real computed height equal to width', () => {
    const el = document.createElement('div')
    el.className = 'aspect-square'
    el.style.width = '200px'
    document.body.appendChild(el)

    const style = window.getComputedStyle(el)
    const height = parseFloat(style.height)
    const width = parseFloat(style.width)

    // height must be > 0 (aspect-square engaged, not collapsed)
    expect(height).toBeGreaterThan(0)
    // height must be within 1px of width (aspect-square: 1/1 ratio)
    expect(Math.abs(height - width)).toBeLessThanOrEqual(1)

    document.body.removeChild(el)
  })
})
