'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { db } from '@/db'
import { watches, wearEvents, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getProfileById } from '@/data/profiles'
import type { ActionResult } from '@/lib/actionTypes'

/**
 * Purge all objects under wear-photos/{userId}/ using a paginated
 * list-then-remove loop.
 *
 * Runs BEFORE any DB delete (RESEARCH Pitfall 2 / success criterion 2).
 * Throws on list or remove error so the caller's catch block surfaces failure.
 *
 * @param supabase - session-scoped or admin client; caller decides
 * @param userId - the authenticated caller's id
 */
async function purgeWearPhotos(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<void> {
  const PAGE_SIZE = 1000

  // CR-01: Always re-list from offset 0. Each remove() consumes the head of
  // the listing, so the wear-photos/{userId}/ prefix is a flat layout
  // ({userId}/{wearEventId}.jpg, no nested folders) that shrinks every
  // iteration. Advancing an offset would skip the files that shifted into
  // the 0..PAGE_SIZE-1 window after the prior remove(). The loop terminates
  // because each iteration deletes min(PAGE_SIZE, remaining) objects until
  // list() returns empty.
  while (true) {
    const { data: files, error: listErr } = await supabase.storage
      .from('wear-photos')
      .list(userId, { limit: PAGE_SIZE })

    if (listErr) throw listErr

    if (!files || files.length === 0) break

    const paths = files.map((f) => `${userId}/${f.name}`)
    const { error: removeErr } = await supabase.storage
      .from('wear-photos')
      .remove(paths)
    if (removeErr) throw removeErr
  }
}

/**
 * Wipe the caller's watch collection and all associated wear events + storage.
 *
 * D-06: Returns a clean ActionResult so the WipeCollectionModal (plan 41-03)
 * can fire its post-Wipe Sonner toast and stay on /settings. This action
 * performs NO toast and NO navigation.
 *
 * What is deleted:
 *   - All objects under wear-photos/{userId}/
 *   - All wear_events rows for the caller
 *   - All watches rows for the caller
 *
 * What is preserved:
 *   - public.users row (account survives)
 *   - profiles row
 *   - profile_settings row
 *   - follows rows
 */
export async function wipeCollection(): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // 1. Storage purge FIRST — success criterion 2 / RESEARCH Pitfall 2
    const supabase = await createSupabaseServerClient()
    await purgeWearPhotos(supabase, user.id)

    // 2. DB deletes — wear_events before watches (explicit; cascades also cover it)
    await db.delete(wearEvents).where(eq(wearEvents.userId, user.id))
    await db.delete(watches).where(eq(watches.userId, user.id))

    // 3. Cache invalidation — mirror removeWatch's invalidation set
    //    (RESEARCH Open Question 3 — accept known explore-rail staleness
    //    as pre-existing, not a Phase 41 regression)
    revalidatePath('/')
    const ownerProfile = await getProfileById(user.id)
    if (ownerProfile?.username) {
      revalidateTag(`profile:${ownerProfile.username}`, 'max')
    }
    revalidateTag('explore', 'max')

    return { success: true, data: undefined }
  } catch (err) {
    console.error('[wipeCollection] unexpected error:', err)
    return { success: false, error: 'Failed to wipe collection' }
  }
}

/**
 * Permanently delete the caller's account.
 *
 * D-07: Performs the hard delete only — does NOT sign the user out or
 * redirect. The post-Delete sign-out + redirect to / runs on the browser
 * client in the DeleteAccountModal (plan 41-03).
 *
 * D-08: No mention of the notifications.actor_id cascade in this action —
 * it is schema-correct behavior documented in CONTEXT.md only.
 *
 * Deletion order (critical — RESEARCH Pitfall 1 + Pitfall 2):
 *   1. Purge wear-photos/{userId}/ storage objects FIRST
 *   2. Delete public.users row (cascades to all 9 child tables)
 *   3. Call auth.admin.deleteUser() to remove the auth.users row
 *
 * NOTE: public.users has NO FK to auth.users — auth.admin.deleteUser()
 * alone leaves public.users and its 9 cascade children orphaned.
 * The explicit db.delete(users) is load-bearing.
 */
export async function deleteAccount(): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // 1. Storage purge FIRST — before any DB delete and before auth delete
    //    (RESEARCH Pitfall 2 + Pitfall 8: session-scoped client cannot
    //    reach storage after auth.admin.deleteUser() revokes the session)
    const supabase = await createSupabaseServerClient()
    await purgeWearPhotos(supabase, user.id)

    // 2. Delete public.users row — cascades to all 9 child tables:
    //    watches, wear_events, user_preferences, profiles, profile_settings,
    //    follows, activities, notifications (user_id + actor_id).
    //    This is the load-bearing line: auth.admin.deleteUser() does NOT
    //    cascade to public.users (RESEARCH Pitfall 1 / FK Cascade Map).
    await db.delete(users).where(eq(users.id, user.id))

    // 3. Auth delete — removes the auth.users row. divestments auto-cascade
    //    via the auth.users FK (supabase/migrations/20260511010000_phase37_layer_d.sql).
    //    Do this AFTER public.users delete so orphaned data cannot accumulate.
    const admin = createSupabaseAdminClient()
    const { error: adminErr } = await admin.auth.admin.deleteUser(user.id)
    if (adminErr) throw adminErr

    // No sign-out, no redirect here — D-07: sign-out runs on the browser
    // client (plan 41-03) after this action resolves.
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[deleteAccount] unexpected error:', err)
    return { success: false, error: 'Failed to delete account' }
  }
}
