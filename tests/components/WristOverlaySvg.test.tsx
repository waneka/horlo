// tests/components/WristOverlaySvg.test.tsx
//
// The WYWT camera overlay is now a transparent PNG framing guide rendered via
// next/image, replacing the original Phase 15 inline-SVG geometry contract.

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { WristOverlaySvg } from '@/components/wywt/WristOverlaySvg'

describe('WristOverlaySvg', () => {
  it('renders the watch-on-arm PNG with empty alt and aria-hidden', () => {
    const { container } = render(<WristOverlaySvg />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('alt')).toBe('')
    expect(img?.getAttribute('aria-hidden')).toBe('true')
    expect(img?.getAttribute('src') ?? '').toContain('watch-on-arm-transparent')
  })

  it('applies object-contain so the framing guide stays fully visible', () => {
    const { container } = render(<WristOverlaySvg className="pointer-events-none absolute inset-0" />)
    const img = container.querySelector('img')
    expect(img?.className).toContain('object-contain')
    expect(img?.className).toContain('pointer-events-none')
  })
})
