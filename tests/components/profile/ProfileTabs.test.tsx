import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/u/tyler/collection',
}))

import { ProfileTabs } from '@/components/profile/ProfileTabs'

describe('ProfileTabs — showCommonGround conditional 6th tab', () => {
  it('renders exactly 5 TabsTriggers when showCommonGround=false (prop omitted)', () => {
    const { container, queryByText } = render(
      <ProfileTabs username="tyler" />,
    )
    const triggers = container.querySelectorAll('[data-tab-id]')
    expect(triggers.length).toBe(5)
    expect(
      container.querySelector('[data-tab-id="common-ground"]'),
    ).toBeNull()
    expect(queryByText('Common Ground')).toBeNull()
  })

  it('renders 6 TabsTriggers when showCommonGround=true, with common-ground trigger present', () => {
    const { container, queryByText } = render(
      <ProfileTabs username="tyler" showCommonGround={true} />,
    )
    const triggers = container.querySelectorAll('[data-tab-id]')
    expect(triggers.length).toBe(6)
    expect(
      container.querySelector('[data-tab-id="common-ground"]'),
    ).toBeTruthy()
    expect(queryByText('Common Ground')).toBeTruthy()
  })

  it('existing 5 tabs each carry a data-tab-id attribute (for testability)', () => {
    const { container } = render(<ProfileTabs username="tyler" />)
    for (const id of ['collection', 'wishlist', 'worn', 'notes', 'stats']) {
      expect(
        container.querySelector(`[data-tab-id="${id}"]`),
      ).toBeTruthy()
    }
  })
})
