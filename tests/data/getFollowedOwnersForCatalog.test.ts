/**
 * Phase 65 Plan 01 Task 2 — Integration tests for getFollowedOwnersForCatalog.
 *
 * Covers FOLL-02 (one-way viewer→owner follow direction; NOT mutual, NOT
 * reversed) + FOLL-04 (single-query, no-N+1, privacy-respecting read path).
 *
 * Mirrors tests/data/getCollectorsForCatalog.test.ts per Phase 65 D-12:
 *
 *   1. D-05 layer 1 (mirrors T-39b-01 layer 1) — profilePublic = false → excluded.
 *   2. D-05 layer 2 (mirrors T-39b-01 layer 2 / D-39b-09) — collectionPublic =
 *      false → excluded. LOAD-BEARING: a follow does NOT override this gate.
 *   3. D-05a (mirrors T-39b-04) — viewer self → excluded.
 *   4. D-05b (mirrors A1 / Q1 RECOMMEND) — watches.status = 'sold' → excluded.
 *   5. D-08 (mirrors D-39b-10) — ORDER BY watches.created_at DESC.
 *   6. Pitfall 3 — JS-side dedup: multi-row-per-user (owned + wishlist on the
 *      same catalog) collapses to one chip; totalCount = count(DISTINCT).
 *   7. D-07 / FOLL-02 / Pitfall 1 — viewer does NOT follow owner → excluded.
 *      Proves the follow-direction join filters; not a "broad-roster" function.
 *   8. D-07 / FOLL-02 / Pitfall 1 — viewer follows owner one-way (NOT mutual) →
 *      owner INCLUDED. Proves the join is one-way, NOT mutual-only.
 *
 * Gating mirrors the canonical pattern (Phase 17 / Phase 16 / Phase 18 Plan 01
 * Task 2 / Phase 39b Plan 04 Task 1) — hasDrizzle && hasSupabaseAdmin. Tests
 * skip silently when env is absent; Phase 36 STATE memory documents the
 * `set -a; source .env.local; set +a; npx vitest run …` workaround required
 * to load .env.local.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const hasDrizzle = Boolean(process.env.DATABASE_URL)
const hasSupabaseAdmin =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const maybe = hasDrizzle && hasSupabaseAdmin ? describe : describe.skip

maybe('getFollowedOwnersForCatalog — DAL integration', () => {
  type DalT = typeof import('@/data/follows')
  type SchemaT = typeof import('@/db/schema')
  type DbT = typeof import('@/db')

  let dal: DalT
  let schema: SchemaT
  let dbModule: DbT

  let viewer: { id: string; email: string }
  let alice: { id: string; email: string }
  let bob: { id: string; email: string }
  let carol: { id: string; email: string }
  let privateProfile: { id: string; email: string }
  let privateCollection: { id: string; email: string }
  const extras: Array<{ id: string; email: string }> = []
  // Track seeded catalog rows so afterAll can wipe them cleanly.
  const seededCatalogIds: string[] = []
  let cleanup: () => Promise<void>

  const seedProfile = async (
    u: { id: string; email: string },
    username: string,
    opts: Partial<{ profilePublic: boolean; collectionPublic: boolean }> = {},
  ) => {
    await dbModule.db
      .insert(schema.users)
      .values({ id: u.id, email: u.email })
      .onConflictDoNothing()
    await dbModule.db
      .insert(schema.profiles)
      .values({ id: u.id, username })
      .onConflictDoNothing()
    await dbModule.db
      .insert(schema.profileSettings)
      .values({
        userId: u.id,
        profilePublic: opts.profilePublic ?? true,
        collectionPublic: opts.collectionPublic ?? true,
        wishlistPublic: true,
      })
      .onConflictDoNothing()
  }

  /**
   * Insert a fresh watches_catalog row, return its uuid. Each test typically
   * gets its own catalog row so privacy assertions don't interfere with one
   * another.
   */
  const seedTestCatalogRow = async (label: string): Promise<string> => {
    const stamp = Date.now()
    const inserted = await dbModule.db
      .insert(schema.watchesCatalog)
      .values({
        brand: `TestBrand-${label}-${stamp}`,
        model: `TestModel-${label}-${stamp}`,
      })
      .returning({ id: schema.watchesCatalog.id })
    const id = inserted[0].id
    seededCatalogIds.push(id)
    return id
  }

  /**
   * Insert a watches row for a user against a catalog row. `createdAt`
   * optional — set when tests need deterministic ordering. status defaults
   * to 'owned'.
   */
  const seedWatchForCatalog = async (
    userId: string,
    catalogId: string,
    status: 'owned' | 'wishlist' | 'grail' | 'sold' = 'owned',
    createdAt?: Date,
  ) => {
    const values: Record<string, unknown> = {
      userId,
      catalogId,
      brand: 'TestBrand',
      model: 'TestModel',
      status,
    }
    if (createdAt) {
      values.createdAt = createdAt
    }
    await dbModule.db.insert(schema.watches).values(values as never)
  }

  /**
   * Insert a one-way follow row (followerId → followingId). Idempotent via
   * the follows_unique_pair constraint + onConflictDoNothing.
   */
  const seedFollow = async (followerId: string, followingId: string) => {
    await dbModule.db
      .insert(schema.follows)
      .values({ followerId, followingId })
      .onConflictDoNothing()
  }

  beforeAll(async () => {
    dal = await import('@/data/follows')
    schema = await import('@/db/schema')
    dbModule = await import('@/db')

    const { seedTwoUsers } = await import('../fixtures/users')
    const seed = await seedTwoUsers()
    viewer = seed.userA
    alice = seed.userB

    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    })

    const stamp = Date.now()
    const make = async (label: string) => {
      const r = await admin.auth.admin.createUser({
        email: `test-followed-${label}-${stamp}@horlo.test`,
        password: `pw-${label}`,
        email_confirm: true,
      })
      if (r.error) throw new Error(r.error.message)
      return { id: r.data.user!.id, email: r.data.user!.email! }
    }
    bob = await make('bob')
    carol = await make('carol')
    privateProfile = await make('priv-profile')
    privateCollection = await make('priv-collection')

    cleanup = async () => {
      // Wipe follows first (FK to users), watches (FK to users + catalog),
      // then catalog rows, then profiles+settings, then auth users.
      try {
        const { inArray, or, eq } = await import('drizzle-orm')
        const allUserIds = [
          viewer.id,
          alice.id,
          bob.id,
          carol.id,
          privateProfile.id,
          privateCollection.id,
          ...extras.map((e) => e.id),
        ]
        if (allUserIds.length > 0) {
          // follows cascade-delete via FK, but wipe explicitly for clarity
          await dbModule.db
            .delete(schema.follows)
            .where(
              or(
                inArray(schema.follows.followerId, allUserIds),
                inArray(schema.follows.followingId, allUserIds),
              ),
            )
          await dbModule.db
            .delete(schema.watches)
            .where(inArray(schema.watches.userId, allUserIds))
          // suppress unused-var lint for `eq` (kept in destructure for parity
          // with possible future helpers).
          void eq
        }
        if (seededCatalogIds.length > 0) {
          await dbModule.db
            .delete(schema.watchesCatalog)
            .where(inArray(schema.watchesCatalog.id, seededCatalogIds))
        }
      } catch {
        // best-effort
      }
      await seed.cleanup()
      await admin.auth.admin.deleteUser(bob.id).catch(() => undefined)
      await admin.auth.admin.deleteUser(carol.id).catch(() => undefined)
      await admin.auth.admin.deleteUser(privateProfile.id).catch(() => undefined)
      await admin.auth.admin.deleteUser(privateCollection.id).catch(() => undefined)
      for (const e of extras) {
        await admin.auth.admin.deleteUser(e.id).catch(() => undefined)
      }
    }

    // Distinct username prefixes per stamp avoid collisions across runs.
    await seedProfile(viewer, `foll-aaa-viewer-${stamp}`)
    await seedProfile(alice, `foll-bbb-alice-${stamp}`)
    await seedProfile(bob, `foll-ccc-bob-${stamp}`)
    await seedProfile(carol, `foll-ddd-carol-${stamp}`)
    await seedProfile(privateProfile, `foll-eee-priv-profile-${stamp}`, {
      profilePublic: false,
      collectionPublic: true,
    })
    await seedProfile(privateCollection, `foll-fff-priv-collection-${stamp}`, {
      profilePublic: true,
      collectionPublic: false,
    })
  }, 60_000)

  afterAll(async () => {
    if (!cleanup) return
    await cleanup()
  }, 60_000)

  it('Test 1: excludes private-profile users even when viewer follows them (D-05 layer 1)', async () => {
    // privateProfile has profilePublic=false AND viewer follows them.
    // The two-layer privacy gate (layer 1) must drop them regardless of the
    // follow: a follow does NOT override privacy (D-05).
    const catalogId = await seedTestCatalogRow('foll-t1')
    await seedWatchForCatalog(privateProfile.id, catalogId, 'owned')
    await seedFollow(viewer.id, privateProfile.id)

    const { owners, totalCount } = await dal.getFollowedOwnersForCatalog(
      catalogId,
      viewer.id,
    )

    expect(owners.find((o) => o.userId === privateProfile.id)).toBeUndefined()
    expect(totalCount).toBe(0)
  })

  it('Test 2: excludes collectionPublic=false users even when viewer follows them (D-05 layer 2 — LOAD-BEARING)', async () => {
    // privateCollection has profilePublic=true but collectionPublic=false AND
    // viewer follows them. The second-layer gate (D-39b-09 NEW, mirrored as
    // D-05 layer 2) must drop them — a follow does NOT grant collection
    // visibility (D-05). This is the load-bearing privacy assertion of
    // Phase 65 (vs the simpler getMostFollowedCollectors path).
    const catalogId = await seedTestCatalogRow('foll-t2')
    await seedWatchForCatalog(privateCollection.id, catalogId, 'owned')
    await seedFollow(viewer.id, privateCollection.id)

    const { owners, totalCount } = await dal.getFollowedOwnersForCatalog(
      catalogId,
      viewer.id,
    )

    expect(
      owners.find((o) => o.userId === privateCollection.id),
    ).toBeUndefined()
    expect(totalCount).toBe(0)
  })

  it('Test 3: excludes viewer self even when self-follow row is present (D-05a)', async () => {
    // Viewer themselves owns this catalog. Seed an explicit self-follow row
    // for symmetry with the broad-roster's self-exclusion test (T-39b-04
    // mirror). The DAL must still exclude the viewer via
    // sql`${profiles.id} != ${viewerId}`.
    const catalogId = await seedTestCatalogRow('foll-t3')
    await seedWatchForCatalog(viewer.id, catalogId, 'owned')
    await seedFollow(viewer.id, viewer.id)

    const { owners, totalCount } = await dal.getFollowedOwnersForCatalog(
      catalogId,
      viewer.id,
    )

    expect(owners.find((o) => o.userId === viewer.id)).toBeUndefined()
    expect(totalCount).toBe(0)
  })

  it('Test 4: excludes sold-status rows even when viewer follows owner (D-05b)', async () => {
    // Alice's catalog row is status='sold' AND viewer follows alice. The DAL
    // filters by inArray(status, ['owned','wishlist','grail']) so a sold row
    // should NOT count alice as a current owner of this catalog (matches
    // "from your circle (owns this)" copy semantics).
    const catalogId = await seedTestCatalogRow('foll-t4')
    await seedWatchForCatalog(alice.id, catalogId, 'sold')
    await seedFollow(viewer.id, alice.id)

    const { owners, totalCount } = await dal.getFollowedOwnersForCatalog(
      catalogId,
      viewer.id,
    )

    expect(owners.find((o) => o.userId === alice.id)).toBeUndefined()
    expect(totalCount).toBe(0)
  })

  it('Test 5: orders by watches.created_at DESC for followed owners (D-08)', async () => {
    // bob added the catalog at 2024-01-01; carol added at 2025-01-01. Viewer
    // follows BOTH. The DAL ORDER BY desc(watches.createdAt) puts carol
    // (newer) first. Tests both the ordering and that one-way follows include
    // both owners.
    const catalogId = await seedTestCatalogRow('foll-t5')
    await seedWatchForCatalog(bob.id, catalogId, 'owned', new Date('2024-01-01T00:00:00Z'))
    await seedWatchForCatalog(carol.id, catalogId, 'owned', new Date('2025-01-01T00:00:00Z'))
    await seedFollow(viewer.id, bob.id)
    await seedFollow(viewer.id, carol.id)

    const { owners, totalCount } = await dal.getFollowedOwnersForCatalog(
      catalogId,
      viewer.id,
    )

    expect(owners.length).toBe(2)
    expect(owners[0].userId).toBe(carol.id)
    expect(owners[1].userId).toBe(bob.id)
    expect(totalCount).toBe(2)
  })

  it('Test 6: deduplicates multi-row-per-user owned+wishlist (Pitfall 3)', async () => {
    // alice has BOTH owned AND wishlist rows on the same catalog AND viewer
    // follows alice. The DAL overfetches at SQL LIMIT 50 then JS-loop dedups
    // by userId before slicing to top-N. alice must appear exactly once;
    // totalCount (count(DISTINCT profiles.id)) must report 1, not 2.
    const catalogId = await seedTestCatalogRow('foll-t6')
    await seedWatchForCatalog(alice.id, catalogId, 'owned')
    await seedWatchForCatalog(alice.id, catalogId, 'wishlist')
    await seedFollow(viewer.id, alice.id)

    const { owners, totalCount } = await dal.getFollowedOwnersForCatalog(
      catalogId,
      viewer.id,
    )

    const aliceRows = owners.filter((o) => o.userId === alice.id)
    expect(aliceRows.length).toBe(1)
    expect(totalCount).toBe(1)
  })

  it('Test 7: viewer does NOT follow → owner excluded (FOLL-02 / Pitfall 1)', async () => {
    // bob owns this catalog but viewer does NOT follow bob.
    // Module must NOT include bob — the new follows INNER JOIN filters them
    // out. Proves the join is a real filter, not a no-op.
    const catalogId = await seedTestCatalogRow('foll-t7')
    await seedWatchForCatalog(bob.id, catalogId, 'owned')
    // No follows row seeded for (viewer → bob).

    const { owners, totalCount } = await dal.getFollowedOwnersForCatalog(
      catalogId,
      viewer.id,
    )

    expect(owners.find((o) => o.userId === bob.id)).toBeUndefined()
    expect(totalCount).toBe(0)
  })

  it('Test 8: viewer follows alice one-way (NOT mutual) → alice INCLUDED (FOLL-02 / Pitfall 1)', async () => {
    // viewer → alice follow seeded; reverse (alice → viewer) NOT seeded.
    // Proves the join is one-way (viewer-as-follower → owner-as-followee),
    // NOT mutual-only. If the join were `eq(follows.followerId, profiles.id)
    // AND eq(follows.followingId, viewerId)` (the reversed-direction
    // anti-pattern from Pitfall 1), this test would fail because no row
    // matches that direction.
    const catalogId = await seedTestCatalogRow('foll-t8')
    await seedWatchForCatalog(alice.id, catalogId, 'owned')
    await seedFollow(viewer.id, alice.id)
    // Do NOT seed the reverse (alice → viewer); proves NOT mutual-only.

    const { owners, totalCount } = await dal.getFollowedOwnersForCatalog(
      catalogId,
      viewer.id,
    )

    expect(owners.find((o) => o.userId === alice.id)).toBeDefined()
    expect(totalCount).toBe(1)
  })
})
