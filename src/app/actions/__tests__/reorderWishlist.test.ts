/**
 * Phase 27 Wave 0 RED — reorderWishlist Server Action surface (WISH-01).
 *
 * Mocks getCurrentUser, bulkReorderWishlist, and revalidatePath at the
 * import-level boundary BEFORE importing the action. Plan 03 ships the
 * `reorderWishlist` export; until then, the import resolves at the type
 * layer (TS-erased) but throws at runtime — that's the expected RED state.
 *
 * Coverage:
 *   1. Auth gate — getCurrentUser rejects → "Not authenticated"
 *   2. Mass-assignment — payload with extra `userId` key → "Invalid request" (Zod .strict())
 *   3. Type validation — payload with non-uuid id → "Invalid request"
 *   4. Error mapping — DAL throws "Owner mismatch: …" → "Some watches do not belong to you."
 *   5. Happy path — DAL resolves → {success:true, data:undefined}
 *   6. Missing field — payload omits orderedIds → "Invalid request"
 *   7. Length cap — 501-element orderedIds → "Invalid request" (.max(500), T-27-03)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'

vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/data/watches', () => ({ bulkReorderWishlist: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { reorderWishlist } from '@/app/actions/wishlist'
import { getCurrentUser } from '@/lib/auth'
import { bulkReorderWishlist } from '@/data/watches'

// RFC 4122 strict UUID v4 (Zod 4's z.string().uuid() enforces version 1-8 +
// variant bits per the v4 strict regex shipped in zod@^4.3). The all-1s
// fixture used during Plan 01 RED scaffolding fails validation in Zod 4 —
// version digit must be 1-8 and variant digit must be 8/9/a/b. Rule 1 fix.
const VALID_UUID = '11111111-1111-4111-8111-111111111111'

describe('Phase 27 — reorderWishlist Server Action surface (WISH-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests with "Not authenticated"', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('Not authenticated'))
    const result = await reorderWishlist({ orderedIds: [VALID_UUID] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authenticated')
  })

  it('rejects payloads with extra keys (.strict() — D-10 mass-assignment defense)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-id' } as any)
    const result = await reorderWishlist({
      orderedIds: [VALID_UUID],
      // Extra key — .strict() should reject. userId must NEVER come from client.
      userId: 'forged-id',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid request')
  })

  it('rejects payloads with non-uuid orderedIds entries', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-id' } as any)
    const result = await reorderWishlist({ orderedIds: ['not-a-uuid'] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid request')
  })

  it('owner-mismatch from DAL → action returns "Some watches do not belong to you."', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-id' } as any)
    vi.mocked(bulkReorderWishlist).mockRejectedValue(
      new Error('Owner mismatch: expected 3 rows, updated 2'),
    )
    const result = await reorderWishlist({ orderedIds: [VALID_UUID] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Some watches do not belong to you.')
  })

  it('happy path: returns {success:true, data:undefined}', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-id' } as any)
    vi.mocked(bulkReorderWishlist).mockResolvedValue(undefined)
    const result = await reorderWishlist({ orderedIds: [VALID_UUID] })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBeUndefined()
  })

  it('rejects payloads missing orderedIds → "Invalid request"', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-id' } as any)
    const result = await reorderWishlist({})
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid request')
  })

  it('rejects payloads exceeding 500 orderedIds (T-27-03 length cap → "Invalid request")', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-id' } as any)
    const tooManyIds = Array.from({ length: 501 }, () => randomUUID())
    const result = await reorderWishlist({ orderedIds: tooManyIds })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid request')
  })
})
