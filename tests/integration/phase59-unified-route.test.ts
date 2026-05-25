/**
 * Phase 59 Plan 01 — ROUTE-01 resolution-contract integration tests.
 *
 * Covers the four resolution branches the unified /w/[ref] page must satisfy.
 * Mirrors the harness style of tests/integration/phase12-visibility-matrix.test.ts.
 *
 * The describe block is titled `phase59` so the validation map can grep it.
 *
 * Resolution contract (D-04/D-06/D-07):
 *   Branch 1 (per-user hit):     getWatchByIdForViewer returns {watch, isOwner, ownerUserId}
 *                                  → framing = isOwner ? 'same-user' : 'cross-user'
 *   Branch 2 (catalog hit):      getWatchByIdForViewer returns null
 *                                  → getCatalogById returns CatalogEntry
 *                                  → catalog resolution path engaged
 *   Branch 2 + D-06 (owned):     on catalog branch, findViewerWatchByCatalogId returns {id}
 *                                  → full owned view rendered in place, framing 'same-user'
 *                                  → null for non-owned/sold rows (BUG-01 fix preserved)
 *   Branch 1 cross-user:         getWatchByIdForViewer returns {isOwner:false}
 *                                  → framing = 'cross-user', viewerCanEdit false
 *
 * DB-backed cases are guarded with `maybe = process.env.DATABASE_URL ? describe : describe.skip`
 * so the suite does not hard-fail in the empty local test DB (mirrors existing integration tests).
 * The assertions encode the contract regardless; they pass when the DB is available.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  users,
  profiles,
  profileSettings,
  watches,
  watchesCatalog,
} from '@/db/schema'
import { getWatchByIdForViewer } from '@/data/watches'
import { findViewerWatchByCatalogId } from '@/data/watches'
import { getCatalogById } from '@/data/catalog'

// Gate the entire suite on DB availability (mirrors phase12-visibility-matrix.test.ts).
const maybe = process.env.DATABASE_URL ? describe : describe.skip

// ---------------------------------------------------------------------------
// phase59: ROUTE-01 resolution-contract integration tests
// ---------------------------------------------------------------------------
maybe('phase59: /w/[ref] resolution contract', () => {
  // Seeded actor IDs — deterministic UUIDs in a reserved namespace.
  const ids = {
    owner:   '59000000-0000-0000-0000-000000000001',
    viewer:  '59000000-0000-0000-0000-000000000002',
    catalog: '59000000-0000-0000-cafe-000000000001',
  } as const

  // Watch IDs populated in beforeAll.
  let ownedWatchId: string
  let soldWatchId: string
  let publicWatchId: string   // public watch owned by owner; viewer is non-owner

  async function cleanup() {
    await db.delete(watches).where(inArray(watches.userId, [ids.owner, ids.viewer]))
    await db.delete(watchesCatalog).where(eq(watchesCatalog.id, ids.catalog))
    await db.delete(profileSettings).where(inArray(profileSettings.userId, [ids.owner, ids.viewer]))
    await db.delete(profiles).where(inArray(profiles.id, [ids.owner, ids.viewer]))
    await db.delete(users).where(inArray(users.id, [ids.owner, ids.viewer]))
  }

  beforeAll(async () => {
    await cleanup()

    // Seed users + profiles.
    await db.insert(users).values([
      { id: ids.owner, email: 'owner59@test.horlo.dev', role: 'user' },
      { id: ids.viewer, email: 'viewer59@test.horlo.dev', role: 'user' },
    ])
    await db.insert(profiles).values([
      { id: ids.owner, username: 'owner59', displayName: 'Owner 59' },
      { id: ids.viewer, username: 'viewer59', displayName: 'Viewer 59' },
    ])
    await db.insert(profileSettings).values([
      { userId: ids.owner, collectionPublic: true, wishlistPublic: false, profilePublic: true },
      { userId: ids.viewer, collectionPublic: true, wishlistPublic: false, profilePublic: true },
    ])

    // Seed the catalog entry used for Branch 2 tests.
    await db.insert(watchesCatalog).values({
      id: ids.catalog,
      brand: 'Rolex',
      model: 'Submariner',
      reference: '14060M',
    })

    // Seed watches for the owner.
    ownedWatchId = randomUUID()
    soldWatchId = randomUUID()
    publicWatchId = randomUUID()

    await db.insert(watches).values([
      {
        id: ownedWatchId,
        userId: ids.owner,
        brand: 'Rolex',
        model: 'Submariner',
        status: 'owned',
        catalogId: ids.catalog,
        complications: [],
        styleTags: [],
        designTraits: [],
        roleTags: [],
      },
      {
        id: soldWatchId,
        userId: ids.owner,
        brand: 'Rolex',
        model: 'Submariner',
        status: 'sold',   // NOT 'owned' — BUG-01: should NOT trigger the owned render
        catalogId: ids.catalog,
        complications: [],
        styleTags: [],
        designTraits: [],
        roleTags: [],
      },
      {
        id: publicWatchId,
        userId: ids.owner,
        brand: 'Omega',
        model: 'Speedmaster',
        status: 'owned',
        catalogId: null,
        complications: [],
        styleTags: [],
        designTraits: [],
        roleTags: [],
      },
    ])
  })

  afterAll(async () => {
    await cleanup()
  })

  // ---------------------------------------------------------------------------
  // Branch 1: per-user resolution — owner views their own watch.
  // Contract: getWatchByIdForViewer returns {watch, isOwner:true, ownerUserId}
  //           → framing resolves same-user.
  // ---------------------------------------------------------------------------
  it('Branch 1 (per-user hit): owner resolves watch with isOwner=true', async () => {
    const result = await getWatchByIdForViewer(ids.owner, ownedWatchId)
    expect(result).not.toBeNull()
    expect(result!.isOwner).toBe(true)
    expect(result!.watch.id).toBe(ownedWatchId)
    expect(result!.ownerUserId).toBe(ids.owner)
  })

  // ---------------------------------------------------------------------------
  // Branch 1 cross-user: non-owner views a public watch.
  // Contract: getWatchByIdForViewer returns {isOwner:false}
  //           → framing cross-user, viewerCanEdit must be false.
  // ---------------------------------------------------------------------------
  it('Branch 1 cross-user: viewer resolves public owner watch with isOwner=false', async () => {
    const result = await getWatchByIdForViewer(ids.viewer, publicWatchId)
    expect(result).not.toBeNull()
    expect(result!.isOwner).toBe(false)
    // viewerCanEdit is sourced from isOwner on the page — assert the contract value.
    const viewerCanEdit = result!.isOwner
    expect(viewerCanEdit).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // Branch 2: catalog resolution — ref is a catalogId not known to per-user.
  // Contract: getWatchByIdForViewer(viewer, catalogId) returns null
  //           → getCatalogById(catalogId) returns CatalogEntry
  //           → catalog resolution path is engaged.
  // ---------------------------------------------------------------------------
  it('Branch 2 (catalog hit): viewer cannot resolve catalogId as watch, catalog branch engages', async () => {
    // The viewer has no watch with id = ids.catalog (it is a catalogId, not a watches.id).
    const perUserResult = await getWatchByIdForViewer(ids.viewer, ids.catalog)
    expect(perUserResult).toBeNull()

    // Catalog resolver should find it.
    const catalogEntry = await getCatalogById(ids.catalog)
    expect(catalogEntry).not.toBeNull()
    expect(catalogEntry!.brand).toBe('Rolex')
    expect(catalogEntry!.model).toBe('Submariner')
  })

  // ---------------------------------------------------------------------------
  // Branch 2 + D-06 (owned-via-catalog): owner arrives via catalogId.
  // Contract: findViewerWatchByCatalogId(owner, catalogId) returns {id}
  //           → owned view rendered in place, framing same-user (no redirect D-08).
  //
  // Also asserts the BUG-01 fix (T-59-02): a sold row with the same catalogId
  // must NOT trigger the owned render (status filter to 'owned' only).
  // ---------------------------------------------------------------------------
  it('Branch 2 D-06 (owned): findViewerWatchByCatalogId returns the owned row id', async () => {
    const result = await findViewerWatchByCatalogId(ids.owner, ids.catalog)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(ownedWatchId)
  })

  it('Branch 2 D-06 BUG-01: sold row does NOT trigger the owned-render path (status filter)', async () => {
    // The owner also has a sold watch with the same catalogId.
    // findViewerWatchByCatalogId must return the owned row, not the sold row,
    // because the BUG-01 fix filters to status='owned' only.
    const result = await findViewerWatchByCatalogId(ids.owner, ids.catalog)
    // Result should be the owned watch (not the sold one), proving the filter works.
    // If BUG-01 were missing, this could return the sold watch id too.
    expect(result).not.toBeNull()
    expect(result!.id).toBe(ownedWatchId)   // ownedWatchId, not soldWatchId
    expect(result!.id).not.toBe(soldWatchId)
  })

  it('Branch 2 D-06 (non-owned): viewer has no owned row → returns null → cross-user framing', async () => {
    // The viewer has no watches at all with this catalogId → null → cross-user view.
    const result = await findViewerWatchByCatalogId(ids.viewer, ids.catalog)
    expect(result).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Privacy gate (T-59-01 IDOR): findViewerWatchByCatalogId is scoped by userId.
  // A different viewer cannot read the owner's watch.id via a shared catalogId.
  // ---------------------------------------------------------------------------
  it('IDOR gate: viewer cannot read owner watches.id via shared catalogId', async () => {
    // Viewer has no row with this catalogId.
    const viewerResult = await findViewerWatchByCatalogId(ids.viewer, ids.catalog)
    expect(viewerResult).toBeNull()

    // Owner can read their own row.
    const ownerResult = await findViewerWatchByCatalogId(ids.owner, ids.catalog)
    expect(ownerResult).not.toBeNull()
    expect(ownerResult!.id).toBe(ownedWatchId)
  })
})
