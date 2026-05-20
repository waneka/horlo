'use server'

import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth'
import { searchCatalogWatches } from '@/data/catalog'
import { searchProfiles, searchCollections } from '@/data/search'
// Phase 46 WR-01 / Phase 49.1 D-SCOPE-01f: era facet is validated against the
// closed taste vocabulary (source of truth: src/lib/taste/vocab.ts) so the Zod
// enum cannot drift from EraSignal. PRIMARY_ARCHETYPES is no longer imported
// here — genre/archetype dropped from the schema per D-SCOPE-01f.
import { ERA_SIGNALS } from '@/lib/taste/vocab'
import type { ActionResult } from '@/lib/actionTypes'
import type {
  SearchProfileResult,
  SearchCatalogWatchResult,
  SearchCollectionResult,
} from '@/lib/searchTypes'

// Zod schema with .strict() rejects mass-assignment attempts. .max(200) bounds
// the input length (Server Action will reject obviously-malicious giant strings
// before they reach the DAL trim/length guard).
// Phase 40 SRCH-16 — facets D-03/D-04/D-05/D-06. People + Collections actions accept-but-ignore.
// Phase 46 D-12: brand/era facets for Explore deep-links (T-46-03 mitigation).
// Phase 49.1 D-SCOPE-01f: genre/archetype keys removed; .strict() preserved so
// old ?genre=/?archetype= URLs are rejected at the action boundary (D-EXPLORE-03).
const searchSchema = z
  .object({
    q: z.string().max(200),
    movement: z.enum(['auto', 'manual', 'quartz', 'spring_drive']).optional(),
    size: z.enum(['lt36', '36-39', '40-42', '43-45', '46plus']).optional(),
    style: z.string().max(500).optional(), // comma-joined; DAL splits
    brand:     z.string().max(100).optional(),
    // Phase 46 WR-01: constrain to the closed vocabulary (matches the
    // movement/size z.enum pattern above).
    era:       z.enum(ERA_SIGNALS).optional(),
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
      filters: {
        movement: parsed.data.movement,
        size: parsed.data.size,
        // style is comma-joined string from URL; split + trim + filter empty (A4)
        style: parsed.data.style?.split(',').map((s) => s.trim()).filter(Boolean),
        // Phase 46 D-12 / Phase 49.1 D-SCOPE-01f: brand + era passthrough.
        // genre + archetype passthrough removed per D-SCOPE-01f.
        brand:     parsed.data.brand,
        era:       parsed.data.era,
      },
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
