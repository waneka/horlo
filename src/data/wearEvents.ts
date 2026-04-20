import 'server-only'

import { db } from '@/db'
import { wearEvents } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

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
  if (watchIds.length === 0) return new Map()
  const { inArray } = await import('drizzle-orm')
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
