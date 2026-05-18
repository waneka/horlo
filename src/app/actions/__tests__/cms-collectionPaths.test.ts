/**
 * Phase 45 Plan 04 — cms-collectionPaths Server Action surface tests (TDD RED).
 *
 * Coverage:
 *   1. Auth gate — assertOwner rejects → 'Not authorized'
 *   2. D-16: createCollectionPath rejects pathType not in four-value vocabulary (zod enum)
 *   3. D-16: createCollectionPath with unknown extra key rejected by zod .strict()
 *   4. publishCollectionPath calls revalidateTag('explore:hero', 'max')
 *   5. unpublishCollectionPath calls revalidateTag('explore:hero', 'max')
 *   6. Happy path — createCollectionPath returns { id: string }
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ assertOwner: vi.fn() }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/data/collectionPaths', () => ({
  createPath: vi.fn(),
  updatePath: vi.fn(),
  deletePath: vi.fn(),
  setPathNode: vi.fn(),
  removePathNode: vi.fn(),
  getAllPathsForOwner: vi.fn(),
  getPathById: vi.fn(),
  swapPathSortOrder: vi.fn(),
  setPathStatus: vi.fn(),
}))

import {
  createCollectionPath,
  publishCollectionPath,
  unpublishCollectionPath,
} from '@/app/actions/cms/collectionPaths'
import { assertOwner } from '@/lib/auth'
import { revalidateTag } from 'next/cache'
import { createPath, setPathStatus } from '@/data/collectionPaths'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'
const OWNER = { id: VALID_UUID, email: 'twwaneka@gmail.com' }

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Auth gate
// ---------------------------------------------------------------------------
describe('auth gate — D-06 assertOwner() first statement', () => {
  it('returns Not authorized when assertOwner throws', async () => {
    vi.mocked(assertOwner).mockRejectedValue(new Error('Not an admin'))

    const result = await createCollectionPath({
      seedCatalogId: VALID_UUID,
      pathType: 'Going Deeper',
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })
})

// ---------------------------------------------------------------------------
// D-16: pathType validation
// ---------------------------------------------------------------------------
describe('D-16 pathType zod enum — four fixed values', () => {
  it('rejects pathType outside the four D-16 values', async () => {
    vi.mocked(assertOwner).mockResolvedValue(OWNER)

    const result = await createCollectionPath({
      seedCatalogId: VALID_UUID,
      pathType: 'Invalid Type',
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })

  it('accepts all four valid D-16 pathType values', async () => {
    const validTypes = ['Going Deeper', 'Branching Out', 'Trading Up', 'Filling a Gap']
    const newId = '22222222-2222-4222-8222-222222222222'
    vi.mocked(createPath).mockResolvedValue(newId)

    for (const pathType of validTypes) {
      vi.mocked(assertOwner).mockResolvedValue(OWNER)
      const result = await createCollectionPath({ seedCatalogId: VALID_UUID, pathType })
      expect(result.success).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Mass-assignment — .strict() rejects unknown keys
// ---------------------------------------------------------------------------
describe('.strict() mass-assignment protection', () => {
  it('rejects payload with unknown extra key', async () => {
    vi.mocked(assertOwner).mockResolvedValue(OWNER)

    const result = await createCollectionPath({
      seedCatalogId: VALID_UUID,
      pathType: 'Going Deeper',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unknownKey: 'should-be-rejected',
    } as any)

    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// publishCollectionPath — must call revalidateTag('explore:hero', 'max')
// ---------------------------------------------------------------------------
describe('publishCollectionPath — revalidates explore:hero cache', () => {
  it("calls revalidateTag('explore:hero', 'max') on publish", async () => {
    vi.mocked(assertOwner).mockResolvedValue(OWNER)
    vi.mocked(setPathStatus).mockResolvedValue(undefined)

    await publishCollectionPath(VALID_UUID)

    expect(revalidateTag).toHaveBeenCalledWith('explore:hero', 'max')
  })
})

// ---------------------------------------------------------------------------
// unpublishCollectionPath — must call revalidateTag('explore:hero', 'max')
// ---------------------------------------------------------------------------
describe('unpublishCollectionPath — revalidates explore:hero cache', () => {
  it("calls revalidateTag('explore:hero', 'max') on unpublish", async () => {
    vi.mocked(assertOwner).mockResolvedValue(OWNER)
    vi.mocked(setPathStatus).mockResolvedValue(undefined)

    await unpublishCollectionPath(VALID_UUID)

    expect(revalidateTag).toHaveBeenCalledWith('explore:hero', 'max')
  })
})

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------
describe('createCollectionPath — happy path', () => {
  it('returns { success: true, data: { id: string } } on valid input', async () => {
    const newId = '33333333-3333-4333-8333-333333333333'
    vi.mocked(assertOwner).mockResolvedValue(OWNER)
    vi.mocked(createPath).mockResolvedValue(newId)

    const result = await createCollectionPath({
      seedCatalogId: VALID_UUID,
      pathType: 'Trading Up',
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.id).toBe(newId)
  })
})
