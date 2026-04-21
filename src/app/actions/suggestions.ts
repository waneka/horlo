'use server'

import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth'
import {
  getSuggestedCollectors,
  type SuggestionCursor,
} from '@/data/suggestions'
import type { ActionResult } from '@/lib/actionTypes'
import type { SuggestedCollector } from '@/lib/discoveryTypes'

/**
 * Keyset cursor shape — must match `SuggestionCursor` from
 * `src/data/suggestions.ts`. `.strict()` rejects mass-assignment attempts
 * (Pitfall 6), `.uuid()` + `.number()` block cursor-fabrication attempts that
 * try to inject arbitrary strings into the DAL WHERE comparator.
 */
const cursorSchema = z
  .object({
    overlap: z.number(),
    userId: z.string().uuid(),
  })
  .strict()

const loadMoreSchema = z.object({ cursor: cursorSchema }).strict()

/**
 * "Load More" for the Suggested Collectors home section (CONTEXT.md S-03).
 *
 * Page 1 is rendered server-side by the home Server Component (Plan 07), so
 * this action is only for page 2+ and requires a valid cursor. Null or missing
 * cursors return 'Invalid request'.
 *
 * Auth-gated (getCurrentUser → UnauthorizedError → 'Not authenticated').
 * DAL failures are logged with `[loadMoreSuggestions]` prefix and surface a
 * generic user-facing error.
 */
export async function loadMoreSuggestions(
  data: unknown,
): Promise<
  ActionResult<{
    collectors: SuggestedCollector[]
    nextCursor: SuggestionCursor | null
  }>
> {
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
    const { collectors, nextCursor } = await getSuggestedCollectors(user.id, {
      limit: 5,
      cursor: parsed.data.cursor,
    })
    return { success: true, data: { collectors, nextCursor } }
  } catch (err) {
    console.error('[loadMoreSuggestions] unexpected error:', err)
    return { success: false, error: "Couldn't load more collectors." }
  }
}
