/**
 * signCoverUrls — server-only batch helper for signing owner-photo cover paths.
 *
 * Context: Phase 60 made `Watch.imageUrl` return a RAW Supabase storage path
 * whenever an owner photo exists (DAL stays admin-client-free by design).
 * Grid/rail card components consume `watch.imageUrl` through `getSafeImageUrl()`,
 * which returns null for non-https paths — so without signing, every owner-photo
 * watch shows a blank/placeholder thumbnail.
 *
 * This helper is called by grid/rail RSCs immediately after their watch list is
 * fetched and BEFORE it reaches card components. Signing ONLY here keeps the DAL
 * admin-client-free (Pitfall-1 rule established in Phase 61 Plan 02).
 *
 * Calling RSCs are dynamic (getCurrentUser() — no ISR), so the 60-min TTL is
 * safe (RESEARCH Open Q3 / A2: cached signed URL expires before ISR revalidate
 * would serve it, but these routes are fully dynamic so there is no stale cache).
 */
import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSafeImageUrl } from '@/lib/images'

/**
 * Signs any raw `watch-photos` storage path in a list of watches' `imageUrl`.
 *
 * - Raw paths (where getSafeImageUrl returns null) are signed via createSignedUrl
 *   with a 60-min TTL and replaced with the signed https url.
 * - https catalog URLs pass through unchanged (getSafeImageUrl already returns them).
 * - null/undefined imageUrl values pass through unchanged.
 * - Distinct raw paths are signed in a single batch (de-duped via Map).
 * - A signing failure returns null for that watch's imageUrl rather than throwing.
 * - Input is never mutated; a new array (and new watch objects) is always returned.
 */
export async function signCoverUrls<T extends { imageUrl?: string | null }>(
  watches: T[],
): Promise<T[]> {
  // Collect the distinct raw paths that need signing.
  // A "raw path" is any non-null, non-empty imageUrl for which getSafeImageUrl returns null
  // (i.e. not an https or http URL — it is a bare storage path like "userId/photoId.jpg").
  const rawPaths = new Set<string>()
  for (const w of watches) {
    if (w.imageUrl && getSafeImageUrl(w.imageUrl) === null) {
      rawPaths.add(w.imageUrl)
    }
  }

  if (rawPaths.size === 0) {
    // Nothing to sign — return new array with same objects to satisfy immutability contract.
    return watches.map((w) => ({ ...w }))
  }

  // Sign all distinct raw paths in parallel (one client instance).
  const supabase = await createSupabaseServerClient()
  const signedMap = new Map<string, string | null>()

  await Promise.all(
    Array.from(rawPaths).map(async (path) => {
      try {
        const { data } = await supabase.storage
          .from('watch-photos')
          .createSignedUrl(path, 3600) // 60-min TTL — matches wear-photos + Plan 02 detail-page precedent
        signedMap.set(path, data?.signedUrl ?? null)
      } catch {
        // Signing failure is non-fatal: null prevents a raw path from appearing in markup.
        signedMap.set(path, null)
      }
    }),
  )

  // Build a new array with imageUrl replaced by signed url (or null on failure).
  return watches.map((w) => {
    if (w.imageUrl && signedMap.has(w.imageUrl)) {
      return { ...w, imageUrl: signedMap.get(w.imageUrl) }
    }
    return { ...w }
  })
}
