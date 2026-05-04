'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'

import { db } from '@/db'
import { wearEvents, watches, profileSettings, follows } from '@/db/schema'
import { getCurrentUser } from '@/lib/auth'
import { createWatch, bulkReorderWishlist } from '@/data/watches'
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

// Phase 27 (WISH-01) — bulk reorder of the authenticated user's wishlist+grail
// sort_order set in a single round-trip. Owner-only at three layers:
//   1. Zod .strict() — payload must contain only `orderedIds`; userId NEVER
//      taken from the client (mass-assignment defense, T-27-01).
//   2. getCurrentUser() — userId always sourced from session.
//   3. DAL WHERE clause + count check — bulkReorderWishlist throws
//      "Owner mismatch" if any input id is foreign or not in the wishlist+grail
//      set (T-27-01 + T-27-02). Status filter inside the DAL also defends
//      against owned/sold ids slipping in (T-27-02).
//
// T-27-03 (DoS via mass row enumeration): .max(500) caps the array.
// <500 watches per user is the v4.1 scale ceiling (project constraint), so
// 500 is a generous upper bound that still bounds memory and SQL plan size.
//
// Returns ActionResult<void> — never throws across the boundary (matches
// the addToWishlistFromWearEvent shape above and the watches.ts addWatch
// contract). The drag UX (Plan 05) wraps this in startTransition with
// useOptimistic; on { success: false } it surfaces a Sonner toast and the
// optimistic order auto-reverts when the transition resolves (D-09).
const reorderWishlistSchema = z
  .object({
    orderedIds: z.array(z.string().uuid()).min(1).max(500),
  })
  .strict()

export async function reorderWishlist(
  data: unknown,
): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = reorderWishlistSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    await bulkReorderWishlist(user.id, parsed.data.orderedIds)

    // BR-02 fix — actual Next.js route is /u/[username]/[tab], NOT
    // /u/[username]/wishlist. revalidatePath matches against the route
    // definition; passing a non-matching path silently no-ops.
    // Use the dynamic [tab] placeholder so all wishlist tab variants
    // (and the collection tab, since they share the same route file)
    // invalidate. The 'page' second arg invalidates the page-level
    // render for that route.
    revalidatePath('/u/[username]/[tab]', 'page')

    return { success: true, data: undefined }
  } catch (err) {
    console.error('[reorderWishlist] unexpected error:', err)
    if (err instanceof Error && err.message.startsWith('Owner mismatch')) {
      return { success: false, error: 'Some watches do not belong to you.' }
    }
    return { success: false, error: "Couldn't save new order." }
  }
}
