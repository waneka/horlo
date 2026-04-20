import 'server-only'

import { db } from '@/db'
import { activities } from '@/db/schema'

export type ActivityType = 'watch_added' | 'wishlist_added' | 'watch_worn'

export async function logActivity(
  userId: string,
  type: ActivityType,
  watchId: string | null,
  metadata: { brand: string; model: string; imageUrl: string | null }
) {
  await db.insert(activities).values({
    userId,
    type,
    watchId,
    metadata,
  })
}
