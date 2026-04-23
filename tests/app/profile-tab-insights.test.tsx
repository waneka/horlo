import { describe, it, expect, vi, beforeEach } from 'vitest'

// next/navigation notFound throws a detectable error so we can assert on it.
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

vi.mock('@/components/profile/InsightsTabContent', () => ({
  InsightsTabContent: vi.fn(() => null),
}))

// Stub the other tab components so their module-level imports don't break
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

vi.mock('@/app/u/[username]/common-ground-gate', () => ({
  resolveCommonGround: vi.fn().mockResolvedValue(null),
}))

import ProfileTabPage from '@/app/u/[username]/[tab]/page'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getProfileByUsername, getProfileSettings } from '@/data/profiles'
import { InsightsTabContent } from '@/components/profile/InsightsTabContent'

describe('/u/[username]/[tab]/page — insights branch (Phase 14 D-13 P-08)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders InsightsTabContent when viewer === profile.id (owner)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'a@b.co' })
    vi.mocked(getProfileByUsername).mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    } as any)
    vi.mocked(getProfileSettings).mockResolvedValue({
      userId: 'user-1',
      profilePublic: true,
      collectionPublic: true,
      wishlistPublic: true,
      notificationsLastSeenAt: new Date(0),
      notifyOnFollow: true,
      notifyOnWatchOverlap: true,
    } as any)
    const result = (await ProfileTabPage({
      params: Promise.resolve({ username: 'alice', tab: 'insights' }),
    })) as any
    // The Server Component returns a React element. Assert its type is the
    // mocked InsightsTabContent and the profileUserId prop equals the owner id.
    expect(result).toBeTruthy()
    expect(result.type).toBe(InsightsTabContent)
    expect(result.props).toEqual({ profileUserId: 'user-1' })
  })

  it('returns notFound when viewer is NOT owner (uniform 404 — P-08)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-2', email: 'b@c.co' })
    vi.mocked(getProfileByUsername).mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    } as any)
    vi.mocked(getProfileSettings).mockResolvedValue({
      userId: 'user-1',
      profilePublic: true,
      collectionPublic: true,
      wishlistPublic: true,
      notificationsLastSeenAt: new Date(0),
      notifyOnFollow: true,
      notifyOnWatchOverlap: true,
    } as any)
    await expect(
      ProfileTabPage({
        params: Promise.resolve({ username: 'alice', tab: 'insights' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    // And InsightsTabContent must NOT have been invoked
    expect(InsightsTabContent).not.toHaveBeenCalled()
  })

  it('returns notFound when viewer is anonymous', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new UnauthorizedError('nope'))
    vi.mocked(getProfileByUsername).mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    } as any)
    vi.mocked(getProfileSettings).mockResolvedValue({
      userId: 'user-1',
      profilePublic: true,
      collectionPublic: true,
      wishlistPublic: true,
      notificationsLastSeenAt: new Date(0),
      notifyOnFollow: true,
      notifyOnWatchOverlap: true,
    } as any)
    await expect(
      ProfileTabPage({
        params: Promise.resolve({ username: 'alice', tab: 'insights' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(InsightsTabContent).not.toHaveBeenCalled()
  })

  it('collection branch still works (regression smoke)', async () => {
    // Smoke test — the insights-branch addition should not break ahead-of-branch flow.
    // Owner viewing collection tab: expect no throw, truthy result.
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'a@b.co' })
    vi.mocked(getProfileByUsername).mockResolvedValue({
      id: 'user-1',
      username: 'alice',
    } as any)
    vi.mocked(getProfileSettings).mockResolvedValue({
      userId: 'user-1',
      profilePublic: true,
      collectionPublic: true,
      wishlistPublic: true,
      notificationsLastSeenAt: new Date(0),
      notifyOnFollow: true,
      notifyOnWatchOverlap: true,
    } as any)
    const result = await ProfileTabPage({
      params: Promise.resolve({ username: 'alice', tab: 'collection' }),
    })
    expect(result).toBeTruthy()
  })
})
