import 'server-only'

import { db } from '@/db'
import { wearEvents, profileSettings, follows, profiles, watches } from '@/db/schema'
import { eq, and, desc, inArray, gte, or, sql } from 'drizzle-orm'
import type { WywtTile, WywtRailData } from '@/lib/wywtTypes'
import type { WearVisibility } from '@/lib/wearVisibility'

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

/**
 * Preflight duplicate-day helper (WYWT-12, 15-CONTEXT.md D-13).
 *
 * Returns the set of watch IDs that `userId` has wear events for on `today`.
 * Used by Plan 03b's `WatchPickerDialog` to dim/disable watches already worn
 * today (preflight UI guard). Paired with the server-side 23505 catch in
 * `logWearWithPhoto` for defense in depth against concurrent inserts.
 *
 * Owner-only query — only the caller's own picker invokes this (the Server
 * Action wrapper `getWornTodayIdsForUserAction` further guards against
 * cross-user input per T-15-16). PROJECT.md caps users at <500 watches so a
 * full scan per (user, date) is acceptable; no index beyond the existing
 * `wear_events_unique_day` UNIQUE constraint is needed.
 */
export async function getWornTodayIdsForUser(
  userId: string,
  today: string,
): Promise<ReadonlySet<string>> {
  const rows = await db
    .select({ watchId: wearEvents.watchId })
    .from(wearEvents)
    .where(and(eq(wearEvents.userId, userId), eq(wearEvents.wornDate, today)))
  return new Set(rows.map((r) => r.watchId))
}

/**
 * Photo-bearing wear event insert (WYWT-15, 15-CONTEXT.md D-15).
 *
 * Mirrors logWearEvent's shape but accepts the full payload including the
 * client-generated wearEventId (so the Server Action can assert the Storage
 * object exists at `{userId}/{id}.jpg` BEFORE inserting — Pattern 7), the
 * three-tier visibility, and the photo path (or null for no-photo posts).
 *
 * Unlike logWearEvent, this helper does NOT use `onConflictDoNothing` —
 * caller (`logWearWithPhoto` Server Action) catches PG 23505 explicitly so it
 * can (a) return the duplicate-day error to the client and (b) clean up the
 * orphan Storage object. Silently swallowing the conflict would leave the
 * client thinking the insert succeeded.
 */
export async function logWearEventWithPhoto(input: {
  id: string
  userId: string
  watchId: string
  wornDate: string
  note: string | null
  photoUrl: string | null
  visibility: WearVisibility
}): Promise<void> {
  await db.insert(wearEvents).values({
    id: input.id,
    userId: input.userId,
    watchId: input.watchId,
    wornDate: input.wornDate,
    note: input.note,
    photoUrl: input.photoUrl,
    visibility: input.visibility,
  })
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
 * Three-tier viewer-aware wear-event reader (Phase 12 D-03 / WYWT-10).
 *
 * Replaces the v2.0 `getPublicWearEventsForViewer` which gated on
 * `profile_settings.worn_public`. The new gate is per-row
 * `wear_events.visibility`:
 *
 *   - 'public'    — visible to anyone when actor.profile_public = true
 *   - 'followers' — visible only when viewer follows actor (G-3 directional;
 *                   variable name `viewerFollowsActor` to avoid the inverted
 *                   follow direction footgun) AND actor.profile_public = true
 *   - 'private'   — visible only to the actor themselves (self-bypass G-5)
 *
 * Two-layer privacy (v2.0 D-15 → Phase 12):
 *   - OUTER gate: RLS on wear_events (Phase 7) is owner-only at anon-key
 *   - INNER gate: this WHERE clause for the postgres-role connection used
 *     by server-rendered pages
 *
 * G-4 outer profile_public gate is preserved on every non-owner branch:
 * a `visibility='public'` wear by a `profile_public=false` actor is
 * invisible to non-owner viewers.
 */
export async function getWearEventsForViewer(
  viewerUserId: string | null,
  profileUserId: string,
) {
  // Self bypass (G-5): owner sees ALL their wears regardless of visibility.
  if (viewerUserId === profileUserId) {
    return getAllWearEventsByUser(profileUserId)
  }

  // Resolve viewer→owner follow relationship as a single boolean.
  // (For per-profile fetch, the follow check is one row, not per-event;
  // this is cheaper than a leftJoin per the canonical pattern.)
  let viewerFollowsActor = false
  if (viewerUserId) {
    const followRows = await db
      .select({ id: follows.id })
      .from(follows)
      .where(
        and(
          eq(follows.followerId, viewerUserId),
          eq(follows.followingId, profileUserId),
        ),
      )
      .limit(1)
    viewerFollowsActor = followRows.length > 0
  }

  // Three-tier predicate composed inline. Drizzle does not compose `or`/`and`
  // through TS helpers cleanly (RESEARCH "Don't Hand-Roll" recommendation),
  // so the predicate lives at the call site with comments tracking pitfalls.
  const visibilityPredicate = viewerFollowsActor
    ? or(
        eq(wearEvents.visibility, 'public'),
        eq(wearEvents.visibility, 'followers'),
      )
    : eq(wearEvents.visibility, 'public')

  const rows = await db
    .select({
      id: wearEvents.id,
      userId: wearEvents.userId,
      watchId: wearEvents.watchId,
      wornDate: wearEvents.wornDate,
      note: wearEvents.note,
      photoUrl: wearEvents.photoUrl,
      visibility: wearEvents.visibility,
      createdAt: wearEvents.createdAt,
    })
    .from(wearEvents)
    .innerJoin(profileSettings, eq(profileSettings.userId, wearEvents.userId))
    .where(
      and(
        eq(wearEvents.userId, profileUserId),
        eq(profileSettings.profilePublic, true), // G-4 outer gate
        visibilityPredicate,
      ),
    )
    .orderBy(desc(wearEvents.wornDate))

  return rows
}

/**
 * WYWT rail DAL (CONTEXT.md W-01 / W-03 / W-07).
 *
 * Phase 12 ripple (WYWT-10): the per-tab `worn_public` boolean gate is
 * replaced with the three-tier `wear_events.visibility` predicate. The
 * outer `profile_public` gate (G-4) is preserved. The self-include
 * short-circuit (G-5) is preserved. The follow relationship is checked
 * per-row via a leftJoin (G-3 directional: viewer → actor).
 */
export async function getWearRailForViewer(viewerId: string): Promise<WywtRailData> {
  const cutoffMs = Date.now() - 48 * 60 * 60 * 1000
  const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10)

  const followingRows = await db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, viewerId))
  const followingIds = followingRows.map((r) => r.id)
  const actorIds = [viewerId, ...followingIds]

  const rows = await db
    .select({
      wearId: wearEvents.id,
      userId: wearEvents.userId,
      watchId: wearEvents.watchId,
      wornDate: wearEvents.wornDate,
      note: wearEvents.note,
      createdAt: wearEvents.createdAt,
      visibility: wearEvents.visibility, // Phase 12: tile carries tier
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      profilePublic: profileSettings.profilePublic,
      brand: watches.brand,
      model: watches.model,
      imageUrl: watches.imageUrl,
    })
    .from(wearEvents)
    .innerJoin(profiles, eq(profiles.id, wearEvents.userId))
    .innerJoin(profileSettings, eq(profileSettings.userId, wearEvents.userId))
    .innerJoin(watches, eq(watches.id, wearEvents.watchId))
    .leftJoin(
      follows,
      and(
        eq(follows.followerId, viewerId),
        eq(follows.followingId, wearEvents.userId),
      ),
    )
    .where(
      and(
        inArray(wearEvents.userId, actorIds),
        gte(wearEvents.wornDate, cutoffDate),
        or(
          eq(wearEvents.userId, viewerId), // G-5 self bypass
          and(
            eq(profileSettings.profilePublic, true), // G-4 outer gate
            or(
              eq(wearEvents.visibility, 'public'),
              and(
                eq(wearEvents.visibility, 'followers'),
                sql`${follows.id} IS NOT NULL`, // viewer follows actor (G-3)
              ),
            ),
          ),
        ),
      ),
    )
    .orderBy(desc(wearEvents.wornDate), desc(wearEvents.createdAt))

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
    visibility: r.visibility as WearVisibility, // Phase 12: tile carries tier
    isSelf: r.userId === viewerId,
  }))

  return { tiles, viewerId }
}
