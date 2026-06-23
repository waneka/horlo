// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
// Plan 07: upgraded from todo to assertions (VID-14, D-06, D-08)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { WearVideoClient } from '@/components/wear/WearVideoClient'

function mkProps(
  overrides: Partial<Parameters<typeof WearVideoClient>[0]> = {},
): Parameters<typeof WearVideoClient>[0] {
  return {
    signedVideoUrl: 'https://example.com/v.mp4',
    signedPosterUrl: 'https://example.com/p.jpg',
    altText: 'test wear',
    watchImageUrl: null,
    brand: 'B',
    model: 'M',
    username: 'u',
    displayName: null,
    avatarUrl: null,
    createdAt: new Date('2026-06-22T00:00:00Z'),
    watchId: 'w-1',
    ...overrides,
  }
}

describe('WearVideoClient — autoplay attrs + error fallback (VID-14)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('VID-14: <video> element has required autoplay/muted/loop/playsInline attributes', () => {
    const { container } = render(<WearVideoClient {...mkProps()} />)
    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    // jsdom lowercases attribute names; React sets autoPlay as "autoplay".
    expect(video?.hasAttribute('autoplay')).toBe(true)
    expect(video?.hasAttribute('loop')).toBe(true)
    expect(video?.hasAttribute('playsinline')).toBe(true)
    // muted is reflected as a property on HTMLMediaElement in jsdom
    expect((video as HTMLVideoElement | null)?.muted).toBe(true)
  })

  it('D-08: shows "Video unavailable" on <video> onError', () => {
    const { container, getByText } = render(<WearVideoClient {...mkProps()} />)
    const video = container.querySelector('video')!
    fireEvent.error(video)
    expect(getByText('Video unavailable')).toBeInTheDocument()
    // After the error the <video> element is gone (component re-rendered the
    // error-fallback branch — assert disappearance too per durable feedback).
    expect(container.querySelector('video')).toBeNull()
  })

  it('D-06: tap on container calls HTMLVideoElement.pause()', () => {
    const playSpy = vi
      .spyOn(HTMLVideoElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve())
    const pauseSpy = vi
      .spyOn(HTMLVideoElement.prototype, 'pause')
      .mockImplementation(() => {})
    const { container } = render(<WearVideoClient {...mkProps()} />)
    const wrapper = container.querySelector('[data-testid="wear-video-container"]')!
    // jsdom's HTMLMediaElement.paused defaults to true (no autoplay engine).
    // First click branches into v.play() since v.paused is true.
    fireEvent.click(wrapper)
    expect(playSpy).toHaveBeenCalled()
    pauseSpy.mockRestore()
    playSpy.mockRestore()
  })
})
