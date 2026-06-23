'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import * as wearEventDAL from '@/data/wearEvents'
import * as watchDAL from '@/data/watches'
import * as profilesDAL from '@/data/profiles'
import { logActivity } from '@/data/activities'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/actionTypes'
import type { WearVisibility } from '@/lib/wearVisibility'

const markAsWornSchema = z.object({
  watchId: z.string().uuid(),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function markAsWorn(
  watchId: string,
  today: string,
): Promise<ActionResult<void>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }

  // CR-01: validate input shape early so non-UUID values or malformed dates
  // cannot reach the DAL. Returns the same 'Watch not found' copy as the
  // IDOR-defense branch (T-X-03: no additional info leak).
  const parsed = markAsWornSchema.safeParse({ watchId, today })
  if (!parsed.success) {
    return { success: false, error: 'Watch not found' }
  }

  // CR-01 / WR-04: ownership check BEFORE writing. markAsWorn previously
  // accepted any UUID — the unique constraint on (user_id, watch_id, worn_date)
  // does not block cross-user watchIds because the insert row carries the
  // caller's user_id. Use the same generic 'Watch not found' message the notes
  // IDOR mitigation uses so existence is not leaked.
  const watch = await watchDAL.getWatchById(user.id, parsed.data.watchId)
  if (!watch) {
    return { success: false, error: 'Watch not found' }
  }

  // WR-02 (2026-06-22 fix): client supplies `today` as their local calendar
  // day (computed by the browser-side wear helper). The server MUST NOT compute
  // `today` itself — on Vercel the process zone is UTC, which diverges from the
  // user's local day near the boundary (T-X-01 / T-X-02: regex-validated;
  // DB UNIQUE(user_id, watch_id, worn_date) is the canonical duplicate gate).

  try {
    await wearEventDAL.logWearEvent(user.id, parsed.data.watchId, parsed.data.today)
    // Activity logging (D-05) — fire and forget
    try {
      await logActivity(user.id, 'watch_worn', parsed.data.watchId, {
        brand: watch.brand,
        model: watch.model,
        imageUrl: watch.imageUrl ?? null,
        visibility: 'public', // D-07: markAsWorn always writes public; per-wear picker arrives in Phase 15 (WYWT picker)
      })
    } catch (err) {
      console.error('[markAsWorn] activity log failed (non-fatal):', err)
    }
    revalidatePath('/')
    // Phase 39c D-39c-04 — invalidate the owner's cached profile shell so
    // wear-event aggregates (most-worn / WornCalendar / WornTabContent) inside
    // <ProfileShellResolver/> recompute. Cross-user fan-out: although caller IS
    // owner, other viewers may have stale cached entries — SWR via revalidateTag(tag, 'max').
    const ownerProfile = await profilesDAL.getProfileById(user.id)
    if (ownerProfile?.username) {
      revalidateTag(`profile:${ownerProfile.username}`, 'max')
    }
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
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

// Phase 76 (VID-07/08/09/10/16) — video variant. Same shape as
// logWearWithPhotoSchema except `hasPhoto: z.boolean()` is replaced with
// `videoBytes: z.number().int().positive()` so the 5 MB server gate has
// the actual byte length to check (VID-09).
const logWearWithVideoSchema = z.object({
  wearEventId: z.string().uuid(),
  watchId: z.string().uuid(),
  note: z.string().max(200).nullable(),
  visibility: z.enum(['public', 'followers', 'private']),
  videoBytes: z.number().int().positive(),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
  today: string
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
  // folder BEFORE inserting the DB row (T-15-04 mitigation). Use createSignedUrl
  // as an O(1) existence probe — `.list({search})` is paginated (~100 cap), so
  // a user with >100 photos would silently false-fail (CR-01 / WR-03 fix).
  if (parsed.data.hasPhoto) {
    const { error: probeErr } = await supabase.storage
      .from('wear-photos')
      .createSignedUrl(photoPath, 1)
    if (probeErr) {
      console.error('[logWearWithPhoto] storage probe failed:', probeErr)
      try {
        await supabase.storage.from('wear-photos').remove([photoPath])
      } catch {
        // best-effort orphan cleanup; never escalate
      }
      return {
        success: false,
        error: 'Photo upload failed — please try again',
      }
    }
  }

  // WR-02 (2026-06-22 fix): client supplies `today` as their local calendar
  // day (computed by the browser-side wear helper). The server MUST NOT compute
  // `today` itself — on Vercel the process zone is UTC, which diverges from the
  // user's local day near the boundary (T-X-01 / T-X-02: regex-validated;
  // DB UNIQUE(user_id, watch_id, worn_date) is the canonical duplicate gate).
  const note = parsed.data.note?.trim() ? parsed.data.note.trim() : null

  try {
    await wearEventDAL.logWearEventWithPhoto({
      id: parsed.data.wearEventId,
      userId: user.id,
      watchId: parsed.data.watchId,
      wornDate: parsed.data.today,
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
  //
  // WR-05 — INTENTIONAL SNAPSHOT SEMANTICS (NOT a join at read-time):
  // brand/model/imageUrl are captured from the `watch` row fetched at the
  // ownership check above (line 128). If the watch is deleted between that
  // fetch and this insert, the activity row carries the brand/model/imageUrl
  // it had at log-time — it does NOT reflect the live (post-deletion) row.
  // This matches Phase 12 D-10's denormalized activity contract: activities
  // are immutable point-in-time snapshots of what the user did, not joined
  // views. Same shape as `markAsWorn` above (line 41). No fix is needed; the
  // race is narrow (concurrent watch deletion is not a user-initiated
  // workflow on this surface) and snapshot semantics are the desired
  // behavior for an activity feed.
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
  // Phase 39c D-39c-04 — invalidate the owner's cached profile shell so
  // wear-event aggregates (most-worn / WornCalendar / WornTabContent) inside
  // <ProfileShellResolver/> recompute. Cross-user fan-out: although caller IS
  // owner, other viewers may have stale cached entries — SWR via revalidateTag(tag, 'max').
  const ownerProfile = await profilesDAL.getProfileById(user.id)
  if (ownerProfile?.username) {
    revalidateTag(`profile:${ownerProfile.username}`, 'max')
  }
  return { success: true, data: { wearEventId: parsed.data.wearEventId } }
}

/**
 * Video-bearing WYWT post (Phase 76 — VID-07/08/09/10/16, SEED-020 D-07).
 *
 * Direct structural parallel to logWearWithPhoto with 7 documented divergences:
 *  1. Schema field videoBytes (int positive) replaces hasPhoto (bool) — VID-09 gate
 *     needs the actual byte length.
 *  2. NEW 5 MB server gate AFTER Zod parse, BEFORE IDOR / Storage / DAL (VID-09).
 *  3. Server constructs TWO paths: `${userId}/${wearEventId}.mp4` + `-poster.jpg`
 *     (VID-07 / VID-16). Action input has NO videoPath / posterPath fields —
 *     tampered client cannot poison the DB row's paths (T-15-17 analog).
 *  4. TWO `.list()` probes via `Promise.all` (VID-08) — one per Storage object;
 *     each result checked with exact-match `.some(f => f.name === ...)` (NOT prefix
 *     match — Pitfall 1). Either miss returns uniform 'Video upload failed' (no
 *     leak of which file is missing). NO hasPhoto guard (video always required).
 *  5. DAL call uses `wearEventDAL.logWearEventWithVideo` with `mediaPath` +
 *     `posterPath` — `photoUrl` is NOT passed (column defaults to NULL).
 *  6. Catch-block cleanup runs `.remove([videoPath, posterPath])` (2-element
 *     array) — NO hasPhoto guard; cleanup fires on BOTH 23505 and non-23505
 *     paths (T-15-18 / VID-10). Best-effort: cleanup error is console.error'd
 *     and never escalated; original DAL error propagates.
 *  7. All console.error log prefixes use `[logWearWithVideo]`.
 *
 * Cache invalidation matches logWearWithPhoto verbatim: `revalidatePath('/')`
 * + `revalidateTag(`profile:${username}`, 'max')` — the 'max' second arg is
 * the Next 16 SWR cross-user fan-out form (per durable memory
 * `project_next16_revalidatetag_deprecated`). This is NOT a read-your-own-write
 * case — do NOT downgrade to single-arg form or migrate to `updateTag`.
 */
export async function logWearWithVideo(input: {
  wearEventId: string
  watchId: string
  note: string | null
  visibility: WearVisibility
  videoBytes: number
  today: string
}): Promise<ActionResult<{ wearEventId: string }>> {
  // (1) Auth FIRST — Zod after auth so unauthenticated callers never reach
  // validation (matches markAsWorn / logWearWithPhoto ordering).
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  // (2) Zod parse — non-UUID wearEventId / watchId, oversize note, bad
  // visibility enum, non-positive videoBytes, malformed today all rejected.
  const parsed = logWearWithVideoSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' }
  }

  // (3) VID-09 5 MB server-side gate — runs BEFORE IDOR / Storage / DAL.
  // Server is authoritative; client-side pre-warn at 4 MB (Phase 77) is UX
  // only and never trusted. Defense in depth: Supabase bucket file_size_limit
  // = 5242880 also rejects at the Storage layer.
  if (parsed.data.videoBytes > 5 * 1024 * 1024) {
    return { success: false, error: 'Video too large — maximum 5 MB' }
  }

  // (4) IDOR defense (matches logWearWithPhoto L151-154): scope the watch
  // lookup to the caller; return uniform 'Watch not found' for cross-user
  // watch IDs so existence is not leaked.
  const watch = await watchDAL.getWatchById(user.id, parsed.data.watchId)
  if (!watch) {
    return { success: false, error: 'Watch not found' }
  }

  // (5) Server-constructed paths — never trust a client-supplied path
  // (T-15-17 / VID-16). The action input type has no videoPath / posterPath
  // fields, so a tampered client cannot reach this line with foreign IDs.
  const videoPath = `${user.id}/${parsed.data.wearEventId}.mp4`
  const posterPath = `${user.id}/${parsed.data.wearEventId}-poster.jpg`
  const supabase = await createSupabaseServerClient()

  // (6) VID-08: probe BOTH Storage objects in parallel BEFORE inserting the
  // DB row. createSignedUrl is an O(1) HEAD-style existence check — returns
  // an error if the object is missing, without enumerating the folder. The
  // prior `.list({search})` probe was paginated (~100 cap) so a user with
  // >100 wear photos would silently false-fail (CR-01 fix). Either miss
  // returns the uniform 'Video upload failed' string — no leak of which file
  // was missing.
  const [videoProbe, posterProbe] = await Promise.all([
    supabase.storage.from('wear-photos').createSignedUrl(videoPath, 1),
    supabase.storage.from('wear-photos').createSignedUrl(posterPath, 1),
  ])
  if (videoProbe.error || posterProbe.error) {
    if (videoProbe.error || posterProbe.error) {
      console.error(
        '[logWearWithVideo] storage probe failed:',
        videoProbe.error ?? 'ok',
        posterProbe.error ?? 'ok',
      )
    }
    try {
      await supabase.storage
        .from('wear-photos')
        .remove([videoPath, posterPath])
    } catch {
      // best-effort orphan cleanup; never escalate
    }
    return { success: false, error: 'Video upload failed — please try again' }
  }

  // (7) Note normalization — same shape as logWearWithPhoto L181.
  const note = parsed.data.note?.trim() ? parsed.data.note.trim() : null

  // (8) DAL insert. NO photoUrl field — leaves it NULL via column default.
  // wornDate uses client-supplied `today` (WR-02 / 2026-06-22 fix — server
  // process zone is UTC on Vercel; client owns calendar-day computation).
  try {
    await wearEventDAL.logWearEventWithVideo({
      id: parsed.data.wearEventId,
      userId: user.id,
      watchId: parsed.data.watchId,
      wornDate: parsed.data.today,
      note,
      mediaPath: videoPath,
      posterPath,
      visibility: parsed.data.visibility,
    })
  } catch (err) {
    // (9) Compensating delete — best-effort cleanup of BOTH orphan Storage
    // objects on ANY DAL insert failure (T-15-18 / VID-10). NO hasPhoto
    // guard; the video path always has both objects. Cleanup error is
    // logged and never escalated — the original DAL error propagates.
    try {
      const cleanup = await supabase.storage
        .from('wear-photos')
        .remove([videoPath, posterPath])
      console.error(
        '[logWearWithVideo] insert failed; orphan cleanup:',
        cleanup.error ?? 'ok',
      )
    } catch (cleanupErr) {
      console.error('[logWearWithVideo] orphan cleanup threw:', cleanupErr)
    }

    const code = (err as { code?: string } | null)?.code
    if (code === '23505') {
      return { success: false, error: 'Already logged this watch today' }
    }
    console.error('[logWearWithVideo] insert failed:', err)
    return {
      success: false,
      error: 'Could not log that wear. Please try again.',
    }
  }

  // (10) Activity logging — fire-and-forget (D-10 / WR-05 snapshot semantics:
  // brand/model/imageUrl captured from `watch` row fetched at the ownership
  // check above). Same shape as logWearWithPhoto L234-243.
  try {
    await logActivity(user.id, 'watch_worn', parsed.data.watchId, {
      brand: watch.brand,
      model: watch.model,
      imageUrl: watch.imageUrl ?? null,
      visibility: parsed.data.visibility,
    })
  } catch (err) {
    console.error('[logWearWithVideo] activity log failed (non-fatal):', err)
  }

  // (11) Cache invalidation — matches logWearWithPhoto L245-253 verbatim.
  // revalidateTag(tag, 'max') is the Next 16 SWR cross-user fan-out form
  // (per durable memory `project_next16_revalidatetag_deprecated` and
  // node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md).
  revalidatePath('/')
  const ownerProfile = await profilesDAL.getProfileById(user.id)
  if (ownerProfile?.username) {
    revalidateTag(`profile:${ownerProfile.username}`, 'max')
  }
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

// ---------------------------------------------------------------------------
// Phase 62 — WPIC-02 (D-11)
// hideWearPicAction / unhideWearPicAction — owner hide/unhide toggle for a
// wear pic on the watch detail carousel.
//
// Security (T-62-04 / T-62-05):
// - getCurrentUser() in try/catch → unauthenticated callers rejected early
// - .strict() Zod schema rejects extra keys (mass-assignment guard, T-62-05)
// - watchDAL.getWatchById(user.id, watchId) ownership re-check before write
// - DAL hideWearPic/unhideWearPic further scopes the UPDATE via ownership
//   subquery at the DB layer (defense in depth, T-62-04)
//
// D-11 constraint: visibility is NEVER written here. "Hide from detail" is a
// separate persistent state that does not affect the rail or worn tab.
// ---------------------------------------------------------------------------

const hideWearPicSchema = z
  .object({
    wearEventId: z.string().uuid(),
    watchId: z.string().uuid(),
  })
  .strict()

export async function hideWearPicAction(
  data: unknown,
): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = hideWearPicSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  // CR-01 / IDOR defense: scope watch lookup to caller's watches.
  // Returns the uniform 'Watch not found' on miss so existence is not leaked.
  const watch = await watchDAL.getWatchById(user.id, parsed.data.watchId)
  if (!watch) {
    return { success: false, error: 'Watch not found' }
  }

  try {
    await wearEventDAL.hideWearPic(user.id, parsed.data.watchId, parsed.data.wearEventId)
    // WR-02 (false positive): revalidatePath('/w/[ref]', 'page') IS the correct
    // Next 16 form for invalidating all pages of a dynamic route — the second
    // argument 'page' combined with a dynamic segment pattern is explicitly
    // documented in node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
    // revalidatePath.md §"Revalidating a Page path". This is NOT a no-op.
    revalidatePath('/w/[ref]', 'page')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[hideWearPicAction] unexpected error:', err)
    return { success: false, error: "Couldn't update. Try again." }
  }
}

export async function unhideWearPicAction(
  data: unknown,
): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = hideWearPicSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  // CR-01 / IDOR defense: scope watch lookup to caller's watches.
  const watch = await watchDAL.getWatchById(user.id, parsed.data.watchId)
  if (!watch) {
    return { success: false, error: 'Watch not found' }
  }

  try {
    await wearEventDAL.unhideWearPic(user.id, parsed.data.watchId, parsed.data.wearEventId)
    // WR-02 (false positive): see hideWearPicAction comment above — 'page' scope
    // with a dynamic segment pattern is the documented form in Next 16.
    revalidatePath('/w/[ref]', 'page')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[unhideWearPicAction] unexpected error:', err)
    return { success: false, error: "Couldn't update. Try again." }
  }
}
