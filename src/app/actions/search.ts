'use server'

import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth'
import { searchCatalogWatches } from '@/data/catalog'
import { searchProfiles, searchCollections } from '@/data/search'
import type { ActionResult } from '@/lib/actionTypes'
import type {
  SearchProfileResult,
  SearchCatalogWatchResult,
  SearchCollectionResult,
} from '@/lib/searchTypes'

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

/**
 * Phase 19 Watches Search Server Action (SRCH-09).
 *
 * Auth-gated (getCurrentUser → UnauthorizedError → 'Not authenticated').
 * Input validated by Zod .strict().max(200) — the same searchSchema as
 * searchPeopleAction; .strict() rejects mass-assignment, .max(200) bounds
 * input length. DAL failures logged with [searchWatchesAction] prefix;
 * user-facing copy intentionally generic.
 *
 * Returns ActionResult<SearchCatalogWatchResult[]>. The DAL enforces the
 * 2-char server-side minimum; this action does NOT pre-filter — keeping the
 * gate in one place makes the security invariant easier to audit.
 */
export async function searchWatchesAction(
  data: unknown,
): Promise<ActionResult<SearchCatalogWatchResult[]>> {
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
    const results = await searchCatalogWatches({
      q: parsed.data.q,
      viewerId: user.id,
      limit: 20, // D-04
    })
    return { success: true, data: results }
  } catch (err) {
    console.error('[searchWatchesAction] unexpected error:', err)
    return { success: false, error: "Couldn't run search." }
  }
}

/**
 * Phase 19 Collections Search Server Action (SRCH-11).
 *
 * Same auth + Zod + error-copy contract as searchPeopleAction +
 * searchWatchesAction. The DAL (searchCollections) enforces two-layer privacy
 * (profile_public=true AND collection_public=true AND id != viewerId) and
 * the 2-char server-side minimum.
 */
export async function searchCollectionsAction(
  data: unknown,
): Promise<ActionResult<SearchCollectionResult[]>> {
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
    const results = await searchCollections({
      q: parsed.data.q,
      viewerId: user.id,
      limit: 20, // D-04
    })
    return { success: true, data: results }
  } catch (err) {
    console.error('[searchCollectionsAction] unexpected error:', err)
    return { success: false, error: "Couldn't run search." }
  }
}
