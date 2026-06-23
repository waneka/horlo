// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
// Plan 05: upgraded from todo to assertions (VID-02, VID-03)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { VideoCaptureView } from '@/components/wywt/VideoCaptureView'

// Minimal MediaRecorder mock — synchronously invokes onstop when stop() is called,
// so the cancelledRef guard path in onstop runs deterministically.
class MockMediaRecorder {
  static isTypeSupported() {
    return true
  }
  state: 'inactive' | 'recording' = 'inactive'
  ondataavailable: ((e: BlobEvent) => void) | null = null
  onstop: (() => void) | null = null
  start = vi.fn(() => {
    this.state = 'recording'
  })
  stop = vi.fn(() => {
    this.state = 'inactive'
    if (this.onstop) this.onstop()
  })
}

function mkStream(): MediaStream {
  return { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream
}

describe('VideoCaptureView — stream-as-prop video capture (VID-02, VID-03)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.stubGlobal('MediaRecorder', MockMediaRecorder)
  })

  it('renders Cancel + Record 4s buttons in pre-recording state', () => {
    render(
      <VideoCaptureView
        stream={mkStream()}
        preferredMimeType="video/mp4;codecs=avc1"
        onVideoReady={vi.fn()}
        onError={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Record video/i })).toBeInTheDocument()
  })

  it('does NOT call navigator.mediaDevices.getUserMedia internally (stream-as-prop architecture)', () => {
    const getUserMediaSpy = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: getUserMediaSpy },
      configurable: true,
    })
    render(
      <VideoCaptureView
        stream={mkStream()}
        preferredMimeType="video/mp4;codecs=avc1"
        onVideoReady={vi.fn()}
        onError={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(getUserMediaSpy).not.toHaveBeenCalled()
  })

  it('disables both Cancel and Record buttons when disabled prop is true', () => {
    render(
      <VideoCaptureView
        stream={mkStream()}
        preferredMimeType="video/mp4;codecs=avc1"
        onVideoReady={vi.fn()}
        onError={vi.fn()}
        onCancel={vi.fn()}
        disabled
      />,
    )
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Record video/i })).toBeDisabled()
  })

  it('VID-03: discard during recording resets state without calling onVideoReady', () => {
    const onVideoReady = vi.fn()
    render(
      <VideoCaptureView
        stream={mkStream()}
        preferredMimeType="video/mp4;codecs=avc1"
        onVideoReady={onVideoReady}
        onError={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    // Tap Record → recorder starts → recording=true; Cancel is now the in-recording
    // cancel handler (D-12). MockMediaRecorder.stop() synchronously invokes onstop;
    // the cancelledRef guard short-circuits before any extractPosterBlob call.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Record video/i }))
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    })
    expect(onVideoReady).not.toHaveBeenCalled()
  })
})
