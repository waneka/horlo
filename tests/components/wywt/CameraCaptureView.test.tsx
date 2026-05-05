// tests/components/wywt/CameraCaptureView.test.tsx
//
// D-07 math contract for the WYWT capture-alignment fix (WYWT-22).
//
// Tests the pure helper `computeObjectCoverSourceRect` that maps the visible,
// object-cover-cropped wrapper rect back to stream coordinates. The saved JPEG
// is drawn from this source rect, so its centerpoint must equal the stream
// centerpoint within ±1px (D-07 tolerance).
//
// References:
// - 30-CONTEXT.md D-07 (3 baseline fixtures, ±1px)
// - 30-RESEARCH.md §"Object-Cover Source Rect Math" (formula + manual validation)
// - 30-RESEARCH.md §"D-07 Math Test (Pure Function Approach)" (verbatim shape)

import { describe, it, expect } from 'vitest'
import { computeObjectCoverSourceRect } from '@/components/wywt/CameraCaptureView'

describe('computeObjectCoverSourceRect — D-07 math assertions (WYWT-22)', () => {
  const TOLERANCE = 1 // ±1px per D-07

  function centerInStream(sx: number, sy: number, sw: number, sh: number) {
    return { cx: sx + sw / 2, cy: sy + sh / 2 }
  }

  it('1920×1080 stream + 360×360 wrapper: source rect center = stream center', () => {
    const { sx, sy, sw, sh } = computeObjectCoverSourceRect(1920, 1080, 360, 360)
    const { cx, cy } = centerInStream(sx, sy, sw, sh)
    expect(Math.abs(cx - 1920 / 2)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(cy - 1080 / 2)).toBeLessThanOrEqual(TOLERANCE)
  })

  it('1280×720 stream + 360×360 wrapper: source rect center = stream center', () => {
    const { sx, sy, sw, sh } = computeObjectCoverSourceRect(1280, 720, 360, 360)
    const { cx, cy } = centerInStream(sx, sy, sw, sh)
    expect(Math.abs(cx - 1280 / 2)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(cy - 720 / 2)).toBeLessThanOrEqual(TOLERANCE)
  })

  it('1080×1080 stream + 360×360 wrapper: source rect = full stream (no crop)', () => {
    const { sx, sy, sw, sh } = computeObjectCoverSourceRect(1080, 1080, 360, 360)
    expect(sx).toBeCloseTo(0)
    expect(sy).toBeCloseTo(0)
    expect(sw).toBeCloseTo(1080)
    expect(sh).toBeCloseTo(1080)
  })

  it('source rect stays within stream bounds for all fixtures', () => {
    const fixtures: Array<[number, number]> = [
      [1920, 1080],
      [1280, 720],
      [1080, 1080],
    ]
    for (const [streamW, streamH] of fixtures) {
      const { sx, sy, sw, sh } = computeObjectCoverSourceRect(
        streamW,
        streamH,
        360,
        360,
      )
      expect(sx).toBeGreaterThanOrEqual(0)
      expect(sy).toBeGreaterThanOrEqual(0)
      expect(sx + sw).toBeLessThanOrEqual(streamW + 0.001)
      expect(sy + sh).toBeLessThanOrEqual(streamH + 0.001)
    }
  })
})
