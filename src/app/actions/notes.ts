'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { watches } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import type { ActionResult } from '@/lib/actionTypes'

const updateVisibilitySchema = z
  .object({
    watchId: z.string().uuid(),
    isPublic: z.boolean(),
  })
  .strict()

/**
 * Toggle notes_public for a single watch the caller owns.
 * IDOR mitigation (T-08-05): UPDATE WHERE user_id = current user — a foreign
 * watchId silently affects 0 rows, returned as a generic 'Watch not found'
 * error so existence is not leaked.
 */
export async function updateNoteVisibility(data: unknown): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = updateVisibilitySchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    const result = await db
      .update(watches)
      .set({
        notesPublic: parsed.data.isPublic,
        notesUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(watches.id, parsed.data.watchId), eq(watches.userId, user.id)))
      .returning({ id: watches.id })

    if (result.length === 0) {
      return { success: false, error: 'Watch not found' }
    }
    revalidatePath('/u/[username]/notes', 'page')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[updateNoteVisibility] unexpected error:', err)
    return { success: false, error: "Couldn't update note visibility. Try again." }
  }
}
