// DAL is server-only — importing this from a client component is a build-time error.
import 'server-only'

import { db } from '@/db'
import { watches, profileSettings } from '@/db/schema'
import { eq, and, or, asc, desc, inArray, sql, type SQL } from 'drizzle-orm'
import type { Watch } from '@/lib/types'

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
    movement: row.movement,
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
    imageUrl: row.imageUrl ?? undefined,
    // Phase 17 catalog FK — preserve null to let callers distinguish "not linked" from "not fetched"
    catalogId: row.catalogId ?? null,
    // Phase 27 — sort_order for wishlist drag-reorder (D-01).
    sortOrder: row.sortOrder,
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
  if (data.movement !== undefined) row.movement = data.movement
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
  if ('imageUrl' in data) row.imageUrl = data.imageUrl ?? null

  // Phase 27 — sort_order is mappable from the domain layer so server
  // actions can pass `{ sortOrder: maxSort + 1 }` for D-03/D-04 bumps.
  if ('sortOrder' in data && data.sortOrder !== undefined) row.sortOrder = data.sortOrder

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
 */
export async function getWatchesByUser(userId: string): Promise<Watch[]> {
  const rows = await db
    .select()
    .from(watches)
    .where(eq(watches.userId, userId))
    .orderBy(asc(watches.sortOrder), desc(watches.createdAt))
  return rows.map(mapRowToWatch)
}

/**
 * Return a single watch by ID, scoped to userId. Returns null if not found.
 * Not-found is an expected outcome, not a thrown error (D-08).
 */
export async function getWatchById(userId: string, watchId: string): Promise<Watch | null> {
  const rows = await db
    .select()
    .from(watches)
    .where(and(eq(watches.userId, userId), eq(watches.id, watchId)))
  return rows[0] ? mapRowToWatch(rows[0]) : null
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
): Promise<{ watch: Watch; isOwner: boolean } | null> {
  const rows = await db
    .select({
      watch: watches,
      profilePublic: profileSettings.profilePublic,
      collectionPublic: profileSettings.collectionPublic,
      wishlistPublic: profileSettings.wishlistPublic,
    })
    .from(watches)
    .innerJoin(profileSettings, eq(profileSettings.userId, watches.userId))
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
    watch: mapRowToWatch(row.watch),
    isOwner: row.watch.userId === viewerId,
  }
}

/**
 * Insert a new watch for the given user. Returns the created Watch domain object.
 */
export async function createWatch(userId: string, data: Omit<Watch, 'id'>): Promise<Watch> {
  const rowData = mapDomainToRow(data)
  const inserted = await db
    .insert(watches)
    .values({
      ...rowData,
      brand: data.brand,
      model: data.model,
      status: data.status,
      movement: data.movement,
      complications: data.complications,
      styleTags: data.styleTags,
      designTraits: data.designTraits,
      roleTags: data.roleTags,
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
 * Phase 27 (WISH-01, D-09, D-10, T-27-01, T-27-02) — Bulk-update sort_order
 * for the user's wishlist+grail set in a single round-trip via UPDATE … CASE WHEN.
 *
 * Defense-in-depth (per RESEARCH Pitfall 5 + Pattern 5):
 *   1. WHERE clause includes user_id (T-27-01: cross-tenant reorder)
 *   2. WHERE clause includes status IN ('wishlist','grail') (T-27-02: status-confused reorder)
 *   3. WHERE clause includes inArray(id, orderedIds)
 *   4. Post-update count check: if updated.length !== orderedIds.length,
 *      throw "Owner mismatch" — caller (Server Action) maps to ActionResult.failure.
 *
 * At v4.1 scale (<500 watches/user) a single CASE WHEN UPDATE is the right
 * shape; lexorank gap-positioning is not needed (CONTEXT D-09).
 */
export async function bulkReorderWishlist(
  userId: string,
  orderedIds: string[],
): Promise<void> {
  if (orderedIds.length === 0) return

  const chunks: SQL[] = [sql`(case`]
  orderedIds.forEach((id, idx) => {
    chunks.push(sql`when ${watches.id} = ${id} then ${idx}`)
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
    throw new Error(
      `Owner mismatch: expected ${orderedIds.length} rows, updated ${updated.length}`,
    )
  }
}
