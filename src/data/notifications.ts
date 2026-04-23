import 'server-only'
import { db } from '@/db'
import { notifications, profileSettings, watches, profiles } from '@/db/schema'
import { and, desc, eq, ne, sql } from 'drizzle-orm'

/**
 * Shape returned by getNotificationsForViewer. Actor fields are left-joined
 * from profiles at read time (CONTEXT.md <specifics>: "Avatar URL is fetched
 * server-side via the DAL since avatars rotate" — so we don't denormalize avatarUrl
 * into payload).
 */
export interface NotificationRow {
  id: string
  userId: string
  actorId: string | null
  type: 'follow' | 'watch_overlap' | 'price_drop' | 'trending_collector'
  payload: Record<string, unknown>
  readAt: Date | null
  createdAt: Date
  // Joined actor fields — null when actorId is null (system notifications)
  actorUsername: string | null
  actorDisplayName: string | null
  actorAvatarUrl: string | null
}

/**
 * Inbox read — last 50 rows newest-first for the viewer (D-03: no pagination at MVP).
 * RLS already gates this WHERE user_id = auth.uid(); the explicit WHERE user_id =
 * viewerId is two-layer defense per v2.0 discipline (service-role Drizzle client
 * bypasses RLS, so DAL WHERE is load-bearing under the service-role path).
 */
export async function getNotificationsForViewer(
  viewerId: string,
  limit = 50,
): Promise<NotificationRow[]> {
  const rows = await db
    .select({
      id: notifications.id,
      userId: notifications.userId,
      actorId: notifications.actorId,
      type: notifications.type,
      payload: notifications.payload,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actorUsername: profiles.username,
      actorDisplayName: profiles.displayName,
      actorAvatarUrl: profiles.avatarUrl,
    })
    .from(notifications)
    .leftJoin(profiles, eq(profiles.id, notifications.actorId))
    .where(eq(notifications.userId, viewerId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    actorId: r.actorId,
    type: r.type,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    readAt: r.readAt,
    createdAt: r.createdAt,
    actorUsername: r.actorUsername,
    actorDisplayName: r.actorDisplayName,
    actorAvatarUrl: r.actorAvatarUrl,
  }))
}

/**
 * Bell unread-state query (D-06, NOTIF-04 amended). Returns boolean only — no count —
 * since NAV-06/07 specifies a dot.
 *
 * CRITICAL: viewerId is an EXPLICIT argument (D-25). Never resolve the viewer identity
 * inside this function — the parent cached scope uses viewerId in its cache key.
 * Pitfall 5 cache-leak prevention.
 */
export async function getNotificationsUnreadState(
  viewerId: string,
): Promise<{ hasUnread: boolean }> {
  // Single round-trip EXISTS query — compares notification.created_at against
  // the recipient's profile_settings.notifications_last_seen_at. COALESCE to
  // '-infinity'::timestamptz for users missing the row (shouldn't happen after
  // Plan 01 backfill, but defense-in-depth).
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM notifications n
       WHERE n.user_id = ${viewerId}::uuid
         AND n.created_at > COALESCE(
               (SELECT notifications_last_seen_at FROM profile_settings WHERE user_id = ${viewerId}::uuid),
               '-infinity'::timestamptz
             )
    ) AS has_unread
  `)
  const rows = result as unknown as Array<{ has_unread: boolean }>
  return { hasUnread: Boolean(rows[0]?.has_unread) }
}

/**
 * Mark-all-read — used by the SA in src/app/actions/notifications.ts.
 * Server-side WHERE read_at IS NULL filter (Pitfall B-5: NEVER accept a
 * client-supplied id list).
 */
export async function markAllReadForUser(viewerId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, viewerId), sql`${notifications.readAt} IS NULL`))
}

/**
 * Update profile_settings.notifications_last_seen_at = now() for the viewer.
 * Called server-side when the user visits /notifications (D-07). Idempotent.
 */
export async function touchLastSeenAt(viewerId: string): Promise<void> {
  await db
    .update(profileSettings)
    .set({ notificationsLastSeenAt: new Date(), updatedAt: new Date() })
    .where(eq(profileSettings.userId, viewerId))
}

/**
 * findOverlapRecipients — used by addWatch to locate pre-existing owners of the
 * same normalized brand/model. CONTEXT.md D-22 normalization + D-23 self-exclusion.
 *
 * Status filter: 'owned' only (RESEARCH Open Question #1). NOTIF-03 wording "User B
 * already owns" is read literally — wishlist/grail are aspirational, not "owns."
 * If UAT reveals grail should also match, revisit here.
 */
export async function findOverlapRecipients(input: {
  brand: string
  model: string
  actorUserId: string
}): Promise<Array<{ userId: string }>> {
  const rows = await db
    .selectDistinct({ userId: watches.userId })
    .from(watches)
    .where(
      and(
        sql`LOWER(TRIM(${watches.brand})) = LOWER(TRIM(${input.brand}))`,
        sql`LOWER(TRIM(${watches.model})) = LOWER(TRIM(${input.model}))`,
        eq(watches.status, 'owned'),
        ne(watches.userId, input.actorUserId), // D-23 self-exclusion
      ),
    )
  return rows
}
