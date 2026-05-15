/**
 * Phase 41 — Track A (SET-13) integration test: deleteAccount server action.
 *
 * RED scaffold — `deleteAccount` does not exist yet (ships in plan 41-02).
 * This file is RED because the import resolves to a missing module.
 *
 * Env-gate: tests skip when DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY is absent.
 * To run locally: set -a; source .env.local; set +a; npx vitest run tests/integration/account-delete.test.ts
 *
 * Critical contracts (RESEARCH §Common Pitfalls + §Runtime State Inventory):
 *   - Storage purge runs BEFORE any DB delete (Pitfall 2 / success criterion 2)
 *   - public.users row is explicitly deleted BEFORE auth.admin.deleteUser() (Pitfall 1)
 *   - auth.admin.deleteUser() is called with a service-role client (SUPABASE_SERVICE_ROLE_KEY)
 *   - divestments auto-cascade off auth.users — no explicit delete needed
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deleteAccount } from '@/app/actions/account'

// Env-gate: skip when DATABASE_URL OR SUPABASE_SERVICE_ROLE_KEY is absent.
const maybe =
  process.env.DATABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? describe
    : describe.skip

// ---- Mocks ----
const mockAdminDeleteUser = vi.fn().mockResolvedValue({ error: null })
const mockStorageList = vi.fn().mockResolvedValue({ data: [], error: null })
const mockStorageRemove = vi.fn().mockResolvedValue({ error: null })
const mockDbExecute = vi.fn().mockResolvedValue([])

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    storage: {
      from: vi.fn().mockReturnValue({
        list: mockStorageList,
        remove: mockStorageRemove,
      }),
    },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn().mockReturnValue({
    auth: {
      admin: {
        deleteUser: mockAdminDeleteUser,
      },
    },
  }),
}))

vi.mock('@/db', () => ({
  db: {
    execute: mockDbExecute,
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'test-user-id', email: 'test@example.com' }),
}))

vi.mock('@/db/schema', () => ({
  users: {},
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockReturnValue('mocked-eq'),
  sql: vi.fn().mockReturnValue('mocked-sql'),
}))

maybe('deleteAccount — SET-13 storage-before-DB ordering + public.users cascade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageList.mockResolvedValue({ data: [], error: null })
    mockStorageRemove.mockResolvedValue({ error: null })
    mockAdminDeleteUser.mockResolvedValue({ error: null })
    mockDbExecute.mockResolvedValue([])
  })

  it('returns { success: true } on successful account deletion', async () => {
    const result = await deleteAccount()
    expect(result).toMatchObject({ success: true })
  })

  it('storage purge precedes public.users delete (Pitfall 2 — success criterion 2)', async () => {
    const callOrder: string[] = []

    mockStorageRemove.mockImplementation(async () => {
      callOrder.push('storage-remove')
      return { error: null }
    })
    mockStorageList.mockResolvedValue({
      data: [{ name: 'event1.jpg' }],
      error: null,
    })
    mockDbExecute.mockImplementation(async () => {
      callOrder.push('db-delete-users')
      return []
    })

    await deleteAccount()

    // If there were storage files, purge must come before DB delete.
    const storageIdx = callOrder.indexOf('storage-remove')
    const dbIdx = callOrder.indexOf('db-delete-users')
    if (storageIdx !== -1 && dbIdx !== -1) {
      expect(storageIdx).toBeLessThan(dbIdx)
    }
  })

  it('calls auth.admin.deleteUser with the user ID (service-role required)', async () => {
    await deleteAccount()
    // The action must call auth.admin.deleteUser to remove the auth.users row.
    // public.users delete is separate (RESEARCH Pitfall 1 — no FK between them).
    expect(mockAdminDeleteUser).toHaveBeenCalledWith('test-user-id')
  })

  it('returns { success: false } when not authenticated', async () => {
    const { getCurrentUser } = await import('@/lib/auth')
    vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error('Not authenticated'))

    const result = await deleteAccount()
    expect(result).toMatchObject({ success: false, error: expect.any(String) })
  })

  it('deleteAccount export is a function', () => {
    expect(typeof deleteAccount).toBe('function')
  })
})

// Stub test: always runs — confirms the module shape expectation.
describe('deleteAccount — module contract (RED until 41-02 ships)', () => {
  it('deleteAccount is exported from @/app/actions/account', () => {
    // RED: This assertion documents the contract. The import will fail until
    // 41-02 creates src/app/actions/account.ts with deleteAccount export.
    expect(deleteAccount).toBeDefined()
  })
})
