// DAL is server-only — importing this from a client component is a build-time error.
import 'server-only'

import { db } from '@/db'
import { watches } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
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

  return row
}

/**
 * Return all watches for a user, ordered by creation date descending.
 */
export async function getWatchesByUser(userId: string): Promise<Watch[]> {
  const rows = await db.select().from(watches).where(eq(watches.userId, userId))
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
