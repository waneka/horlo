/**
 * Phase 10 Plan 09 — End-to-end privacy verification (F-06 + W-01 + S-01).
 *
 * Each test exercises the DAL composition against a seeded local Postgres.
 * Suite skips cleanly when `DATABASE_URL` is unset so CI stays green.
 *
 * Scenario graph (seeded in beforeAll):
 *   - V (viewer)
 *   - A (followed, all public)                     — watch_added + watch_worn
 *   - B (followed, collection_public=false,
 *        worn_public=true)                         — watch_added + watch_worn
 *   - C (followed, profile_public=false — lockdown) — watch_added + watch_worn
 *   - D (NOT followed, all public)                 — watch_added + watch_worn
 *   - E (NOT followed, profile_public=false)       — used only for suggestions exclusion
 *
 * Seeding note: Phase 7's `on_public_user_created` DB trigger auto-creates a
 * profile row + profile_settings row on every public.users insert. Therefore
 * this suite inserts users first, then UPDATEs the trigger-created profile
 * + profile_settings rows to set deterministic usernames and the privacy
 * fields under test. INSERTing profiles directly would collide on the PK.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'

import { db } from '@/db'
import {
  users,
  profiles,
  profileSettings,
  follows,
  watches,
  activities,
  wearEvents,
} from '@/db/schema'
import { getFeedForUser } from '@/data/activities'
import { getWearRailForViewer } from '@/data/wearEvents'
import { getSuggestedCollectors } from '@/data/suggestions'

// Gate the entire suite on DB availability. `DATABASE_URL` is the Drizzle
// connection string; `@/db` throws at import if it's missing.
const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 10 home privacy end-to-end', () => {
  // Fixed UUIDs so afterAll cleanup is deterministic — T-10-09-01 mitigation.
  const ids = {
    V: '00000000-0000-0000-0000-00000000000a',
    A: '00000000-0000-0000-0000-00000000000b',
    B: '00000000-0000-0000-0000-00000000000c',
    C: '00000000-0000-0000-0000-00000000000d',
    D: '00000000-0000-0000-0000-00000000000e',
    E: '00000000-0000-0000-0000-00000000000f',
  } as const

  const allIds = Object.values(ids) as string[]

  async function cleanup() {
    // Order matters: children before parents (FK cascades handle most, but be
    // explicit for activities + wearEvents since they reference watches).
    await db.delete(activities).where(inArray(activities.userId, allIds))
    await db.delete(wearEvents).where(inArray(wearEvents.userId, allIds))
    await db.delete(watches).where(inArray(watches.userId, allIds))
    await db.delete(follows).where(inArray(follows.followerId, allIds))
    await db.delete(follows).where(inArray(follows.followingId, allIds))
    // profile_settings + profiles cascade when users are deleted (FK onDelete:
    // 'cascade' in the schema). Explicit deletes here are belt-and-braces.
    await db.delete(profileSettings).where(inArray(profileSettings.userId, allIds))
    await db.delete(profiles).where(inArray(profiles.id, allIds))
    await db.delete(users).where(inArray(users.id, allIds))
  }

  beforeAll(async () => {
    // Defensive pre-clean in case a prior aborted run left residue.
    await cleanup()

    // Users — inserting a public.users row fires the on_public_user_created
    // trigger which auto-creates profiles + profile_settings rows.
    await db.insert(users).values(
      Object.entries(ids).map(([k, id]) => ({
        id,
        email: `${k.toLowerCase()}-${Date.now()}@horlo.test`,
      })),
    )

    // Overwrite the trigger-generated usernames with deterministic test IDs.
    const stamp = Date.now().toString(36)
    for (const [k, id] of Object.entries(ids)) {
      await db
        .update(profiles)
        .set({
          username: `user_${k.toLowerCase()}_${stamp}`,
          displayName: k,
        })
        .where(eq(profiles.id, id))
    }

    // Overwrite the trigger-generated settings (all true by default) with the
    // per-user privacy mix this suite exercises.
    const privacyByUser: Record<
      string,
      { profilePublic: boolean; collectionPublic: boolean; wishlistPublic: boolean; wornPublic: boolean }
    > = {
      [ids.V]: { profilePublic: true, collectionPublic: true, wishlistPublic: true, wornPublic: true },
      [ids.A]: { profilePublic: true, collectionPublic: true, wishlistPublic: true, wornPublic: true },
      [ids.B]: { profilePublic: true, collectionPublic: false, wishlistPublic: true, wornPublic: true },
      [ids.C]: { profilePublic: false, collectionPublic: true, wishlistPublic: true, wornPublic: true },
      [ids.D]: { profilePublic: true, collectionPublic: true, wishlistPublic: true, wornPublic: true },
      [ids.E]: { profilePublic: false, collectionPublic: true, wishlistPublic: true, wornPublic: true },
    }
    for (const [userId, settings] of Object.entries(privacyByUser)) {
      await db.update(profileSettings).set(settings).where(eq(profileSettings.userId, userId))
    }

    // V follows A, B, C. NOT D, NOT E.
    await db.insert(follows).values([
      { followerId: ids.V, followingId: ids.A },
      { followerId: ids.V, followingId: ids.B },
      { followerId: ids.V, followingId: ids.C },
    ])

    // Seed one watch per user — activities + wear events reference these.
    const watchRows = await db
      .insert(watches)
      .values(
        Object.entries(ids).map(([k, id]) => ({
          userId: id,
          brand: `Brand-${k}`,
          model: `Model-${k}`,
          status: 'owned' as const,
          movement: 'automatic' as const,
        })),
      )
      .returning()
    const watchByUser = new Map(watchRows.map((w) => [w.userId, w]))

    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const halfHourAgo = new Date(now.getTime() - 30 * 60 * 1000)
    const today = now.toISOString().slice(0, 10)

    // Activities — V + A/B/C/D each get 1 watch_added and 1 watch_worn.
    // E has no activity (only used for suggestions exclusion).
    const actorsWithActivity = [ids.V, ids.A, ids.B, ids.C, ids.D]
    const actRows = actorsWithActivity.flatMap((uid) => {
      const w = watchByUser.get(uid)!
      const metadata = { brand: w.brand, model: w.model, imageUrl: null }
      return [
        {
          userId: uid,
          type: 'watch_added' as const,
          watchId: w.id,
          metadata,
          createdAt: oneHourAgo,
        },
        {
          userId: uid,
          type: 'watch_worn' as const,
          watchId: w.id,
          metadata,
          createdAt: halfHourAgo,
        },
      ]
    })
    await db.insert(activities).values(actRows)

    // Wear events — V + A/B/C/D get today's wear (for WYWT rail).
    await db.insert(wearEvents).values(
      actorsWithActivity.map((uid) => {
        const w = watchByUser.get(uid)!
        return { userId: uid, watchId: w.id, wornDate: today }
      }),
    )
  }, 30_000)

  afterAll(async () => {
    await cleanup()
  }, 30_000)

  it('feed includes A both events + B watch_worn; excludes B watch_added (collection_public=false) and all C (profile_public=false) (F-06)', async () => {
    const { rows } = await getFeedForUser(ids.V, null, 50)
    const byUser: Record<string, string[]> = {}
    for (const r of rows) {
      if (r.kind !== 'raw') continue
      ;(byUser[r.userId] ??= []).push(r.type)
    }
    expect(byUser[ids.A]?.sort()).toEqual(['watch_added', 'watch_worn'])
    expect(byUser[ids.B]).toEqual(['watch_worn'])
    expect(byUser[ids.C]).toBeUndefined()
  })

  it('feed excludes non-followed user D (follow-gate)', async () => {
    const { rows } = await getFeedForUser(ids.V, null, 50)
    expect(rows.every((r) => r.kind !== 'raw' || r.userId !== ids.D)).toBe(true)
  })

  it("feed excludes viewer's own activities (F-05)", async () => {
    const { rows } = await getFeedForUser(ids.V, null, 50)
    expect(rows.every((r) => r.kind !== 'raw' || r.userId !== ids.V)).toBe(true)
  })

  it('WYWT rail includes V + A + B; excludes C (profile_public=false) and D (not followed) (W-01)', async () => {
    const { tiles } = await getWearRailForViewer(ids.V)
    const userIds = tiles.map((t) => t.userId)
    expect(userIds).toContain(ids.V)
    expect(userIds).toContain(ids.A)
    expect(userIds).toContain(ids.B)
    expect(userIds).not.toContain(ids.C)
    expect(userIds).not.toContain(ids.D)
    expect(userIds).not.toContain(ids.E)
  })

  it('Suggested Collectors includes D; excludes E (private), A/B/C (already followed), and V (self) (S-01)', async () => {
    // Destructure the SuggestionPage — never treat the return as a raw array.
    // Pins the test to the Plan 04 signature and catches future signature drift.
    const { collectors } = await getSuggestedCollectors(ids.V, { limit: 20 })
    const userIds = collectors.map((s) => s.userId)
    expect(userIds).toContain(ids.D)
    expect(userIds).not.toContain(ids.E)
    expect(userIds).not.toContain(ids.A)
    expect(userIds).not.toContain(ids.B)
    expect(userIds).not.toContain(ids.C)
    expect(userIds).not.toContain(ids.V)
  })
})
