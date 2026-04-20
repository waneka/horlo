'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import * as wearEventDAL from '@/data/wearEvents'
import type { ActionResult } from '@/lib/actionTypes'

export async function markAsWorn(watchId: string): Promise<ActionResult<void>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }

  const today = new Date().toISOString().split('T')[0]

  try {
    await wearEventDAL.logWearEvent(user.id, watchId, today)
    revalidatePath('/')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[markAsWorn] unexpected error:', err)
    return { success: false, error: 'Failed to log wear event' }
  }
}
