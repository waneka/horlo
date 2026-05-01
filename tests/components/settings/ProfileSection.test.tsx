import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Phase 22 D-19 — Profile tab read-only stub GREEN tests.
// Phase 22 ships a non-interactive panel (displayName / @username / avatar /
// "View public profile" link / "Profile editing coming in the next update"
// footer note); editable form lands in Phase 25 (UX-08).
// ---------------------------------------------------------------------------

import { ProfileSection } from '@/components/settings/ProfileSection'

describe('ProfileSection — Phase 22 D-19 read-only stub', () => {
  it('renders displayName when present, falls back to username', () => {
    const { rerender } = render(
      <ProfileSection
        username="alice"
        displayName="Alice"
        avatarUrl={null}
      />,
    )
    expect(screen.getByText('Alice')).toBeInTheDocument()

    rerender(
      <ProfileSection
        username="alice"
        displayName={null}
        avatarUrl={null}
      />,
    )
    // displayName null -> username used as the display heading. The handle
    // text "@alice" also exists, so use a more targeted assertion that
    // matches the heading paragraph (not the muted handle).
    const headings = screen.getAllByText(/^alice$/i)
    expect(headings.length).toBeGreaterThanOrEqual(1)
  })

  it('renders @username at text-sm text-muted-foreground', () => {
    render(
      <ProfileSection
        username="alice"
        displayName="Alice"
        avatarUrl={null}
      />,
    )
    const handle = screen.getByText('@alice')
    expect(handle).toHaveClass('text-sm')
    expect(handle).toHaveClass('text-muted-foreground')
  })

  it('renders View public profile link to /u/{username}', () => {
    render(
      <ProfileSection
        username="alice"
        displayName="Alice"
        avatarUrl={null}
      />,
    )
    const link = screen.getByRole('link', { name: 'View public profile' })
    expect(link).toHaveAttribute('href', '/u/alice')
  })

  it('renders avatar image when avatarUrl is present', () => {
    const { container } = render(
      <ProfileSection
        username="alice"
        displayName="Alice"
        avatarUrl="https://cdn.example.com/avatar.jpg"
      />,
    )
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/avatar.jpg')
    expect(img).toHaveClass('rounded-full')
  })

  it('renders muted bg-muted placeholder when avatarUrl is null', () => {
    const { container } = render(
      <ProfileSection
        username="alice"
        displayName="Alice"
        avatarUrl={null}
      />,
    )
    expect(container.querySelector('img')).toBeNull()
    // Placeholder div with bg-muted + rounded-full classes.
    const placeholder = container.querySelector('div.bg-muted.rounded-full')
    expect(placeholder).not.toBeNull()
  })

  it('renders "Profile editing coming in the next update." footer note', () => {
    render(
      <ProfileSection
        username="alice"
        displayName="Alice"
        avatarUrl={null}
      />,
    )
    expect(
      screen.getByText('Profile editing coming in the next update.'),
    ).toBeInTheDocument()
  })
})
