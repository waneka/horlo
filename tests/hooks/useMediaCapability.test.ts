// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
// Plan 04: upgraded from todo to assertions (VID-01, VID-04)

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMediaCapability } from '@/hooks/useMediaCapability'

describe('useMediaCapability — capability probe hook (VID-01, VID-04)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns supportsVideoCapture=false before probe runs (SSR default)', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    const { result } = renderHook(() => useMediaCapability())
    expect(result.current.supportsVideoCapture).toBe(false)
    expect(result.current.preferredMimeType).toBeNull()
  })

  it('returns supportsVideoCapture=true + mp4 mimeType when mp4 supported (VID-04)', async () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: (m: string) => m === 'video/mp4;codecs=avc1' })
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn() }, configurable: true })
    const { result } = renderHook(() => useMediaCapability())
    await act(async () => {})
    expect(result.current.supportsVideoCapture).toBe(true)
    expect(result.current.preferredMimeType).toBe('video/mp4;codecs=avc1')
  })

  it('falls back to webm when mp4 unsupported (VID-04)', async () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: (m: string) => m.startsWith('video/webm') })
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn() }, configurable: true })
    const { result } = renderHook(() => useMediaCapability())
    await act(async () => {})
    expect(result.current.supportsVideoCapture).toBe(true)
    expect(result.current.preferredMimeType).toMatch(/^video\/webm/)
  })

  it('returns supportsVideoCapture=false when getUserMedia unavailable', async () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => true })
    Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true })
    const { result } = renderHook(() => useMediaCapability())
    await act(async () => {})
    expect(result.current.supportsVideoCapture).toBe(false)
  })
})
