import 'server-only'

import { db } from '@/db'
import { wearEvents, profileSettings } from '@/db/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'

export async function logWearEvent(
  userId: string,
  watchId: string,
  wornDate: string,
  note?: string
) {
  await db
    .insert(wearEvents)
    .values({ userId, watchId, wornDate, note: note ?? null })
    .onConflictDoNothing()
}

export async function getMostRecentWearDate(
  userId: string,
  watchId: string
): Promise<string | null> {
  const rows = await db
    .select({ wornDate: wearEvents.wornDate })
    .from(wearEvents)
    .where(and(eq(wearEvents.userId, userId), eq(wearEvents.watchId, watchId)))
    .orderBy(desc(wearEvents.wornDate))
    .limit(1)
  return rows[0]?.wornDate ?? null
}

export async function getWearEventsByWatch(
  userId: string,
  watchId: string
) {
  return db
    .select()
    .from(wearEvents)
    .where(and(eq(wearEvents.userId, userId), eq(wearEvents.watchId, watchId)))
    .orderBy(desc(wearEvents.wornDate))
}

export async function getMostRecentWearDates(
  userId: string,
  watchIds: string[]
): Promise<Map<string, string>> {
  // WR-06: inArray is imported statically at the top — the prior dynamic
  // import defeated tree-shaking and added a microtask per call on a hot path
  // hit by every Collection / Wishlist / Notes render.
  if (watchIds.length === 0) return new Map()
  const rows = await db
    .select({ watchId: wearEvents.watchId, wornDate: wearEvents.wornDate })
    .from(wearEvents)
    .where(and(eq(wearEvents.userId, userId), inArray(wearEvents.watchId, watchIds)))
    .orderBy(desc(wearEvents.wornDate))
  const map = new Map<string, string>()
  for (const row of rows) {
    if (!map.has(row.watchId)) {
      map.set(row.watchId, row.wornDate)
    }
  }
  return map
}

/**
 * Returns ALL wear events for a userId, ordered by wornDate desc.
 * No pagination — D-09 worn tab needs the full set for both Timeline and
 * Calendar views; PROJECT.md caps users at <500 watches so this is bounded.
 */
export async function getAllWearEventsByUser(userId: string) {
  return db
    .select()
    .from(wearEvents)
    .where(eq(wearEvents.userId, userId))
    .orderBy(desc(wearEvents.wornDate))
}

/**
 * DAL visibility gate (D-15, PRIV-05). Two-layer enforcement:
 *   - RLS on wear_events (Phase 7) is owner-only at the DB level — direct
 *     anon-key clients cannot read another user's events.
 *   - This DAL gate guards the postgres-role connection used by server-rendered
 *     pages: when viewer != owner AND owner.wornPublic is false, returns [].
 * Owner always sees their own events.
 */
export async function getPublicWearEventsForViewer(
  viewerUserId: string | null,
  profileUserId: string
) {
  if (viewerUserId !== profileUserId) {
    const settings = await db
      .select({ wornPublic: profileSettings.wornPublic })
      .from(profileSettings)
      .where(eq(profileSettings.userId, profileUserId))
      .limit(1)
    // Missing settings row → defaults to public (matches getProfileSettings default)
    const wornPublic = settings[0]?.wornPublic ?? true
    if (!wornPublic) return []
  }
  return getAllWearEventsByUser(profileUserId)
}
