/**
 * Phase 82 Plan 04 Task 1 — brands Server Action tests (TDD RED → GREEN)
 *
 * Coverage:
 *   T1: confirmBrandAsNew — unauth returns Not authorized
 *   T2: confirmBrandAsNew — success returns { success: true } + revalidatePath called
 *   T3: confirmBrandAsNew — Zod invalid UUID returns Invalid data
 *   T4: confirmBrandAsNew — Zod .strict() rejects unknown key
 *   T5: renameBrand — unauth returns Not authorized
 *   T6: renameBrand — Zod .strict() rejects slug injection (slug not in schema)
 *   T7: renameBrand — success calls DAL with (id, name) + revalidatePath fired
 *   T8: mergeBrand — unauth returns Not authorized
 *   T9: mergeBrand — Zod .strict() rejects unknown key
 *   T10: mergeBrand — success calls DAL + revalidatePath for /admin/brands AND /admin/families
 *   T11: mergeBrand — DAL error path returns Couldn't merge brand + console.error called
 *   T12: grep armor — assertOwner appears exactly 3 times in brands.ts
 *   T13: grep armor — .strict() appears exactly 3 times in brands.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// --- Mock @/lib/auth ---
vi.mock('@/lib/auth', () => {
  class UnauthorizedError extends Error {
    constructor(message = 'Not authenticated') {
      super(message)
      this.name = 'UnauthorizedError'
    }
  }
  return {
    UnauthorizedError,
    getCurrentUser: vi.fn(),
    assertOwner: vi.fn(),
  }
})

// --- Mock next/cache ---
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))

// --- Mock @/data/brands DAL ---
vi.mock('@/data/brands', () => ({
  confirmBrand: vi.fn(),
  renameBrandInDb: vi.fn(),
  mergeBrandInDb: vi.fn(),
  listBrandsForQueue: vi.fn(),
}))

// Import AFTER mocking
import { assertOwner, UnauthorizedError } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { confirmBrand, renameBrandInDb, mergeBrandInDb } from '@/data/brands'
import {
  confirmBrandAsNew,
  renameBrand,
  mergeBrand,
} from '@/app/actions/cms/brands'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'
const VALID_UUID_2 = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  vi.clearAllMocks()
  // Default: assertOwner succeeds (authenticated admin)
  vi.mocked(assertOwner).mockResolvedValue({ id: 'user-1', email: 'admin@example.com' })
})

// ─── T1: confirmBrandAsNew — unauth ───
describe('confirmBrandAsNew', () => {
  it('T1: returns { success: false, error: "Not authorized" } when assertOwner throws', async () => {
    vi.mocked(assertOwner).mockRejectedValue(new UnauthorizedError('Not an admin'))
    const result = await confirmBrandAsNew({ id: VALID_UUID })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })

  it('T2: success — calls DAL + revalidatePath("/admin/brands") + returns { success: true }', async () => {
    vi.mocked(confirmBrand).mockResolvedValue(undefined)
    const result = await confirmBrandAsNew({ id: VALID_UUID })
    expect(result.success).toBe(true)
    expect(vi.mocked(confirmBrand)).toHaveBeenCalledWith(VALID_UUID)
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/admin/brands')
  })

  it('T3: Zod invalid UUID returns { success: false, error: "Invalid data" }', async () => {
    const result = await confirmBrandAsNew({ id: 'not-a-uuid' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid data')
  })

  it('T4: Zod .strict() rejects unknown key', async () => {
    const result = await confirmBrandAsNew({ id: VALID_UUID, extraKey: 'value' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid data')
  })
})

// ─── T5-T7: renameBrand ───
describe('renameBrand', () => {
  it('T5: returns { success: false, error: "Not authorized" } when assertOwner throws', async () => {
    vi.mocked(assertOwner).mockRejectedValue(new UnauthorizedError('Not an admin'))
    const result = await renameBrand({ id: VALID_UUID, name: 'Hamilton' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })

  it('T6: Zod .strict() rejects slug injection (slug not in schema)', async () => {
    const result = await renameBrand({ id: VALID_UUID, name: 'Hamilton', slug: 'user-injected' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid data')
  })

  it('T7: success — calls DAL with (id, name) + revalidatePath fired + returns { success: true }', async () => {
    vi.mocked(renameBrandInDb).mockResolvedValue(undefined)
    const result = await renameBrand({ id: VALID_UUID, name: 'Hamilton' })
    expect(result.success).toBe(true)
    expect(vi.mocked(renameBrandInDb)).toHaveBeenCalledWith(VALID_UUID, 'Hamilton')
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/admin/brands')
  })
})

// ─── T8-T11: mergeBrand ───
describe('mergeBrand', () => {
  it('T8: returns { success: false, error: "Not authorized" } when assertOwner throws', async () => {
    vi.mocked(assertOwner).mockRejectedValue(new UnauthorizedError('Not an admin'))
    const result = await mergeBrand({ sourceId: VALID_UUID, targetId: VALID_UUID_2, moveFamilies: true })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })

  it('T9: Zod .strict() rejects unknown key', async () => {
    const result = await mergeBrand({
      sourceId: VALID_UUID,
      targetId: VALID_UUID_2,
      moveFamilies: true,
      extra: 'x',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid data')
  })

  it('T10: success — calls DAL + revalidatePath for /admin/brands AND /admin/families', async () => {
    vi.mocked(mergeBrandInDb).mockResolvedValue(undefined)
    const result = await mergeBrand({
      sourceId: VALID_UUID,
      targetId: VALID_UUID_2,
      moveFamilies: true,
    })
    expect(result.success).toBe(true)
    expect(vi.mocked(mergeBrandInDb)).toHaveBeenCalledWith(VALID_UUID, VALID_UUID_2, true)
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/admin/brands')
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/admin/families')
  })

  it('T11: DAL error returns { success: false, error: "Couldn\'t merge brand. Try again." } + console.error called', async () => {
    const dbError = new Error('DB error')
    vi.mocked(mergeBrandInDb).mockRejectedValue(dbError)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await mergeBrand({
      sourceId: VALID_UUID,
      targetId: VALID_UUID_2,
      moveFamilies: false,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe("Couldn't merge brand. Try again.")
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})

// ─── T12-T13: Grep armor ───
describe('Grep armor (file-level assertions)', () => {
  const brandsActionsPath = resolve(process.cwd(), 'src/app/actions/cms/brands.ts')

  it('T12: assertOwner appears exactly 3 times in brands.ts', () => {
    const src = readFileSync(brandsActionsPath, 'utf-8')
    const matches = src.match(/await assertOwner\(\)/g)
    expect(matches).not.toBeNull()
    expect(matches?.length).toBe(3)
  })

  it('T13: .strict() appears exactly 3 times in brands.ts', () => {
    const src = readFileSync(brandsActionsPath, 'utf-8')
    const matches = src.match(/\.strict\(\)/g)
    expect(matches).not.toBeNull()
    expect(matches?.length).toBe(3)
  })
})
