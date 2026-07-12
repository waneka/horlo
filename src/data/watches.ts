// DAL is server-only — importing this from a client component is a build-time error.
import 'server-only'

import { db } from '@/db'
import { watches, profileSettings, watchesCatalog, watchPhotos } from '@/db/schema'
import { eq, and, or, asc, desc, inArray, sql, type SQL } from 'drizzle-orm'
import type { Watch, EraSignal } from '@/lib/types'

// Row type inferred from the Drizzle schema — used for mapping only.
type WatchRow = typeof watches.$inferSelect

/**
 * Convert a Drizzle DB row to the domain Watch type.
 * DB-internal fields (userId, createdAt, updatedAt) are stripped.
 * Nullable DB fields become undefined in the domain type.
 */
function mapRowToWatch(row: WatchRow): Watch {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    reference: row.reference ?? undefined,
    status: row.status,
    pricePaid: row.pricePaid ?? undefined,
    targetPrice: row.targetPrice ?? undefined,
    marketPrice: row.marketPrice ?? undefined,
    movement: row.movementType ?? undefined,
    complications: row.complications,
    caseSizeMm: row.caseSizeMm ?? undefined,
    lugToLugMm: row.lugToLugMm ?? undefined,
    waterResistanceM: row.waterResistanceM ?? undefined,
    strapType: row.strapType ?? undefined,
    crystalType: row.crystalType ?? undefined,
    dialColor: row.dialColor ?? undefined,
    styleTags: row.styleTags,
    designTraits: row.designTraits,
    roleTags: row.roleTags,
    acquisitionDate: row.acquisitionDate ?? undefined,
    productionYear: row.productionYear ?? undefined,
    isFlaggedDeal: row.isFlaggedDeal ?? undefined,
    isChronometer: row.isChronometer ?? undefined,
    notes: row.notes ?? undefined,
    notesPublic: row.notesPublic ?? true,
    notesUpdatedAt: row.notesUpdatedAt?.toISOString() ?? undefined,
    // imageUrl is NOT mapped here — the column was dropped in Phase 60 Plan 01.
    // Cover is resolved per-query as a correlated subquery and overridden after spread.
    // Phase 17 catalog FK — preserve null to let callers distinguish "not linked" from "not fetched"
    catalogId: row.catalogId ?? null,
    // Phase 27 — sort_order for wishlist drag-reorder (D-01).
    sortOrder: row.sortOrder,
    // Phase 37 D-01..D-08 — collector provenance fields (all nullable; CAT-18)
    serial: row.serial ?? undefined,
    yearOfAcquisition: row.yearOfAcquisition ?? undefined,
    condition: row.condition ?? undefined,
    boxPapers: row.boxPapers ?? undefined,
    serviceHistory: row.serviceHistory ?? undefined,
    paidCurrency: row.paidCurrency ?? undefined,
    purchaseDate: row.purchaseDate ?? undefined,
  }
}

// Domain-to-row mapping for insert/update operations.
// Converts undefined to null for nullable DB columns.
// Does NOT include id, userId, createdAt, updatedAt — caller supplies these separately.
function mapDomainToRow(data: Partial<Watch>): Partial<Omit<WatchRow, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> {
  const row: Partial<Omit<WatchRow, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> = {}

  if (data.brand !== undefined) row.brand = data.brand
  if (data.model !== undefined) row.model = data.model
  if ('reference' in data) row.reference = data.reference ?? null
  if (data.status !== undefined) row.status = data.status
  if ('pricePaid' in data) row.pricePaid = data.pricePaid ?? null
  if ('targetPrice' in data) row.targetPrice = data.targetPrice ?? null
  if ('marketPrice' in data) row.marketPrice = data.marketPrice ?? null
  if (data.movement !== undefined) row.movementType = data.movement
  if (data.complications !== undefined) row.complications = data.complications
  if ('caseSizeMm' in data) row.caseSizeMm = data.caseSizeMm ?? null
  if ('lugToLugMm' in data) row.lugToLugMm = data.lugToLugMm ?? null
  if ('waterResistanceM' in data) row.waterResistanceM = data.waterResistanceM ?? null
  if ('strapType' in data) row.strapType = data.strapType ?? null
  if ('crystalType' in data) row.crystalType = data.crystalType ?? null
  if ('dialColor' in data) row.dialColor = data.dialColor ?? null
  if (data.styleTags !== undefined) row.styleTags = data.styleTags
  if (data.designTraits !== undefined) row.designTraits = data.designTraits
  if (data.roleTags !== undefined) row.roleTags = data.roleTags
  if ('acquisitionDate' in data) row.acquisitionDate = data.acquisitionDate ?? null
  if ('productionYear' in data) row.productionYear = data.productionYear ?? null
  if ('isFlaggedDeal' in data) row.isFlaggedDeal = data.isFlaggedDeal ?? null
  if ('isChronometer' in data) row.isChronometer = data.isChronometer ?? null
  if ('notes' in data) row.notes = data.notes ?? null
  // notesPublic is mappable from the domain layer (set when toggling per-note visibility).
  // notesUpdatedAt is NOT mapped here — Server Actions set it explicitly when notes change.
  if ('notesPublic' in data && data.notesPublic !== undefined) row.notesPublic = data.notesPublic
  // imageUrl is NOT mapped here — the column was dropped in Phase 60 Plan 01.
  // Cover is computed from watch_photos at read time; it is not a writable column.

  // Phase 27 — sort_order is mappable from the domain layer so server
  // actions can pass `{ sortOrder: maxSort + 1 }` for D-03/D-04 bumps.
  if ('sortOrder' in data && data.sortOrder !== undefined) row.sortOrder = data.sortOrder

  // Phase 37 D-01..D-08 — collector provenance fields (all nullable; CAT-18)
  if ('serial' in data) row.serial = data.serial ?? null
  if ('yearOfAcquisition' in data) row.yearOfAcquisition = data.yearOfAcquisition ?? null
  if ('condition' in data) row.condition = data.condition ?? null
  if ('boxPapers' in data) row.boxPapers = data.boxPapers ?? null
  if ('serviceHistory' in data) row.serviceHistory = data.serviceHistory ?? null
  if ('paidCurrency' in data) row.paidCurrency = data.paidCurrency ?? null
  if ('purchaseDate' in data) row.purchaseDate = data.purchaseDate ?? null

  return row
}

/**
 * Return all watches for a user.
 *
 * Phase 27: ORDER BY sort_order ASC, created_at DESC (D-01).
 *   - Primary: sort_order ASC — owner's chosen wishlist order.
 *   - Tiebreaker: created_at DESC — defends against any rows sharing a
 *     sort_order; post-migration there should be no ties (DO $$ assertion
 *     in 20260504120000_phase27_sort_order.sql verifies), but cheap safety.
 *
 * Phase 38 D-11: LEFT JOINs watches_catalog to populate catalogTaste on every
 * returned Watch. LEFT JOIN (not INNER) preserves graceful degradation in the
 * rare race where a watches_catalog row is deleted while a watches row still
 * references it (RESEARCH Pitfall 6). D-12: DAL does NOT pre-filter by
 * confidence — the engine gates at its own boundary (analyzeSimilarity).
 */
export async function getWatchesByUser(userId: string): Promise<Watch[]> {
  const rows = await db
    .select({
      watch: watches,
      taste: {
        // Phase 49.1 D-SCOPE-01e + Pitfall 3 — primaryArchetype dropped from the
        // LEFT JOIN projection. The DB column still exists until Plans 07/08
        // ship the schema drop; this read-side update lands first so reader
        // code is clean before the migration runs.
        formality: watchesCatalog.formality,
        sportiness: watchesCatalog.sportiness,
        heritageScore: watchesCatalog.heritageScore,
        eraSignal: watchesCatalog.eraSignal,
        designMotifs: watchesCatalog.designMotifs,
        confidence: watchesCatalog.confidence,
        extractedFromPhoto: watchesCatalog.extractedFromPhoto,
      },
      // Phase 60 D-04: catalog imageUrl for fallback chain (D-05).
      catalogImageUrl: watchesCatalog.imageUrl,
      // Phase 81 D-81-02 — canonical brand + family FK ids projected through
      // the existing LEFT JOIN. LEFT JOIN miss (catalogId=null legacy row) →
      // null → converted to undefined at the map() boundary per RESEARCH
      // Pitfall 4. Downstream recommender (Plan 02) keys exclusion +
      // multi-brand-match on these instead of free-text brand/model strings.
      catalogBrandId: watchesCatalog.brandId,
      catalogFamilyId: watchesCatalog.familyId,
      // Phase 60 D-04/D-05: cover subquery — lowest sort_order watch_photos row.
      // Returns the RAW storagePath (Phase 61 signs URLs; keep DAL admin-client-free).
      // Cover wins over catalog when both present (D-06).
      coverStoragePath: sql<string | null>`(
        SELECT wp.storage_path
        FROM watch_photos wp
        WHERE wp.watch_id = ${watches.id}
        ORDER BY wp.sort_order ASC
        LIMIT 1
      )`,
    })
    .from(watches)
    .leftJoin(watchesCatalog, eq(watchesCatalog.id, watches.catalogId))
    .where(eq(watches.userId, userId))
    .orderBy(asc(watches.sortOrder), desc(watches.createdAt))

  return rows.map(({ watch, taste, coverStoragePath, catalogImageUrl, catalogBrandId, catalogFamilyId }) => ({
    ...mapRowToWatch(watch),
    // Phase 60 D-04/D-05/D-06: cover->catalog->undefined fallback chain.
    // coverStoragePath is the lowest-sort_order watch_photos row storage_path (raw path).
    // catalogImageUrl is the catalog imageUrl (fallback when no watch_photos exist).
    imageUrl: coverStoragePath ?? (catalogImageUrl ?? undefined),
    // Phase 81 D-81-02 — LEFT JOIN nullable → optional-undefined at the domain boundary
    // (Watch.brandId / familyId are `?: string`, not nullable).
    brandId: catalogBrandId ?? undefined,
    familyId: catalogFamilyId ?? undefined,
    // Numeric columns surface as strings via postgres-js — coerce at the boundary.
    // RESEARCH Pitfall 2: if forgotten, cosine3D produces NaN and all scores collapse.
    // LEFT JOIN miss: taste itself is null when no catalog row matched.
    catalogTaste: taste == null || (taste.confidence === null && taste.formality === null)
      ? null
      : {
          formality: taste.formality !== null ? Number(taste.formality) : null,
          sportiness: taste.sportiness !== null ? Number(taste.sportiness) : null,
          heritageScore: taste.heritageScore !== null ? Number(taste.heritageScore) : null,
          eraSignal: taste.eraSignal as EraSignal | null,
          designMotifs: taste.designMotifs ?? [],
          confidence: taste.confidence !== null ? Number(taste.confidence) : null,
          extractedFromPhoto: taste.extractedFromPhoto ?? false,
        },
  }))
}

/**
 * Return a single watch by ID, scoped to userId. Returns null if not found.
 * Not-found is an expected outcome, not a thrown error (D-08).
 */
export async function getWatchById(userId: string, watchId: string): Promise<Watch | null> {
  // Phase 60 D-04/D-05: add catalog leftJoin (previously absent) for the cover->catalog fallback.
  const rows = await db
    .select({
      watch: watches,
      catalogImageUrl: watchesCatalog.imageUrl,
      // Phase 81 D-81-02 — mirror getWatchesByUser projection.
      catalogBrandId: watchesCatalog.brandId,
      catalogFamilyId: watchesCatalog.familyId,
      coverStoragePath: sql<string | null>`(
        SELECT wp.storage_path
        FROM watch_photos wp
        WHERE wp.watch_id = ${watches.id}
        ORDER BY wp.sort_order ASC
        LIMIT 1
      )`,
    })
    .from(watches)
    .leftJoin(watchesCatalog, eq(watchesCatalog.id, watches.catalogId))
    .where(and(eq(watches.userId, userId), eq(watches.id, watchId)))
  if (!rows[0]) return null
  const { watch, coverStoragePath, catalogImageUrl, catalogBrandId, catalogFamilyId } = rows[0]
  return {
    ...mapRowToWatch(watch),
    imageUrl: coverStoragePath ?? (catalogImageUrl ?? undefined),
    // Phase 81 D-81-02 — LEFT JOIN nullable → undefined per Pitfall 4.
    brandId: catalogBrandId ?? undefined,
    familyId: catalogFamilyId ?? undefined,
  }
}

/**
 * Viewer-aware fetch for /watch/[id]. Returns { watch, isOwner } or null.
 *
 * Privacy gate (mirrors getWearRailForViewer — two-layer per CLAUDE.md + STATE.md):
 *   - OUTER: RLS on watches is owner-only at anon-key.
 *   - INNER (this WHERE clause): self-include short-circuits (OR owner branch);
 *     non-owner rows require profile_public=true AND the per-tab flag for the
 *     watch's status (collection_public for owned/sold/grail, wishlist_public
 *     for wishlist).
 *
 * Missing watch and "exists but private" both return null — uniform path
 * avoids leaking existence of private watches (precedent: Phase 10 WYWT DAL).
 */
export async function getWatchByIdForViewer(
  viewerId: string,
  watchId: string,
): Promise<{ watch: Watch; isOwner: boolean; ownerUserId: string } | null> {
  const rows = await db
    .select({
      watch: watches,
      profilePublic: profileSettings.profilePublic,
      collectionPublic: profileSettings.collectionPublic,
      wishlistPublic: profileSettings.wishlistPublic,
      // Phase 60 D-04/D-05: catalog imageUrl for cover->catalog->undefined fallback.
      catalogImageUrl: watchesCatalog.imageUrl,
      // Phase 60 D-04: cover subquery — lowest sort_order watch_photos row.
      coverStoragePath: sql<string | null>`(
        SELECT wp.storage_path
        FROM watch_photos wp
        WHERE wp.watch_id = ${watches.id}
        ORDER BY wp.sort_order ASC
        LIMIT 1
      )`,
    })
    .from(watches)
    .innerJoin(profileSettings, eq(profileSettings.userId, watches.userId))
    .leftJoin(watchesCatalog, eq(watchesCatalog.id, watches.catalogId))
    .where(
      and(
        eq(watches.id, watchId),
        or(
          eq(watches.userId, viewerId), // owner short-circuit
          and(
            eq(profileSettings.profilePublic, true),
            // per-tab gate by status — wishlist uses wishlist_public,
            // owned/sold/grail use collection_public
            sql`(
              (${watches.status} = 'wishlist' AND ${profileSettings.wishlistPublic} = true)
              OR (${watches.status} IN ('owned','sold','grail') AND ${profileSettings.collectionPublic} = true)
            )`,
          ),
        ),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row) return null
  return {
    watch: {
      ...mapRowToWatch(row.watch),
      // Phase 60 D-04/D-05/D-06: cover->catalog->undefined fallback chain.
      imageUrl: row.coverStoragePath ?? (row.catalogImageUrl ?? undefined),
    },
    isOwner: row.watch.userId === viewerId,
    // Phase 57 Plan 05: expose ownerUserId for GATE-03 signal resolution + CommentThread.
    // userId is stripped from the Watch domain type (DB-internal field); surfaced here
    // for the watch-detail page to resolve follow-direction signals without a second query.
    ownerUserId: row.watch.userId,
  }
}

/**
 * ARCH-02 detection — does the viewer already own a row in `watches` with this
 * catalogId? If yes, return the row (we need its id to build the owned-view).
 * If no, return null.
 *
 * T-20-06-01: query is scoped by BOTH userId AND catalogId — the viewer can
 * never read another user's watches.id even if catalogIds collide across users.
 */
export async function findViewerWatchByCatalogId(
  userId: string,
  catalogId: string,
  statuses: ('owned' | 'wishlist')[] = ['owned'],  // D-06: default preserves BUG-01 contract
): Promise<{ id: string; status: 'owned' | 'wishlist'; reference: string | null } | null> {
  // Phase 70 Wave 0 (RESEARCH §2 / Pitfall #2) — return shape widened to
  // include the catalog row's `reference`. DupeBanner's "View existing" link
  // builds `/w/${reference}` from this server-authoritative value (T-70-04 —
  // reference is JOINed from watches_catalog server-side, never client-supplied).
  // Backward-compat: existing callers (Phase 67 tests + /w/[ref] Branch 2 catalog
  // lookup) destructure only {id, status}; the added field is additive.
  const rows = await db
    .select({
      id: watches.id,
      status: watches.status,  // ADD: projection required for widened return type (RESEARCH Pitfall 2)
      reference: watchesCatalog.reference,  // Phase 70 Wave 0 — DupeBanner /w/[ref] target
    })
    .from(watches)
    .leftJoin(watchesCatalog, eq(watches.catalogId, watchesCatalog.id))  // Phase 70 Wave 0
    .where(and(
      eq(watches.userId, userId),
      eq(watches.catalogId, catalogId),
      inArray(watches.status, statuses),  // replaces eq(watches.status, 'owned') — D-06
    ))
    // D-08: owned wins over wishlist when both rows exist for the same catalogId.
    // Within each status tier, most-recently acquired wins (D-05 carry-forward).
    // T-20-06-01: query is scoped by BOTH userId AND catalogId — cross-user read is impossible.
    .orderBy(
      asc(sql`CASE ${watches.status} WHEN 'owned' THEN 0 WHEN 'wishlist' THEN 1 ELSE 2 END`),
      desc(watches.createdAt),
    )
    .limit(1)
  if (rows.length === 0) return null
  const row = rows[0]
  return {
    id: row.id,
    status: row.status as 'owned' | 'wishlist',
    reference: row.reference ?? null,  // Phase 70 Wave 0 — catalog row's reference (nullable column)
  }
}

/**
 * Insert a new watch for the given user. Returns the created Watch domain object.
 *
 * Phase 38 D-06: catalogId is now a required second positional argument (IDIOM A).
 * Callers must upsert catalog BEFORE calling createWatch and pass the resulting catalogId.
 * The column is NOT NULL in prod (Phase 36 shipped SET NOT NULL); Drizzle catches up in Task 7.
 */
export async function createWatch(
  userId: string,
  catalogId: string,
  data: Omit<Watch, 'id' | 'catalogId'>,
): Promise<Watch> {
  const rowData = mapDomainToRow(data)
  const inserted = await db
    .insert(watches)
    .values({
      ...rowData,
      brand: data.brand,
      model: data.model,
      status: data.status,
      movementType: data.movement,
      complications: data.complications,
      styleTags: data.styleTags,
      designTraits: data.designTraits,
      roleTags: data.roleTags,
      catalogId, // Phase 38 D-06: catalogId now required, set atomically at insert
      userId,
    })
    .returning()
  return mapRowToWatch(inserted[0])
}

/**
 * Update a watch by ID, scoped to userId. Throws if the watch is not found or belongs to another user.
 */
export async function updateWatch(userId: string, watchId: string, data: Partial<Watch>): Promise<Watch> {
  const rowData = mapDomainToRow(data)
  const updated = await db
    .update(watches)
    .set({ ...rowData, updatedAt: new Date() })
    .where(and(eq(watches.userId, userId), eq(watches.id, watchId)))
    .returning()
  if (!updated[0]) {
    throw new Error(`Watch not found or access denied: watchId=${watchId}, userId=${userId}`)
  }
  return mapRowToWatch(updated[0])
}

/**
 * Delete a watch by ID, scoped to userId. Throws if the watch is not found or belongs to another user.
 */
export async function deleteWatch(userId: string, watchId: string): Promise<void> {
  const deleted = await db
    .delete(watches)
    .where(and(eq(watches.userId, userId), eq(watches.id, watchId)))
    .returning()
  if (!deleted[0]) {
    throw new Error(`Watch not found or access denied: watchId=${watchId}, userId=${userId}`)
  }
}

/**
 * Link a per-user watch to a canonical catalog row (CAT-08, Phase 17).
 * Idempotent: re-running with the same args is a no-op.
 * Owner-scoped: WHERE clause includes user_id to prevent cross-user catalog linking (T-17-02-03).
 *
 * Called by:
 *   - addWatch Server Action (Plan 03 wiring)
 *   - backfill script (Plan 04)
 *
 * Failure semantics: caller MUST wrap in try/catch (fire-and-forget per CAT-08).
 *
 * @deprecated Phase 38 D-06: createWatch now sets catalogId atomically; this helper has no callers
 * post-Plan-A. Mark for deletion in Polish.
 */
export async function linkWatchToCatalog(
  userId: string,
  watchId: string,
  catalogId: string,
): Promise<void> {
  await db
    .update(watches)
    .set({ catalogId })
    .where(and(eq(watches.id, watchId), eq(watches.userId, userId)))
}

/**
 * Phase 27 (D-03, D-04) — Returns max(sort_order) across the user's
 * wishlist+grail set, or -1 if empty.
 *
 * Used by:
 *   - addWatch Server Action: when status='wishlist'|'grail', new watch lands
 *     at end of list with sort_order = max + 1.
 *   - editWatch Server Action: when status transitions INTO wishlist|grail
 *     from another status, bump sort_order to max + 1.
 */
export async function getMaxWishlistSortOrder(userId: string): Promise<number> {
  const rows = await db
    .select({ maxSort: sql<number>`coalesce(max(${watches.sortOrder}), -1)::int` })
    .from(watches)
    .where(
      and(
        eq(watches.userId, userId),
        inArray(watches.status, ['wishlist', 'grail']),
      ),
    )
  return rows[0]?.maxSort ?? -1
}

/**
 * Phase 27 typed error (WR-04 fix) — thrown when the WHERE-clause-bounded
 * UPDATE in bulkReorderWishlist returns fewer rows than orderedIds. Indicates
 * one of: foreign id in payload, owned/sold-status id in payload, or stale
 * id (deleted by another tab between fetch and reorder). The Server Action
 * uses `instanceof OwnerMismatchError` to map this to a stable user-facing
 * message without coupling to the wording of the message string.
 *
 * Message preserves the legacy "Owner mismatch: expected N rows, updated M"
 * wording for back-compat with integration tests in
 * tests/integration/phase27-bulk-reorder.test.ts (regex /Owner mismatch/).
 */
export class OwnerMismatchError extends Error {
  constructor(public expected: number, public got: number) {
    super(`Owner mismatch: expected ${expected} rows, updated ${got}`)
    this.name = 'OwnerMismatchError'
  }
}

/**
 * Phase 27 typed error (BR-01 + WR-04) — thrown when orderedIds is a strict
 * subset of the user's wishlist+grail set. A partial set submission (e.g.,
 * stale client racing a concurrent add in another tab) would leave the
 * unsent rows with their pre-existing sort_order, colliding with the
 * freshly-assigned 0..N-1 range. Reject the submission so the client can
 * refetch and retry against current state.
 */
export class SetMismatchError extends Error {
  constructor(public expected: number, public got: number) {
    super(`Set mismatch: user has ${expected} wishlist/grail watches, received ${got}`)
    this.name = 'SetMismatchError'
  }
}

/**
 * Phase 27 (WISH-01, D-09, D-10, T-27-01, T-27-02) — Bulk-update sort_order
 * for the user's wishlist+grail set in a single round-trip via UPDATE … CASE WHEN.
 *
 * Defense-in-depth (per RESEARCH Pitfall 5 + Pattern 5):
 *   1. WHERE clause includes user_id (T-27-01: cross-tenant reorder)
 *   2. WHERE clause includes status IN ('wishlist','grail') (T-27-02: status-confused reorder)
 *   3. WHERE clause includes inArray(id, orderedIds)
 *   4. Post-update count check: if updated.length !== orderedIds.length,
 *      throw OwnerMismatchError — every submitted id is owner-owned and in
 *      the wishlist+grail set.
 *   5. (BR-01) Set-completeness check: orderedIds.length must equal the
 *      user's TOTAL wishlist+grail row count. Without this, a partial-set
 *      submission (race with concurrent add/remove in another tab) leaves
 *      unsent rows with stale sort_order that collides with 0..N-1.
 *      Combined with (4) this is a full bidirectional set-equality proof:
 *      every submitted id is in the set (4) AND no set row is missing (5).
 *
 * At v4.1 scale (<500 watches/user) a single CASE WHEN UPDATE is the right
 * shape; lexorank gap-positioning is not needed (CONTEXT D-09).
 */
export async function bulkReorderWishlist(
  userId: string,
  orderedIds: string[],
): Promise<void> {
  if (orderedIds.length === 0) return

  // BR-01 — set-completeness check. Compute the user's total wishlist+grail
  // row count and require orderedIds.length to match. This blocks stale
  // clients that race a concurrent add/remove in another tab and submit a
  // strict subset of the current set. Cheap: COUNT(*) with the user_id +
  // status filter is index-supported by watches_user_sort_idx.
  const totalRows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(watches)
    .where(
      and(
        eq(watches.userId, userId),
        inArray(watches.status, ['wishlist', 'grail']),
      ),
    )
  const total = totalRows[0]?.c ?? 0
  if (total !== orderedIds.length) {
    throw new SetMismatchError(total, orderedIds.length)
  }

  // Postgres infers text type for CASE WHEN parameters by default; cast each
  // ordinal to int4 so the assignment to integer column "sort_order" succeeds.
  const chunks: SQL[] = [sql`(case`]
  orderedIds.forEach((id, idx) => {
    chunks.push(sql`when ${watches.id} = ${id} then ${idx}::int4`)
  })
  chunks.push(sql`end)`)
  const caseExpr = sql.join(chunks, sql.raw(' '))

  const updated = await db
    .update(watches)
    .set({ sortOrder: caseExpr, updatedAt: new Date() })
    .where(
      and(
        eq(watches.userId, userId),
        inArray(watches.id, orderedIds),
        inArray(watches.status, ['wishlist', 'grail']),
      ),
    )
    .returning({ id: watches.id })

  if (updated.length !== orderedIds.length) {
    throw new OwnerMismatchError(orderedIds.length, updated.length)
  }
}

// ---- Phase 60: Photo cap + CRUD -----------------------------------------------

/**
 * Phase 60 D-12 — maximum number of owner-uploaded photos per watch.
 * Canonical location is this DAL enforcement site. Counts watch_photos rows ONLY
 * (does not include wear pics — see D-14 and Phase 62).
 */
export const MAX_PHOTOS_PER_WATCH = 10

/**
 * Phase 60 D-13 — thrown when addWatchPhoto would exceed MAX_PHOTOS_PER_WATCH.
 * The cap is intentionally soft (no DB CHECK) so it can be tuned via code
 * without a migration. DAL is the sole write path — this error is the gate.
 */
export class PhotoCapExceededError extends Error {
  constructor(public cap: number) {
    super(`Photo cap reached: a watch may have at most ${cap} photos`)
    this.name = 'PhotoCapExceededError'
  }
}

/**
 * Phase 60 (PHOTO-07) — Insert a new photo for an owned watch.
 *
 * Three-step guard (T-60-XTENANT / T-60-CAP):
 *   1. Ownership check — `watches.id = watchId AND watches.user_id = userId`; throws on miss.
 *   2. Cap check — `count(*) >= MAX_PHOTOS_PER_WATCH`; throws PhotoCapExceededError (D-13).
 *      Counts watch_photos rows ONLY (D-14; wear pics are not counted).
 *   3. Next sort_order = coalesce(max(sortOrder), -1)::int + 1 (starts at 0 for first photo).
 *   4. Insert + return.
 *
 * Returns the inserted row. Caller stores the storagePath after a successful upload.
 */
export async function addWatchPhoto(
  userId: string,
  watchId: string,
  storagePath: string,
): Promise<typeof watchPhotos.$inferSelect> {
  // 1. Ownership check
  const owned = await db
    .select({ id: watches.id })
    .from(watches)
    .where(and(eq(watches.id, watchId), eq(watches.userId, userId)))
    .limit(1)
  if (!owned[0]) {
    throw new Error(`Watch not found or access denied: watchId=${watchId}, userId=${userId}`)
  }

  // 2. Cap check (counts watch_photos rows only — D-14)
  const countRows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(watchPhotos)
    .where(eq(watchPhotos.watchId, watchId))
  const current = countRows[0]?.c ?? 0
  if (current >= MAX_PHOTOS_PER_WATCH) {
    throw new PhotoCapExceededError(MAX_PHOTOS_PER_WATCH)
  }

  // 3. Next sort_order
  const maxRows = await db
    .select({ maxSort: sql<number>`coalesce(max(${watchPhotos.sortOrder}), -1)::int` })
    .from(watchPhotos)
    .where(eq(watchPhotos.watchId, watchId))
  const nextSort = (maxRows[0]?.maxSort ?? -1) + 1

  // 4. Insert
  const inserted = await db
    .insert(watchPhotos)
    .values({ watchId, storagePath, sortOrder: nextSort })
    .returning()
  return inserted[0]
}

/**
 * Phase 60 (D-03, T-60-REORDER) — Rewrite sort_order for all photos on a watch
 * in a single round-trip via UPDATE … CASE WHEN.
 *
 * Defense-in-depth (mirrors bulkReorderWishlist):
 *   1. Ownership check via watches table (T-60-XTENANT).
 *   2. Set-completeness check: count of watch_photos must equal orderedIds.length.
 *      Rejects partial-set submissions (SetMismatchError) that would leave stale
 *      sort_order values colliding with the 0..N-1 range.
 *   3. CASE WHEN bulk update; OwnerMismatchError if updated.length !== orderedIds.length.
 */
export async function bulkReorderPhotos(
  userId: string,
  watchId: string,
  orderedIds: string[],
): Promise<void> {
  if (orderedIds.length === 0) return

  // 1. Ownership check
  const owned = await db
    .select({ id: watches.id })
    .from(watches)
    .where(and(eq(watches.id, watchId), eq(watches.userId, userId)))
    .limit(1)
  if (!owned[0]) {
    throw new Error(`Watch not found or access denied: watchId=${watchId}, userId=${userId}`)
  }

  // 2. Set-completeness check
  const totalRows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(watchPhotos)
    .where(eq(watchPhotos.watchId, watchId))
  const total = totalRows[0]?.c ?? 0
  if (total !== orderedIds.length) {
    throw new SetMismatchError(total, orderedIds.length)
  }

  // 3. CASE WHEN bulk update
  const chunks: SQL[] = [sql`(case`]
  orderedIds.forEach((id, idx) => {
    chunks.push(sql`when ${watchPhotos.id} = ${id} then ${idx}::int4`)
  })
  chunks.push(sql`end)`)
  const caseExpr = sql.join(chunks, sql.raw(' '))

  const updated = await db
    .update(watchPhotos)
    .set({ sortOrder: caseExpr })
    .where(
      and(
        eq(watchPhotos.watchId, watchId),
        inArray(watchPhotos.id, orderedIds),
      ),
    )
    .returning({ id: watchPhotos.id })

  if (updated.length !== orderedIds.length) {
    throw new OwnerMismatchError(orderedIds.length, updated.length)
  }
}

/**
 * Phase 60 (T-60-XTENANT) — Delete a single photo row for an owned watch.
 *
 * Ownership check is via the watches table (not watchPhotos) so the
 * cross-tenant guard is on `watches.user_id = userId`.
 * Throws if the photo does not exist or the watch is not owned by userId.
 */
export async function deleteWatchPhoto(
  userId: string,
  watchId: string,
  photoId: string,
): Promise<void> {
  // Ownership check
  const owned = await db
    .select({ id: watches.id })
    .from(watches)
    .where(and(eq(watches.id, watchId), eq(watches.userId, userId)))
    .limit(1)
  if (!owned[0]) {
    throw new Error(`Watch not found or access denied: watchId=${watchId}, userId=${userId}`)
  }

  const deleted = await db
    .delete(watchPhotos)
    .where(and(eq(watchPhotos.id, photoId), eq(watchPhotos.watchId, watchId)))
    .returning()
  if (!deleted[0]) {
    throw new Error(`Photo not found: photoId=${photoId}, watchId=${watchId}`)
  }
}

/**
 * Phase 61 Plan 01 (PHOTO-02/03/05/06) — Return all photos for a watch ordered
 * by sortOrder ascending.
 *
 * No userId param — ownership framing is resolved by the RSC that already
 * confirmed the viewer has access to this watch. This is a pure read by watchId
 * used to populate the carousel and filmstrip. The RSC signs the URLs before
 * passing signedPhotos to WatchDetail/WatchPhotoSection.
 */
export async function getWatchPhotosForWatch(
  watchId: string,
): Promise<{ id: string; storagePath: string; sortOrder: number }[]> {
  const rows = await db
    .select({
      id: watchPhotos.id,
      storagePath: watchPhotos.storagePath,
      sortOrder: watchPhotos.sortOrder,
    })
    .from(watchPhotos)
    .where(eq(watchPhotos.watchId, watchId))
    .orderBy(asc(watchPhotos.sortOrder))
  return rows
}
