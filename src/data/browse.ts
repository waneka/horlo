// DAL is server-only — importing this from a client component is a build-time error.
import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { PRIMARY_ARCHETYPES } from '@/lib/taste/vocab'

/**
 * Phase 46 Browse count DAL.
 *
 * Four viewer-independent GROUP BY count readers powering the Browse the Catalog
 * module and index pages (EXPL-03, D-19).
 *
 * Cache strategy (D-19): each function uses 'use cache' + cacheTag('explore',
 * 'explore:browse') + cacheLife('hours'). Browse counts are global (no per-viewer
 * data, public-read RLS) — all users share the same cache entry.
 *
 * Invalidation (Phase 46 CR-01): catalog mutations must call
 * revalidateTag('explore', 'max') so these caches recompute. There are TWO
 * catalog-mutation entry points and BOTH are now wired:
 *   1. The addWatch Server Action (src/app/actions/watches.ts:294) — covers the
 *      user-input promotion path.
 *   2. The /api/extract-watch route handler (src/app/api/extract-watch/route.ts)
 *      — covers the URL-extraction path (upsertCatalogFromExtractedUrl +
 *      updateCatalogTaste). This route was previously unwired; CR-01 added the
 *      revalidateTag call there.
 * cacheTag registers both 'explore' and 'explore:browse', so revalidateTag('explore')
 * busts Browse caches as a side effect.
 *
 * Pattern: 'use cache' → cacheTag → cacheLife → db.execute(sql`...`) → cast to
 * typed array (same as getTopStyleTags in catalog.ts, Pattern 1 in RESEARCH.md).
 */

// ---------------------------------------------------------------------------
// getBrowseArchetypeCounts — derived from unnest(style_tags) (D-EXPLORE-01)
// ---------------------------------------------------------------------------

/**
 * Count of catalog watches per archetype, derived from `style_tags`. Phase 49.1
 * D-EXPLORE-01 rewire: the prior archetype column is gone; counts come from the
 * intersection of `style_tags` and the 10-value PRIMARY_ARCHETYPES closed vocab.
 *
 * Per spike Q1 (49-SPIKE.md §4), 99% of catalog rows have the archetype value
 * verbatim in `style_tags`, so post-rewire counts are near-identical to pre-rewire.
 *
 * Function signature, return shape, and cache scope are PRESERVED — callers
 * (CollectorArchetypes module count badges, EXPL-05) are type-compatible
 * without modification.
 *
 * SQL: lateral unnest pattern (analog: src/data/catalog.ts:533-544 getTopStyleTags).
 * Parameter binding for the 10-value list uses sql.join (analog: catalog.ts:611
 * motifsSql idiom) — values are never interpolated as a string.
 */
export async function getBrowseArchetypeCounts(): Promise<Array<{ archetype: string; count: number }>> {
  'use cache'
  cacheTag('explore', 'explore:browse')
  cacheLife('hours')
  const rows = await db.execute(
    sql`SELECT tag AS archetype, COUNT(*)::int AS count
        FROM watches_catalog, unnest(style_tags) AS tag
        WHERE tag = ANY(ARRAY[${sql.join(PRIMARY_ARCHETYPES.map((v) => sql`${v}`), sql`, `)}])
        GROUP BY tag
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

// ---------------------------------------------------------------------------
// getBrowseBrandFacets — { slug, name } projection for the /search Filter drawer
// ---------------------------------------------------------------------------

/**
 * Quick-task 260519-ga9 (FU-01).
 *
 * Brand-facet vocabulary for the /search Watches-tab Filter drawer BrandChips
 * control. Thin { slug, name } projection of the same brands↔watches_catalog
 * INNER JOIN used by getBrowseBrandCounts — no new query shape, just dropped the
 * count column. Shares the exact 'use cache' + cacheTag('explore','explore:browse')
 * + cacheLife('hours') scope so catalog mutations bust it the same way.
 *
 * Only brands with at least one catalog watch appear (INNER JOIN). Ordered by
 * name_normalized ASC so the chip row reads A–Z.
 */
export async function getBrowseBrandFacets(): Promise<Array<{ slug: string; name: string }>> {
  'use cache'
  cacheTag('explore', 'explore:browse')
  cacheLife('hours')
  const rows = await db.execute(
    sql`SELECT b.slug, b.name
        FROM brands b
        JOIN watches_catalog wc ON wc.brand_id = b.id
        GROUP BY b.id, b.slug, b.name
        ORDER BY b.name_normalized ASC`,
  )
  return rows as unknown as Array<{ slug: string; name: string }>
}
