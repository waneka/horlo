// DAL is server-only — importing this from a client component is a build-time error.
import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

/**
 * Phase 46 Browse count DAL.
 *
 * Four viewer-independent GROUP BY count readers powering the Browse the Catalog
 * module and index pages (EXPL-03, D-19).
 *
 * Cache strategy (D-19): each function uses 'use cache' + cacheTag('explore',
 * 'explore:browse') + cacheLife('hours'). Browse counts are global (no per-viewer
 * data, public-read RLS) — all users share the same cache entry. The existing
 * revalidateTag('explore', 'max') calls in watch mutation Server Actions already
 * cover catalog-mutation invalidation: cacheTag registers both 'explore' and
 * 'explore:browse', so any call to revalidateTag('explore') busts Browse caches
 * as a side effect. No new revalidation wiring needed (RESEARCH § Anti-Patterns).
 *
 * Pattern: 'use cache' → cacheTag → cacheLife → db.execute(sql`...`) → cast to
 * typed array (same as getTopStyleTags in catalog.ts, Pattern 1 in RESEARCH.md).
 */

// ---------------------------------------------------------------------------
// getBrowseArchetypeCounts — GROUP BY primary_archetype
// ---------------------------------------------------------------------------

/**
 * Count of catalog watches per primary_archetype. Only rows with a non-null
 * primary_archetype appear (WHERE NOT NULL in query). Ordered by count DESC.
 *
 * Powers the Collector Archetypes module count badges (EXPL-05).
 */
export async function getBrowseArchetypeCounts(): Promise<Array<{ archetype: string; count: number }>> {
  'use cache'
  cacheTag('explore', 'explore:browse')
  cacheLife('hours')
  const rows = await db.execute(
    sql`SELECT primary_archetype AS archetype, COUNT(*)::int AS count
        FROM watches_catalog
        WHERE primary_archetype IS NOT NULL
        GROUP BY primary_archetype
        ORDER BY count DESC`,
  )
  return rows as unknown as Array<{ archetype: string; count: number }>
}

// ---------------------------------------------------------------------------
// getBrowseEraCounts — GROUP BY era_signal
// ---------------------------------------------------------------------------

/**
 * Count of catalog watches per eraSignal. Only rows with a non-null era_signal
 * appear. Returns at most 3 rows (ERA_SIGNALS has 3 values: D-18).
 *
 * Powers the /explore/eras index page (EXPL-03).
 */
export async function getBrowseEraCounts(): Promise<Array<{ era: string; count: number }>> {
  'use cache'
  cacheTag('explore', 'explore:browse')
  cacheLife('hours')
  const rows = await db.execute(
    sql`SELECT era_signal AS era, COUNT(*)::int AS count
        FROM watches_catalog
        WHERE era_signal IS NOT NULL
        GROUP BY era_signal`,
  )
  return rows as unknown as Array<{ era: string; count: number }>
}

// ---------------------------------------------------------------------------
// getBrowseGenreCounts — GROUP BY primary_archetype (same column, different intent)
// ---------------------------------------------------------------------------

/**
 * Count of catalog watches per primary_archetype, aliased as 'genre'.
 *
 * Shares the same underlying column as getBrowseArchetypeCounts (D-17) — the
 * two functions serve different UI intents: Archetypes = identity rail with
 * editorial copy; Genres = utility list with counts as primary data.
 *
 * Powers the /explore/genres index page (EXPL-03).
 */
export async function getBrowseGenreCounts(): Promise<Array<{ genre: string; count: number }>> {
  'use cache'
  cacheTag('explore', 'explore:browse')
  cacheLife('hours')
  const rows = await db.execute(
    sql`SELECT primary_archetype AS genre, COUNT(*)::int AS count
        FROM watches_catalog
        WHERE primary_archetype IS NOT NULL
        GROUP BY primary_archetype
        ORDER BY count DESC`,
  )
  return rows as unknown as Array<{ genre: string; count: number }>
}

// ---------------------------------------------------------------------------
// getBrowseBrandCounts — JOIN brands + watches_catalog
// ---------------------------------------------------------------------------

/**
 * Count of catalog watches per brand, joined from the brands table.
 *
 * Only brands with at least one catalog watch appear (INNER JOIN). Ordered by
 * name_normalized ASC for A–Z index page rendering (D-07, EXPL-04).
 *
 * The brandId is the brands.id UUID (not slug). The slug is included for
 * deep-link URL construction on the brands index page (the link carries slug
 * so the /search predicate can resolve slug → brand_id via subquery in Plan 02).
 *
 * Powers the /explore/brands index page (EXPL-03, EXPL-04).
 */
export async function getBrowseBrandCounts(): Promise<Array<{ brandId: string; name: string; slug: string; count: number }>> {
  'use cache'
  cacheTag('explore', 'explore:browse')
  cacheLife('hours')
  const rows = await db.execute(
    sql`SELECT b.id AS "brandId", b.name, b.slug, COUNT(wc.id)::int AS count
        FROM brands b
        JOIN watches_catalog wc ON wc.brand_id = b.id
        GROUP BY b.id, b.name, b.slug
        ORDER BY b.name_normalized ASC`,
  )
  return rows as unknown as Array<{ brandId: string; name: string; slug: string; count: number }>
}
