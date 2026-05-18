'use server'

// D-11: catalog watch picker — reuses searchCatalogWatches so the picker scales
// into the v5.2 catalog expansion without a full-table client load.
// T-45-15: SQL injection mitigation — searchCatalogWatches uses Drizzle parameterized
// binds (verified in src/data/catalog.ts). The picker query is never string-concatenated.

import { assertOwner } from '@/lib/auth'
import { searchCatalogWatches } from '@/data/catalog'
import type { ActionResult } from '@/lib/actionTypes'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'

const PICKER_LIMIT = 20
const MIN_QUERY_LENGTH = 2

/**
 * D-11: Owner-gated catalog search for the admin watch-picker typeahead.
 * Returns [] for queries shorter than 2 chars (enforces min before hitting the DB).
 * Forwards longer queries to searchCatalogWatches — existing catalog search layer.
 */
export async function searchCatalogForPicker(
  query: string
): Promise<ActionResult<SearchCatalogWatchResult[]>> {
  let owner: { id: string; email: string }
  try {
    owner = await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  // Enforce 2-char minimum — short queries are noise and expensive
  if (query.trim().length < MIN_QUERY_LENGTH) {
    return { success: true, data: [] }
  }

  try {
    const results = await searchCatalogWatches({
      q: query,
      viewerId: owner.id,
      limit: PICKER_LIMIT,
    })
    return { success: true, data: results }
  } catch (err) {
    console.error('[searchCatalogForPicker] unexpected error:', err)
    return { success: false, error: "Couldn't search catalog. Try again." }
  }
}
