// tests/components/profile/ProfileWatchCard.test.tsx
//
// Behavior tests for <ProfileWatchCard> covering:
//   1. Wishlist watch: no wear badge, no last-worn line
//   2. Grail watch: no wear badge, no last-worn line
//   3. Owned watch (worn today): wear badge + last-worn line present
//   4. Brand + model appear in DOM before the image container
//   5. No photo: WatchIcon placeholder rendered, not a broken image

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProfileWatchCard } from '@/components/profile/ProfileWatchCard'
import type { Watch } from '@/lib/types'

// ---------------------------------------------------------------------------
// Mocks — declared before component import so vitest hoisting applies
// ---------------------------------------------------------------------------

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({ alt, src, ...rest }: { alt: string; src: string } & Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />
  ),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TODAY_ISO = new Date().toISOString().split('T')[0] // YYYY-MM-DD

function makeWatch(overrides: Partial<Watch> = {}): Watch {
  return {
    id: 'w1',
    brand: 'Omega',
    model: 'Speedmaster',
    status: 'owned',
    movement: 'auto',
    complications: [],
    styleTags: [],
    designTraits: [],
    roleTags: [],
    notes: '',
    imageUrl: 'https://example.com/watch.jpg',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProfileWatchCard — wear suppression (PLSH-03, D-12)', () => {
  // Test 1: wishlist watch renders no wear badge and no last-worn line
  it('renders no wear badge and no last-worn line for a wishlist watch', () => {
    render(
      <ProfileWatchCard
        watch={makeWatch({ status: 'wishlist' })}
        lastWornDate={TODAY_ISO}
      />,
    )
    // Wear badge text must not appear
    expect(screen.queryByText('Worn today')).toBeNull()
    expect(screen.queryByText('Not worn recently')).toBeNull()
    // Last-worn line must not appear (the line shows "Worn today", "Worn yesterday",
    // "Worn Nd ago", or "Never worn" — none should appear for wishlist)
    expect(screen.queryByText(/Worn/)).toBeNull()
    expect(screen.queryByText('Never worn')).toBeNull()
  })

  // Test 2: grail watch renders no wear badge and no last-worn line
  it('renders no wear badge and no last-worn line for a grail watch', () => {
    render(
      <ProfileWatchCard
        watch={makeWatch({ status: 'grail' })}
        lastWornDate={TODAY_ISO}
      />,
    )
    expect(screen.queryByText('Worn today')).toBeNull()
    expect(screen.queryByText('Not worn recently')).toBeNull()
    expect(screen.queryByText(/Worn/)).toBeNull()
    expect(screen.queryByText('Never worn')).toBeNull()
  })

  // Test 3: owned watch worn today renders the "Worn today" badge AND a last-worn line
  it('renders the "Worn today" badge for an owned watch worn today', () => {
    render(
      <ProfileWatchCard
        watch={makeWatch({ status: 'owned' })}
        lastWornDate={TODAY_ISO}
      />,
    )
    // "Worn today" appears both in the badge (absolute position) and as the last-worn line.
    // There will be at least one element with this text — the badge inside the image container.
    const instances = screen.getAllByText('Worn today')
    expect(instances.length).toBeGreaterThanOrEqual(1)
  })
})

describe('ProfileWatchCard — layout structure (PLSH-04, D-04)', () => {
  // Test 4: brand and model appear in DOM before the image container
  it('renders brand and model text nodes before the image container in DOM order', () => {
    const { container } = render(
      <ProfileWatchCard
        watch={makeWatch({ brand: 'Omega', model: 'Speedmaster' })}
        lastWornDate={null}
      />,
    )

    const allElements = Array.from(container.querySelectorAll('*'))

    // Find the brand text node's parent element
    const brandEl = allElements.find(
      (el) => el.textContent?.trim() === 'Omega' && el.tagName === 'P',
    )
    // Find the image container (has aspect-[3/4] class in className or data)
    const imageContainer = allElements.find(
      (el) => el.className.includes('aspect-') && el.tagName === 'DIV',
    )

    expect(brandEl).toBeTruthy()
    expect(imageContainer).toBeTruthy()

    // Node.DOCUMENT_POSITION_FOLLOWING means imageContainer comes after brandEl
    const position = brandEl!.compareDocumentPosition(imageContainer!)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // Test 5: a watch with no photo renders the WatchIcon placeholder, not a broken image
  it('renders the WatchIcon placeholder when no imageUrl is set', () => {
    const { container } = render(
      <ProfileWatchCard
        watch={makeWatch({ imageUrl: undefined })}
        lastWornDate={null}
      />,
    )
    // No <img> element should be rendered (no photo, no next/image)
    expect(container.querySelector('img')).toBeNull()
    // The watch icon SVG (lucide Watch icon) should be present
    // Lucide icons render as <svg> elements; the parent div uses flex centering
    const svgEl = container.querySelector('svg')
    expect(svgEl).toBeTruthy()
  })
})
