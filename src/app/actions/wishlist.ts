'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'

import { db } from '@/db'
import { wearEvents, watches, profileSettings, follows } from '@/db/schema'
import { getCurrentUser } from '@/lib/auth'
import { createWatch } from '@/data/watches'
import { logActivity } from '@/data/activities'
import type { ActionResult } from '@/lib/actionTypes'
import type { MovementType } from '@/lib/types'

/**
 * Mass-assignment protection (T-10-03-04): .strict() rejects any payload key
 * other than `wearEventId`. Brand/model/imageUrl are never taken from the
 * client — they are snapshotted server-side from the source wear event's
 * watch row.
 */
const schema = z.object({ wearEventId: z.string().uuid() }).strict()

/**
 * WYWT overlay "Add to wishlist" (CONTEXT.md W-05).
 *
 * Snapshots the source wear event's watch metadata into a NEW `watches` row
 * with status='wishlist' under the viewer's account. Per Horlo's
 * per-user-independent-entries model there is no canonical watch DB;
 * duplicates are tolerated because <specifics> calls this a conversion
 * moment with one-tap no-friction UX.
 *
 * Three-tier visibility gate (Phase 12 / WYWT-10): the source wear event
 * must be the viewer's own (G-5 self-bypass) OR the actor's profile_public
 * must be true (G-4 outer gate) AND one of:
 *   - wear_events.visibility = 'public', OR
 *   - wear_events.visibility = 'followers' AND viewer follows actor (G-3
 *     directional: viewer is the follower).
 * Any negative branch returns the uniform 'Wear event not found' message
 * to avoid existence leaks (Letterboxd-style 404; RESEARCH Open Question #3).
 *
 * Activity logging is fire-and-forget (Phase 7 D-05) — a failure in
 * logActivity never blocks the primary mutation.
 */
export async function addToWishlistFromWearEvent(
  data: unknown,
): Promise<ActionResult<{ watchId: string }>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  // Resolve the source wear event, its watch metadata, the actor's profile_public,
  // and the wear visibility in a single JOIN query.
  const rows = await db
    .select({
      watchId: wearEvents.watchId,
      actorId: wearEvents.userId,
      brand: watches.brand,
      model: watches.model,
      imageUrl: watches.imageUrl,
      movement: watches.movement,
      profilePublic: profileSettings.profilePublic,
      visibility: wearEvents.visibility,
    })
    .from(wearEvents)
    .innerJoin(watches, eq(watches.id, wearEvents.watchId))
    .innerJoin(profileSettings, eq(profileSettings.userId, wearEvents.userId))
    .where(eq(wearEvents.id, parsed.data.wearEventId))
    .limit(1)

  const row = rows[0]
  if (!row) {
    return { success: false, error: 'Wear event not found' }
  }

  // Three-tier visibility gate. Self-bypass (G-5) FIRST.
  const isSelf = row.actorId === user.id
  let isFollower = false
  if (!isSelf && row.visibility === 'followers') {
    // Only resolve the follow relationship when needed (followers tier).
    // 'public' tier doesn't need a follow check; 'private' is rejected
    // unconditionally for non-self.
    const followRows = await db
      .select({ id: follows.id })
      .from(follows)
      .where(
        and(
          eq(follows.followerId, user.id),
          eq(follows.followingId, row.actorId),
        ),
      )
      .limit(1)
    isFollower = followRows.length > 0
  }

  const canSee =
    isSelf ||
    (row.profilePublic &&
      (row.visibility === 'public' ||
        (row.visibility === 'followers' && isFollower)))

  if (!canSee) {
    // Uniform error string preserves Letterboxd-style 404 (RESEARCH Open Question #3).
    return { success: false, error: 'Wear event not found' }
  }

  try {
    // Create a NEW watch row under the viewer's account, snapshotted from
    // the source. Required fields per Watch domain type:
    // brand, model, status, movement, complications, styleTags, designTraits,
    // roleTags. Optional: imageUrl (undefined when source has none).
    const watch = await createWatch(user.id, {
      brand: row.brand,
      model: row.model,
      status: 'wishlist',
      movement: row.movement as MovementType,
      complications: [],
      styleTags: [],
      designTraits: [],
      roleTags: [],
      imageUrl: row.imageUrl ?? undefined,
    })

    // Fire-and-forget activity log (Phase 7 D-05) — failure must never block
    // the primary mutation.
    try {
      await logActivity(user.id, 'wishlist_added', watch.id, {
        brand: watch.brand,
        model: watch.model,
        imageUrl: watch.imageUrl ?? null,
      })
    } catch (err) {
      console.error('[addToWishlistFromWearEvent] activity log failed (non-fatal):', err)
    }

    revalidatePath('/')
    return { success: true, data: { watchId: watch.id } }
  } catch (err) {
    console.error('[addToWishlistFromWearEvent] unexpected error:', err)
    return { success: false, error: "Couldn't save to wishlist." }
  }
}
