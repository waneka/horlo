/**
 * Phase 82 Plan 05 Task 1 — families Server Action tests (TDD RED → GREEN)
 *
 * Coverage:
 *   T1: confirmFamilyAsNew — unauth returns Not authorized
 *   T2: confirmFamilyAsNew — Zod .strict() rejects unknown key
 *   T3: confirmFamilyAsNew — success calls DAL + revalidatePath fired
 *   T4: renameFamily — unauth returns Not authorized
 *   T5: renameFamily — Zod .strict() rejects unknown key
 *   T6: renameFamily — success calls DAL with (id, name) + revalidatePath fired
 *   T7: addFamilyAlias — unauth returns Not authorized
 *   T8: addFamilyAlias — normalization: '  Submariner  ' → DAL called with 'submariner'
 *       (LOAD-BEARING per RESEARCH Pitfall 3 — aliases must match resolver lower(trim($1)))
 *   T9: addFamilyAlias — Zod .strict() rejects unknown key
 *   T10: addFamilyAlias — empty alias rejected via Zod min(1)
 *   T11: addFamilyAlias — whitespace-only alias rejected (post-normalization empty guard)
 *   T12: removeFamilyAlias — unauth returns Not authorized
 *   T13: removeFamilyAlias — Zod .strict() rejects unknown key
 *   T14: removeFamilyAlias — success calls DAL VERBATIM (no re-normalize on remove)
 *   T15: grep armor — assertOwner appears exactly 4 times in families.ts
 *   T16: grep armor — .strict() appears exactly 4 times in families.ts
 *   T17: grep armor — array_remove appears exactly 1 time in families.ts (DAL)
 *   T18: grep armor — aliases @> appears exactly 1 time in families.ts (DAL dedup guard)
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

// --- Mock @/data/families DAL ---
vi.mock('@/data/families', () => ({
  listFamiliesForQueue: vi.fn(),
  confirmFamily: vi.fn(),
  renameFamilyInDb: vi.fn(),
  addFamilyAliasInDb: vi.fn(),
  removeFamilyAliasInDb: vi.fn(),
  getBrandNameById: vi.fn(),
}))

// Import AFTER mocking
import { assertOwner, UnauthorizedError } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { confirmFamily, renameFamilyInDb, addFamilyAliasInDb, removeFamilyAliasInDb } from '@/data/families'
import {
  confirmFamilyAsNew,
  renameFamily,
  addFamilyAlias,
  removeFamilyAlias,
} from '@/app/actions/cms/families'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  // Default: assertOwner succeeds (authenticated admin)
  vi.mocked(assertOwner).mockResolvedValue({ id: 'user-1', email: 'admin@example.com' })
})

// ─── T1-T3: confirmFamilyAsNew ───
describe('confirmFamilyAsNew', () => {
  it('T1: returns { success: false, error: "Not authorized" } when assertOwner throws', async () => {
    vi.mocked(assertOwner).mockRejectedValue(new UnauthorizedError('Not an admin'))
    const result = await confirmFamilyAsNew({ id: VALID_UUID })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })

  it('T2: Zod .strict() rejects unknown key', async () => {
    const result = await confirmFamilyAsNew({ id: VALID_UUID, extra: 'x' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid data')
  })

  it('T3: success — calls DAL + revalidatePath("/admin/families") + returns { success: true }', async () => {
    vi.mocked(confirmFamily).mockResolvedValue(undefined)
    const result = await confirmFamilyAsNew({ id: VALID_UUID })
    expect(result.success).toBe(true)
    expect(vi.mocked(confirmFamily)).toHaveBeenCalledWith(VALID_UUID)
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/admin/families')
  })
})

// ─── T4-T6: renameFamily ───
describe('renameFamily', () => {
  it('T4: returns { success: false, error: "Not authorized" } when assertOwner throws', async () => {
    vi.mocked(assertOwner).mockRejectedValue(new UnauthorizedError('Not an admin'))
    const result = await renameFamily({ id: VALID_UUID, name: 'Submariner' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })

  it('T5: Zod .strict() rejects unknown key', async () => {
    const result = await renameFamily({ id: VALID_UUID, name: 'Submariner', slug: 'injected' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid data')
  })

  it('T6: success — calls DAL with (id, name) + revalidatePath fired + returns { success: true }', async () => {
    vi.mocked(renameFamilyInDb).mockResolvedValue(undefined)
    const result = await renameFamily({ id: VALID_UUID, name: 'Submariner' })
    expect(result.success).toBe(true)
    expect(vi.mocked(renameFamilyInDb)).toHaveBeenCalledWith(VALID_UUID, 'Submariner')
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/admin/families')
  })
})

// ─── T7-T11: addFamilyAlias ───
describe('addFamilyAlias', () => {
  it('T7: returns { success: false, error: "Not authorized" } when assertOwner throws', async () => {
    vi.mocked(assertOwner).mockRejectedValue(new UnauthorizedError('Not an admin'))
    const result = await addFamilyAlias({ id: VALID_UUID, alias: 'submariner' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })

  it('T8: LOAD-BEARING normalization — alias "  Submariner  " → DAL called with "submariner"', async () => {
    // This test is load-bearing per RESEARCH Pitfall 3:
    // Aliases stored as-is won't match resolver Tier 2 lower(trim($1)) lookup.
    // Server Action MUST normalize (trim().toLowerCase()) BEFORE calling DAL.
    vi.mocked(addFamilyAliasInDb).mockResolvedValue(undefined)
    const result = await addFamilyAlias({ id: VALID_UUID, alias: '  Submariner  ' })
    expect(result.success).toBe(true)
    expect(vi.mocked(addFamilyAliasInDb)).toHaveBeenCalledWith(VALID_UUID, 'submariner')
  })

  it('T9: Zod .strict() rejects unknown key', async () => {
    const result = await addFamilyAlias({ id: VALID_UUID, alias: 'sub', extra: 'y' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid data')
  })

  it('T10: empty alias rejected via Zod min(1)', async () => {
    const result = await addFamilyAlias({ id: VALID_UUID, alias: '' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid data')
  })

  it('T11: whitespace-only alias rejected via post-normalization empty guard', async () => {
    // '   ' passes Zod min(1) as raw string but trim().toLowerCase() === '' (length 0)
    const result = await addFamilyAlias({ id: VALID_UUID, alias: '   ' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid data')
  })
})

// ─── T12-T14: removeFamilyAlias ───
describe('removeFamilyAlias', () => {
  it('T12: returns { success: false, error: "Not authorized" } when assertOwner throws', async () => {
    vi.mocked(assertOwner).mockRejectedValue(new UnauthorizedError('Not an admin'))
    const result = await removeFamilyAlias({ id: VALID_UUID, alias: 'submariner' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })

  it('T13: Zod .strict() rejects unknown key', async () => {
    const result = await removeFamilyAlias({ id: VALID_UUID, alias: 'sub', extra: 'z' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid data')
  })

  it('T14: success — DAL called VERBATIM (no re-normalize on remove)', async () => {
    // Chip strip already shows stored normalized form; remove must pass exact stored alias.
    vi.mocked(removeFamilyAliasInDb).mockResolvedValue(undefined)
    const result = await removeFamilyAlias({ id: VALID_UUID, alias: 'submariner' })
    expect(result.success).toBe(true)
    expect(vi.mocked(removeFamilyAliasInDb)).toHaveBeenCalledWith(VALID_UUID, 'submariner')
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/admin/families')
  })
})

// ─── T15-T18: Grep armor ───
describe('Grep armor (file-level assertions)', () => {
  const familiesActionsPath = resolve(process.cwd(), 'src/app/actions/cms/families.ts')
  const familiesDalPath = resolve(process.cwd(), 'src/data/families.ts')

  it('T15: assertOwner appears exactly 4 times in families.ts (Server Actions)', () => {
    const src = readFileSync(familiesActionsPath, 'utf-8')
    const matches = src.match(/await assertOwner\(\)/g)
    expect(matches).not.toBeNull()
    expect(matches?.length).toBe(4)
  })

  it('T16: .strict() appears exactly 4 times in families.ts (Server Actions)', () => {
    const src = readFileSync(familiesActionsPath, 'utf-8')
    const matches = src.match(/\.strict\(\)/g)
    expect(matches).not.toBeNull()
    expect(matches?.length).toBe(4)
  })

  it('T17: array_remove appears exactly 1 time in families.ts (DAL)', () => {
    const src = readFileSync(familiesDalPath, 'utf-8')
    const matches = src.match(/array_remove/g)
    expect(matches).not.toBeNull()
    expect(matches?.length).toBe(1)
  })

  it('T18: "aliases @>" appears exactly 1 time in families.ts (DAL — dedup guard)', () => {
    const src = readFileSync(familiesDalPath, 'utf-8')
    const matches = src.match(/aliases @>/g)
    expect(matches).not.toBeNull()
    expect(matches?.length).toBe(1)
  })
})
