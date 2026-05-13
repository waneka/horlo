import { describe, it, expect, vi, beforeEach } from 'vitest'

// Pitfall 6: ALL vi.mock(...) calls hoisted ABOVE the page import.
// vitest hoists module-scope vi.mock automatically, but the source position
// must precede the import for clarity and to match project convention.

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message = 'Not authenticated') {
      super(message)
      this.name = 'UnauthorizedError'
    }
  },
}))

vi.mock('@/data/profiles', () => ({
  getProfileByUsername: vi.fn(),
  getProfileSettings: vi.fn(),
}))

vi.mock('@/data/watches', () => ({
  getWatchesByUser: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/data/wearEvents', () => ({
  getMostRecentWearDates: vi.fn().mockResolvedValue(new Map()),
  getWearEventsForViewer: vi.fn().mockResolvedValue([]),
  getAllWearEventsByUser: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/data/preferences', () => ({
  getPreferencesByUser: vi.fn().mockResolvedValue({ collectionGoal: 'balanced' }),
}))

// Stub all tab content components so module-level resolution doesn't pull in
// real components (which would drag in DAL types / hooks).
vi.mock('@/components/profile/CollectionTabContent', () => ({
  CollectionTabContent: vi.fn(() => null),
}))
vi.mock('@/components/profile/WishlistTabContent', () => ({
  WishlistTabContent: vi.fn(() => null),
}))
vi.mock('@/components/profile/NotesTabContent', () => ({
  NotesTabContent: vi.fn(() => null),
}))
vi.mock('@/components/profile/WornTabContent', () => ({
  WornTabContent: vi.fn(() => null),
}))
vi.mock('@/components/profile/StatsTabContent', () => ({
  StatsTabContent: vi.fn(() => null),
}))
vi.mock('@/components/profile/LockedTabCard', () => ({
  LockedTabCard: vi.fn(() => null),
}))
vi.mock('@/components/profile/CommonGroundTabContent', () => ({
  CommonGroundTabContent: vi.fn(() => null),
}))
vi.mock('@/components/profile/InsightsTabContent', () => ({
  InsightsTabContent: vi.fn(() => null),
}))

vi.mock('@/app/u/[username]/common-ground-gate', () => ({
  resolveCommonGround: vi.fn(),
}))

import ProfileTabPage from '@/app/u/[username]/[tab]/page'
import { getCurrentUser } from '@/lib/auth'
import { getProfileByUsername, getProfileSettings } from '@/data/profiles'
import { resolveCommonGround } from '@/app/u/[username]/common-ground-gate'
import { notFound } from 'next/navigation'

// Inline copy of findInTree from tests/app/layout.test.tsx:23-36 (no shared util).
function findInTree(node: any, predicate: (n: any) => boolean): any | null {
  if (!node || typeof node !== 'object') return null
  if (predicate(node)) return node
  const children = node.props?.children
  if (Array.isArray(children)) {
    for (const c of children) {
      const hit = findInTree(c, predicate)
      if (hit) return hit
    }
  } else if (children) {
    return findInTree(children, predicate)
  }
  return null
}

describe('NSV-12 common-ground walk-back fallback (Phase 39 D-09)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseSettings = {
    userId: 'owner-1',
    profilePublic: true,
    collectionPublic: true,
    wishlistPublic: true,
    notificationsLastSeenAt: new Date(0),
    notifyOnFollow: true,
    notifyOnWatchOverlap: true,
  } as any

  it('returns 200 with fallback Card when overlap.hasAny is false (viewer follows owner)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'viewer-1', email: 'v@b.co' } as any)
    vi.mocked(getProfileByUsername).mockResolvedValue({
      id: 'owner-1',
      username: 'alice',
      displayName: 'Alice',
    } as any)
    vi.mocked(getProfileSettings).mockResolvedValue(baseSettings)
    vi.mocked(resolveCommonGround).mockResolvedValue({
      hasAny: false,
      sharedWatches: [],
      sharedTasteTags: [],
      overlapLabel: 'Different taste',
      sharedStyleRows: [],
      sharedRoleRows: [],
    } as any)

    const result = (await ProfileTabPage({
      params: Promise.resolve({ username: 'alice', tab: 'common-ground' }),
    })) as any

    expect(result).toBeTruthy()
    // Privacy assertion: notFound MUST NOT have been called.
    expect(notFound).not.toHaveBeenCalled()

    // Walk tree for the locked title copy (D-10).
    const title = findInTree(
      result,
      (n) => n?.props?.children === 'No shared watches yet.',
    )
    expect(title).toBeTruthy()

    // Walk tree for the two CTA hrefs (D-10).
    const primaryCta = findInTree(
      result,
      (n) => n?.props?.href === '/u/alice/collection',
    )
    expect(primaryCta).toBeTruthy()

    const secondaryCta = findInTree(
      result,
      (n) => n?.props?.href === '/explore',
    )
    expect(secondaryCta).toBeTruthy()
  })

  it('still calls notFound() when overlap === null (gate failure preserves privacy boundary — T-39-01)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'viewer-1', email: 'v@b.co' } as any)
    vi.mocked(getProfileByUsername).mockResolvedValue({
      id: 'owner-1',
      username: 'alice',
      displayName: 'Alice',
    } as any)
    vi.mocked(getProfileSettings).mockResolvedValue(baseSettings)
    // resolveCommonGround returns null when the three-way gate fails
    // (viewerId null / isOwner / !collectionPublic). The privacy boundary
    // MUST 404 — not render the fallback Card.
    vi.mocked(resolveCommonGround).mockResolvedValue(null)

    await expect(
      ProfileTabPage({
        params: Promise.resolve({ username: 'alice', tab: 'common-ground' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('still calls notFound() when profile not found (line 54 unchanged — out of NSV-12 scope)', async () => {
    vi.mocked(getProfileByUsername).mockResolvedValue(null)

    await expect(
      ProfileTabPage({
        params: Promise.resolve({ username: 'nobody', tab: 'common-ground' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
