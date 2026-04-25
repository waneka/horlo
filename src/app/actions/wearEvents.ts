'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import * as wearEventDAL from '@/data/wearEvents'
import * as watchDAL from '@/data/watches'
import { logActivity } from '@/data/activities'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/actionTypes'
import type { WearVisibility } from '@/lib/wearVisibility'
import { todayLocalISO } from '@/lib/wear'

const watchIdSchema = z.string().uuid()

export async function markAsWorn(watchId: string): Promise<ActionResult<void>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }

  // CR-01: validate input shape early so non-UUID values cannot reach the DAL.
  const parsed = watchIdSchema.safeParse(watchId)
  if (!parsed.success) {
    return { success: false, error: 'Watch not found' }
  }

  // CR-01 / WR-04: ownership check BEFORE writing. markAsWorn previously
  // accepted any UUID — the unique constraint on (user_id, watch_id, worn_date)
  // does not block cross-user watchIds because the insert row carries the
  // caller's user_id. Use the same generic 'Watch not found' message the notes
  // IDOR mitigation uses so existence is not leaked.
  const watch = await watchDAL.getWatchById(user.id, parsed.data)
  if (!watch) {
    return { success: false, error: 'Watch not found' }
  }

  // WR-02: use the user's local calendar day. The Server Action runs in the
  // user's request context (no compute job / cron offset concern), so the
  // process clock matches the actor. Avoids the UTC-boundary duplicate-day
  // false positive documented in src/lib/wear.ts:todayLocalISO.
  const today = todayLocalISO()

  try {
    await wearEventDAL.logWearEvent(user.id, parsed.data, today)
    // Activity logging (D-05) — fire and forget
    try {
      await logActivity(user.id, 'watch_worn', parsed.data, {
        brand: watch.brand,
        model: watch.model,
        imageUrl: watch.imageUrl ?? null,
        visibility: 'public', // D-07: markAsWorn always writes public; per-wear picker arrives in Phase 15 (WYWT picker)
      })
    } catch (err) {
      console.error('[markAsWorn] activity log failed (non-fatal):', err)
    }
    revalidatePath('/')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[markAsWorn] unexpected error:', err)
    return { success: false, error: 'Failed to log wear event' }
  }
}

// ---- Phase 15 (WYWT-12, WYWT-15) — photo-bearing wear + preflight wrapper ----

/**
 * Schemas for logWearWithPhoto + getWornTodayIdsForUserAction.
 *
 * WYWT-08 threat T-15-04: client-supplied visibility is validated against the
 * three-tier enum. Invalid values are rejected as 'Invalid input' — no silent
 * fall-through to 'public'.
 *
 * WYWT-07: note is capped at 200 chars; whitespace-only is normalized to null
 * at the Server Action (defense in depth — client also trims).
 */
const logWearWithPhotoSchema = z.object({
  wearEventId: z.string().uuid(),
  watchId: z.string().uuid(),
  note: z.string().max(200).nullable(),
  visibility: z.enum(['public', 'followers', 'private']),
  hasPhoto: z.boolean(),
})

const preflightSchema = z.object({
  userId: z.string().uuid(),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/**
 * Photo-bearing WYWT post (WYWT-15, 15-CONTEXT.md D-15).
 *
 * Pipeline: auth → zod → watch ownership check → (if hasPhoto) Storage list
 * probe → DAL insert → logActivity → revalidatePath('/').
 *
 * Security (threat model):
 * - T-15-04 (client tampers hasPhoto): Server runs .list() probe at
 *   `{userId}/{wearEventId}.jpg` before inserting. Missing object rejects
 *   with a generic 'Photo upload failed — please try again' — no info leak.
 * - T-15-05 (duplicate-day race): DB UNIQUE `wear_events_unique_day` +
 *   PG 23505 caught here. Returns 'Already logged this watch today'.
 * - T-15-17 (cross-user path write): Storage path is CONSTRUCTED
 *   server-side as `${user.id}/${wearEventId}.jpg` — never from client
 *   input — so a compromised client cannot force a cross-user path.
 * - T-15-18 (orphan Storage on insert failure): Best-effort
 *   `storage.remove()` runs on ANY insert failure when hasPhoto=true
 *   (both 23505 and non-23505 paths). Log-only on cleanup failure.
 * - Pitfall H-2 (Server Action calling toast): NO sonner import anywhere.
 *   Client owns the toast call-site after this action resolves.
 */
export async function logWearWithPhoto(input: {
  wearEventId: string
  watchId: string
  note: string | null
  visibility: WearVisibility
  hasPhoto: boolean
}): Promise<ActionResult<{ wearEventId: string }>> {
  // Auth FIRST — zod after auth so unauthenticated callers never reach
  // validation (matches markAsWorn ordering).
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = logWearWithPhotoSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' }
  }

  // IDOR defense (matches markAsWorn CR-01): scope the watch lookup to the
  // caller; return the uniform 'Watch not found' for cross-user watch IDs
  // so existence is not leaked.
  const watch = await watchDAL.getWatchById(user.id, parsed.data.watchId)
  if (!watch) {
    return { success: false, error: 'Watch not found' }
  }

  // Path is server-constructed — never trust a client-supplied path.
  const photoPath = `${user.id}/${parsed.data.wearEventId}.jpg`
  const supabase = await createSupabaseServerClient()

  // If client asserts hasPhoto, verify the object exists under the caller's
  // folder BEFORE inserting the DB row (T-15-04 mitigation).
  if (parsed.data.hasPhoto) {
    const { data: listed, error: listErr } = await supabase.storage
      .from('wear-photos')
      .list(user.id, { search: `${parsed.data.wearEventId}.jpg` })
    const found =
      !listErr && (listed ?? []).some((f) => f.name === `${parsed.data.wearEventId}.jpg`)
    if (!found) {
      return {
        success: false,
        error: 'Photo upload failed — please try again',
      }
    }
  }

  // WR-02: local calendar day — see src/lib/wear.ts:todayLocalISO. Client
  // (WywtPostDialog preflight) AND server MUST agree on the same calendar
  // boundary or the picker's "Worn today" hint and the DB UNIQUE
  // (user_id, watch_id, worn_date) constraint will diverge across the UTC
  // day boundary.
  const today = todayLocalISO()
  const note = parsed.data.note?.trim() ? parsed.data.note.trim() : null

  try {
    await wearEventDAL.logWearEventWithPhoto({
      id: parsed.data.wearEventId,
      userId: user.id,
      watchId: parsed.data.watchId,
      wornDate: today,
      note,
      photoUrl: parsed.data.hasPhoto ? photoPath : null,
      visibility: parsed.data.visibility,
    })
  } catch (err) {
    // Best-effort orphan Storage cleanup runs on ANY insert failure when
    // hasPhoto was asserted — covers 23505 AND non-23505 paths (T-15-18).
    if (parsed.data.hasPhoto) {
      try {
        const cleanup = await supabase.storage
          .from('wear-photos')
          .remove([photoPath])
        console.error(
          '[logWearWithPhoto] insert failed; orphan cleanup:',
          cleanup.error ?? 'ok',
        )
      } catch (cleanupErr) {
        console.error('[logWearWithPhoto] orphan cleanup threw:', cleanupErr)
      }
    }

    const code = (err as { code?: string } | null)?.code
    if (code === '23505') {
      return { success: false, error: 'Already logged this watch today' }
    }
    console.error('[logWearWithPhoto] insert failed:', err)
    return {
      success: false,
      error: 'Could not log that wear. Please try again.',
    }
  }

  // Activity logging — fire-and-forget (D-10 contract from Phase 12).
  try {
    await logActivity(user.id, 'watch_worn', parsed.data.watchId, {
      brand: watch.brand,
      model: watch.model,
      imageUrl: watch.imageUrl ?? null,
      visibility: parsed.data.visibility,
    })
  } catch (err) {
    console.error('[logWearWithPhoto] activity log failed (non-fatal):', err)
  }

  revalidatePath('/')
  return { success: true, data: { wearEventId: parsed.data.wearEventId } }
}

/**
 * Preflight wrapper for getWornTodayIdsForUser (WYWT-12, 15-CONTEXT.md D-13).
 *
 * Returns array (Server Actions cannot serialize Set) of watch IDs the caller
 * has wear events for on `today`. Used by Plan 03b's WatchPickerDialog to
 * dim/disable already-worn watches.
 *
 * Threat model (T-15-16): Defense-in-depth cross-user guard — returns `[]`
 * when input.userId !== caller.id. Never resolves another user's worn set.
 * Zod validates userId (uuid) and today (ISO date) first; bad input → `[]`.
 */
export async function getWornTodayIdsForUserAction(
  input: { userId: string; today: string },
): Promise<string[]> {
  const parsed = preflightSchema.safeParse(input)
  if (!parsed.success) return []

  let user
  try {
    user = await getCurrentUser()
  } catch {
    return []
  }

  // T-15-16: cross-user input → empty array. Never resolve someone else's set.
  if (user.id !== parsed.data.userId) return []

  const set = await wearEventDAL.getWornTodayIdsForUser(user.id, parsed.data.today)
  return [...set]
}
