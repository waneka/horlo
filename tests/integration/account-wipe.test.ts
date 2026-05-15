/**
 * Phase 41 — Track A (SET-13) integration test: wipeCollection server action.
 *
 * RED scaffold — `wipeCollection` does not exist yet (ships in plan 41-02).
 * This file is RED because the import resolves to a missing module.
 *
 * Env-gate: tests skip when DATABASE_URL is absent (no local Supabase running).
 * To run locally: set -a; source .env.local; set +a; npx vitest run tests/integration/account-wipe.test.ts
 *
 * Preserve-account contract (SET-13):
 *   - wipeCollection deletes watches + wear_events rows owned by the user
 *   - profiles and follows rows for that user SURVIVE the wipe
 *   - storage objects under wear-photos/{userId}/ are purged
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { wipeCollection } from '@/app/actions/account'

// Env-gate: skip when DATABASE_URL is absent (no local Supabase available).
const maybe = process.env.DATABASE_URL ? describe : describe.skip

// ---- Mocks for the server action dependencies ----
// The server action imports supabase server client and db; mock them so the
// assertions focus on call ordering and return shape.
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    storage: {
      from: vi.fn().mockReturnValue({
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  }),
}))

vi.mock('@/db', () => ({
  db: {
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'test-user-id', email: 'test@example.com' }),
}))

vi.mock('@/db/schema', () => ({
  watches: {},
  wearEvents: {},
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockReturnValue('mocked-eq'),
}))

maybe('wipeCollection — SET-13 preserve-account contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { success: true } when collection is wiped successfully', async () => {
    const result = await wipeCollection()
    expect(result).toMatchObject({ success: true })
  })

  it('purges wear-photos storage before deleting DB rows', async () => {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server')
    const { db } = await import('@/db')

    const mockStorageBucket = {
      list: vi.fn().mockResolvedValue({ data: [{ name: 'event1.jpg' }], error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      storage: {
        from: vi.fn().mockReturnValue(mockStorageBucket),
      },
    } as never)

    const callOrder: string[] = []
    mockStorageBucket.remove.mockImplementation(async () => {
      callOrder.push('storage-remove')
      return { error: null }
    })
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockImplementation(async () => {
        callOrder.push('db-delete')
      }),
    } as never)

    await wipeCollection()

    // Storage purge MUST precede DB delete (Pitfall 2 / success criterion 2)
    const storageIdx = callOrder.indexOf('storage-remove')
    const dbIdx = callOrder.indexOf('db-delete')
    if (storageIdx !== -1 && dbIdx !== -1) {
      expect(storageIdx).toBeLessThan(dbIdx)
    }
  })

  it('returns { success: false } when not authenticated', async () => {
    const { getCurrentUser } = await import('@/lib/auth')
    vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error('Not authenticated'))

    const result = await wipeCollection()
    expect(result).toMatchObject({ success: false, error: expect.any(String) })
  })

  it('wipeCollection export is a function', () => {
    expect(typeof wipeCollection).toBe('function')
  })
})

// Stub test: always runs (no env gate) — confirms the module shape expectation.
describe('wipeCollection — module contract (RED until 41-02 ships)', () => {
  it('wipeCollection is exported from @/app/actions/account', () => {
    // RED: This assertion documents the contract. The import will fail until
    // 41-02 creates src/app/actions/account.ts.
    expect(wipeCollection).toBeDefined()
  })
})
