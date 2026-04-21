import 'server-only'

import { db } from '@/db'
import { wearEvents, profileSettings, follows, profiles, watches } from '@/db/schema'
import { eq, and, desc, inArray, gte, or } from 'drizzle-orm'
import type { WywtTile, WywtRailData } from '@/lib/wywtTypes'

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

/**
 * WYWT rail DAL (CONTEXT.md W-01 / W-03 / W-07).
 *
 * Returns at most one WywtTile per actor:
 *   - viewer's own most-recent wear (within 48h) — always included (W-01),
 *   - plus each followed user's most-recent wear (within 48h) provided their
 *     worn_public is true (F-06 carries into WYWT — follows do NOT bypass
 *     privacy).
 *
 * Single JOIN query to avoid N+1 across follows. Two-layer privacy:
 *   - OUTER gate: RLS on wear_events (Phase 7) is owner-only at anon-key.
 *   - INNER gate (this WHERE clause): `or(self, wornPublic)` re-enforces the
 *     worn_public rule at the postgres-role connection level that server-
 *     rendered pages use.
 *
 * The 48h window is computed as the ISO date string of `now - 48h`. Because
 * wear_events.wornDate is TEXT 'YYYY-MM-DD', we compare `wornDate >= cutoff`
 * as a string comparison (lexicographically correct for ISO dates).
 */
export async function getWearRailForViewer(viewerId: string): Promise<WywtRailData> {
  // 1. Compute the 48h-ago ISO date string.
  const cutoffMs = Date.now() - 48 * 60 * 60 * 1000
  const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10) // YYYY-MM-DD

  // 2. Resolve the viewer's following-ids (may be empty).
  const followingRows = await db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, viewerId))
  const followingIds = followingRows.map((r) => r.id)
  const actorIds = [viewerId, ...followingIds]

  // 3. Single JOIN query. Privacy gate: viewer's own rows always pass;
  //    followed-actor rows require worn_public = true.
  const rows = await db
    .select({
      wearId: wearEvents.id,
      userId: wearEvents.userId,
      watchId: wearEvents.watchId,
      wornDate: wearEvents.wornDate,
      note: wearEvents.note,
      createdAt: wearEvents.createdAt,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      wornPublic: profileSettings.wornPublic,
      brand: watches.brand,
      model: watches.model,
      imageUrl: watches.imageUrl,
    })
    .from(wearEvents)
    .innerJoin(profiles, eq(profiles.id, wearEvents.userId))
    .innerJoin(profileSettings, eq(profileSettings.userId, wearEvents.userId))
    .innerJoin(watches, eq(watches.id, wearEvents.watchId))
    .where(
      and(
        inArray(wearEvents.userId, actorIds),
        gte(wearEvents.wornDate, cutoffDate),
        or(
          eq(wearEvents.userId, viewerId), // self-include bypasses worn_public
          eq(profileSettings.wornPublic, true), // followed actors gated
        ),
      ),
    )
    .orderBy(desc(wearEvents.wornDate), desc(wearEvents.createdAt))

  // 4. Dedupe to most-recent-per-actor. Rows are sorted wornDate DESC then
  //    createdAt DESC, so the FIRST row per userId is the most recent.
  const byUser = new Map<string, (typeof rows)[number]>()
  for (const r of rows) {
    if (!byUser.has(r.userId)) byUser.set(r.userId, r)
  }

  const tiles: WywtTile[] = [...byUser.values()].map((r) => ({
    wearEventId: r.wearId,
    userId: r.userId,
    username: r.username,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    watchId: r.watchId,
    brand: r.brand,
    model: r.model,
    imageUrl: r.imageUrl ?? null,
    wornDate: r.wornDate,
    note: r.note,
    isSelf: r.userId === viewerId,
  }))

  return { tiles, viewerId }
}
