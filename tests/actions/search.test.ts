import { describe, it, expect, vi, beforeEach } from 'vitest'

// Phase 19 Plan 02 — Server Action contract tests covering all three actions:
// searchPeopleAction (existing), searchWatchesAction (new), searchCollectionsAction (new).
// Locks the carry-forward Phase 16 contract: Zod .strict().max(200), getCurrentUser
// auth gate, generic error copy, viewerId from session (never from caller),
// console.error with action prefix.

const mockGetCurrentUser = vi.fn()
const mockSearchProfiles = vi.fn()
const mockSearchCatalogWatches = vi.fn()
const mockSearchCollections = vi.fn()

vi.mock('@/lib/auth', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}))
vi.mock('@/data/search', () => ({
  searchProfiles: (...args: unknown[]) => mockSearchProfiles(...args),
  searchCollections: (...args: unknown[]) => mockSearchCollections(...args),
}))
vi.mock('@/data/catalog', () => ({
  searchCatalogWatches: (...args: unknown[]) => mockSearchCatalogWatches(...args),
}))

import {
  searchPeopleAction,
  searchWatchesAction,
  searchCollectionsAction,
} from '@/app/actions/search'

beforeEach(() => {
  mockGetCurrentUser.mockReset()
  mockSearchProfiles.mockReset()
  mockSearchCatalogWatches.mockReset()
  mockSearchCollections.mockReset()
})

const ACTIONS: Array<
  [
    string,
    (d: unknown) => Promise<unknown>,
    ReturnType<typeof vi.fn>,
    string,
  ]
> = [
  ['searchPeopleAction', searchPeopleAction, mockSearchProfiles, '[searchPeopleAction]'],
  ['searchWatchesAction', searchWatchesAction, mockSearchCatalogWatches, '[searchWatchesAction]'],
  ['searchCollectionsAction', searchCollectionsAction, mockSearchCollections, '[searchCollectionsAction]'],
]

for (const [name, action, dalMock, errPrefix] of ACTIONS) {
  describe(`${name} contract`, () => {
    it('rejects extra keys via Zod .strict()', async () => {
      mockGetCurrentUser.mockResolvedValue({ id: 'u1' })
      const out = await action({ q: 'rolex', extra: 'attack' })
      expect(out).toEqual({ success: false, error: 'Invalid request' })
      expect(dalMock).not.toHaveBeenCalled()
    })

    it('rejects q.length > 200 via Zod .max(200)', async () => {
      mockGetCurrentUser.mockResolvedValue({ id: 'u1' })
      const out = await action({ q: 'a'.repeat(201) })
      expect(out).toEqual({ success: false, error: 'Invalid request' })
      expect(dalMock).not.toHaveBeenCalled()
    })

    it('rejects missing q', async () => {
      mockGetCurrentUser.mockResolvedValue({ id: 'u1' })
      const out = await action({})
      expect(out).toEqual({ success: false, error: 'Invalid request' })
    })

    it('returns Not authenticated when getCurrentUser throws', async () => {
      mockGetCurrentUser.mockRejectedValue(new Error('no session'))
      const out = await action({ q: 'rolex' })
      expect(out).toEqual({ success: false, error: 'Not authenticated' })
      expect(dalMock).not.toHaveBeenCalled()
    })

    it('returns generic error + logs with prefix when DAL throws', async () => {
      mockGetCurrentUser.mockResolvedValue({ id: 'u1' })
      dalMock.mockRejectedValue(
        new Error('postgres column "secret" does not exist'),
      )
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const out = await action({ q: 'rolex' })
      expect(out).toEqual({ success: false, error: "Couldn't run search." })
      expect(errSpy).toHaveBeenCalled()
      expect(String(errSpy.mock.calls[0][0])).toContain(errPrefix)
      // Generic copy MUST NOT contain DAL detail (T-19-02-04 regression lock)
      expect(JSON.stringify(out)).not.toContain('postgres')
      expect(JSON.stringify(out)).not.toContain('column')
      errSpy.mockRestore()
    })

    it('passes viewerId from session (NOT from caller)', async () => {
      mockGetCurrentUser.mockResolvedValue({ id: 'session-uid-from-auth' })
      dalMock.mockResolvedValue([])
      // Even if a caller tried to inject viewerId, .strict() blocks it.
      // Confirm DAL receives session uid.
      await action({ q: 'rolex' })
      expect(dalMock).toHaveBeenCalledTimes(1)
      const calledWith = dalMock.mock.calls[0][0] as { viewerId: string }
      expect(calledWith.viewerId).toBe('session-uid-from-auth')
    })

    it('success path returns data', async () => {
      mockGetCurrentUser.mockResolvedValue({ id: 'u1' })
      dalMock.mockResolvedValue([{ id: 'r1' }])
      const out = await action({ q: 'rolex' })
      expect(out).toEqual({ success: true, data: [{ id: 'r1' }] })
    })
  })
}
