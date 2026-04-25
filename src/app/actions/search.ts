'use server'

import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth'
import { searchProfiles } from '@/data/search'
import type { ActionResult } from '@/lib/actionTypes'
import type { SearchProfileResult } from '@/lib/searchTypes'

// Zod schema with .strict() rejects mass-assignment attempts. .max(200) bounds
// the input length (Server Action will reject obviously-malicious giant strings
// before they reach the DAL trim/length guard).
const searchSchema = z
  .object({
    q: z.string().max(200),
  })
  .strict()

/**
 * Phase 16 People Search Server Action (SRCH-04).
 *
 * Auth-gated (getCurrentUser → UnauthorizedError → 'Not authenticated').
 * Input validated by Zod (.strict() blocks mass-assignment per Plan 13 D-25).
 * DAL failures logged with [searchPeopleAction] prefix; user-facing copy is
 * intentionally generic so we never leak Postgres error details.
 *
 * Returns ActionResult<SearchProfileResult[]> — the Client Component
 * (Plan 03 useSearchState hook) discriminates success/error and updates state.
 *
 * The DAL enforces the 2-char server-side minimum (D-20 / Pitfall C-2). This
 * action does NOT pre-filter — keeping the gate in one place makes the
 * security invariant easier to audit. Empty results from short queries are
 * returned as { success: true, data: [] }.
 */
export async function searchPeopleAction(
  data: unknown,
): Promise<ActionResult<SearchProfileResult[]>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = searchSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    const results = await searchProfiles({
      q: parsed.data.q,
      viewerId: user.id,
      limit: 20, // D-22
    })
    return { success: true, data: results }
  } catch (err) {
    console.error('[searchPeopleAction] unexpected error:', err)
    return { success: false, error: "Couldn't run search." }
  }
}
