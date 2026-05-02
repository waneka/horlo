/**
 * Phase 12 Plan 01 — Three-tier visibility matrix integration tests.
 *
 * Privacy-first UAT rule (v2.0 retrospective): these tests are authored BEFORE
 * any DAL function is touched. All test cells that exercise getWearEventsForViewer
 * will fail until Plan 02 introduces the new function name. This is the desired
 * red state — the failing tests are the load-bearing artifact.
 *
 * Matrix: 3 visibility tiers (public / followers / private)
 *       × 3 viewer relationships (owner / follower / stranger)
 *       × surfaces (profile worn tab, WYWT rail, feed, wishlist action)
 *
 * Negative cells (stranger/non-follower cannot see followers/private wear) run
 * BEFORE positive cells in source order — catches inverted G-3 logic first.
 *
 * Seeded actors:
 *   V  — viewer (the authenticated user making requests)
 *   Op — owner with public wear;     V follows Op
 *   Of — owner with followers wear;  V follows Of
 *   Or — owner with private wear;    V follows Or
 *   S  — stranger; V does NOT follow S; S does NOT follow V
 *   Pp — profile_public=false, visibility='public' wear; V follows Pp
 *
 * G-3 directional check also seeds a visibility='followers' wear for V itself
 * (wearIds.viewerFollowers) to assert that Of viewing V's profile does NOT
 * surface that wear (Of does not follow V).
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
// NOTE: getWearEventsForViewer does not yet exist — this import causes a
// compile/runtime error until Plan 02 introduces the new export. This is
// the structural guarantee that the file is in red state.
import { getWearEventsForViewer, getWearRailForViewer } from '@/data/wearEvents'
import { getFeedForUser } from '@/data/activities'
// addToWishlistFromWearEvent is auth-context dependent; tests using it are
// left with comments noting the auth-context caveat (see below).
import { addToWishlistFromWearEvent } from '@/app/actions/wishlist'

// Gate the entire suite on DB availability.
const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 12 visibility matrix', () => {
  const ids = {
    V:  '00000000-0000-0000-0000-00000000c0a0', // viewer
    Op: '00000000-0000-0000-0000-00000000c0a1', // public wear, V follows
    Of: '00000000-0000-0000-0000-00000000c0a2', // followers wear, V follows
    Or: '00000000-0000-0000-0000-00000000c0a3', // private wear, V follows
    S:  '00000000-0000-0000-0000-00000000c0a4', // stranger; no follow either way
    Pp: '00000000-0000-0000-0000-00000000c0a5', // profile_public=false, visibility='public' wear; V follows
  } as const
  const allIds = Object.values(ids) as string[]

  // wearEventIds populated in beforeAll for use in test assertions and the
  // wishlist action calls.
  const wearIds: Record<string, string> = {}

  async function cleanup() {
    await db.delete(activities).where(inArray(activities.userId, allIds))
    await db.delete(wearEvents).where(inArray(wearEvents.userId, allIds))
    await db.delete(watches).where(inArray(watches.userId, allIds))
    await db.delete(follows).where(inArray(follows.followerId, allIds))
    await db.delete(follows).where(inArray(follows.followingId, allIds))
    await db.delete(profileSettings).where(inArray(profileSettings.userId, allIds))
    await db.delete(profiles).where(inArray(profiles.id, allIds))
    await db.delete(users).where(inArray(users.id, allIds))
  }

  beforeAll(async () => {
    // Defensive pre-clean in case a prior aborted run left residue.
    await cleanup()

    // Insert users — Phase 7 trigger auto-creates profile + profileSettings rows.
    await db.insert(users).values(
      Object.entries(ids).map(([k, id]) => ({
        id, email: `${k.toLowerCase()}-p12-${Date.now()}@horlo.test`,
      })),
    )

    // Overwrite trigger-generated usernames with deterministic test IDs.
    const stamp = Date.now().toString(36)
    for (const [k, id] of Object.entries(ids)) {
      await db.update(profiles).set({
        username: `p12_${k.toLowerCase()}_${stamp}`, displayName: k,
      }).where(eq(profiles.id, id))
    }

    // Settings — Pp has profile_public=false; everyone else true.
    // The wear_events.visibility column is the sole per-row gate after Phase 12.
    await db.update(profileSettings).set({
      profilePublic: false, collectionPublic: true, wishlistPublic: true,
    }).where(eq(profileSettings.userId, ids.Pp))

    // Follow graph: V → Op, Of, Or, Pp. Stranger S has no follows.
    // NOTE: Of does NOT follow V (used in G-3 directional check below).
    await db.insert(follows).values([
      { followerId: ids.V, followingId: ids.Op },
      { followerId: ids.V, followingId: ids.Of },
      { followerId: ids.V, followingId: ids.Or },
      { followerId: ids.V, followingId: ids.Pp },
    ])

    // One watch per actor.
    const watchRows = await db.insert(watches).values(
      Object.entries(ids).map(([k, id]) => ({
        userId: id, brand: `Brand-${k}`, model: `Model-${k}`,
        status: 'owned' as const, movement: 'automatic' as const,
      })),
    ).returning()
    const watchByUser = new Map(watchRows.map((w) => [w.userId, w]))

    const today = new Date().toISOString().slice(0, 10)

    // Wear events at each visibility tier.
    const wearInserts = await db.insert(wearEvents).values([
      { userId: ids.Op, watchId: watchByUser.get(ids.Op)!.id, wornDate: today, visibility: 'public' as const },
      { userId: ids.Of, watchId: watchByUser.get(ids.Of)!.id, wornDate: today, visibility: 'followers' as const },
      { userId: ids.Or, watchId: watchByUser.get(ids.Or)!.id, wornDate: today, visibility: 'private' as const },
      { userId: ids.Pp, watchId: watchByUser.get(ids.Pp)!.id, wornDate: today, visibility: 'public' as const },
      // V seeds a followers-only wear (used by G-3 directional check:
      // Of viewing V's profile must NOT see this wear because Of does not follow V).
      { userId: ids.V,  watchId: watchByUser.get(ids.V)!.id,  wornDate: today, visibility: 'followers' as const },
    ]).returning()

    for (const w of wearInserts) {
      if (w.userId === ids.Op) wearIds.public = w.id
      if (w.userId === ids.Of) wearIds.followers = w.id
      if (w.userId === ids.Or) wearIds.private = w.id
      if (w.userId === ids.Pp) wearIds.publicPrivateProfile = w.id
      if (w.userId === ids.V)  wearIds.viewerFollowers = w.id
    }

    // Activities for the feed gate test. Op + Of + Or each get a watch_worn
    // row carrying the matching visibility key in metadata (D-10 pattern).
    // Plus one LEGACY row for Op (a second watch_worn) with NO visibility key
    // — this row must fail-closed and NOT appear in V's feed (D-09 rule).
    await db.insert(activities).values([
      { userId: ids.Op, type: 'watch_worn', watchId: watchByUser.get(ids.Op)!.id,
        metadata: { brand: 'Brand-Op', model: 'Model-Op', imageUrl: null, visibility: 'public' } },
      { userId: ids.Of, type: 'watch_worn', watchId: watchByUser.get(ids.Of)!.id,
        metadata: { brand: 'Brand-Of', model: 'Model-Of', imageUrl: null, visibility: 'followers' } },
      { userId: ids.Or, type: 'watch_worn', watchId: watchByUser.get(ids.Or)!.id,
        metadata: { brand: 'Brand-Or', model: 'Model-Or', imageUrl: null, visibility: 'private' } },
      // LEGACY row (no visibility key) — must NOT appear in V's feed (D-09 fail-closed)
      { userId: ids.Op, type: 'watch_worn', watchId: watchByUser.get(ids.Op)!.id,
        metadata: { brand: 'Brand-Op', model: 'Model-Op', imageUrl: null } },
    ])
  }, 30_000)

  afterAll(async () => { await cleanup() }, 30_000)

  // ===========================================================================
  // NEGATIVE CELLS FIRST — privacy-first ordering rule (catches inverted G-3)
  // ===========================================================================

  it('G-5 baseline: owner sees own private wear in own profile', async () => {
    const events = await getWearEventsForViewer(ids.Or, ids.Or)
    expect(events.some((e) => e.id === wearIds.private)).toBe(true)
  })

  it('stranger CANNOT see followers wear (G-3 / V-2)', async () => {
    const events = await getWearEventsForViewer(ids.S, ids.Of)
    expect(events.some((e) => e.id === wearIds.followers)).toBe(false)
  })

  it('stranger CANNOT see private wear', async () => {
    const events = await getWearEventsForViewer(ids.S, ids.Or)
    expect(events.some((e) => e.id === wearIds.private)).toBe(false)
  })

  it('follower CANNOT see other actor private wear', async () => {
    const events = await getWearEventsForViewer(ids.V, ids.Or)
    expect(events.some((e) => e.id === wearIds.private)).toBe(false)
  })

  it('G-4 outer gate: visibility=public wear by profile_public=false actor invisible to non-owner', async () => {
    // Even though Pp's wear is visibility='public', Pp.profilePublic=false means
    // no non-owner viewer should see Pp's wears. This is the G-4 outer gate.
    const events = await getWearEventsForViewer(ids.V, ids.Pp)
    expect(events.some((e) => e.id === wearIds.publicPrivateProfile)).toBe(false)
  })

  it('G-3 directional follow check: viewing V profile does not surface V followers wear to non-follower (Of viewing V)', async () => {
    // Of does NOT follow V; V's wear is visibility='followers'.
    // Of must not see it. This confirms follow is read as
    // follower=viewer, following=owner (not flipped).
    const events = await getWearEventsForViewer(ids.Of, ids.V)
    expect(events.some((e) => e.id === wearIds.viewerFollowers)).toBe(false)
  })

  // ===========================================================================
  // POSITIVE CELLS
  // ===========================================================================

  it('follower CAN see followers wear', async () => {
    const events = await getWearEventsForViewer(ids.V, ids.Of)
    expect(events.some((e) => e.id === wearIds.followers)).toBe(true)
  })

  it('stranger CAN see public wear from profile_public=true actor', async () => {
    const events = await getWearEventsForViewer(ids.S, ids.Op)
    expect(events.some((e) => e.id === wearIds.public)).toBe(true)
  })

  // ===========================================================================
  // WYWT RAIL CELLS
  // ===========================================================================

  it('WYWT rail: follower sees followed actor followers wear', async () => {
    const { tiles } = await getWearRailForViewer(ids.V)
    expect(tiles.some((t) => t.userId === ids.Of)).toBe(true)
  })

  it('WYWT rail: stranger does NOT see followed-by-V followers wear (rail self+followed only)', async () => {
    // S follows nobody, so S's rail should not contain Of's tile even if
    // Of has a visibility='followers' wear; the follow-relationship gate excludes S.
    const { tiles } = await getWearRailForViewer(ids.S)
    expect(tiles.some((t) => t.userId === ids.Of)).toBe(false)
  })

  it('WYWT rail: follower sees followed actor public wear', async () => {
    const { tiles } = await getWearRailForViewer(ids.V)
    expect(tiles.some((t) => t.userId === ids.Op)).toBe(true)
  })

  it('WYWT rail: G-4 outer gate excludes profile_public=false actor', async () => {
    // V follows Pp, Pp has visibility='public' wear, but Pp.profilePublic=false.
    // Pp's tile must NOT appear in V's rail.
    const { tiles } = await getWearRailForViewer(ids.V)
    expect(tiles.some((t) => t.userId === ids.Pp)).toBe(false)
  })

  it('WYWT rail: owner sees own followers wear in own rail (G-5 self-bypass)', async () => {
    // V seeded a followers-only wear; assert it appears in V's own rail.
    const { tiles } = await getWearRailForViewer(ids.V)
    expect(tiles.some((t) => t.userId === ids.V && t.wearEventId === wearIds.viewerFollowers)).toBe(true)
  })

  // ===========================================================================
  // FEED CELLS — metadata->>'visibility' gate (D-09 fail-closed)
  // ===========================================================================

  it('feed: V sees Op watch_worn (public) and Of watch_worn (followers); excludes Or (private)', async () => {
    const { rows } = await getFeedForUser(ids.V, null, 50)
    const wornByUser: Record<string, number> = {}
    for (const r of rows) {
      if (r.kind === 'raw' && r.type === 'watch_worn') {
        wornByUser[r.userId] = (wornByUser[r.userId] ?? 0) + 1
      }
    }
    // Op contributes exactly 1 worn row (the public one — the legacy NULL row is
    // fail-closed per D-09 and must not be admitted)
    expect(wornByUser[ids.Op]).toBe(1)
    expect(wornByUser[ids.Of]).toBe(1)
    // Or's private wear must not appear
    expect(wornByUser[ids.Or]).toBeUndefined()
  })

  it('feed D-09 fail-closed: legacy watch_worn row with no metadata.visibility key is invisible to V', async () => {
    const { rows } = await getFeedForUser(ids.V, null, 50)
    // Op has two watch_worn activities: one with visibility='public' and one
    // without a visibility key. Only the 'public' one must appear — the legacy
    // NULL-visibility row is fail-closed per D-09. Expect exactly 1.
    const opWornRows = rows.filter((r) => r.kind === 'raw' && r.type === 'watch_worn' && r.userId === ids.Op)
    expect(opWornRows).toHaveLength(1)
  })

  it('feed F-05 own-filter preserved: V never sees own activities', async () => {
    const { rows } = await getFeedForUser(ids.V, null, 50)
    expect(rows.every((r) => r.kind !== 'raw' || r.userId !== ids.V)).toBe(true)
  })

  // ===========================================================================
  // WISHLIST ACTION CELLS
  // (These tests require auth-context; addToWishlistFromWearEvent calls
  // getCurrentUser() internally. Without session wiring in vitest, we can only
  // assert that the import resolves. Full wishlist gate coverage is in the
  // manual UAT table in 12-VALIDATION.md. When Plan 04 wires auth-context to
  // tests, these can be un-skipped.)
  // ===========================================================================

  it.skip('addToWishlistFromWearEvent: follower V CAN add followers wear from Of (auth-context required)', async () => {
    // TODO (Plan 04): wire getCurrentUser() mock so this test can assert success.
    // Expected: { success: true, data: { watchId: string } }
    const result = await addToWishlistFromWearEvent({ wearEventId: wearIds.followers })
    expect(result.success).toBe(true)
  })

  it.skip('addToWishlistFromWearEvent: stranger S CANNOT add followers wear from Of (uniform error)', async () => {
    // TODO (Plan 04): wire getCurrentUser() mock to impersonate S.
    // Expected uniform error string (RESEARCH §Open Question #3):
    // { success: false, error: 'Wear event not found' }
    const result = await addToWishlistFromWearEvent({ wearEventId: wearIds.followers })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Wear event not found')
    }
  })

})
