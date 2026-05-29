// Phase 70 Plan 02 — DupeBanner presenter (DUPE-02 / DUPE-03)
//
// 5 unit cases the implementation must satisfy:
//   (a) Owned context  — headline "Already in your collection"; "View existing"
//       + "Add another copy"; no "Move to Collection".
//   (b) Wishlist context — headline "On your wishlist"; "View existing" +
//       "Move to Collection" + "Add another copy"; clicking "Move to Collection"
//       fires onMoveToCollection.
//   (c) Null-reference fallback — when existingReference is null, "View existing"
//       button is NOT in the DOM and the "Reference: …" subtext line is hidden
//       (D-06 / UI-SPEC A3).
//   (d) Callbacks fire — onViewExisting + onAddAnotherCopy each fire exactly once
//       on click.
//   (e) Pending state — pending=true in wishlist context disables all three
//       buttons and the "Move to Collection" CTA shows "Moving…" with a Loader2
//       spinner (UI-SPEC A4).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { DupeBanner } from '@/components/watch/DupeBanner'

const BASE_OWNED_PROPS = {
  existingStatus: 'owned' as const,
  existingReference: 'REF-001',
  onViewExisting: vi.fn(),
  onAddAnotherCopy: vi.fn(),
}

const BASE_WISHLIST_PROPS = {
  existingStatus: 'wishlist' as const,
  existingReference: 'REF-001',
  onViewExisting: vi.fn(),
  onMoveToCollection: vi.fn(),
  onAddAnotherCopy: vi.fn(),
}

describe('DupeBanner — owned context (DUPE-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('(a) renders owned headline + subtext + "View existing" + "Add another copy"; no "Move to Collection"', () => {
    render(<DupeBanner {...BASE_OWNED_PROPS} />)
    expect(screen.getByText('Already in your collection')).toBeInTheDocument()
    expect(screen.getByText('Reference: REF-001')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View existing' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add another copy' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Move to Collection' })).not.toBeInTheDocument()
  })

  it('(d.1) clicking "View existing" fires onViewExisting once; "Add another copy" fires onAddAnotherCopy once', () => {
    render(<DupeBanner {...BASE_OWNED_PROPS} />)

    fireEvent.click(screen.getByRole('button', { name: 'View existing' }))
    expect(BASE_OWNED_PROPS.onViewExisting).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Add another copy' }))
    expect(BASE_OWNED_PROPS.onAddAnotherCopy).toHaveBeenCalledTimes(1)
  })
})

describe('DupeBanner — wishlist context (DUPE-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('(b) renders wishlist headline + "View existing" + "Move to Collection" + "Add another copy"', () => {
    render(<DupeBanner {...BASE_WISHLIST_PROPS} />)
    expect(screen.getByText('On your wishlist')).toBeInTheDocument()
    expect(screen.getByText('Reference: REF-001')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View existing' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move to Collection' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add another copy' })).toBeInTheDocument()
  })

  it('(d.2) clicking "Move to Collection" fires onMoveToCollection once', () => {
    render(<DupeBanner {...BASE_WISHLIST_PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Move to Collection' }))
    expect(BASE_WISHLIST_PROPS.onMoveToCollection).toHaveBeenCalledTimes(1)
  })

  it('(e) pending=true disables all three buttons and "Move to Collection" shows "Moving…" + Loader2 spinner', () => {
    const { container } = render(<DupeBanner {...BASE_WISHLIST_PROPS} pending={true} />)

    // "Moving…" text replaces "Move to Collection" label (U+2026 ellipsis)
    expect(screen.getByText('Moving…')).toBeInTheDocument()
    expect(screen.queryByText('Move to Collection')).not.toBeInTheDocument()

    // Loader2 svg is present inside the wishlist primary button — assert by class.
    const spinner = container.querySelector('svg.animate-spin')
    expect(spinner).not.toBeNull()

    // All three action buttons are disabled.
    expect(screen.getByRole('button', { name: /Moving/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'View existing' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add another copy' })).toBeDisabled()
  })
})

describe('DupeBanner — null reference (D-06 / UI-SPEC A3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('(c) hides "View existing" + "Reference: …" subtext when existingReference is null; headline + "Add another copy" still render', () => {
    render(<DupeBanner {...BASE_OWNED_PROPS} existingReference={null} />)

    // Headline still renders.
    expect(screen.getByText('Already in your collection')).toBeInTheDocument()

    // "Add another copy" still renders.
    expect(screen.getByRole('button', { name: 'Add another copy' })).toBeInTheDocument()

    // "View existing" is NOT in the DOM (no /w/[ref] target derivable from null reference).
    expect(screen.queryByRole('button', { name: 'View existing' })).not.toBeInTheDocument()

    // Subtext line is not rendered (no reference to display).
    expect(screen.queryByText(/^Reference:/)).not.toBeInTheDocument()
  })
})
