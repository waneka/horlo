'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import * as followsDAL from '@/data/follows'
import { getCurrentUser } from '@/lib/auth'
import { logNotification } from '@/lib/notifications/logger'
import { getProfileById } from '@/data/profiles'
import type { ActionResult } from '@/lib/actionTypes'

// Mass-assignment protection (T-09-01, T-09-05): Zod .strict() rejects any
// payload keys other than `userId`. The follower side is NEVER accepted
// from client input — it is always derived from getCurrentUser().id on the
// server. A client that tries to POST { userId, followerId } fails the
// strict Zod parse and is rejected with 'Invalid request'.
const followSchema = z.object({ userId: z.string().uuid() }).strict()

export async function followUser(data: unknown): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = followSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  // D-10 + T-09-02: self-follow rejected at the application layer. The
  // follows_insert_own RLS policy permits follower_id = auth.uid(), which
  // does NOT block self-follow on its own. Application-layer rejection is
  // load-bearing here to prevent follower-count inflation.
  if (parsed.data.userId === user.id) {
    return { success: false, error: 'Cannot follow yourself' }
  }

  try {
    // Pre-resolve actor profile so logNotification has denormalized fields.
    // Fetching before the primary commit keeps the logger non-blocking (see below).
    // RESEARCH Open Q #5 locks this denormalize-in-caller approach.
    const actorProfile = await getProfileById(user.id)

    // D-10: DAL uses onConflictDoNothing, so duplicate follows are a silent
    // no-op. The action is therefore idempotent — rapid double-clicks yield
    // the same end state without surfacing a duplicate-key error.
    await followsDAL.followUser(user.id, parsed.data.userId)
    // FOLL-03 end-to-end reconciliation: invalidate the layout so ProfileHeader
    // (which calls getFollowerCounts) re-fetches on the next navigation. WR-07
    // precedent — path template must be literal with the bracketed segment.
    revalidatePath('/u/[username]', 'layout')

    // NOTIF-02 — fire-and-forget. Non-awaited (D-28) so a logger failure cannot
    // roll back the follow above. The logger's internal try/catch (Plan 02) means
    // promise rejections never surface as unhandled.
    void logNotification({
      type: 'follow',
      recipientUserId: parsed.data.userId,
      actorUserId: user.id,
      payload: {
        actor_username: actorProfile?.username ?? '',
        actor_display_name: actorProfile?.displayName ?? null,
      },
    })

    return { success: true, data: undefined }
  } catch (err) {
    console.error('[followUser] unexpected error:', err)
    return { success: false, error: "Couldn't follow. Try again." }
  }
}

export async function unfollowUser(data: unknown): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = followSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  // Symmetry with followUser — self-unfollow is rejected so bugs that try to
  // unfollow yourself surface early instead of producing a silent no-op.
  if (parsed.data.userId === user.id) {
    return { success: false, error: 'Cannot unfollow yourself' }
  }

  try {
    await followsDAL.unfollowUser(user.id, parsed.data.userId)
    // FOLL-03 mirror: revalidate the same layout slot on unfollow so counts
    // reconcile on both directions of the toggle.
    revalidatePath('/u/[username]', 'layout')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[unfollowUser] unexpected error:', err)
    return { success: false, error: "Couldn't unfollow. Try again." }
  }
}
