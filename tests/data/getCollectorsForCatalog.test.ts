/**
 * Phase 39b Plan 04 Task 1 — Integration tests for getCollectorsForCatalog.
 *
 * Covers DISC-11 / NSV-18 (catalog other-owners roster). Asserts the four
 * privacy edges + sort + dedup contract:
 *   1. T-39b-01 layer 1 — profileSettings.profilePublic = false → excluded.
 *   2. T-39b-01 layer 2 (D-39b-09 NEW) — profileSettings.collectionPublic =
 *      false → excluded. This second layer does not exist in
 *      getMostFollowedCollectors and is the load-bearing add for NSV-18.
 *   3. T-39b-04 — profiles.id === viewerId → excluded (self-exclusion).
 *   4. A1 / Q1 RECOMMEND — watches.status = 'sold' → row not counted as
 *      ownership (matches "X collectors own this" copy).
 *   5. D-39b-10 — ORDER BY watches.created_at DESC.
 *   6. Pitfall 3 — JS-side dedup: multi-row-per-user (owned + wishlist on the
 *      same catalog) appears once.
 *
 * Gating mirrors the canonical pattern (Phase 17 / Phase 16 / Phase 18 Plan 01
 * Task 2) — hasDrizzle && hasSupabaseAdmin. Tests skip silently when env is
 * absent; Phase 36 STATE memory documents the `set -a; source .env.local; set
 * +a; npx vitest run …` workaround required to load .env.local.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const hasDrizzle = Boolean(process.env.DATABASE_URL)
const hasSupabaseAdmin =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const maybe = hasDrizzle && hasSupabaseAdmin ? describe : describe.skip

maybe('getCollectorsForCatalog — DAL integration', () => {
  type DalT = typeof import('@/data/discovery')
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
    // watches table requires brand + model (NOT NULL) — pass dummy strings
    // since the DAL projects from profiles, not watches.brand/model. Phase 36
    // shipped watches.catalogId as NOT NULL, so catalogId is required.
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

  beforeAll(async () => {
    dal = await import('@/data/discovery')
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
        email: `test-roster-${label}-${stamp}@horlo.test`,
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
      // Wipe watches first (FK to users + catalog), then catalog rows, then
      // profiles+settings, then auth users.
      try {
        const { inArray } = await import('drizzle-orm')
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
          await dbModule.db
            .delete(schema.watches)
            .where(inArray(schema.watches.userId, allUserIds))
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
    await seedProfile(viewer, `roster-aaa-viewer-${stamp}`)
    await seedProfile(alice, `roster-bbb-alice-${stamp}`)
    await seedProfile(bob, `roster-ccc-bob-${stamp}`)
    await seedProfile(carol, `roster-ddd-carol-${stamp}`)
    await seedProfile(privateProfile, `roster-eee-priv-profile-${stamp}`, {
      profilePublic: false,
      collectionPublic: true,
    })
    await seedProfile(privateCollection, `roster-fff-priv-collection-${stamp}`, {
      profilePublic: true,
      collectionPublic: false,
    })
  }, 60_000)

  afterAll(async () => {
    if (!cleanup) return
    await cleanup()
  }, 60_000)

  it('Test 1: excludes private-profile users (T-39b-01 layer 1)', async () => {
    // privateProfile has profilePublic=false. Even with an 'owned' watch on
    // this catalog, they must NOT appear in the roster.
    const catalogId = await seedTestCatalogRow('t1')
    await seedWatchForCatalog(privateProfile.id, catalogId, 'owned')

    const { collectors, totalCount } = await dal.getCollectorsForCatalog(
      catalogId,
      viewer.id,
    )

    expect(collectors.find((c) => c.userId === privateProfile.id)).toBeUndefined()
    expect(totalCount).toBe(0)
  })

  it('Test 2: excludes collectionPublic=false users (T-39b-01 layer 2 / D-39b-09)', async () => {
    // privateCollection has profilePublic=true but collectionPublic=false.
    // The second-layer gate (NEW in D-39b-09) must drop them. This is the
    // load-bearing assertion vs. getMostFollowedCollectors (which only
    // enforces profilePublic).
    const catalogId = await seedTestCatalogRow('t2')
    await seedWatchForCatalog(privateCollection.id, catalogId, 'owned')

    const { collectors, totalCount } = await dal.getCollectorsForCatalog(
      catalogId,
      viewer.id,
    )

    expect(
      collectors.find((c) => c.userId === privateCollection.id),
    ).toBeUndefined()
    expect(totalCount).toBe(0)
  })

  it('Test 3: excludes viewer self (T-39b-04)', async () => {
    // Viewer themselves owns this catalog — must be excluded from their own
    // roster (the viewer is browsing /catalog/{id}, not their own profile).
    const catalogId = await seedTestCatalogRow('t3')
    await seedWatchForCatalog(viewer.id, catalogId, 'owned')

    const { collectors, totalCount } = await dal.getCollectorsForCatalog(
      catalogId,
      viewer.id,
    )

    expect(collectors.find((c) => c.userId === viewer.id)).toBeUndefined()
    expect(totalCount).toBe(0)
  })

  it("Test 4: excludes sold-status rows (A1 / Q1 RECOMMEND)", async () => {
    // Alice's catalog row is status='sold'. The DAL filters by
    // inArray(status, ['owned','wishlist','grail']) so a sold row should
    // NOT count alice as a collector of this catalog (matches "X collectors
    // own this" copy semantics).
    const catalogId = await seedTestCatalogRow('t4')
    await seedWatchForCatalog(alice.id, catalogId, 'sold')

    const { collectors, totalCount } = await dal.getCollectorsForCatalog(
      catalogId,
      viewer.id,
    )

    expect(collectors.find((c) => c.userId === alice.id)).toBeUndefined()
    expect(totalCount).toBe(0)
  })

  it('Test 5: orders by watches.created_at DESC (D-39b-10)', async () => {
    // bob added the catalog at 2024-01-01; carol added at 2025-01-01. The
    // DAL ORDER BY desc(watches.createdAt) puts carol (newer) first.
    const catalogId = await seedTestCatalogRow('t5')
    await seedWatchForCatalog(bob.id, catalogId, 'owned', new Date('2024-01-01T00:00:00Z'))
    await seedWatchForCatalog(carol.id, catalogId, 'owned', new Date('2025-01-01T00:00:00Z'))

    const { collectors, totalCount } = await dal.getCollectorsForCatalog(
      catalogId,
      viewer.id,
    )

    expect(collectors.length).toBe(2)
    expect(collectors[0].userId).toBe(carol.id)
    expect(collectors[1].userId).toBe(bob.id)
    expect(totalCount).toBe(2)
  })

  it('Test 6: deduplicates multi-row-per-user (Pitfall 3)', async () => {
    // alice has BOTH owned AND wishlist rows on the same catalog. The DAL
    // overfetches at SQL LIMIT 50 then JS-loop dedups by userId before
    // slicing to top-N. alice must appear exactly once; totalCount
    // (count(DISTINCT profiles.id)) must report 1, not 2.
    const catalogId = await seedTestCatalogRow('t6')
    await seedWatchForCatalog(alice.id, catalogId, 'owned')
    await seedWatchForCatalog(alice.id, catalogId, 'wishlist')

    const { collectors, totalCount } = await dal.getCollectorsForCatalog(
      catalogId,
      viewer.id,
    )

    const aliceRows = collectors.filter((c) => c.userId === alice.id)
    expect(aliceRows.length).toBe(1)
    expect(totalCount).toBe(1)
  })
})
