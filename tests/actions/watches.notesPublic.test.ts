// Phase 23 Plan 01 — Wave 0 RED scaffold for FEAT-07.
//
// Asserts that addWatch / editWatch:
//   1. Accept `notesPublic: boolean` in the Zod schema (D-17 — one-line addition)
//   2. Persist notesPublic through to the DAL.createWatch / DAL.updateWatch call
//   3. Reject non-boolean notesPublic at validation time
//   4. Revalidate the per-row note surface (`/u/[username]` layout) on success
//      so the <NoteVisibilityPill> on /u/{username}/notes reflects the form's
//      choice (D-19)
//
// This file MUST FAIL today: insertWatchSchema in
// src/app/actions/watches.ts does NOT include `notesPublic`, so submissions
// silently drop the field; and neither addWatch nor editWatch revalidates
// `/u/[username]`. Plan 05 makes this GREEN.
//
// Mock layout mirrors tests/actions/watches.test.ts so existing wiring
// (auth gate, fan-out invalidation, fire-and-forget enrichment) does not
// fail under this scaffold's stricter assertions.

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
  linkWatchToCatalog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/notifications/logger', () => ({
  logNotification: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/data/notifications', () => ({ findOverlapRecipients: vi.fn().mockResolvedValue([]) }))
vi.mock('@/data/profiles', () => ({ getProfileById: vi.fn().mockResolvedValue(null) }))
vi.mock('@/data/activities', () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }))

// Phase 19.1 catalog DAL mocks (fire-and-forget).
vi.mock('@/data/catalog', () => ({
  upsertCatalogFromUserInput: vi.fn().mockResolvedValue(null),
  updateCatalogTaste: vi.fn().mockResolvedValue({ updated: true }),
  applyUserUploadedPhoto: vi.fn().mockResolvedValue({ applied: true }),
}))
vi.mock('@/lib/taste/enricher', () => ({
  enrichTasteAttributes: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/storage/catalogSourcePhotos', () => ({
  getCatalogSourcePhotoSignedUrl: vi.fn().mockResolvedValue(null),
  uploadCatalogSourcePhoto: vi.fn().mockResolvedValue({ path: 'u/pending/x.jpg' }),
}))

import { addWatch, editWatch } from '@/app/actions/watches'
import { getCurrentUser } from '@/lib/auth'
import * as watchDAL from '@/data/watches'
import { revalidatePath } from 'next/cache'

const viewerUserId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: viewerUserId,
    email: 't@example.com',
  })
})

describe('addWatch / editWatch — notesPublic + revalidation (FEAT-07, Wave 0 RED scaffold)', () => {
  it('addWatch accepts notesPublic in the Zod schema and persists it through createWatch', async () => {
    vi.mocked(watchDAL.createWatch).mockResolvedValue({
      id: 'w-1',
      brand: 'Rolex',
      model: 'Submariner',
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
    } as unknown as Awaited<ReturnType<typeof watchDAL.createWatch>>)

    const result = await addWatch({
      brand: 'Rolex',
      model: 'Submariner',
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
      notesPublic: false,
    })
    expect(result.success).toBe(true)
    expect(watchDAL.createWatch).toHaveBeenCalled()
    const passedData = vi.mocked(watchDAL.createWatch).mock.calls[0][1] as Record<
      string,
      unknown
    >
    expect(passedData.notesPublic).toBe(false)
  })

  it('editWatch accepts notesPublic and revalidates /u/[username] layout (D-19)', async () => {
    vi.mocked(watchDAL.updateWatch).mockResolvedValue({
      id: 'w-1',
      brand: 'Omega',
      model: 'Speedmaster',
      status: 'owned',
      movement: 'manual',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
    } as unknown as Awaited<ReturnType<typeof watchDAL.updateWatch>>)

    const result = await editWatch('w-1', { notesPublic: false })
    expect(result.success).toBe(true)
    // D-19: editWatch MUST revalidate the per-row note surface.
    expect(revalidatePath).toHaveBeenCalledWith('/u/[username]', 'layout')
  })

  it('addWatch revalidates /u/[username] layout on success (D-19 — covers create-with-private-note)', async () => {
    vi.mocked(watchDAL.createWatch).mockResolvedValue({
      id: 'w-1',
      brand: 'Rolex',
      model: 'Submariner',
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
    } as unknown as Awaited<ReturnType<typeof watchDAL.createWatch>>)

    await addWatch({
      brand: 'Rolex',
      model: 'Submariner',
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
      notesPublic: true,
    })
    expect(revalidatePath).toHaveBeenCalledWith('/u/[username]', 'layout')
  })

  it('rejects non-boolean notesPublic with a Zod error', async () => {
    const result = await addWatch({
      brand: 'Rolex',
      model: 'Submariner',
      status: 'owned',
      movement: 'automatic',
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
      notesPublic: 'yes', // wrong type
    })
    expect(result.success).toBe(false)
    expect(watchDAL.createWatch).not.toHaveBeenCalled()
  })
})
