import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error {
    constructor(m = 'Not authenticated') {
      super(m)
      this.name = 'UnauthorizedError'
    }
  },
  getCurrentUser: vi.fn(),
}))
vi.mock('@/data/watches', () => ({
  createWatch: vi.fn(),
  updateWatch: vi.fn(),
  deleteWatch: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { addWatch, editWatch, removeWatch } from '@/app/actions/watches'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import * as watchDAL from '@/data/watches'

const validWatch = {
  brand: 'Omega', model: 'Seamaster', status: 'owned' as const, movement: 'automatic' as const,
}

describe('watches Server Actions auth gate — AUTH-02', () => {
  beforeEach(() => vi.clearAllMocks())

  it('addWatch returns Not authenticated when getCurrentUser throws', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new UnauthorizedError())
    await expect(addWatch(validWatch)).resolves.toEqual({
      success: false,
      error: 'Not authenticated',
    })
    expect(watchDAL.createWatch).not.toHaveBeenCalled()
  })

  it('editWatch returns Not authenticated when getCurrentUser throws', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new UnauthorizedError())
    await expect(editWatch('w-1', validWatch)).resolves.toEqual({
      success: false,
      error: 'Not authenticated',
    })
  })

  it('removeWatch returns Not authenticated when getCurrentUser throws', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new UnauthorizedError())
    await expect(removeWatch('w-1')).resolves.toEqual({
      success: false,
      error: 'Not authenticated',
    })
  })

  it('addWatch calls DAL.createWatch with session user.id', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(watchDAL.createWatch).mockResolvedValue({ id: 'w-1', ...validWatch } as any)
    await addWatch(validWatch)
    expect(watchDAL.createWatch).toHaveBeenCalledWith('u-1', expect.objectContaining(validWatch))
  })

  it('editWatch(watchId, data) uses new two-arg signature', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(watchDAL.updateWatch).mockResolvedValue({ id: 'w-1', ...validWatch } as any)
    await editWatch('w-1', { brand: 'Rolex' })
    expect(watchDAL.updateWatch).toHaveBeenCalledWith('u-1', 'w-1', expect.objectContaining({ brand: 'Rolex' }))
  })

  it('removeWatch(watchId) uses new one-arg signature', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(watchDAL.deleteWatch).mockResolvedValue(undefined)
    await removeWatch('w-1')
    expect(watchDAL.deleteWatch).toHaveBeenCalledWith('u-1', 'w-1')
  })

  it('editWatch maps DAL "not found or access denied" to Not found', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(watchDAL.updateWatch).mockRejectedValue(
      new Error('Watch not found or access denied: w-1'),
    )
    await expect(editWatch('w-1', { brand: 'Rolex' })).resolves.toEqual({
      success: false,
      error: 'Not found',
    })
  })
})
