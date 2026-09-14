// Phase 85 Plan 07 — D-14: watchLinkable prop on WearPhotoOverlays / WearDetailHero.
//
// A visitor viewing a wear of a previously-owned watch must NOT see a link to
// /w/[watchId] (it would 404 for them, D-14). The wear's owner still gets the
// link. This test locks the Link-vs-plain-text rendering contract at the
// WearPhotoOverlays and WearDetailHero level (WearCard/WearPhotoClient/
// WearVideoClient just thread the prop through — covered by their own
// existing test files per the plan's acceptance criteria).

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

import { WearPhotoOverlays, WearDetailHero } from '@/components/wear/WearDetailHero'

function mkOverlayProps(
  overrides: Partial<Parameters<typeof WearPhotoOverlays>[0]> = {},
): Parameters<typeof WearPhotoOverlays>[0] {
  return {
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
    createdAt: new Date('2026-09-13T00:00:00Z'),
    brand: 'Rolex',
    model: 'GMT',
    hasPhoto: true,
    watchId: 'w-1',
    ...overrides,
  }
}

describe('WearPhotoOverlays — watchLinkable (D-14)', () => {
  it('watchLinkable omitted → renders a link to /w/w-1 containing the brand text', () => {
    const { container, getByText } = render(<WearPhotoOverlays {...mkOverlayProps()} />)
    const links = container.querySelectorAll('a[href="/w/w-1"]')
    expect(links.length).toBeGreaterThan(0)
    expect(getByText('Rolex')).toBeInTheDocument()
  })

  it('watchLinkable={false} → brand/model text renders but no element links to /w/w-1', () => {
    const { container, getByText } = render(
      <WearPhotoOverlays {...mkOverlayProps({ watchLinkable: false })} />,
    )
    const links = container.querySelectorAll('a[href="/w/w-1"]')
    expect(links.length).toBe(0)
    expect(getByText('Rolex')).toBeInTheDocument()
    expect(getByText('GMT')).toBeInTheDocument()
  })
})

describe('WearDetailHero — watchLinkable threaded to overlays (D-14)', () => {
  it('watchLinkable={false} with watchImageUrl null → no /w/ link anywhere', () => {
    const { container, getByText } = render(
      <WearDetailHero
        watchImageUrl={null}
        brand="Omega"
        model="Speedmaster"
        altText="test wear"
        username="bob"
        displayName="Bob"
        avatarUrl={null}
        createdAt={new Date('2026-09-13T00:00:00Z')}
        watchId="w-2"
        watchLinkable={false}
      />,
    )
    const links = container.querySelectorAll('a[href^="/w/"]')
    expect(links.length).toBe(0)
    expect(getByText('Omega')).toBeInTheDocument()
  })

  it('watchLinkable omitted (defaults true) with watchImageUrl null → link present', () => {
    const { container } = render(
      <WearDetailHero
        watchImageUrl={null}
        brand="Omega"
        model="Speedmaster"
        altText="test wear"
        username="bob"
        displayName="Bob"
        avatarUrl={null}
        createdAt={new Date('2026-09-13T00:00:00Z')}
        watchId="w-2"
      />,
    )
    const links = container.querySelectorAll('a[href="/w/w-2"]')
    expect(links.length).toBeGreaterThan(0)
  })
})
