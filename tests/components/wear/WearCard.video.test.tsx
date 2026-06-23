// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
// Plan 07: upgraded from todo to assertions (VID-13, VID-15)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { WearCard } from '@/components/wear/WearCard'

// Spy on HTMLMediaElement methods so the autoplay attempt inside WearVideoClient
// doesn't reject and crash the jsdom test environment.
beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(HTMLVideoElement.prototype, 'play').mockImplementation(() => Promise.resolve())
  vi.spyOn(HTMLVideoElement.prototype, 'pause').mockImplementation(() => {})
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mkProps(overrides: Record<string, any> = {}) {
  return {
    signedUrl: null,
    watchImageUrl: null,
    altText: 'Test wear',
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
    createdAt: new Date('2026-06-22T10:00:00Z'),
    brand: 'Rolex',
    model: 'GMT',
    watchId: 'w-001',
    viewerId: 'v-001',
    wearEventId: 'we-001',
    initialLiked: false,
    initialCount: 0,
    commentHostVariant: 'inline' as const,
    showAddToWishlist: false,
    permalinkUrl: '/wear/we-001',
    initialComments: [],
    canComment: true,
    ownerFollowsViewer: false,
    viewerIsFollowing: false,
    ownerUserId: 'u-001',
    ownerUsername: 'alice',
    viewerAuthor: null,
    commentCount: 0,
    ...overrides,
  }
}

describe('WearCard video — branch + VID-15 regression', () => {
  it('VID-15: no <video> element when mediaType prop absent (photo branch byte-identical)', () => {
    const { container } = render(
      <WearCard {...mkProps({ signedUrl: 'https://example.com/photo.jpg' })} />,
    )
    expect(container.querySelector('video')).toBeNull()
    // Per durable feedback: also assert the photo path actually rendered.
    // WearPhotoClient renders the signed URL via <img>.
    expect(container.querySelector('img')).not.toBeNull()
  })

  it('VID-13: renders WearVideoClient (contains <video>) when mediaType="video"', () => {
    const { container } = render(
      <WearCard
        {...mkProps({
          signedUrl: null,
          mediaType: 'video',
          signedVideoUrl: 'https://example.com/v.mp4',
          signedPosterUrl: 'https://example.com/p.jpg',
        })}
      />,
    )
    expect(container.querySelector('video')).not.toBeNull()
  })
})
