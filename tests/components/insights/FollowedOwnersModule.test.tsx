import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { FollowedOwnersModule } from '@/components/insights/FollowedOwnersModule'
import type { FollowedOwner } from '@/data/follows'

/**
 * Phase 65 Plan 02 — FollowedOwnersModule component test.
 *
 * Covers the four locked contracts from 65-CONTEXT.md + 65-UI-SPEC.md:
 *
 *  - FOLL-01 hide-if-empty: module returns null when owners=[] (no DOM at
 *    all — no header, no placeholder). Also covers the Branch 1
 *    null-catalogId case once Plan 03 short-circuits to {owners: [],
 *    totalCount: 0}.
 *  - D-04a header copy: visible <h3> shows the literal "From your circle"
 *    (warmer Rdio-inspired framing). The wrapping <section> ALSO carries the
 *    literal SR aria-label "People you follow who own this" (UI-SPEC
 *    §Copywriting Contract — two-layer copy: visible warmer / SR literal).
 *  - FOLL-03 chip semantics: each chip is a single absolute-inset <Link>
 *    with href=`/u/${username}/collection` and aria-label
 *    `${displayName ?? '@'+username}'s collection` (D-02a, mirrors
 *    OtherOwnersRoster).
 *  - D-04c overflow caption: "and {N} more" plain-text caption rendered
 *    ONLY when `totalCount > owners.length` (strict `>`, not `>=`).
 *
 * Fixtures use the Alice / Bob pair to validate the displayName fallback
 * in the aria-label — Alice has a displayName ("Alice Wonder"), Bob does
 * NOT (null), so Bob's aria-label must fall back to "@bob's collection".
 */

function makeOwner(
  n: number,
  opts: { displayName?: string | null } = {},
): FollowedOwner {
  return {
    userId: `user-${n}`,
    username: `user${n}`,
    displayName: opts.displayName === undefined ? `User ${n}` : opts.displayName,
    avatarUrl: null,
  }
}

function makeOwners(count: number): FollowedOwner[] {
  return Array.from({ length: count }, (_, i) => makeOwner(i + 1))
}

const ALICE: FollowedOwner = {
  userId: 'u1',
  username: 'alice',
  displayName: 'Alice Wonder',
  avatarUrl: null,
}

const BOB: FollowedOwner = {
  userId: 'u2',
  username: 'bob',
  displayName: null,
  avatarUrl: null,
}

describe('FollowedOwnersModule', () => {
  // -------------------------------------------------------------------------
  // FOLL-01 hide-if-empty
  // -------------------------------------------------------------------------

  it('returns null when owners=[] (FOLL-01 hide-if-empty)', () => {
    const { container } = render(
      <FollowedOwnersModule owners={[]} totalCount={0} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('returns null when owners=[] even with non-zero totalCount (defensive — chip list is the gate, not the count)', () => {
    const { container } = render(
      <FollowedOwnersModule owners={[]} totalCount={42} />,
    )
    expect(container.firstChild).toBeNull()
  })

  // -------------------------------------------------------------------------
  // D-04a / D-10 header + section aria-label
  // -------------------------------------------------------------------------

  it('renders the literal "From your circle" header inside an <h3> when owners.length >= 1', () => {
    const { getByText } = render(
      <FollowedOwnersModule owners={[ALICE]} totalCount={1} />,
    )
    const heading = getByText('From your circle')
    expect(heading).toBeTruthy()
    expect(heading.tagName.toLowerCase()).toBe('h3')
  })

  it('applies the literal SR aria-label "People you follow who own this" on the wrapping <section>', () => {
    const { container } = render(
      <FollowedOwnersModule owners={[ALICE]} totalCount={1} />,
    )
    const section = container.querySelector(
      'section[aria-label="People you follow who own this"]',
    )
    expect(section).not.toBeNull()
  })

  // -------------------------------------------------------------------------
  // FOLL-03 chip semantics — Alice (with displayName) and Bob (null displayName)
  // -------------------------------------------------------------------------

  it('renders one <Link> per owner with href "/u/{username}/collection" and the correct aria-label (FOLL-03)', () => {
    const { container } = render(
      <FollowedOwnersModule owners={[ALICE, BOB]} totalCount={2} />,
    )

    // Alice — has displayName, aria-label uses it
    const aliceLink = container.querySelector('a[href="/u/alice/collection"]')
    expect(aliceLink).not.toBeNull()
    expect(aliceLink!.getAttribute('aria-label')).toBe(
      "Alice Wonder's collection",
    )

    // Bob — null displayName, aria-label falls back to '@'+username
    const bobLink = container.querySelector('a[href="/u/bob/collection"]')
    expect(bobLink).not.toBeNull()
    expect(bobLink!.getAttribute('aria-label')).toBe("@bob's collection")
  })

  it('renders @username as the primary visible chip text', () => {
    const { getAllByText } = render(
      <FollowedOwnersModule owners={[ALICE, BOB]} totalCount={2} />,
    )
    expect(getAllByText('@alice').length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('@bob').length).toBeGreaterThanOrEqual(1)
  })

  it('renders the displayName secondary line only when displayName is non-null', () => {
    const { getByText, queryByText } = render(
      <FollowedOwnersModule owners={[ALICE, BOB]} totalCount={2} />,
    )
    // Alice has a displayName → it renders
    expect(getByText('Alice Wonder')).toBeTruthy()
    // Bob has null displayName → no secondary line, no text node should
    // contain the literal "null"
    expect(queryByText('null')).toBeNull()
  })

  it('uses one <ul> with exactly one <li> per owner (semantic list shape, A11y)', () => {
    const owners = makeOwners(3)
    const { container } = render(
      <FollowedOwnersModule owners={owners} totalCount={3} />,
    )
    const lists = container.querySelectorAll('ul')
    expect(lists.length).toBe(1)
    const items = container.querySelectorAll('li')
    expect(items.length).toBe(3)
  })

  // -------------------------------------------------------------------------
  // D-04c overflow caption — strict `>` gate
  // -------------------------------------------------------------------------

  it('renders "and N more" caption when totalCount > owners.length (D-04c)', () => {
    const { getByText } = render(
      <FollowedOwnersModule owners={makeOwners(3)} totalCount={10} />,
    )
    expect(getByText('and 7 more')).toBeTruthy()
  })

  it('omits the caption when totalCount === owners.length (gate is strictly >, not >=)', () => {
    const { queryByText } = render(
      <FollowedOwnersModule owners={makeOwners(5)} totalCount={5} />,
    )
    expect(queryByText(/and \d+ more/)).toBeNull()
  })

  it('omits the caption when totalCount < owners.length (defensive — strict > gate)', () => {
    const { queryByText } = render(
      <FollowedOwnersModule owners={makeOwners(5)} totalCount={3} />,
    )
    expect(queryByText(/and -?\d+ more/)).toBeNull()
  })
})
