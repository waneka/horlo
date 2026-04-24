// tests/components/WristOverlaySvg.test.tsx
//
// Wave 0 supplement — pins the WristOverlaySvg geometry per UI-SPEC §D-08.
//
// The plan's done criterion requires `grep -c 'line\|circle\|rect'` ≤ 6
// (4 lines + 2 circles + 1 rect = 7; we tolerate the rect as the crown
// per CONTEXT D-08). The component count we assert here:
//   - 4 line elements (2 arm + 2 hands)
//   - 2 circle elements (bezel + face)
//   - 1 rect element (crown)
// Total: 7 shape elements. Anything more is forbidden (no hour markers,
// no lugs, no strap edges, no bracelet).

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { WristOverlaySvg } from '@/components/wywt/WristOverlaySvg'

describe('WristOverlaySvg', () => {
  it('renders an SVG with viewBox=0 0 100 100 and aria-hidden', () => {
    const { container } = render(<WristOverlaySvg />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('viewBox')).toBe('0 0 100 100')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  it('contains two arm lines at y=38 and y=62 spanning full width', () => {
    const { container } = render(<WristOverlaySvg />)
    const lines = container.querySelectorAll('line')
    const arm38 = Array.from(lines).find(
      (l) => l.getAttribute('y1') === '38' && l.getAttribute('y2') === '38',
    )
    const arm62 = Array.from(lines).find(
      (l) => l.getAttribute('y1') === '62' && l.getAttribute('y2') === '62',
    )
    expect(arm38).toBeTruthy()
    expect(arm62).toBeTruthy()
    expect(arm38?.getAttribute('x1')).toBe('0')
    expect(arm38?.getAttribute('x2')).toBe('100')
    expect(arm62?.getAttribute('x1')).toBe('0')
    expect(arm62?.getAttribute('x2')).toBe('100')
  })

  it('contains two concentric circles at (50,50) with r=22 (bezel) and r=17 (face)', () => {
    const { container } = render(<WristOverlaySvg />)
    const circles = container.querySelectorAll('circle')
    expect(circles).toHaveLength(2)
    const radii = Array.from(circles).map((c) => c.getAttribute('r'))
    expect(radii).toContain('22')
    expect(radii).toContain('17')
    Array.from(circles).forEach((c) => {
      expect(c.getAttribute('cx')).toBe('50')
      expect(c.getAttribute('cy')).toBe('50')
    })
  })

  it('contains the crown rect at x=72 y=49 width=4 height=3', () => {
    const { container } = render(<WristOverlaySvg />)
    const rects = container.querySelectorAll('rect')
    expect(rects).toHaveLength(1)
    const crown = rects[0]
    expect(crown.getAttribute('x')).toBe('72')
    expect(crown.getAttribute('y')).toBe('49')
    expect(crown.getAttribute('width')).toBe('4')
    expect(crown.getAttribute('height')).toBe('3')
  })

  it('contains exactly 4 lines + 2 circles + 1 rect = 7 shapes (no extras)', () => {
    const { container } = render(<WristOverlaySvg />)
    const lines = container.querySelectorAll('line')
    const circles = container.querySelectorAll('circle')
    const rects = container.querySelectorAll('rect')
    expect(lines).toHaveLength(4) // 2 arm + 2 hands at 10:10
    expect(circles).toHaveLength(2) // bezel + face
    expect(rects).toHaveLength(1) // crown
    // Forbidden: no hour-marker paths, lugs, strap edges, etc.
    expect(container.querySelectorAll('path')).toHaveLength(0)
    expect(container.querySelectorAll('polygon')).toHaveLength(0)
    expect(container.querySelectorAll('polyline')).toHaveLength(0)
    expect(container.querySelectorAll('ellipse')).toHaveLength(0)
  })
})
