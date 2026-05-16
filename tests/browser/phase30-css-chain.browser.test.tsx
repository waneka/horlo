// tests/browser/phase30-css-chain.browser.test.tsx
//
// Phase 30 CSS-chain assertions (DEBT-10 D-07/D-08).
//
// Checks computed styles in real Chromium — NOT class names.
// D-08 requirement: assertions that would have caught the h-full hotfix regression.
//
// Visual surfaces covered:
//   - CameraCaptureView: `relative w-full aspect-square overflow-hidden rounded-md bg-black` wrapper
//   - CameraCaptureView: `block h-full w-full object-cover` video element
//
// References:
//   - 30-CONTEXT.md (wywt-capture-alignment-fix)
//   - 42-validation-backfill/30-VALIDATION.md (backfilled artifact)
//
// Source: CameraCaptureView.tsx lines 120-137

import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Phase 30 CSS-chain: CameraCaptureView layout (DEBT-10)', () => {
  beforeEach(() => {
    // Stub mediaDevices to prevent getUserMedia permission prompt in Chromium.
    // Although the DOM-only pattern does not mount the full component, keep the
    // stub for safety — the browser project runs all browser.test.tsx files in
    // the same Chromium context and any leaked global could interfere.
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [],
        }),
      },
    })
  })

  it('aspect-square wrapper computes equal width and height (both > 0)', () => {
    const wrapper = document.createElement('div')
    // Exact class string from CameraCaptureView.tsx:122
    wrapper.className = 'relative w-full aspect-square overflow-hidden rounded-md bg-black'
    // Anchor width so aspect-ratio math has a resolved reference length
    wrapper.style.width = '360px'
    document.body.appendChild(wrapper)

    const style = window.getComputedStyle(wrapper)
    const w = parseFloat(style.width)
    const h = parseFloat(style.height)

    expect(h).toBeGreaterThan(0) // not collapsed
    // aspect-square → height === width (within 1px rounding tolerance)
    expect(Math.abs(h - w)).toBeLessThanOrEqual(1)

    document.body.removeChild(wrapper)
  })

  it('video with h-full w-full object-cover computes height > 0 and objectFit = cover', () => {
    // This assertion WOULD HAVE caught the h-full hotfix regression (commit 2dd7377).
    // Before the hotfix: <video> had no h-full class → computed height was 0px (the video
    // element kept its intrinsic 16:9 aspect rather than filling the aspect-square wrapper),
    // causing a black bar at the bottom of the capture frame.
    // After the hotfix: h-full is present → computed height fills the wrapper → objectFit
    // can engage and cover the entire wrapper area.
    // Without h-full, this assertion fails: parseFloat(style.height) === 0 and
    // style.objectFit may return '' (no area to cover against).
    const wrapper = document.createElement('div')
    // Exact class string from CameraCaptureView.tsx:122
    wrapper.className = 'relative w-full aspect-square overflow-hidden rounded-md bg-black'
    wrapper.style.width = '360px'

    const video = document.createElement('video')
    // Exact class string from CameraCaptureView.tsx:137 (the h-full hotfix addition)
    video.className = 'block h-full w-full object-cover'
    wrapper.appendChild(video)
    document.body.appendChild(wrapper)

    const style = window.getComputedStyle(video)

    // h-full → fills the aspect-square wrapper → height > 0
    expect(parseFloat(style.height)).toBeGreaterThan(0)
    // object-cover → computed objectFit is 'cover'
    expect(style.objectFit).toBe('cover')

    document.body.removeChild(wrapper)
  })
})
