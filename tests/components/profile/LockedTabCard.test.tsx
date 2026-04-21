import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { LockedTabCard } from '@/components/profile/LockedTabCard'

describe('LockedTabCard', () => {
  it('renders a lucide Lock icon (svg with aria-hidden)', () => {
    const { container } = render(
      <LockedTabCard
        tab="collection"
        displayName="Tyler"
        username="tyler"
      />,
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders "Tyler keeps their collection private." for tab=collection', () => {
    const { getByText } = render(
      <LockedTabCard
        tab="collection"
        displayName="Tyler"
        username="tyler"
      />,
    )
    expect(getByText('Tyler keeps their collection private.')).toBeTruthy()
  })

  it('falls back to @username when displayName is null (wishlist)', () => {
    const { getByText } = render(
      <LockedTabCard tab="wishlist" displayName={null} username="tyler" />,
    )
    expect(getByText('@tyler keeps their wishlist private.')).toBeTruthy()
  })

  it('remaps tab=worn to "worn history" in the copy', () => {
    const { getByText } = render(
      <LockedTabCard tab="worn" displayName={null} username="tyler" />,
    )
    expect(getByText('@tyler keeps their worn history private.')).toBeTruthy()
  })

  it('renders "Tyler keeps their notes private." for tab=notes', () => {
    const { getByText } = render(
      <LockedTabCard tab="notes" displayName="Tyler" username="tyler" />,
    )
    expect(getByText('Tyler keeps their notes private.')).toBeTruthy()
  })

  it('renders "Tyler keeps their stats private." for tab=stats', () => {
    const { getByText } = render(
      <LockedTabCard tab="stats" displayName="Tyler" username="tyler" />,
    )
    expect(getByText('Tyler keeps their stats private.')).toBeTruthy()
  })

  it('returns null for tab=common-ground (tab is never locked)', () => {
    const { container } = render(
      <LockedTabCard
        tab="common-ground"
        displayName="Tyler"
        username="tyler"
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('applies bg-card rounded-xl border py-16 classes to the section', () => {
    const { container } = render(
      <LockedTabCard
        tab="collection"
        displayName="Tyler"
        username="tyler"
      />,
    )
    const section = container.querySelector('section')
    expect(section).toBeTruthy()
    expect(section?.className).toContain('bg-card')
    expect(section?.className).toContain('rounded-xl')
    expect(section?.className).toContain('border')
    expect(section?.className).toContain('py-16')
  })
})
