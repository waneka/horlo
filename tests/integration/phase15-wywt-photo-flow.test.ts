/**
 * Phase 15 Plan 03a integration tests — WYWT-12 / WYWT-15.
 *
 * Covers:
 *   Task 1 (DAL) — Tests 4, 5, 6:
 *     - getWornTodayIdsForUser returns Set of watch IDs for (user, today)
 *     - logWearEventWithPhoto inserts a row with exactly the supplied fields
 *     - Duplicate-day insert throws PG 23505
 *
 *   Task 2 (Server Actions) — Tests 16-26 + A5 smoke (25):
 *     - 25 (A5 smoke, ORDER FIRST): session-client .list() succeeds under session auth
 *     - 16 happy no-photo
 *     - 17 happy with-photo
 *     - 18 client asserts hasPhoto but Storage object missing → rejected, no DB row
 *     - 19 duplicate-day with photo → 23505 caught, orphan Storage cleaned up
 *     - 20 duplicate-day no-photo
 *     - 21 unauthorized
 *     - 22 cross-user watch (getWatchById returns null)
 *     - 23 zod validation failure
 *     - 24 / 24b / 24c getWornTodayIdsForUserAction happy path + cross-user defense + zod
 *     - 26 non-23505 insert failure with hasPhoto → orphan Storage cleaned up
 *
 * Gate: DATABASE_URL + NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY.
 * When any env var is missing the suite is `describe.skip` (same pattern as home-privacy.test.ts).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { eq, inArray } from 'drizzle-orm'

import { db } from '@/db'
import { users, watches, wearEvents, profileSettings } from '@/db/schema'
import {
  getWornTodayIdsForUser,
  logWearEventWithPhoto,
} from '@/data/wearEvents'

const hasDrizzle = Boolean(process.env.DATABASE_URL)
const hasSupabase =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const maybe = hasDrizzle && hasSupabase ? describe : describe.skip

function isoToday(offsetDays = 0): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

// Minimal valid JPEG (SOI + EOI marker).
const TINY_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])

maybe('Phase 15 WYWT photo flow — DAL (Task 1) + Server Actions (Task 2)', () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  let admin: SupabaseClient
  let userA: { id: string; email: string; password: string }
  let userB: { id: string; email: string; password: string }
  let watchA1: string
  let watchA2: string
  let watchB1: string

  async function cleanupStorage(userId: string) {
    try {
      const { data } = await admin.storage.from('wear-photos').list(userId)
      if (data && data.length > 0) {
        await admin.storage
          .from('wear-photos')
          .remove(data.map((f) => `${userId}/${f.name}`))
      }
    } catch {}
  }

  beforeAll(async () => {
    admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    const stamp = Date.now()
    const makeUser = async (prefix: string) => {
      const email = `p15-${prefix}-${stamp}@horlo.test`
      const password = `p15-pass-${prefix}-${stamp}`
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (error || !data.user) {
        throw new Error(`createUser ${prefix} failed: ${error?.message}`)
      }
      return { id: data.user.id, email, password }
    }

    userA = await makeUser('a')
    userB = await makeUser('b')

    // Ensure profile_public = true (default from trigger) so auth flow is normal.
    await db
      .update(profileSettings)
      .set({ profilePublic: true })
      .where(inArray(profileSettings.userId, [userA.id, userB.id]))

    const [w1, w2, w3] = await db
      .insert(watches)
      .values([
        {
          userId: userA.id,
          brand: 'TestBrandA1',
          model: 'TestModelA1',
          status: 'owned',
          movement: 'automatic',
        },
        {
          userId: userA.id,
          brand: 'TestBrandA2',
          model: 'TestModelA2',
          status: 'owned',
          movement: 'automatic',
        },
        {
          userId: userB.id,
          brand: 'TestBrandB1',
          model: 'TestModelB1',
          status: 'owned',
          movement: 'automatic',
        },
      ])
      .returning()
    watchA1 = w1.id
    watchA2 = w2.id
    watchB1 = w3.id
  }, 60_000)

  afterAll(async () => {
    if (!userA || !userB) return
    try {
      await cleanupStorage(userA.id)
      await cleanupStorage(userB.id)
    } catch {}
    try {
      await db
        .delete(wearEvents)
        .where(inArray(wearEvents.userId, [userA.id, userB.id]))
      await db
        .delete(watches)
        .where(inArray(watches.userId, [userA.id, userB.id]))
      await db.delete(users).where(inArray(users.id, [userA.id, userB.id]))
    } catch {}
    try {
      await admin.auth.admin.deleteUser(userA.id)
      await admin.auth.admin.deleteUser(userB.id)
    } catch {}
  }, 60_000)

  // ---------- Task 1 — DAL helpers (Tests 4, 5, 6) ----------

  describe('Task 1 DAL — getWornTodayIdsForUser + logWearEventWithPhoto', () => {
    const today = isoToday()
    const yesterday = isoToday(-1)

    it('Test 4: getWornTodayIdsForUser returns set of watch IDs worn today (empty for yesterday)', async () => {
      await db.insert(wearEvents).values([
        { userId: userA.id, watchId: watchA1, wornDate: today },
        { userId: userA.id, watchId: watchA2, wornDate: today },
      ])

      const todaySet = await getWornTodayIdsForUser(userA.id, today)
      expect(todaySet.has(watchA1)).toBe(true)
      expect(todaySet.has(watchA2)).toBe(true)
      expect(todaySet.size).toBe(2)

      const yesterdaySet = await getWornTodayIdsForUser(userA.id, yesterday)
      expect(yesterdaySet.size).toBe(0)

      // Cleanup — remove the seeds so Task 2 tests see a clean slate.
      await db.delete(wearEvents).where(eq(wearEvents.userId, userA.id))
    })

    it('Test 5: logWearEventWithPhoto inserts a row with exactly the supplied fields', async () => {
      // Use a distinct date so we don't collide with Test 6.
      const date = isoToday(-5)
      const id = crypto.randomUUID()
      const photoUrl = `${userA.id}/fixture.jpg`

      await logWearEventWithPhoto({
        id,
        userId: userA.id,
        watchId: watchA1,
        wornDate: date,
        note: 'hello',
        photoUrl,
        visibility: 'followers',
      })

      const [row] = await db
        .select()
        .from(wearEvents)
        .where(eq(wearEvents.id, id))

      expect(row).toBeDefined()
      expect(row.id).toBe(id)
      expect(row.userId).toBe(userA.id)
      expect(row.watchId).toBe(watchA1)
      expect(row.wornDate).toBe(date)
      expect(row.note).toBe('hello')
      expect(row.photoUrl).toBe(photoUrl)
      expect(row.visibility).toBe('followers')

      await db.delete(wearEvents).where(eq(wearEvents.id, id))
    })

    it('Test 6: duplicate-day insert throws PG 23505', async () => {
      const date = isoToday(-10)
      const id1 = crypto.randomUUID()
      const id2 = crypto.randomUUID()

      await logWearEventWithPhoto({
        id: id1,
        userId: userA.id,
        watchId: watchA1,
        wornDate: date,
        note: null,
        photoUrl: null,
        visibility: 'public',
      })

      let caught: unknown = null
      try {
        await logWearEventWithPhoto({
          id: id2,
          userId: userA.id,
          watchId: watchA1,
          wornDate: date,
          note: null,
          photoUrl: null,
          visibility: 'public',
        })
      } catch (err) {
        caught = err
      }

      expect(caught).not.toBeNull()
      expect((caught as { code?: string } | null)?.code).toBe('23505')

      await db.delete(wearEvents).where(eq(wearEvents.userId, userA.id))
    })
  })

  // ---------- Task 2 — Server Actions ----------
  //
  // NOTE (tests 16-26) are intentionally defined AFTER Task 2 ships its Server
  // Action code. We dynamic-import the action module inside each test so that
  // during Task 1 execution (RED → GREEN) this file loads cleanly without the
  // yet-to-exist exports on `@/app/actions/wearEvents`. Once Task 2 appends
  // logWearWithPhoto + getWornTodayIdsForUserAction, these tests activate.

  describe('Task 2 Server Actions — logWearWithPhoto + getWornTodayIdsForUserAction', () => {
    const today = isoToday()

    /**
     * Mock the auth module so `getCurrentUser()` returns the user we want for
     * each test. The session client `list()` probe (A5) is NOT mocked — we
     * want to exercise the real Supabase client path. To do that, we ALSO
     * need the Server Action's `createSupabaseServerClient()` to hit a real
     * server; we stub it to return an authenticated service-role client
     * that has RLS disabled. (The A5 smoke test separately exercises the
     * session-client list path through a directly-authenticated anon client
     * for documentation of the A5 question.)
     */
    async function withMockedAuth(userId: string, fn: () => Promise<void>) {
      // Mock auth + server client for the Server Action module. We use
      // vi.resetModules() + vi.doMock so the Server Action picks up the
      // mocked imports on the NEXT dynamic import below.
      vi.resetModules()
      vi.doMock('@/lib/auth', async () => {
        const actual = await vi.importActual<typeof import('@/lib/auth')>(
          '@/lib/auth'
        )
        return {
          ...actual,
          getCurrentUser: vi.fn(async () => ({ id: userId, email: `${userId}@horlo.test` })),
        }
      })
      // Force the action's Storage client to use the service-role admin so
      // we can run tests without a real cookie-based session. We still
      // exercise the same API surface (.list, .remove).
      vi.doMock('@/lib/supabase/server', () => ({
        createSupabaseServerClient: vi.fn(async () => admin),
      }))
      vi.doMock('next/cache', () => ({
        revalidatePath: vi.fn(),
        revalidateTag: vi.fn(),
      }))

      try {
        await fn()
      } finally {
        vi.doUnmock('@/lib/auth')
        vi.doUnmock('@/lib/supabase/server')
        vi.doUnmock('next/cache')
        vi.resetModules()
      }
    }

    async function loadActions() {
      return await import('@/app/actions/wearEvents')
    }

    async function withAuthFailure(fn: () => Promise<void>) {
      vi.resetModules()
      vi.doMock('@/lib/auth', async () => {
        const actual = await vi.importActual<typeof import('@/lib/auth')>(
          '@/lib/auth'
        )
        return {
          ...actual,
          getCurrentUser: vi.fn(async () => {
            throw new actual.UnauthorizedError()
          }),
        }
      })
      vi.doMock('@/lib/supabase/server', () => ({
        createSupabaseServerClient: vi.fn(async () => admin),
      }))
      vi.doMock('next/cache', () => ({
        revalidatePath: vi.fn(),
        revalidateTag: vi.fn(),
      }))
      try {
        await fn()
      } finally {
        vi.doUnmock('@/lib/auth')
        vi.doUnmock('@/lib/supabase/server')
        vi.doUnmock('next/cache')
        vi.resetModules()
      }
    }

    // ---- Test 25 (A5 smoke — listed FIRST to fail fast if service-role fallback needed) ----

    it('Test 25 (A5 smoke): session-client .list() returns object when it exists', async () => {
      // Sign in as userA directly using the anon client.
      const session = createClient(url, anonKey, { auth: { persistSession: false } })
      const { error: signInError } = await session.auth.signInWithPassword({
        email: userA.email,
        password: userA.password,
      })
      expect(signInError).toBeNull()

      const wearEventId = crypto.randomUUID()
      const path = `${userA.id}/${wearEventId}.jpg`
      const up = await session.storage
        .from('wear-photos')
        .upload(path, TINY_JPEG, { contentType: 'image/jpeg', upsert: false })
      expect(up.error).toBeNull()

      const { data: listed, error: listErr } = await session.storage
        .from('wear-photos')
        .list(userA.id, { search: `${wearEventId}.jpg` })
      expect(listErr).toBeNull()
      expect(listed).toBeTruthy()
      expect((listed ?? []).some((f) => f.name === `${wearEventId}.jpg`)).toBe(true)

      // Cleanup.
      await admin.storage.from('wear-photos').remove([path])
    })

    // ---- Tests 16-23, 26 ----

    it('Test 16 (happy no-photo): inserts row, returns wearEventId, no photoUrl', async () => {
      const wearEventId = crypto.randomUUID()
      await withMockedAuth(userA.id, async () => {
        const { logWearWithPhoto } = await loadActions()
        const result = await logWearWithPhoto({
          wearEventId,
          watchId: watchA1,
          note: 'nice',
          visibility: 'public',
          hasPhoto: false,
        })
        expect(result).toEqual({ success: true, data: { wearEventId } })
      })

      const [row] = await db
        .select()
        .from(wearEvents)
        .where(eq(wearEvents.id, wearEventId))
      expect(row).toBeDefined()
      expect(row.photoUrl).toBeNull()
      expect(row.note).toBe('nice')
      expect(row.visibility).toBe('public')

      await db.delete(wearEvents).where(eq(wearEvents.id, wearEventId))
    })

    it('Test 17 (happy with-photo): finds seeded object via list probe, inserts with photoUrl', async () => {
      const wearEventId = crypto.randomUUID()
      const path = `${userA.id}/${wearEventId}.jpg`

      // Seed the Storage object (admin bypasses RLS).
      const up = await admin.storage
        .from('wear-photos')
        .upload(path, TINY_JPEG, { contentType: 'image/jpeg', upsert: false })
      expect(up.error).toBeNull()

      await withMockedAuth(userA.id, async () => {
        const { logWearWithPhoto } = await loadActions()
        const result = await logWearWithPhoto({
          wearEventId,
          watchId: watchA2,
          note: null,
          visibility: 'followers',
          hasPhoto: true,
        })
        expect(result).toEqual({ success: true, data: { wearEventId } })
      })

      const [row] = await db
        .select()
        .from(wearEvents)
        .where(eq(wearEvents.id, wearEventId))
      expect(row).toBeDefined()
      expect(row.photoUrl).toBe(path)
      expect(row.visibility).toBe('followers')

      await db.delete(wearEvents).where(eq(wearEvents.id, wearEventId))
      await admin.storage.from('wear-photos').remove([path])
    })

    it('Test 18 (client lies about hasPhoto — no file): rejected, no row, no activity', async () => {
      const wearEventId = crypto.randomUUID()
      // Do NOT seed a Storage object.

      await withMockedAuth(userA.id, async () => {
        const { logWearWithPhoto } = await loadActions()
        const result = await logWearWithPhoto({
          wearEventId,
          watchId: watchA1,
          note: null,
          visibility: 'public',
          hasPhoto: true,
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBe('Photo upload failed — please try again')
        }
      })

      const rows = await db
        .select()
        .from(wearEvents)
        .where(eq(wearEvents.id, wearEventId))
      expect(rows).toHaveLength(0)
    })

    it('Test 19 (duplicate-day with photo): 23505 caught, orphan Storage removed', async () => {
      const date = today
      const firstEventId = crypto.randomUUID()
      const orphanEventId = crypto.randomUUID()

      // Seed first wear (manually, so the duplicate-day constraint is already
      // primed before the Server Action fires).
      await db.insert(wearEvents).values({
        id: firstEventId,
        userId: userA.id,
        watchId: watchA1,
        wornDate: date,
        visibility: 'public',
      })

      // Seed a fresh orphan Storage object.
      const orphanPath = `${userA.id}/${orphanEventId}.jpg`
      const up = await admin.storage
        .from('wear-photos')
        .upload(orphanPath, TINY_JPEG, { contentType: 'image/jpeg', upsert: false })
      expect(up.error).toBeNull()

      await withMockedAuth(userA.id, async () => {
        const { logWearWithPhoto } = await loadActions()
        const result = await logWearWithPhoto({
          wearEventId: orphanEventId,
          watchId: watchA1,
          note: null,
          visibility: 'public',
          hasPhoto: true,
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBe('Already logged this watch today')
        }
      })

      // Orphan was cleaned up.
      const { data: remaining } = await admin.storage
        .from('wear-photos')
        .list(userA.id, { search: `${orphanEventId}.jpg` })
      expect((remaining ?? []).some((f) => f.name === `${orphanEventId}.jpg`)).toBe(false)

      await db.delete(wearEvents).where(eq(wearEvents.id, firstEventId))
    })

    it('Test 20 (duplicate-day no photo): 23505 caught, returns duplicate error', async () => {
      const date = isoToday(-2)
      const firstEventId = crypto.randomUUID()
      const secondEventId = crypto.randomUUID()

      await db.insert(wearEvents).values({
        id: firstEventId,
        userId: userA.id,
        watchId: watchA2,
        wornDate: date,
        visibility: 'public',
      })

      await withMockedAuth(userA.id, async () => {
        const { logWearWithPhoto } = await loadActions()
        // Stub today() so the Server Action uses `date` instead of the
        // current day. The Server Action computes `today` via
        // `new Date().toISOString().split('T')[0]`, so we need to pin the
        // Date constructor for this one call. Use vi.useFakeTimers.
        vi.useFakeTimers()
        vi.setSystemTime(new Date(`${date}T12:00:00Z`))
        try {
          const result = await logWearWithPhoto({
            wearEventId: secondEventId,
            watchId: watchA2,
            note: null,
            visibility: 'public',
            hasPhoto: false,
          })
          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error).toBe('Already logged this watch today')
          }
        } finally {
          vi.useRealTimers()
        }
      })

      await db.delete(wearEvents).where(eq(wearEvents.id, firstEventId))
    })

    it('Test 21 (unauthorized): returns Not authenticated', async () => {
      await withAuthFailure(async () => {
        const { logWearWithPhoto } = await loadActions()
        const result = await logWearWithPhoto({
          wearEventId: crypto.randomUUID(),
          watchId: watchA1,
          note: null,
          visibility: 'public',
          hasPhoto: false,
        })
        expect(result).toEqual({ success: false, error: 'Not authenticated' })
      })
    })

    it('Test 22 (cross-user watch): returns Watch not found (IDOR defense)', async () => {
      const wearEventId = crypto.randomUUID()
      await withMockedAuth(userA.id, async () => {
        const { logWearWithPhoto } = await loadActions()
        const result = await logWearWithPhoto({
          wearEventId,
          watchId: watchB1, // watch owned by userB
          note: null,
          visibility: 'public',
          hasPhoto: false,
        })
        expect(result).toEqual({ success: false, error: 'Watch not found' })
      })
    })

    it('Test 23 (zod validation): non-UUID wearEventId returns Invalid input', async () => {
      await withMockedAuth(userA.id, async () => {
        const { logWearWithPhoto } = await loadActions()
        const result = await logWearWithPhoto({
          wearEventId: 'not-a-uuid',
          watchId: watchA1,
          note: null,
          visibility: 'public',
          hasPhoto: false,
        })
        expect(result).toEqual({ success: false, error: 'Invalid input' })
      })
    })

    it('Test 24 (preflight self): returns array of own worn watch IDs', async () => {
      const date = isoToday(-3)
      await db.insert(wearEvents).values({
        userId: userA.id,
        watchId: watchA1,
        wornDate: date,
        visibility: 'public',
      })

      await withMockedAuth(userA.id, async () => {
        const { getWornTodayIdsForUserAction } = await loadActions()
        const ids = await getWornTodayIdsForUserAction({ userId: userA.id, today: date })
        expect(ids).toContain(watchA1)
      })

      await db.delete(wearEvents).where(eq(wearEvents.userId, userA.id))
    })

    it('Test 24b (preflight cross-user defense): returns empty array', async () => {
      const date = isoToday(-4)
      await db.insert(wearEvents).values({
        userId: userB.id,
        watchId: watchB1,
        wornDate: date,
        visibility: 'public',
      })

      await withMockedAuth(userA.id, async () => {
        const { getWornTodayIdsForUserAction } = await loadActions()
        const ids = await getWornTodayIdsForUserAction({ userId: userB.id, today: date })
        expect(ids).toEqual([])
      })

      await db.delete(wearEvents).where(eq(wearEvents.userId, userB.id))
    })

    it('Test 24c (preflight bad input): zod rejects → empty array', async () => {
      await withMockedAuth(userA.id, async () => {
        const { getWornTodayIdsForUserAction } = await loadActions()
        const ids = await getWornTodayIdsForUserAction({
          userId: 'not-a-uuid',
          today: 'not-a-date',
        })
        expect(ids).toEqual([])
      })
    })

    it('Test 26 (non-23505 insert failure with hasPhoto): orphan Storage cleanup still fires', async () => {
      const wearEventId = crypto.randomUUID()
      const path = `${userA.id}/${wearEventId}.jpg`

      // Seed the Storage object so the list-probe succeeds.
      const up = await admin.storage
        .from('wear-photos')
        .upload(path, TINY_JPEG, { contentType: 'image/jpeg', upsert: false })
      expect(up.error).toBeNull()

      // Mock the DAL's logWearEventWithPhoto to throw a non-23505 error.
      vi.resetModules()
      vi.doMock('@/lib/auth', async () => {
        const actual = await vi.importActual<typeof import('@/lib/auth')>(
          '@/lib/auth'
        )
        return {
          ...actual,
          getCurrentUser: vi.fn(async () => ({ id: userA.id, email: userA.email })),
        }
      })
      vi.doMock('@/lib/supabase/server', () => ({
        createSupabaseServerClient: vi.fn(async () => admin),
      }))
      vi.doMock('next/cache', () => ({
        revalidatePath: vi.fn(),
        revalidateTag: vi.fn(),
      }))
      vi.doMock('@/data/wearEvents', async () => {
        const actual = await vi.importActual<typeof import('@/data/wearEvents')>(
          '@/data/wearEvents'
        )
        return {
          ...actual,
          logWearEventWithPhoto: vi.fn(async () => {
            const err: Error & { code?: string } = new Error('simulated RLS deny')
            err.code = '42501'
            throw err
          }),
        }
      })

      try {
        const actions = await import('@/app/actions/wearEvents')
        const result = await actions.logWearWithPhoto({
          wearEventId,
          watchId: watchA1,
          note: null,
          visibility: 'public',
          hasPhoto: true,
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBe('Could not log that wear. Please try again.')
        }
      } finally {
        vi.doUnmock('@/lib/auth')
        vi.doUnmock('@/lib/supabase/server')
        vi.doUnmock('next/cache')
        vi.doUnmock('@/data/wearEvents')
        vi.resetModules()
      }

      // Orphan cleanup fired — object should be gone.
      const { data: remaining } = await admin.storage
        .from('wear-photos')
        .list(userA.id, { search: `${wearEventId}.jpg` })
      expect((remaining ?? []).some((f) => f.name === `${wearEventId}.jpg`)).toBe(false)
    })
  })
})
