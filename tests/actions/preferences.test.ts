import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error {
    constructor(m = 'Not authenticated') { super(m); this.name = 'UnauthorizedError' }
  },
  getCurrentUser: vi.fn(),
}))
vi.mock('@/data/preferences', () => ({
  upsertPreferences: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { savePreferences } from '@/app/actions/preferences'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import * as preferencesDAL from '@/data/preferences'

describe('preferences Server Actions auth gate — AUTH-02', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns Not authenticated when getCurrentUser throws', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new UnauthorizedError())
    await expect(savePreferences({ collectionGoal: 'balanced' })).resolves.toEqual({
      success: false,
      error: 'Not authenticated',
    })
    expect(preferencesDAL.upsertPreferences).not.toHaveBeenCalled()
  })

  it('calls DAL.upsertPreferences with session user.id', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(preferencesDAL.upsertPreferences).mockResolvedValue({ collectionGoal: 'balanced' } as any)
    await savePreferences({ collectionGoal: 'balanced' })
    expect(preferencesDAL.upsertPreferences).toHaveBeenCalledWith('u-1', { collectionGoal: 'balanced' })
  })

  it('savePreferences accepts one argument (new signature)', () => {
    // Compile-time check via type assertion — if this line compiles, signature is correct.
    expect(savePreferences.length).toBe(1)
  })
})
