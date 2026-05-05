import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/u/tyler/collection',
}))

import { ProfileTabs } from '@/components/profile/ProfileTabs'

describe('ProfileTabs — isOwner-gated Insights tab (Phase 14 D-13 P-08)', () => {
  // Test 1 (regression): 5 base tabs when isOwner=false, showCommonGround=false
  it('renders 5 base tabs when isOwner=false and showCommonGround=false', () => {
    const { container, queryByText } = render(
      <ProfileTabs username="tyler" />,
    )
    const triggers = container.querySelectorAll('[data-tab-id]')
    expect(triggers.length).toBe(5)
    expect(container.querySelector('[data-tab-id="insights"]')).toBeNull()
    expect(container.querySelector('[data-tab-id="common-ground"]')).toBeNull()
    expect(queryByText('Insights')).toBeNull()
    for (const id of ['collection', 'wishlist', 'worn', 'notes', 'stats']) {
      expect(container.querySelector(`[data-tab-id="${id}"]`)).toBeTruthy()
    }
  })

  // Test 2: 5 base + common-ground when isOwner=false, showCommonGround=true
  it('renders Collection, Wishlist, Worn, Notes, Stats, Common Ground (no Insights) when isOwner=false and showCommonGround=true', () => {
    const { container, queryByText } = render(
      <ProfileTabs username="tyler" showCommonGround={true} />,
    )
    const triggers = container.querySelectorAll('[data-tab-id]')
    expect(triggers.length).toBe(6)
    expect(container.querySelector('[data-tab-id="common-ground"]')).toBeTruthy()
    expect(container.querySelector('[data-tab-id="insights"]')).toBeNull()
    expect(queryByText('Insights')).toBeNull()
  })

  // Test 3: 5 base + insights when isOwner=true, showCommonGround=false
  it('renders Collection, Wishlist, Worn, Notes, Stats, Insights (no Common Ground) when isOwner=true and showCommonGround=false', () => {
    const { container, queryByText } = render(
      <ProfileTabs username="tyler" isOwner={true} />,
    )
    const triggers = container.querySelectorAll('[data-tab-id]')
    expect(triggers.length).toBe(6)
    expect(container.querySelector('[data-tab-id="insights"]')).toBeTruthy()
    expect(container.querySelector('[data-tab-id="common-ground"]')).toBeNull()
    expect(queryByText('Insights')).toBeTruthy()
  })

  // Test 4: all 7 tabs when isOwner=true, showCommonGround=true
  it('renders all 7 tabs when isOwner=true and showCommonGround=true', () => {
    const { container } = render(
      <ProfileTabs username="tyler" isOwner={true} showCommonGround={true} />,
    )
    const triggers = container.querySelectorAll('[data-tab-id]')
    expect(triggers.length).toBe(7)
    for (const id of [
      'collection',
      'wishlist',
      'worn',
      'notes',
      'stats',
      'common-ground',
      'insights',
    ]) {
      expect(container.querySelector(`[data-tab-id="${id}"]`)).toBeTruthy()
    }
  })

  // Test 5: Existence-leak defense (P-08) — no Insights text, no /insights link when isOwner=false
  it('does NOT render any Insights text or /insights link when isOwner=false (existence-leak defense — P-08)', () => {
    const { container, queryByText } = render(
      <ProfileTabs username="tyler" isOwner={false} showCommonGround={true} />,
    )
    // No text
    expect(queryByText('Insights')).toBeNull()
    // No data-tab-id="insights"
    expect(container.querySelector('[data-tab-id="insights"]')).toBeNull()
    // No href ending in /insights
    const anchors = container.querySelectorAll('a[href]')
    for (const a of Array.from(anchors)) {
      const href = a.getAttribute('href') ?? ''
      expect(href.endsWith('/insights')).toBe(false)
    }
  })

  // Test 6: When isOwner=true, Insights link href is /u/{username}/insights
  it('renders Insights link with href /u/${username}/insights when isOwner=true', () => {
    const { container } = render(
      <ProfileTabs username="alice" isOwner={true} />,
    )
    const insightsTrigger = container.querySelector('[data-tab-id="insights"]')
    expect(insightsTrigger).toBeTruthy()
    // The anchor is rendered by base-ui via `render` prop; search for the nearest anchor
    const anchor =
      insightsTrigger?.tagName.toLowerCase() === 'a'
        ? insightsTrigger
        : insightsTrigger?.querySelector('a') ??
          // base-ui may mount the Link as the root via render prop, so also check parent
          insightsTrigger?.closest('a')
    // At minimum one anchor with /u/alice/insights href should exist
    const anchors = Array.from(container.querySelectorAll('a[href]'))
    const hrefs = anchors.map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/u/alice/insights')
    // And the insights-tab-id element either IS or contains the right href
    if (anchor) {
      expect(anchor.getAttribute('href')).toBe('/u/alice/insights')
    }
  })

  // Test 7: Default for isOwner is false (same behavior as Test 1 when omitted)
  it('treats omitted isOwner prop as false (default)', () => {
    const { container } = render(<ProfileTabs username="tyler" />)
    const triggers = container.querySelectorAll('[data-tab-id]')
    expect(triggers.length).toBe(5)
    expect(container.querySelector('[data-tab-id="insights"]')).toBeNull()
  })
})

describe('ProfileTabs — PROF-10 horizontal-only scroll className override', () => {
  it('TabsList has overflow-x-auto AND overflow-y-hidden + scrollbar-hiding utilities + pb-2', () => {
    const { container } = render(<ProfileTabs username="tyler" />)
    // The TabsList is the parent of all [data-tab-id] triggers.
    const firstTrigger = container.querySelector('[data-tab-id]')
    const tabsList = firstTrigger?.parentElement
    expect(tabsList).toBeTruthy()
    const cls = tabsList!.className
    // Preserved utilities (Phase 14 lock):
    expect(cls).toContain('w-full')
    expect(cls).toContain('justify-start')
    expect(cls).toContain('gap-2')
    expect(cls).toContain('overflow-x-auto')
    // PROF-10 additions (CONTEXT D-06/D-07/D-08):
    expect(cls).toContain('overflow-y-hidden')
    expect(cls).toContain('pb-2')
    expect(cls).toContain('[scrollbar-width:none]')
    expect(cls).toContain('[&::-webkit-scrollbar]:hidden')
  })
})
