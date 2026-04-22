'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import * as wearEventDAL from '@/data/wearEvents'
import * as watchDAL from '@/data/watches'
import { logActivity } from '@/data/activities'
import type { ActionResult } from '@/lib/actionTypes'

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

  const today = new Date().toISOString().split('T')[0]

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
