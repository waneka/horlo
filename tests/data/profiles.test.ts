import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Drizzle client. Each `db.select()...limit(1)` chain resolves to the
// rows we provide via `mockRows`. We exercise control flow only — integration
// behavior against a real DB is covered by Plan 02/04 manual checkpoints.
let mockRows: unknown[] = []

vi.mock('@/db', () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(mockRows),
    orderBy: () => Promise.resolve(mockRows),
  }
  return {
    db: {
      select: () => chain,
    },
  }
})

import { getProfileSettings } from '@/data/profiles'

describe('getProfileSettings — DAL visibility-gate defaults', () => {
  beforeEach(() => {
    mockRows = []
  })

  it('returns DEFAULT_SETTINGS (all public: true) when no row exists', async () => {
    mockRows = []
    const settings = await getProfileSettings('user-no-row')
    expect(settings).toEqual({
      userId: 'user-no-row',
      profilePublic: true,
      collectionPublic: true,
      wishlistPublic: true,
      wornPublic: true,
    })
  })

  it('returns the row values when a profile_settings row exists', async () => {
    mockRows = [
      {
        userId: 'user-with-row',
        profilePublic: false,
        collectionPublic: true,
        wishlistPublic: false,
        wornPublic: false,
      },
    ]
    const settings = await getProfileSettings('user-with-row')
    expect(settings).toEqual({
      userId: 'user-with-row',
      profilePublic: false,
      collectionPublic: true,
      wishlistPublic: false,
      wornPublic: false,
    })
  })

  it('uses the requested userId in the default response (not from row)', async () => {
    mockRows = []
    const settings = await getProfileSettings('the-caller')
    expect(settings.userId).toBe('the-caller')
  })
})
