/**
 * Phase 45 Plan 04 — cms-settings Server Action surface tests (TDD RED).
 *
 * Coverage:
 *   1. Auth gate — assertOwner rejects → 'Not authorized' (D-06)
 *   2. setPinnedHero calls revalidateTag('explore:hero', 'max') (STATE.md locked decision)
 *   3. clearPinnedHero calls revalidateTag('explore:hero', 'max')
 *   4. setPinnedHero rejects invalid uuid
 *   5. searchCatalogForPicker returns [] for query shorter than 2 chars
 *   6. searchCatalogForPicker forwards longer queries to searchCatalogWatches
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ assertOwner: vi.fn() }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/data/cmsSettings', () => ({
  setPinnedHero: vi.fn(),
  clearPinnedHero: vi.fn(),
  getCmsSettings: vi.fn(),
}))
vi.mock('@/data/catalog', () => ({
  searchCatalogWatches: vi.fn(),
}))

import { setPinnedHero, clearPinnedHero } from '@/app/actions/cms/settings'
import { searchCatalogForPicker } from '@/app/actions/cms/catalogPicker'
import { assertOwner } from '@/lib/auth'
import { revalidateTag } from 'next/cache'
import { setPinnedHero as dalSetPinnedHero } from '@/data/cmsSettings'
import { searchCatalogWatches } from '@/data/catalog'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'
const OWNER = { id: VALID_UUID, email: 'twwaneka@gmail.com' }

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Auth gate — D-06
// ---------------------------------------------------------------------------
describe('setPinnedHero auth gate', () => {
  it('returns Not authorized when assertOwner throws', async () => {
    vi.mocked(assertOwner).mockRejectedValue(new Error('Not an admin'))

    const result = await setPinnedHero({ listId: VALID_UUID })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })
})

describe('clearPinnedHero auth gate', () => {
  it('returns Not authorized when assertOwner throws', async () => {
    vi.mocked(assertOwner).mockRejectedValue(new Error('Not an admin'))

    const result = await clearPinnedHero()

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })
})

// ---------------------------------------------------------------------------
// revalidateTag('explore:hero', 'max') — STATE.md locked decision
// ---------------------------------------------------------------------------
describe("setPinnedHero — calls revalidateTag('explore:hero', 'max')", () => {
  it('revalidates explore:hero on success', async () => {
    vi.mocked(assertOwner).mockResolvedValue(OWNER)
    vi.mocked(dalSetPinnedHero).mockResolvedValue(undefined)

    await setPinnedHero({ listId: VALID_UUID })

    expect(revalidateTag).toHaveBeenCalledWith('explore:hero', 'max')
  })
})

describe("clearPinnedHero — calls revalidateTag('explore:hero', 'max')", () => {
  it('revalidates explore:hero on success', async () => {
    vi.mocked(assertOwner).mockResolvedValue(OWNER)
    vi.mocked(clearPinnedHero as () => Promise<unknown>)

    const { clearPinnedHero: dalClearPinnedHero } = await import('@/data/cmsSettings')
    vi.mocked(dalClearPinnedHero).mockResolvedValue(undefined)

    const result = await clearPinnedHero()

    expect(result.success).toBe(true)
    expect(revalidateTag).toHaveBeenCalledWith('explore:hero', 'max')
  })
})

// ---------------------------------------------------------------------------
// setPinnedHero — zod uuid validation
// ---------------------------------------------------------------------------
describe('setPinnedHero — zod validation', () => {
  it('rejects non-uuid listId', async () => {
    vi.mocked(assertOwner).mockResolvedValue(OWNER)

    const result = await setPinnedHero({ listId: 'not-a-uuid' })

    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// searchCatalogForPicker — 2-char minimum + catalog delegation
// ---------------------------------------------------------------------------
describe('searchCatalogForPicker', () => {
  it('returns [] for query shorter than 2 chars', async () => {
    vi.mocked(assertOwner).mockResolvedValue(OWNER)

    const result = await searchCatalogForPicker('a')

    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual([])
    expect(searchCatalogWatches).not.toHaveBeenCalled()
  })

  it('returns [] for empty string', async () => {
    vi.mocked(assertOwner).mockResolvedValue(OWNER)

    const result = await searchCatalogForPicker('')

    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual([])
    expect(searchCatalogWatches).not.toHaveBeenCalled()
  })

  it('forwards query of 2+ chars to searchCatalogWatches', async () => {
    vi.mocked(assertOwner).mockResolvedValue(OWNER)
    const mockResults = [{ id: VALID_UUID, brand: 'Rolex', model: 'Submariner', reference: null, imageUrl: null, ownersCount: 5, wishlistCount: 3 }]
    vi.mocked(searchCatalogWatches).mockResolvedValue(mockResults as any)

    const result = await searchCatalogForPicker('ro')

    expect(searchCatalogWatches).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'ro', viewerId: OWNER.id })
    )
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual(mockResults)
  })

  it('returns Not authorized when assertOwner throws', async () => {
    vi.mocked(assertOwner).mockRejectedValue(new Error('Not an admin'))

    const result = await searchCatalogForPicker('rolex')

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })
})
