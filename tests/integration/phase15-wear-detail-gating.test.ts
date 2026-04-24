/**
 * Phase 15 Plan 04 — /wear/[wearEventId] three-tier privacy gate (DAL layer).
 *
 * 9-cell matrix (3 visibility × 3 viewer relations) + 4 edge cases = 13 tests.
 *
 * Viewer relations:  owner (G-5 self bypass) | follower | stranger
 * Visibility tiers:  public | followers | private
 *
 * Edge cells:
 *   - non-existent wearEventId → null (uniform with denied)
 *   - stranger viewing public wear by profile_public=false actor → null (G-4)
 *   - unauthenticated viewer (viewerId=null) / public wear → visible
 *   - unauthenticated viewer / followers wear → null (no follow for null viewer)
 *
 * Privacy-first ordering rule (v2.0 retrospective): negative cells run BEFORE
 * positive cells so an inverted G-3 (follow direction flipped) fails fast.
 *
 * Suite skips cleanly when DATABASE_URL is unset — mirrors home-privacy.test.ts.
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
  wearEvents,
} from '@/db/schema'
import { getWearEventByIdForViewer } from '@/data/wearEvents'

// Gate the suite on DB availability. Matches the pattern used by
// tests/integration/home-privacy.test.ts + phase12-visibility-matrix.test.ts.
const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 15 wear detail gating', () => {
  // Fixed UUIDs so afterAll cleanup is deterministic.
  const ids = {
    A:  '00000000-0000-0000-0000-0000000015a0', // owner, profile_public=true (cells 1-9)
    Ap: '00000000-0000-0000-0000-0000000015a1', // owner, profile_public=FALSE (cell 11)
    F:  '00000000-0000-0000-0000-0000000015a2', // follower of A
    S:  '00000000-0000-0000-0000-0000000015a3', // stranger (follows neither)
  } as const
  const allIds = Object.values(ids) as string[]

  // wearIds populated in beforeAll.
  const wearIds: Record<string, string> = {}

  async function cleanup() {
    await db.delete(wearEvents).where(inArray(wearEvents.userId, allIds))
    await db.delete(watches).where(inArray(watches.userId, allIds))
    await db.delete(follows).where(inArray(follows.followerId, allIds))
    await db.delete(follows).where(inArray(follows.followingId, allIds))
    await db.delete(profileSettings).where(inArray(profileSettings.userId, allIds))
    await db.delete(profiles).where(inArray(profiles.id, allIds))
    await db.delete(users).where(inArray(users.id, allIds))
  }

  beforeAll(async () => {
    await cleanup()

    // Insert users (trigger auto-creates profile + profile_settings).
    await db.insert(users).values(
      Object.entries(ids).map(([k, id]) => ({
        id,
        email: `${k.toLowerCase()}-p15-${Date.now()}@horlo.test`,
      })),
    )

    const stamp = Date.now().toString(36)
    for (const [k, id] of Object.entries(ids)) {
      await db
        .update(profiles)
        .set({
          username: `p15_${k.toLowerCase()}_${stamp}`,
          displayName: k,
        })
        .where(eq(profiles.id, id))
    }

    // Ap has profile_public=false (G-4 outer gate exerciser); A/F/S default true.
    await db
      .update(profileSettings)
      .set({ profilePublic: false })
      .where(eq(profileSettings.userId, ids.Ap))

    // Follow graph: F → A only. S follows no one. No one follows Ap.
    await db
      .insert(follows)
      .values([{ followerId: ids.F, followingId: ids.A }])

    // One watch per actor (A + Ap — F/S do not post wears here).
    const watchRows = await db
      .insert(watches)
      .values([
        {
          userId: ids.A,
          brand: 'Brand-A',
          model: 'Model-A',
          status: 'owned' as const,
          movement: 'automatic' as const,
        },
        {
          userId: ids.Ap,
          brand: 'Brand-Ap',
          model: 'Model-Ap',
          status: 'owned' as const,
          movement: 'automatic' as const,
        },
      ])
      .returning()
    const watchByUser = new Map(watchRows.map((w) => [w.userId, w]))

    // Wear events at each visibility tier by A (for cells 1–9) + one public
    // wear by Ap (for cell 11 G-4 outer gate). A seeds three wears, each on
    // a different worn_date so the UNIQUE (user_id, watch_id, worn_date) is
    // not violated — the predicate under test is visibility/follow, not date.
    const today = new Date()
    const d0 = today.toISOString().slice(0, 10)
    const d1 = new Date(today.getTime() - 1 * 86_400_000).toISOString().slice(0, 10)
    const d2 = new Date(today.getTime() - 2 * 86_400_000).toISOString().slice(0, 10)

    const wearInserts = await db
      .insert(wearEvents)
      .values([
        {
          userId: ids.A,
          watchId: watchByUser.get(ids.A)!.id,
          wornDate: d0,
          visibility: 'public' as const,
        },
        {
          userId: ids.A,
          watchId: watchByUser.get(ids.A)!.id,
          wornDate: d1,
          visibility: 'followers' as const,
        },
        {
          userId: ids.A,
          watchId: watchByUser.get(ids.A)!.id,
          wornDate: d2,
          visibility: 'private' as const,
        },
        {
          userId: ids.Ap,
          watchId: watchByUser.get(ids.Ap)!.id,
          wornDate: d0,
          visibility: 'public' as const,
        },
      ])
      .returning()

    for (const w of wearInserts) {
      if (w.userId === ids.A && w.visibility === 'public') wearIds.aPublic = w.id
      if (w.userId === ids.A && w.visibility === 'followers') wearIds.aFollowers = w.id
      if (w.userId === ids.A && w.visibility === 'private') wearIds.aPrivate = w.id
      if (w.userId === ids.Ap) wearIds.apPublic = w.id
    }
  }, 30_000)

  afterAll(async () => {
    await cleanup()
  }, 30_000)

  // ===========================================================================
  // NEGATIVE CELLS FIRST — catches inverted G-3 / missing G-4 / missing gate
  // ===========================================================================

  it('Cell 6: follower CANNOT see private wear → null', async () => {
    const result = await getWearEventByIdForViewer(ids.F, wearIds.aPrivate)
    expect(result).toBeNull()
  })

  it('Cell 8: stranger CANNOT see followers wear → null', async () => {
    const result = await getWearEventByIdForViewer(ids.S, wearIds.aFollowers)
    expect(result).toBeNull()
  })

  it('Cell 9: stranger CANNOT see private wear → null', async () => {
    const result = await getWearEventByIdForViewer(ids.S, wearIds.aPrivate)
    expect(result).toBeNull()
  })

  it('Cell 10: non-existent wearEventId → null (uniform with denied)', async () => {
    // All-zero UUID does not exist in wear_events; same null contract as denied
    // so the page.tsx notFound() path is INDISTINGUISHABLE between the two.
    const result = await getWearEventByIdForViewer(
      ids.A,
      '00000000-0000-0000-0000-000000000000',
    )
    expect(result).toBeNull()
  })

  it('Cell 11: stranger CANNOT see public wear by profile_public=false actor → null (G-4)', async () => {
    // Ap.profile_public = false; wear visibility='public' — must STILL be null
    // for any non-owner viewer. If the G-4 outer gate is skipped, a tier
    // regression would let strangers past the profile lockdown.
    const result = await getWearEventByIdForViewer(ids.S, wearIds.apPublic)
    expect(result).toBeNull()
  })

  it('Cell 13: unauthenticated viewer (null) CANNOT see followers wear → null', async () => {
    // No follow relationship can exist for a null viewer; must short-circuit
    // to null rather than running a nonsense follower query.
    const result = await getWearEventByIdForViewer(null, wearIds.aFollowers)
    expect(result).toBeNull()
  })

  // ===========================================================================
  // POSITIVE CELLS — owner + permitted viewers + edge public case
  // ===========================================================================

  it('Cell 1: owner sees own public wear', async () => {
    const result = await getWearEventByIdForViewer(ids.A, wearIds.aPublic)
    expect(result).toMatchObject({
      id: wearIds.aPublic,
      userId: ids.A,
      visibility: 'public',
      brand: 'Brand-A',
      model: 'Model-A',
    })
  })

  it('Cell 2: owner sees own followers wear (G-5 self bypass)', async () => {
    const result = await getWearEventByIdForViewer(ids.A, wearIds.aFollowers)
    expect(result).toMatchObject({
      id: wearIds.aFollowers,
      userId: ids.A,
      visibility: 'followers',
    })
  })

  it('Cell 3: owner sees own private wear (G-5 self bypass)', async () => {
    const result = await getWearEventByIdForViewer(ids.A, wearIds.aPrivate)
    expect(result).toMatchObject({
      id: wearIds.aPrivate,
      userId: ids.A,
      visibility: 'private',
    })
  })

  it('Cell 4: follower sees public wear', async () => {
    const result = await getWearEventByIdForViewer(ids.F, wearIds.aPublic)
    expect(result).toMatchObject({
      id: wearIds.aPublic,
      visibility: 'public',
    })
  })

  it('Cell 5: follower sees followers wear (F follows A)', async () => {
    const result = await getWearEventByIdForViewer(ids.F, wearIds.aFollowers)
    expect(result).toMatchObject({
      id: wearIds.aFollowers,
      visibility: 'followers',
    })
  })

  it('Cell 7: stranger sees public wear from profile_public=true actor', async () => {
    const result = await getWearEventByIdForViewer(ids.S, wearIds.aPublic)
    expect(result).toMatchObject({
      id: wearIds.aPublic,
      visibility: 'public',
    })
  })

  it('Cell 12: unauthenticated viewer (null) sees public wear on profile_public=true actor', async () => {
    const result = await getWearEventByIdForViewer(null, wearIds.aPublic)
    expect(result).toMatchObject({
      id: wearIds.aPublic,
      visibility: 'public',
    })
  })

  // ===========================================================================
  // Shape contract — the DAL must return the JOINed fields the page needs.
  // Verified once on the owner/public path; other cells assert only on id/
  // visibility since the matrix is about gating, not projection.
  // ===========================================================================

  it('Shape: return includes username, displayName, avatarUrl, brand, model, watchImageUrl, and raw photoUrl (NOT signed)', async () => {
    const result = await getWearEventByIdForViewer(ids.A, wearIds.aPublic)
    expect(result).not.toBeNull()
    // Discriminating JOIN fields — the Server Component page depends on these
    // to render hero + metadata without additional round trips.
    expect(result).toHaveProperty('username')
    expect(result).toHaveProperty('displayName')
    expect(result).toHaveProperty('avatarUrl')
    expect(result).toHaveProperty('brand')
    expect(result).toHaveProperty('model')
    expect(result).toHaveProperty('watchImageUrl')
    expect(result!.brand).toBe('Brand-A')
    expect(result!.model).toBe('Model-A')
    // photoUrl must be the raw Storage path (null here since the fixture did
    // not upload anything) — NEVER a signed URL. Pitfall F-2: signed URLs are
    // minted per-request in the page.tsx Server Component, never in the DAL.
    expect(typeof result!.photoUrl === 'string' || result!.photoUrl === null).toBe(true)
  })
})
