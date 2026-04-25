import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Wave 0 RED — PeopleSearchRow contract per CONTEXT.md D-13, D-14, D-15,
// D-16, D-17.
//
// Covers: row visual layout, whole-row link, inline FollowButton wiring,
// case-insensitive match highlighting (Tests 4 / 5 / 5b), XSS-safety
// against crafted bio (Test 6), regex metachar safety (Test 7), bio
// snippet line-clamp class (Test 8), mini-thumb cluster mobile-hidden
// + shared-count rendering (Tests 9 / 10).
// ---------------------------------------------------------------------------

// next/link stub — render as plain <a>
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    'aria-label': ariaLabel,
  }: {
    href: string
    children: React.ReactNode
    className?: string
    'aria-label'?: string
  }) => (
    <a href={href} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}))

// next/image stub
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
  }: {
    src: string
    alt: string
    className?: string
  }) => <img src={src} alt={alt} className={className} />,
}))

// Stub FollowButton so tests can read initialIsFollowing without exercising
// Phase 9 behavior. Mirrors the SuggestedCollectorRow test stub.
vi.mock('@/components/profile/FollowButton', () => ({
  FollowButton: ({
    viewerId,
    targetUserId,
    targetDisplayName,
    initialIsFollowing,
    variant,
  }: {
    viewerId: string | null
    targetUserId: string
    targetDisplayName: string
    initialIsFollowing: boolean
    variant?: string
  }) => (
    <button
      data-testid="follow-button"
      data-viewer-id={viewerId ?? 'null'}
      data-target-user-id={targetUserId}
      data-target-display-name={targetDisplayName}
      data-following={String(initialIsFollowing)}
      data-variant={variant ?? 'primary'}
    >
      Follow
    </button>
  ),
}))

// Target import — RED until Plan 03.
import { PeopleSearchRow } from '@/components/search/PeopleSearchRow'
import type { SearchProfileResult } from '@/lib/searchTypes'

const baseResult: SearchProfileResult = {
  userId: 'user-1',
  username: 'liam',
  displayName: 'Liam Smith',
  avatarUrl: null,
  bio: 'Loves vintage chronographs',
  bioSnippet: 'Loves vintage chronographs',
  overlap: 0.85,
  sharedCount: 3,
  sharedWatches: [
    { watchId: 'w1', brand: 'Rolex', model: 'Submariner', imageUrl: null },
    { watchId: 'w2', brand: 'Omega', model: 'Speedmaster', imageUrl: null },
    { watchId: 'w3', brand: 'Tudor', model: 'Pelagos', imageUrl: null },
  ],
  isFollowing: false,
}

describe('PeopleSearchRow (D-13 / D-14 / D-15 / D-16 / D-17)', () => {
  it('Test 1: renders avatar (img or fallback), name, bio snippet, taste-overlap line', () => {
    render(<PeopleSearchRow result={baseResult} q="" viewerId="me" />)
    // Name (displayName takes precedence)
    expect(screen.getByText('Liam Smith')).toBeInTheDocument()
    // Bio snippet
    expect(screen.getByText(/Loves vintage chronographs/)).toBeInTheDocument()
    // Taste overlap line
    expect(screen.getByText(/85% taste overlap/)).toBeInTheDocument()
  })

  it('Test 2: whole-row Link to /u/{username}/collection', () => {
    const { container } = render(
      <PeopleSearchRow result={baseResult} q="" viewerId="me" />,
    )
    const link = container.querySelector('a[href="/u/liam/collection"]')
    expect(link).not.toBeNull()
  })

  it('Test 3: inline FollowButton renders with initialIsFollowing from result.isFollowing', () => {
    const { rerender } = render(
      <PeopleSearchRow result={baseResult} q="" viewerId="me" />,
    )
    let btn = screen.getByTestId('follow-button')
    expect(btn.getAttribute('data-following')).toBe('false')
    expect(btn.getAttribute('data-variant')).toBe('inline')

    rerender(
      <PeopleSearchRow
        result={{ ...baseResult, isFollowing: true }}
        q=""
        viewerId="me"
      />,
    )
    btn = screen.getByTestId('follow-button')
    expect(btn.getAttribute('data-following')).toBe('true')
  })

  it('Test 4: match highlighting — q="li" + username="liam" → <strong>li</strong>am (D-15)', () => {
    render(<PeopleSearchRow result={baseResult} q="li" viewerId="me" />)
    const matched = screen.getByText(/li/i)
    expect(matched.tagName).toMatch(/STRONG|SPAN/)
    expect(matched).toHaveClass('font-semibold')
  })

  it('Test 5: case-insensitive match — q="LI" + username="liam" → matched substring wrapped (D-15)', () => {
    render(<PeopleSearchRow result={baseResult} q="LI" viewerId="me" />)
    const matched = screen.getByText(/li/i)
    expect(matched.tagName).toMatch(/STRONG|SPAN/)
    expect(matched).toHaveClass('font-semibold')
  })

  it('Test 5b: inverse-casing — q="li" + username="LIAM" → <strong>LI</strong>AM (D-15)', () => {
    const upperResult: SearchProfileResult = {
      ...baseResult,
      username: 'LIAM',
      displayName: null, // force username rendering as the visible name
    }
    render(<PeopleSearchRow result={upperResult} q="li" viewerId="me" />)
    const matched = screen.getByText('LI')
    expect(matched.tagName).toMatch(/STRONG|SPAN/)
    expect(matched).toHaveClass('font-semibold')
  })

  it('Test 6: XSS-safety — bio with <script>alert(1)</script> renders as text, NOT DOM (D-15 / V8)', () => {
    const xssResult: SearchProfileResult = {
      ...baseResult,
      bio: '<script>alert(1)</script>nice watch',
      bioSnippet: '<script>alert(1)</script>nice watch',
    }
    const { container } = render(
      <PeopleSearchRow result={xssResult} q="nice" viewerId="me" />,
    )
    // No actual <script> element should be in the DOM (the bio's <script>...
    // appears as a text node, not as a parsed HTML element).
    expect(document.querySelector('script')).toBeNull()
    // The literal text is rendered. With q="nice", HighlightedText splits the
    // bio across multiple text nodes (and a <strong> for the match), so we
    // verify the bio paragraph's combined textContent contains the FULL
    // literal — the script tag, the highlighted match, and the trailing word.
    const bioParagraph = container.querySelector('p.line-clamp-1')
    expect(bioParagraph).not.toBeNull()
    expect(bioParagraph?.textContent).toBe(
      '<script>alert(1)</script>nice watch',
    )
  })

  it('Test 7: regex metachar safety — q="(.*)" does not crash (D-15)', () => {
    expect(() =>
      render(<PeopleSearchRow result={baseResult} q="(.*)" viewerId="me" />),
    ).not.toThrow()
  })

  it('Test 8: bio snippet has line-clamp-1 class (D-14)', () => {
    const { container } = render(
      <PeopleSearchRow result={baseResult} q="" viewerId="me" />,
    )
    // Find the element rendering the bio snippet
    const clamped = container.querySelector('.line-clamp-1')
    expect(clamped).not.toBeNull()
  })

  it('Test 9: mini-thumb cluster has hidden sm:flex classes (D-17 mobile responsive)', () => {
    const { container } = render(
      <PeopleSearchRow result={baseResult} q="" viewerId="me" />,
    )
    const cluster = container.querySelector('.hidden.sm\\:flex')
    expect(cluster).not.toBeNull()
  })

  it('Test 10: mini-thumb cluster shows up to 3 watches + "{N} shared" count when sharedWatches.length > 0', () => {
    render(<PeopleSearchRow result={baseResult} q="" viewerId="me" />)
    expect(screen.getByText(/3 shared/)).toBeInTheDocument()
  })
})
