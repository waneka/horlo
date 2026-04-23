import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

// Mocks must be registered BEFORE the component import.
vi.mock('@/data/watches', () => ({
  getWatchesByUser: vi.fn(),
}))
vi.mock('@/data/wearEvents', () => ({
  getMostRecentWearDates: vi.fn(),
  getAllWearEventsByUser: vi.fn(),
}))
vi.mock('@/data/follows', () => ({
  getFollowingForProfile: vi.fn(),
  getTasteOverlapData: vi.fn(),
}))
vi.mock('@/data/profiles', () => ({
  getProfileSettings: vi.fn(),
}))
vi.mock('@/lib/tasteOverlap', () => ({
  computeTasteOverlap: vi.fn(),
}))

// next/link stub
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

// next/image stub (used indirectly by AvatarDisplay)
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

import { PersonalInsightsGrid } from '@/components/home/PersonalInsightsGrid'
import { getWatchesByUser } from '@/data/watches'
import {
  getMostRecentWearDates,
  getAllWearEventsByUser,
} from '@/data/wearEvents'
import {
  getFollowingForProfile,
  getTasteOverlapData,
} from '@/data/follows'
import { getProfileSettings } from '@/data/profiles'
import { computeTasteOverlap } from '@/lib/tasteOverlap'
import type { Watch } from '@/lib/types'

function makeWatch(overrides: Partial<Watch> = {}): Watch {
  return {
    id: `w-${Math.random().toString(36).slice(2, 8)}`,
    brand: 'Rolex',
    model: 'Submariner',
    status: 'owned',
    movement: 'automatic',
    complications: [],
    styleTags: [],
    designTraits: [],
    roleTags: ['dive'],
    ...overrides,
  }
}

async function renderAsync(el: Promise<React.ReactElement | null>) {
  const resolved = await el
  return render(resolved ?? <></>)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getFollowingForProfile).mockResolvedValue([])
  vi.mocked(getAllWearEventsByUser).mockResolvedValue([])
  vi.mocked(getMostRecentWearDates).mockResolvedValue(new Map())
  // Default all followers to fully public so existing tests that don't care
  // about the WR-02 privacy gate still exercise the happy Common-Ground path.
  vi.mocked(getProfileSettings).mockResolvedValue({
    userId: 'u-friend',
    profilePublic: true,
    collectionPublic: true,
    wishlistPublic: true,
    notificationsLastSeenAt: new Date(0),
    notifyOnFollow: true,
    notifyOnWatchOverlap: true,
  })
})

describe('PersonalInsightsGrid — I-04 hide on empty', () => {
  it('Test 1 — viewer with no owned watches: returns null (entire section hidden)', async () => {
    vi.mocked(getWatchesByUser).mockResolvedValue([])
    const { container } = await renderAsync(
      PersonalInsightsGrid({ viewerId: 'v1' }),
    )
    expect(container.textContent).toBe('')
  })
})

describe('PersonalInsightsGrid — 4 cards when data is present', () => {
  it('Test 2 — all four cards render when data fills each slot', async () => {
    const divewatch = makeWatch({
      id: 'w-dive',
      brand: 'Rolex',
      model: 'Submariner',
      roleTags: ['dive'],
      status: 'owned',
    })
    const formalwatch = makeWatch({
      id: 'w-formal',
      brand: 'Omega',
      model: 'Constellation',
      roleTags: ['dress'],
      status: 'owned',
    })
    vi.mocked(getWatchesByUser).mockResolvedValue([divewatch, formalwatch])

    // Sleeping Beauty — divewatch last worn 60 days ago
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000)
      .toISOString()
      .slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)
    vi.mocked(getMostRecentWearDates).mockResolvedValue(
      new Map([
        ['w-dive', sixtyDaysAgo],
        ['w-formal', today],
      ]),
    )

    // Most worn — 3 wears of formalwatch this month
    vi.mocked(getAllWearEventsByUser).mockResolvedValue([
      { id: 'we-1', userId: 'v1', watchId: 'w-formal', wornDate: today, note: null, createdAt: new Date() },
      { id: 'we-2', userId: 'v1', watchId: 'w-formal', wornDate: today, note: null, createdAt: new Date() },
      { id: 'we-3', userId: 'v1', watchId: 'w-formal', wornDate: today, note: null, createdAt: new Date() },
    ] as never)

    // Common Ground — follower exists with overlap
    vi.mocked(getFollowingForProfile).mockResolvedValue([
      {
        userId: 'u-friend',
        username: 'alice',
        displayName: 'Alice',
        bio: null,
        avatarUrl: null,
        profilePublic: true,
        watchCount: 5,
        wishlistCount: 0,
        followedAt: '2026-04-01T00:00:00Z',
      },
    ])
    vi.mocked(getTasteOverlapData).mockResolvedValue({
      viewer: { watches: [divewatch, formalwatch], preferences: {} as never, tasteTags: [] },
      owner: { watches: [divewatch], preferences: {} as never, tasteTags: [] },
    })
    vi.mocked(computeTasteOverlap).mockReturnValue({
      sharedWatches: [
        { brand: 'Rolex', model: 'Submariner', viewerWatch: divewatch, ownerWatch: divewatch },
      ],
      sharedTasteTags: [],
      overlapLabel: 'Strong overlap',
      sharedStyleRows: [],
      sharedRoleRows: [],
      hasAny: true,
    })

    const { container } = await renderAsync(
      PersonalInsightsGrid({ viewerId: 'v1' }),
    )
    expect(container.textContent).toMatch(/For you/)
    expect(container.textContent).toMatch(/Rolex Submariner/) // Sleeping Beauty
    expect(container.textContent).toMatch(/Most worn this month/) // MostWorn heading
    // Wishlist gap: with both owned being dive+dress, other canonical roles are
    // 0%, so wishlistGap returns a non-null role. Tip badge renders.
    expect(container.textContent).toMatch(/Tip/)
    expect(container.textContent).toMatch(/1 shared/) // Common Ground
  })
})

describe('PersonalInsightsGrid — Sleeping Beauty rendering', () => {
  it('Test 3 — worn ≥15d ago renders "{N} days unworn" + Alert badge', async () => {
    const w = makeWatch({ id: 'w-dive', roleTags: ['dive'], status: 'owned' })
    vi.mocked(getWatchesByUser).mockResolvedValue([w])
    const twentyDaysAgo = new Date(Date.now() - 20 * 86_400_000)
      .toISOString()
      .slice(0, 10)
    vi.mocked(getMostRecentWearDates).mockResolvedValue(
      new Map([['w-dive', twentyDaysAgo]]),
    )
    const { container } = await renderAsync(
      PersonalInsightsGrid({ viewerId: 'v1' }),
    )
    // "{N} days unworn" literal
    expect(container.textContent).toMatch(/20 days unworn/)
    // Alert badge text
    expect(container.textContent).toMatch(/Alert/)
  })

  it("Test 3b — never worn renders 'Never worn' (not a fabricated day count)", async () => {
    const w = makeWatch({ id: 'w-dive', roleTags: ['dive'], status: 'owned' })
    vi.mocked(getWatchesByUser).mockResolvedValue([w])
    vi.mocked(getMostRecentWearDates).mockResolvedValue(new Map()) // no entry
    const { container } = await renderAsync(
      PersonalInsightsGrid({ viewerId: 'v1' }),
    )
    expect(container.textContent).toMatch(/Never worn/)
    expect(container.textContent).not.toMatch(/999 days unworn/)
    expect(container.textContent).toMatch(/Alert/)
  })
})

describe('PersonalInsightsGrid — WishlistGapCard', () => {
  it('Test 4 — gap.rationale renders with Tip badge', async () => {
    // All-dive collection → gap is 'dress' or the first under-represented
    // canonical role. leansOn = 'dive'. Rationale is non-null.
    const owned = [
      makeWatch({ id: 'w-1', roleTags: ['dive'] }),
      makeWatch({ id: 'w-2', roleTags: ['dive'] }),
    ]
    vi.mocked(getWatchesByUser).mockResolvedValue(owned)
    const today = new Date().toISOString().slice(0, 10)
    vi.mocked(getMostRecentWearDates).mockResolvedValue(
      new Map([
        ['w-1', today],
        ['w-2', today],
      ]),
    )
    const { container } = await renderAsync(
      PersonalInsightsGrid({ viewerId: 'v1' }),
    )
    // Tip badge + rationale literal fragment.
    expect(container.textContent).toMatch(/Tip/)
    expect(container.textContent).toMatch(
      /Your collection leans dive\. Consider a .+ watch to round it out\./,
    )
  })
})

describe('PersonalInsightsGrid — Common Ground', () => {
  it('Test 5 — renders follower displayName + "N shared"', async () => {
    const w = makeWatch({ id: 'w-1', roleTags: ['dive'] })
    vi.mocked(getWatchesByUser).mockResolvedValue([w])
    const today = new Date().toISOString().slice(0, 10)
    vi.mocked(getMostRecentWearDates).mockResolvedValue(
      new Map([['w-1', today]]),
    )
    vi.mocked(getFollowingForProfile).mockResolvedValue([
      {
        userId: 'u-friend',
        username: 'alice',
        displayName: 'Alice',
        bio: null,
        avatarUrl: null,
        profilePublic: true,
        watchCount: 5,
        wishlistCount: 0,
        followedAt: '2026-04-01T00:00:00Z',
      },
    ])
    vi.mocked(getTasteOverlapData).mockResolvedValue({
      viewer: { watches: [w], preferences: {} as never, tasteTags: [] },
      owner: { watches: [w], preferences: {} as never, tasteTags: [] },
    })
    vi.mocked(computeTasteOverlap).mockReturnValue({
      sharedWatches: [
        { brand: 'Rolex', model: 'Submariner', viewerWatch: w, ownerWatch: w },
        { brand: 'Omega', model: 'Seamaster', viewerWatch: w, ownerWatch: w },
      ],
      sharedTasteTags: [],
      overlapLabel: 'Strong overlap',
      sharedStyleRows: [],
      sharedRoleRows: [],
      hasAny: true,
    })
    const { container } = await renderAsync(
      PersonalInsightsGrid({ viewerId: 'v1' }),
    )
    expect(container.textContent).toMatch(/Alice/)
    expect(container.textContent).toMatch(/2 shared/)
    // Link to /u/alice/common-ground
    const link = container.querySelector('a[href="/u/alice/common-ground"]')
    expect(link).toBeTruthy()
  })

  it('Test 6 — all optional cards degrade: no wears/wishlist/followers still renders "For you" + Never worn Sleeping Beauty', async () => {
    const w = makeWatch({ id: 'w-1', roleTags: ['dive'] })
    vi.mocked(getWatchesByUser).mockResolvedValue([w])
    vi.mocked(getMostRecentWearDates).mockResolvedValue(new Map()) // never worn
    vi.mocked(getAllWearEventsByUser).mockResolvedValue([])
    vi.mocked(getFollowingForProfile).mockResolvedValue([])
    const { container } = await renderAsync(
      PersonalInsightsGrid({ viewerId: 'v1' }),
    )
    expect(container.textContent).toMatch(/For you/)
    expect(container.textContent).toMatch(/Never worn/)
    // No "Most worn this month" — no wears
    expect(container.textContent).not.toMatch(/Most worn this month/)
    // No "N shared" — no followers
    expect(container.textContent).not.toMatch(/\d+ shared/)
  })

  it('Test 7 — getTasteOverlapData throws: common-ground card omitted gracefully', async () => {
    const w = makeWatch({ id: 'w-1', roleTags: ['dive'] })
    vi.mocked(getWatchesByUser).mockResolvedValue([w])
    const today = new Date().toISOString().slice(0, 10)
    vi.mocked(getMostRecentWearDates).mockResolvedValue(
      new Map([['w-1', today]]),
    )
    vi.mocked(getFollowingForProfile).mockResolvedValue([
      {
        userId: 'u-friend',
        username: 'bob',
        displayName: 'Bob',
        bio: null,
        avatarUrl: null,
        profilePublic: true,
        watchCount: 5,
        wishlistCount: 0,
        followedAt: '2026-04-01T00:00:00Z',
      },
    ])
    vi.mocked(getTasteOverlapData).mockRejectedValue(new Error('db down'))
    const { container } = await renderAsync(
      PersonalInsightsGrid({ viewerId: 'v1' }),
    )
    // Section still renders, but no common-ground card (no /common-ground link)
    expect(container.textContent).toMatch(/For you/)
    expect(
      container.querySelector('a[href="/u/bob/common-ground"]'),
    ).toBeNull()
  })
})

describe('PersonalInsightsGrid — WR-02 Common Ground privacy gates', () => {
  it('WR-02 Test A — follower with profilePublic=false is excluded: no overlap fetch, no card', async () => {
    const w = makeWatch({ id: 'w-1', roleTags: ['dive'] })
    vi.mocked(getWatchesByUser).mockResolvedValue([w])
    const today = new Date().toISOString().slice(0, 10)
    vi.mocked(getMostRecentWearDates).mockResolvedValue(
      new Map([['w-1', today]]),
    )
    // Only follower is private-profile → must be filtered out before scoring.
    vi.mocked(getFollowingForProfile).mockResolvedValue([
      {
        userId: 'u-private',
        username: 'privy',
        displayName: 'Privy',
        bio: null,
        avatarUrl: null,
        profilePublic: false, // ← privacy flag flipped
        watchCount: 5,
        wishlistCount: 0,
        followedAt: '2026-04-01T00:00:00Z',
      },
    ])
    const { container } = await renderAsync(
      PersonalInsightsGrid({ viewerId: 'v1' }),
    )
    // Card must be omitted — no link to /u/privy/common-ground, no "N shared".
    expect(container.textContent).not.toMatch(/Privy/)
    expect(container.textContent).not.toMatch(/\d+ shared/)
    expect(
      container.querySelector('a[href="/u/privy/common-ground"]'),
    ).toBeNull()
    // And `getTasteOverlapData` must NEVER be called for the private follower.
    expect(getTasteOverlapData).not.toHaveBeenCalled()
  })

  it('WR-02 Test B — follower with collectionPublic=false: resolveCommonGround returns null, no card', async () => {
    const w = makeWatch({ id: 'w-1', roleTags: ['dive'] })
    vi.mocked(getWatchesByUser).mockResolvedValue([w])
    const today = new Date().toISOString().slice(0, 10)
    vi.mocked(getMostRecentWearDates).mockResolvedValue(
      new Map([['w-1', today]]),
    )
    vi.mocked(getFollowingForProfile).mockResolvedValue([
      {
        userId: 'u-friend',
        username: 'bob',
        displayName: 'Bob',
        bio: null,
        avatarUrl: null,
        profilePublic: true,
        watchCount: 5,
        wishlistCount: 0,
        followedAt: '2026-04-01T00:00:00Z',
      },
    ])
    // Follower's collection is private → gate blocks overlap lookup.
    vi.mocked(getProfileSettings).mockResolvedValue({
      userId: 'u-friend',
      profilePublic: true,
      collectionPublic: false, // ← collection hidden
      wishlistPublic: true,
      notificationsLastSeenAt: new Date(0),
      notifyOnFollow: true,
      notifyOnWatchOverlap: true,
    })
    const { container } = await renderAsync(
      PersonalInsightsGrid({ viewerId: 'v1' }),
    )
    // Even the shared *count* must not be disclosed → no card, no link.
    expect(container.textContent).not.toMatch(/\d+ shared/)
    expect(
      container.querySelector('a[href="/u/bob/common-ground"]'),
    ).toBeNull()
    // resolveCommonGround short-circuits before calling getTasteOverlapData.
    expect(getTasteOverlapData).not.toHaveBeenCalled()
  })

  it('WR-02 Test C — mixed followers: private ones skipped, public-with-overlap wins', async () => {
    const w = makeWatch({ id: 'w-1', roleTags: ['dive'] })
    vi.mocked(getWatchesByUser).mockResolvedValue([w])
    const today = new Date().toISOString().slice(0, 10)
    vi.mocked(getMostRecentWearDates).mockResolvedValue(
      new Map([['w-1', today]]),
    )
    vi.mocked(getFollowingForProfile).mockResolvedValue([
      {
        userId: 'u-priv',
        username: 'priv',
        displayName: 'Priv',
        bio: null,
        avatarUrl: null,
        profilePublic: false,
        watchCount: 3,
        wishlistCount: 0,
        followedAt: '2026-04-02T00:00:00Z',
      },
      {
        userId: 'u-pub',
        username: 'pub',
        displayName: 'Pub',
        bio: null,
        avatarUrl: null,
        profilePublic: true,
        watchCount: 5,
        wishlistCount: 0,
        followedAt: '2026-04-01T00:00:00Z',
      },
    ])
    // Public follower's collection is visible.
    vi.mocked(getProfileSettings).mockResolvedValue({
      userId: 'u-pub',
      profilePublic: true,
      collectionPublic: true,
      wishlistPublic: true,
      notificationsLastSeenAt: new Date(0),
      notifyOnFollow: true,
      notifyOnWatchOverlap: true,
    })
    vi.mocked(getTasteOverlapData).mockResolvedValue({
      viewer: { watches: [w], preferences: {} as never, tasteTags: [] },
      owner: { watches: [w], preferences: {} as never, tasteTags: [] },
    })
    vi.mocked(computeTasteOverlap).mockReturnValue({
      sharedWatches: [
        { brand: 'Rolex', model: 'Submariner', viewerWatch: w, ownerWatch: w },
      ],
      sharedTasteTags: [],
      overlapLabel: 'Strong overlap',
      sharedStyleRows: [],
      sharedRoleRows: [],
      hasAny: true,
    })
    const { container } = await renderAsync(
      PersonalInsightsGrid({ viewerId: 'v1' }),
    )
    // Pub renders; Priv must not leak displayName / link.
    expect(container.textContent).toMatch(/Pub/)
    expect(container.textContent).toMatch(/1 shared/)
    expect(container.textContent).not.toMatch(/Priv/)
    expect(
      container.querySelector('a[href="/u/priv/common-ground"]'),
    ).toBeNull()
    // The private follower must never have their overlap data fetched.
    // Pub (public) is called once; Priv is not.
    expect(getTasteOverlapData).toHaveBeenCalledTimes(1)
    expect(getTasteOverlapData).toHaveBeenCalledWith('v1', 'u-pub')
  })
})
