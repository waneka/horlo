'use server'

import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth'
import { getCatalogById } from '@/data/catalog'
import { getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { computeVerdictBundle } from '@/lib/verdict/composer'
import { computeViewerTasteProfile } from '@/lib/verdict/viewerTasteProfile'
import { catalogEntryToSimilarityInput } from '@/lib/verdict/shims'
import type { ActionResult } from '@/lib/actionTypes'
import type { VerdictBundle } from '@/lib/verdict/types'

/**
 * Phase 20 D-06 + FIT-04 Server Action.
 *
 * Auth-gated (UnauthorizedError → 'Not authenticated'); Zod .strict() blocks
 * mass-assignment + UUID validation rejects non-UUID input. Mirrors
 * searchPeopleAction pattern at src/app/actions/search.ts.
 *
 * Pitfall 3: VerdictBundle is plain JSON-serializable. No Date / Map / Set.
 *
 * V4 ASVS L1: viewerId is taken from getCurrentUser() — never accepted from
 * input. The 'data' parameter is unknown until validated.
 *
 * Search rows are always non-owned candidates → framing is hardcoded to
 * 'cross-user'. Self-via-cross-user (D-08) is owned by Plan 06's catalog page.
 *
 * Phase 20.1 UAT gap 1 observability contract: error strings on the failure
 * path are STABLE — AddWatchFlow.handleExtract logs them via console.warn so
 * silent verdict-null paths surface during reproduction. Do not collapse
 * specific errors to a generic 'failed' string without updating the consumer.
 */
const verdictSchema = z.object({ catalogId: z.string().uuid() }).strict()

export async function getVerdictForCatalogWatch(
  data: unknown,
): Promise<ActionResult<VerdictBundle>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = verdictSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    const [entry, collection, preferences] = await Promise.all([
      getCatalogById(parsed.data.catalogId),
      getWatchesByUser(user.id),
      getPreferencesByUser(user.id),
    ])

    if (!entry) return { success: false, error: 'Watch not found' }

    const profile = await computeViewerTasteProfile(collection)
    const candidate = catalogEntryToSimilarityInput(entry)
    const bundle = computeVerdictBundle({
      candidate,
      catalogEntry: entry,
      collection,
      preferences,
      profile,
      framing: 'cross-user',
    })

    return { success: true, data: bundle }
  } catch (err) {
    console.error('[getVerdictForCatalogWatch] unexpected error:', err)
    return { success: false, error: "Couldn't compute verdict." }
  }
}
