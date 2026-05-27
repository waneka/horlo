'use server'

import { revalidateTag, updateTag } from 'next/cache'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

import { getCurrentUser } from '@/lib/auth'
import { logNotification } from '@/lib/notifications/logger'
import { getProfileById } from '@/data/profiles'
import type { ActionResult } from '@/lib/actionTypes'
import { getLikesForTarget, createLike, deleteLike } from '@/data/reactions'
import type { LikeTarget } from '@/data/reactions'
import { db } from '@/db'
import { watches, wearEvents } from '@/db/schema'

// Mass-assignment protection (SEC-03): Zod .strict() rejects any payload keys
// other than `type` and `id`. The actor is NEVER accepted from client input —
// it is always derived from getCurrentUser().id on the server. The owner is
// resolved server-side from the watches/wearEvents tables, never from the client.
// A client that tries to POST { type, id, actorId } fails the strict parse.
const toggleLikeSchema = z
  .object({
    type: z.enum(['watch', 'wear']), // DAL discriminator — 'wear' not 'wear_event'
    id: z.string().uuid(),
  })
  .strict()

export async function toggleLikeAction(
  data: unknown,
): Promise<ActionResult<{ liked: boolean; count: number }>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = toggleLikeSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    const target: LikeTarget = { type: parsed.data.type, id: parsed.data.id }

    // Resolve owner + brand/model SERVER-SIDE (SEC-03 IDOR prevention).
    // Never trust a client-supplied ownerId — always read from the DB.
    let ownerId: string
    let watchBrand: string
    let watchModel: string

    if (target.type === 'watch') {
      const [watchRow] = await db
        .select({ userId: watches.userId, brand: watches.brand, model: watches.model })
        .from(watches)
        .where(eq(watches.id, target.id))
        .limit(1)

      if (!watchRow) return { success: false, error: 'Not found' }

      ownerId = watchRow.userId
      watchBrand = watchRow.brand
      watchModel = watchRow.model
    } else {
      // 'wear' target: look up wearEvent → parent watch for brand/model
      const [wearRow] = await db
        .select({ userId: wearEvents.userId, watchId: wearEvents.watchId })
        .from(wearEvents)
        .where(eq(wearEvents.id, target.id))
        .limit(1)

      if (!wearRow) return { success: false, error: 'Not found' }

      const [watchRow] = await db
        .select({ brand: watches.brand, model: watches.model })
        .from(watches)
        .where(eq(watches.id, wearRow.watchId))
        .limit(1)

      ownerId = wearRow.userId
      watchBrand = watchRow?.brand ?? ''
      watchModel = watchRow?.model ?? ''
    }

    // Pre-resolve actor profile so logNotification has denormalized fields.
    // Fetching before the primary commit keeps the logger non-blocking
    // (RESEARCH §Open Questions #5 — REVERSED from recommendation: caller resolves).
    const actorProfile = await getProfileById(user.id)

    // Read state + toggle (toggle composition is this action's job — DAL line 89 forbids a DAL toggleLike).
    const before = await getLikesForTarget(user.id, target)
    if (before.viewerHasLiked) {
      await deleteLike(user.id, target)
    } else {
      await createLike(user.id, target)
    }
    const liked = !before.viewerHasLiked
    const count = liked ? before.count + 1 : before.count - 1

    // Cache invalidation — D-07 full contract:
    // 1. Cross-user fan-out: count visible to all viewers
    revalidateTag(`reactions:${target.type}:${target.id}`, 'max')

    // 2. Owner's profile grid count badge (only if we can resolve the username)
    const ownerProfile = await getProfileById(ownerId)
    if (ownerProfile?.username) {
      revalidateTag(`profile:${ownerProfile.username}`, 'max')
      // D-12: bust viewer's own batched counts cache (liked + canComment fields).
      // viewer:reactions tag (updateTag below) covers LikeButton on the detail page;
      // viewer:counts tag covers getBatchedWatchCountsCached on the profile grid.
      revalidateTag(`viewer:${user.id}:counts`, 'max')
    }

    // 3. RYO — actor sees own liked state immediately (Server-Action-only updateTag, D-07 SEC-05)
    updateTag(`viewer:${user.id}:reactions`)

    // Notification — NOTIF-11: fire ONLY on the create (like) direction, never on unlike.
    // Also skip when actor === owner (self-like self-guard); the logger's D-24 belt-and-suspenders
    // internal guard also catches this, but the explicit check here keeps intent readable.
    // AWAITED (not fire-and-forget): Next 16 workAsyncStorage is torn down when the Server Action
    // returns. We must await the insert before invalidating the bell cache — otherwise the bell
    // refetch could race the insert and re-cache a stale "no unread" state. The logger's internal
    // try/catch (D-27) guarantees logNotification never throws, so awaiting preserves D-28.
    if (liked && ownerId !== user.id) {
      if (target.type === 'watch') {
        await logNotification({
          type: 'watch_like',
          recipientUserId: ownerId,
          actorUserId: user.id,
          payload: {
            actor_username: actorProfile?.username ?? '',
            actor_display_name: actorProfile?.displayName ?? null,
            watch_id: target.id,           // payload key MUST match dedup index expression: payload->>'watch_id'
            watch_brand: watchBrand,
            watch_model: watchModel,
          },
        })
      } else {
        await logNotification({
          type: 'wear_like',
          recipientUserId: ownerId,
          actorUserId: user.id,
          payload: {
            actor_username: actorProfile?.username ?? '',
            actor_display_name: actorProfile?.displayName ?? null,
            wear_event_id: target.id,      // payload key MUST match dedup index expression: payload->>'wear_event_id' (NOT wear_id or wear_event)
            watch_brand: watchBrand,
            watch_model: watchModel,
          },
        })
      }
      // Bell cache on RECIPIENT — invalidate after the awaited insert so the dot lights up.
      revalidateTag(`viewer:${ownerId}`, 'max')
    }

    return { success: true, data: { liked, count } }
  } catch (err) {
    console.error('[toggleLikeAction] unexpected error:', err)
    return { success: false, error: "Couldn't update like. Try again." }
  }
}
