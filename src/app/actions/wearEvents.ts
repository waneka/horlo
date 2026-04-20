'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import * as wearEventDAL from '@/data/wearEvents'
import * as watchDAL from '@/data/watches'
import { logActivity } from '@/data/activities'
import type { ActionResult } from '@/lib/actionTypes'

export async function markAsWorn(watchId: string): Promise<ActionResult<void>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }

  const today = new Date().toISOString().split('T')[0]

  try {
    await wearEventDAL.logWearEvent(user.id, watchId, today)
    // Activity logging (D-05) — fire and forget
    try {
      const watch = await watchDAL.getWatchById(user.id, watchId)
      if (watch) {
        await logActivity(user.id, 'watch_worn', watchId, {
          brand: watch.brand,
          model: watch.model,
          imageUrl: watch.imageUrl ?? null,
        })
      }
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
