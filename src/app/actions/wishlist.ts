'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { wearEvents, watches, profileSettings } from '@/db/schema'
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
 * Visibility gate (defense-in-depth, T-10-03-03): the source wear event must
 * either be the viewer's own OR belong to an actor whose worn_public = true.
 * Rejections return a generic 'Wear event not found' to avoid existence
 * leaks.
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

  // Resolve the source wear event, its watch metadata, and the actor's
  // worn_public setting in a single JOIN query.
  const rows = await db
    .select({
      watchId: wearEvents.watchId,
      actorId: wearEvents.userId,
      brand: watches.brand,
      model: watches.model,
      imageUrl: watches.imageUrl,
      movement: watches.movement,
      wornPublic: profileSettings.wornPublic,
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

  // Privacy gate: viewer-own is fine; otherwise worn_public must be true.
  // Same 'Wear event not found' message on both branches to avoid leaking
  // existence of private wears.
  if (row.actorId !== user.id && !row.wornPublic) {
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
