// tests/components/watch/WatchForm.celebration.test.tsx
//
// Phase 85 Plan 09 — LIFE-04 / D-09 / D-10 / D-11 / D-12: the edit-save promotion
// celebration. WatchForm's edit branch reads the server's `promoted` /
// `promotedFrom` signal off editWatch's ActionResult<WatchEditResult> and either
// celebrates (confetti + distinct toast) or shows the normal 'Watch updated'
// toast — never both.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Watch } from '@/lib/types'

const mockRouterPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, back: vi.fn() }),
}))

const mockAddWatch = vi.fn().mockResolvedValue({ success: true, data: { id: 'new-id' } })
const mockEditWatch = vi.fn()
vi.mock('@/app/actions/watches', () => ({
  addWatch: (...args: unknown[]) => mockAddWatch(...args),
  editWatch: (...args: unknown[]) => mockEditWatch(...args),
}))

vi.mock('@/components/watch/CatalogPhotoUploader', () => ({
  CatalogPhotoUploader: () => (
    <div data-testid="catalog-photo-uploader">[CatalogPhotoUploader]</div>
  ),
}))

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc-123' } } }),
    },
  })),
}))
vi.mock('@/lib/storage/catalogSourcePhotos', () => ({
  uploadCatalogSourcePhoto: vi.fn(),
  getCatalogSourcePhotoSignedUrl: vi.fn().mockResolvedValue(null),
}))

const mockCelebratePromotion = vi.fn()
vi.mock('@/lib/celebrate', () => ({
  celebratePromotion: (...args: unknown[]) => mockCelebratePromotion(...args),
}))

const mockToastSuccess = vi.fn()
vi.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => mockToastSuccess(...args) },
}))

// Import AFTER mocks.
import { WatchForm } from '@/components/watch/WatchForm'

const wishlistWatch: Watch = {
  id: 'wish-id-001',
  brand: 'Omega',
  model: 'Speedmaster',
  reference: '',
  status: 'wishlist',
  movement: 'auto',
  complications: [],
  styleTags: [],
  designTraits: [],
  roleTags: [],
  notes: '',
  imageUrl: '',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('WatchForm edit-save — promotion celebration (LIFE-04, D-09/D-10/D-11/D-12)', () => {
  it('promoted:true, promotedFrom "wishlist" → celebratePromotion("wishlist") called; "Watch updated" NOT shown', async () => {
    const user = userEvent.setup()
    mockEditWatch.mockResolvedValueOnce({
      success: true,
      data: { watch: { ...wishlistWatch, status: 'owned' }, promoted: true, promotedFrom: 'wishlist' },
    })
    render(<WatchForm mode="edit" watch={wishlistWatch} />)

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(mockEditWatch).toHaveBeenCalledOnce()
    expect(mockCelebratePromotion).toHaveBeenCalledWith('wishlist')
    expect(mockToastSuccess).not.toHaveBeenCalledWith('Watch updated')
    expect(mockRouterPush).toHaveBeenCalledWith('/')
  })

  it('promoted:true, promotedFrom "grail" → celebratePromotion("grail") called', async () => {
    const user = userEvent.setup()
    mockEditWatch.mockResolvedValueOnce({
      success: true,
      data: { watch: { ...wishlistWatch, status: 'owned' }, promoted: true, promotedFrom: 'grail' },
    })
    render(<WatchForm mode="edit" watch={{ ...wishlistWatch, status: 'grail' }} />)

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(mockCelebratePromotion).toHaveBeenCalledWith('grail')
  })

  it('promoted:false → "Watch updated" toast fires exactly once; celebratePromotion NOT called', async () => {
    const user = userEvent.setup()
    mockEditWatch.mockResolvedValueOnce({
      success: true,
      data: { watch: { ...wishlistWatch, status: 'owned' }, promoted: false, promotedFrom: null },
    })
    render(<WatchForm mode="edit" watch={wishlistWatch} />)

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(mockToastSuccess).toHaveBeenCalledTimes(1)
    expect(mockToastSuccess).toHaveBeenCalledWith('Watch updated')
    expect(mockCelebratePromotion).not.toHaveBeenCalled()
    expect(mockRouterPush).toHaveBeenCalledWith('/')
  })
})
