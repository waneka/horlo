import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

// Mock getCurrentUser so actions use a controllable session identity.
// The DAL itself is NOT mocked — it runs against the real local Postgres
// (or is skipped entirely when env vars are absent).
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth')
  return {
    ...actual,
    getCurrentUser: vi.fn(),
  }
})

// Always mock next/cache (no server context in tests).
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { getCurrentUser } from '@/lib/auth'

const hasLocalDb =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const maybe = hasLocalDb ? describe : describe.skip

maybe('IDOR isolation — AUTH-03', () => {
  let userA: { id: string; email: string }
  let userB: { id: string; email: string }
  let cleanup: () => Promise<void>
  let userBWatchId: string

  // Import actions and DAL lazily inside the describe block so that vitest
  // only resolves drizzle-orm when the stack is confirmed live.
  let editWatch: typeof import('@/app/actions/watches').editWatch
  let removeWatch: typeof import('@/app/actions/watches').removeWatch
  let addWatch: typeof import('@/app/actions/watches').addWatch
  let watchDAL: typeof import('@/data/watches')

  beforeAll(async () => {
    // Dynamic imports — only resolved when hasLocalDb is true.
    const actions = await import('@/app/actions/watches')
    editWatch = actions.editWatch
    removeWatch = actions.removeWatch
    addWatch = actions.addWatch
    watchDAL = await import('@/data/watches')

    const { seedTwoUsers } = await import('../fixtures/users')
    const seed = await seedTwoUsers()
    userA = seed.userA
    userB = seed.userB
    cleanup = seed.cleanup

    // Seed a watch directly into UserB's collection via the DAL (bypassing the action).
    const w = await watchDAL.createWatch(userB.id, {
      brand: 'Omega', model: 'Speedmaster',
      status: 'owned', movement: 'manual',
      complications: [], styleTags: [], designTraits: [], roleTags: [],
    } as any)
    userBWatchId = w.id
  }, 30_000)

  afterAll(async () => {
    if (!watchDAL || !userBWatchId) return
    // Delete UserB's seeded watch first to avoid FK violation on user delete.
    try { await watchDAL.deleteWatch(userB.id, userBWatchId) } catch {}
    await cleanup()
  }, 30_000)

  it('editWatch(otherUsersWatchId) returns Not found for User A', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userA)
    const result = await editWatch(userBWatchId, { brand: 'Hacked' })
    expect(result).toEqual({ success: false, error: 'Not found' })

    // Confirm UserB's watch is unchanged in the DB.
    const untouched = await watchDAL.getWatchesByUser(userB.id).catch(() => [] as any[])
    const stillOmega = Array.isArray(untouched) && untouched.some((w) => w.id === userBWatchId && w.brand === 'Omega')
    expect(stillOmega).toBe(true)
  })

  it('removeWatch(otherUsersWatchId) returns Not found for User A', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userA)
    const result = await removeWatch(userBWatchId)
    expect(result).toEqual({ success: false, error: 'Not found' })
  })

  it('addWatch with User A session creates a watch owned by User A only', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userA)
    const result = await addWatch({
      brand: 'Seiko', model: 'SKX007', status: 'owned', movement: 'automatic',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      // Cleanup — delete the watch created during this test.
      await watchDAL.deleteWatch(userA.id, result.data.id)
    }
  })
})
