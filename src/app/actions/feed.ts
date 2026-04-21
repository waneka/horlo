'use server'

import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth'
import { getFeedForUser } from '@/data/activities'
import { aggregateFeed } from '@/lib/feedAggregate'
import type { ActionResult } from '@/lib/actionTypes'
import type { FeedCursor, FeedRow } from '@/lib/feedTypes'

// FEED-03 cursor contract: opaque-looking on the wire but explicitly typed —
// `.strict()` blocks mass-assignment (T-10-02-05), `.uuid()` + `.datetime()`
// block cursor fabrication attempts (T-10-02-04). A malformed cursor is
// rejected before any DB work happens.
const cursorSchema = z
  .object({
    createdAt: z.string().datetime(),
    id: z.string().uuid(),
  })
  .strict()

// F-04: loadMoreFeed is ONLY called for page 2+. The first page is rendered
// server-side by the home page Server Component, so this action requires a
// non-null cursor. Null / missing cursors are rejected with 'Invalid request'.
const loadMoreSchema = z.object({ cursor: cursorSchema }).strict()

export async function loadMoreFeed(
  data: unknown,
): Promise<ActionResult<{ rows: FeedRow[]; nextCursor: FeedCursor | null }>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = loadMoreSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    const { rows, nextCursor } = await getFeedForUser(
      user.id,
      parsed.data.cursor,
      20,
    )
    return {
      success: true,
      data: { rows: aggregateFeed(rows), nextCursor },
    }
  } catch (err) {
    console.error('[loadMoreFeed] unexpected error:', err)
    return { success: false, error: "Couldn't load more." }
  }
}
