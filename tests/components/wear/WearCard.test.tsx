// Wave 0 RED — completed by Plan 02 (WearCard component extraction)
//
// SC-4: WearCard is the single shared wear-content card used by both
// /wears/[username] and /wear/[id] routes (D-12).
//
// D-09: "Add to wishlist" overflow menu item is conditionally shown:
//   - hidden when showAddToWishlist={false} (own wear / owned / wishlisted)
//   - shown  when showAddToWishlist={true}
//
// EXPECTED RED until Plan 02 lands WearCard at src/components/wear/WearCard.tsx

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

// SC-4: the import itself resolves to a function (single shared source).
// This module path is the canonical location per RESEARCH.md §Project Structure.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let WearCard: (props: any) => JSX.Element | null

describe('WearCard — SC-4 single-source + D-09 wishlist gate (Wave 0 RED)', () => {
  it('SC-4: @/components/wear/WearCard exports a function (single shared source)', async () => {
    // EXPECTED RED until Plan 02 lands WearCard
    const mod = await import('@/components/wear/WearCard')
    expect(typeof mod.WearCard, 'WearCard must be a function').toBe('function')
    WearCard = mod.WearCard
  })

  it('D-09: showAddToWishlist={false} → "Add to wishlist" item NOT present', async () => {
    // EXPECTED RED until Plan 02 lands WearCard
    // Minimal required props — Plan 02 executor may extend as needed
    const mod = await import('@/components/wear/WearCard')
    WearCard = mod.WearCard

    const { container } = render(
      <WearCard
        signedUrl={null}
        watchImageUrl={null}
        altText="Test wear"
        username="alice"
        displayName="Alice"
        avatarUrl={null}
        createdAt={new Date('2026-05-22T10:00:00Z')}
        brand="Rolex"
        model="GMT"
        watchId="w-001"
        viewerId="v-001"
        wearEventId="we-001"
        initialLiked={false}
        initialCount={0}
        commentHostVariant="inline"
        showAddToWishlist={false}
        permalinkUrl="/wear/we-001"
      />,
    )
    // The text "Add to wishlist" must not appear at all
    expect(
      container.textContent,
      'showAddToWishlist=false → no wishlist menu item',
    ).not.toContain('Add to wishlist')
  })

  it('D-09: showAddToWishlist={true} → "Add to wishlist" item IS present', async () => {
    // EXPECTED RED until Plan 02 lands WearCard
    const mod = await import('@/components/wear/WearCard')
    WearCard = mod.WearCard

    render(
      <WearCard
        signedUrl={null}
        watchImageUrl={null}
        altText="Test wear"
        username="bob"
        displayName="Bob"
        avatarUrl={null}
        createdAt={new Date('2026-05-22T10:00:00Z')}
        brand="Omega"
        model="Speedmaster"
        watchId="w-002"
        viewerId="v-002"
        wearEventId="we-002"
        initialLiked={false}
        initialCount={0}
        commentHostVariant="inline"
        showAddToWishlist={true}
        permalinkUrl="/wear/we-002"
      />,
    )
    // The text "Add to wishlist" must appear somewhere in the rendered output
    expect(
      screen.getByText('Add to wishlist'),
      'showAddToWishlist=true → wishlist menu item present',
    ).toBeTruthy()
  })
})
