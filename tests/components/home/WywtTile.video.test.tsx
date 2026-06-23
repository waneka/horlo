// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
// Plan 08: upgraded from todo to assertions (VID-13)

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { WywtTile } from '@/components/home/WywtTile'
import type { WywtTile as WywtTileData } from '@/lib/wywtTypes'

function mkTileData(overrides: Partial<WywtTileData> = {}): WywtTileData {
  return {
    wearEventId: 'we-1',
    userId: 'u-1',
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
    watchId: 'w-1',
    brand: 'Rolex',
    model: 'GMT',
    imageUrl: null,
    photoUrl: 'https://example.com/photo.jpg',
    wornDate: '2026-06-22',
    note: null,
    visibility: 'public',
    isSelf: false,
    ...overrides,
  }
}

describe('WywtTile video — VideoPlayBadge overlay (VID-13)', () => {
  it('VID-13: renders the VideoPlayBadge overlay when mediaType === "video"', () => {
    const { container } = render(
      <WywtTile
        tile={mkTileData({ mediaType: 'video' })}
        isSelfPlaceholder={false}
        viewedIds={new Set()}
        hydrated={true}
        onOpen={vi.fn()}
        onOpenPicker={vi.fn()}
        mediaType="video"
        signedPosterUrl="https://example.com/poster.jpg"
      />,
    )
    // VideoPlayBadge signature: <div class="rounded-full bg-black/50 ...">
    const badge = container.querySelector('.rounded-full.bg-black\\/50')
    expect(badge).not.toBeNull()
  })

  it('VID-13: renders NO VideoPlayBadge when mediaType === "photo"', () => {
    const { container } = render(
      <WywtTile
        tile={mkTileData()}
        isSelfPlaceholder={false}
        viewedIds={new Set()}
        hydrated={true}
        onOpen={vi.fn()}
        onOpenPicker={vi.fn()}
        mediaType="photo"
        signedPosterUrl={null}
      />,
    )
    // Photo path renders — assert image present (disappearance pattern: badge absent)
    expect(container.querySelector('img')).not.toBeNull()
    expect(container.querySelector('.rounded-full.bg-black\\/50')).toBeNull()
  })

  it('VID-15: renders NO VideoPlayBadge when mediaType prop is absent (photo regression)', () => {
    const { container } = render(
      <WywtTile
        tile={mkTileData()}
        isSelfPlaceholder={false}
        viewedIds={new Set()}
        hydrated={true}
        onOpen={vi.fn()}
        onOpenPicker={vi.fn()}
      />,
    )
    // Photo path active — image present; badge absent
    expect(container.querySelector('img')).not.toBeNull()
    expect(container.querySelector('.rounded-full.bg-black\\/50')).toBeNull()
  })
})
