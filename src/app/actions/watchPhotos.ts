'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import {
  addWatchPhoto,
  bulkReorderPhotos,
  deleteWatchPhoto,
  PhotoCapExceededError,
  OwnerMismatchError,
  SetMismatchError,
} from '@/data/watches'
import type { ActionResult } from '@/lib/actionTypes'

// ---------------------------------------------------------------------------
// Schemas — zod .strict() rejects any undeclared key (mass-assignment guard,
// T-61-03). userId is NEVER taken from the client — always from getCurrentUser().
// ---------------------------------------------------------------------------

// reorderWatchPhotosAction: orderedIds capped at 10 (MAX_PHOTOS_PER_WATCH, T-61-04).
const reorderSchema = z
  .object({
    watchId: z.string().uuid(),
    orderedIds: z.array(z.string().uuid()).min(1).max(10),
  })
  .strict()

// addWatchPhotoAction: storagePath is the path already uploaded by the client;
// the action only records the DB row. PhotoCapExceededError from DAL is the
// authoritative server-side cap backstop (T-61-04).
const addSchema = z
  .object({
    watchId: z.string().uuid(),
    storagePath: z.string().min(1),
  })
  .strict()

// deleteWatchPhotoAction: both watchId and photoId are uuids.
const deleteSchema = z
  .object({
    watchId: z.string().uuid(),
    photoId: z.string().uuid(),
  })
  .strict()

// ---------------------------------------------------------------------------
// reorderWatchPhotosAction — PHOTO-05
//
// Structure mirrors reorderWishlist in src/app/actions/wishlist.ts exactly:
//   getCurrentUser() try/catch → zod safeParse → DAL call in try/catch →
//   instanceof error discrimination → revalidatePath('/w/[ref]', 'page')
// ---------------------------------------------------------------------------
export async function reorderWatchPhotosAction(
  data: unknown,
): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = reorderSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    await bulkReorderPhotos(user.id, parsed.data.watchId, parsed.data.orderedIds)
    // BR-02 pattern: use route TEMPLATE, not concrete URL (RESEARCH Pitfall 8).
    // This invalidates all pages matching /w/[ref] at the page level.
    revalidatePath('/w/[ref]', 'page')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[reorderWatchPhotosAction] unexpected error:', err)
    if (err instanceof OwnerMismatchError) {
      return { success: false, error: 'Some photos do not belong to you.' }
    }
    if (err instanceof SetMismatchError) {
      return {
        success: false,
        error: 'Photos changed in another tab. Refresh and try again.',
      }
    }
    return { success: false, error: "Couldn't save new order." }
  }
}

// ---------------------------------------------------------------------------
// addWatchPhotoAction — PHOTO-02
//
// storagePath is already uploaded to Storage by the client. This action records
// the DB row via addWatchPhoto (which owns the cap check, sort_order computation,
// and ownership verification — T-61-01, T-61-04, T-61-05).
// Returns ActionResult<{ id: string }> so the client can correlate the new row.
// ---------------------------------------------------------------------------
export async function addWatchPhotoAction(
  data: unknown,
): Promise<ActionResult<{ id: string }>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = addSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    const inserted = await addWatchPhoto(user.id, parsed.data.watchId, parsed.data.storagePath)
    revalidatePath('/w/[ref]', 'page')
    return { success: true, data: { id: inserted.id } }
  } catch (err) {
    console.error('[addWatchPhotoAction] unexpected error:', err)
    if (err instanceof PhotoCapExceededError) {
      return {
        success: false,
        error: `You've reached the ${err.cap}-photo limit for this watch.`,
      }
    }
    return { success: false, error: "Couldn't add photo." }
  }
}

// ---------------------------------------------------------------------------
// deleteWatchPhotoAction — PHOTO-06
//
// deleteWatchPhoto gates on watches.user_id = user.id (T-61-02). Any failure
// (not found, ownership mismatch) maps to the same generic error to avoid
// existence leaks.
// ---------------------------------------------------------------------------
export async function deleteWatchPhotoAction(
  data: unknown,
): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = deleteSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    await deleteWatchPhoto(user.id, parsed.data.watchId, parsed.data.photoId)
    revalidatePath('/w/[ref]', 'page')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[deleteWatchPhotoAction] unexpected error:', err)
    return { success: false, error: "Couldn't delete photo." }
  }
}
