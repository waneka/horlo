/**
 * Phase 19 Plan 01 Task 4 — Live-DB integration: two-layer privacy + self-
 * exclusion lock for searchCollections (SRCH-12 / Pitfall 6).
 *
 * Seeds 4 profiles in the local Postgres (Profile A public+public, B public+
 * private collection, C private+public, V the viewer) all with one watch
 * matching `Speedmaster-${TAG}`. Asserts that searchCollections returns
 * EXACTLY 1 row whose userId === Profile A.
 *
 * Pitfall 6 regression lock: removing the `collection_public = true` clause
 * from the DAL would surface Profile B in the results, breaking this test.
 *
 * Suite skips cleanly when DATABASE_URL is unset so CI stays green.
 *
 * Seeding note: Phase 7's `on_public_user_created` DB trigger auto-creates
 * profile + profile_settings rows on every public.users insert. Therefore
 * this suite inserts users first, then UPDATEs the trigger-created rows to
 * set deterministic usernames and the privacy fields under test (mirrors
 * tests/integration/home-privacy.test.ts pattern).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'

import { db } from '@/db'
import { users, profiles, profileSettings, watches } from '@/db/schema'
import { searchCollections } from '@/data/search'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 19 Collections two-layer privacy + self-exclusion (SRCH-12)', () => {
  // Fixed UUIDs so afterAll cleanup is deterministic.
  const ids = {
    V: '00000000-0000-0000-0000-000000019aa1',
    A: '00000000-0000-0000-0000-000000019aa2',
    B: '00000000-0000-0000-0000-000000019aa3',
    C: '00000000-0000-0000-0000-000000019aa4',
  } as const

  const allIds = Object.values(ids) as string[]
  const TAG = `phase19-priv-${Date.now()}`
  const MATCH_MODEL = `Speedmaster-${TAG}`

  async function cleanup() {
    await db.delete(watches).where(inArray(watches.userId, allIds))
    await db.delete(profileSettings).where(inArray(profileSettings.userId, allIds))
    await db.delete(profiles).where(inArray(profiles.id, allIds))
    await db.delete(users).where(inArray(users.id, allIds))
  }

  beforeAll(async () => {
    // Defensive pre-clean.
    await cleanup()

    // 1. Insert users (trigger auto-creates profile + profile_settings rows).
    const stamp = Date.now().toString(36)
    await db.insert(users).values(
      Object.entries(ids).map(([k, id]) => ({
        id,
        email: `phase19-priv-${k.toLowerCase()}-${stamp}@horlo.test`,
      })),
    )

    // 2. Overwrite trigger-generated usernames with deterministic test IDs.
    for (const [k, id] of Object.entries(ids)) {
      await db
        .update(profiles)
        .set({
          username: `phase19_priv_${k.toLowerCase()}_${stamp}`,
          displayName: k,
        })
        .where(eq(profiles.id, id))
    }

    // 3. Privacy mix:
    //    V (viewer):       public + public  — must be excluded as self
    //    A (valid match):  public + public  — MUST appear in results
    //    B (private coll): public + private — MUST be excluded (Pitfall 6)
    //    C (private prof): private + public — MUST be excluded
    const privacy: Record<string, { profilePublic: boolean; collectionPublic: boolean }> = {
      [ids.V]: { profilePublic: true, collectionPublic: true },
      [ids.A]: { profilePublic: true, collectionPublic: true },
      [ids.B]: { profilePublic: true, collectionPublic: false },
      [ids.C]: { profilePublic: false, collectionPublic: true },
    }
    for (const [userId, settings] of Object.entries(privacy)) {
      await db.update(profileSettings).set(settings).where(eq(profileSettings.userId, userId))
    }

    // 4. Seed one matching Speedmaster watch per user (model contains TAG).
    await db.insert(watches).values(
      Object.values(ids).map((id) => ({
        userId: id,
        brand: 'Omega',
        model: MATCH_MODEL,
        status: 'owned' as const,
        movement: 'manual' as const,
      })),
    )
  }, 60_000)

  afterAll(async () => {
    await cleanup()
  }, 60_000)

  it('returns exactly Profile A: excludes B (collection_public=false), C (profile_public=false), and viewer self', async () => {
    const results = await searchCollections({
      q: MATCH_MODEL,
      viewerId: ids.V,
    })
    expect(results.length).toBe(1)
    expect(results[0].userId).toBe(ids.A)
  })
})
