// DAL for watch_families — server-only.
// Provides listFamiliesForQueue, confirmFamily, renameFamilyInDb, addFamilyAliasInDb,
// removeFamilyAliasInDb, getBrandNameById.
// Used by /admin/families Server Component + families Server Actions.
import 'server-only'

import { db } from '@/db'
import { watchFamilies, brands } from '@/db/schema'
import { asc, desc, eq, sql } from 'drizzle-orm'

// FamilyRow extends the base watchFamilies row with projected brandName for the queue display.
export type FamilyRow = typeof watchFamilies.$inferSelect & { brandName: string | null }

/**
 * Fetch watch_families ordered by needs_review DESC, name ASC (review-required rows at top).
 * Optionally filtered by brand_id (T-82-05: caller validates UUID before passing here).
 * Projects brandName via LEFT JOIN for queue display.
 */
export async function listFamiliesForQueue(brandIdFilter?: string | null): Promise<FamilyRow[]> {
  const base = db
    .select({
      id: watchFamilies.id,
      brandId: watchFamilies.brandId,
      name: watchFamilies.name,
      nameNormalized: watchFamilies.nameNormalized,
      slug: watchFamilies.slug,
      aliases: watchFamilies.aliases,
      needsReview: watchFamilies.needsReview,
      createdAt: watchFamilies.createdAt,
      updatedAt: watchFamilies.updatedAt,
      brandName: brands.name,
    })
    .from(watchFamilies)
    .leftJoin(brands, eq(brands.id, watchFamilies.brandId))

  const query = brandIdFilter
    ? base.where(eq(watchFamilies.brandId, brandIdFilter))
    : base

  return query.orderBy(desc(watchFamilies.needsReview), asc(watchFamilies.name)) as unknown as Promise<FamilyRow[]>
}

/**
 * Flip needs_review = false on a watch_families row.
 * Called by confirmFamilyAsNew Server Action.
 */
export async function confirmFamily(id: string): Promise<void> {
  await db.update(watchFamilies).set({ needsReview: false }).where(eq(watchFamilies.id, id))
}

/**
 * Rename a family — updates name only.
 * Slug left UNCHANGED: nullable, not URL-referenced by resolver or any route.
 * Per RESEARCH Open Question 2: skip slugifyWithRandomSuffix for families.
 */
export async function renameFamilyInDb(id: string, name: string): Promise<void> {
  // slug unchanged per D-82-14 recommendation + RESEARCH Open Q2 (nullable; not URL-referenced)
  await db.update(watchFamilies).set({ name }).where(eq(watchFamilies.id, id))
}

/**
 * Append a normalized alias to the aliases array with atomic dedup guard.
 *
 * SQL uses containment operator with single-element literal (RESEARCH § Pattern 4).
 * normalizedAlias MUST be pre-normalized (trim().toLowerCase()) by the Server Action
 * before this function is called — D-82-11 + RESEARCH Pitfall 3.
 * The dedup guard uses the array containment operator to prevent duplicates atomically.
 *
 * [[drizzle-sql-any-array-pitfall]] does NOT apply — this is a single-element
 * ARRAY[value]::text[] literal, not = ANY(${arr}) spread.
 */
export async function addFamilyAliasInDb(id: string, normalizedAlias: string): Promise<void> {
  await db.execute(sql`
    UPDATE watch_families
    SET aliases = aliases || ARRAY[${normalizedAlias}]::text[]
    WHERE id = ${id}
      AND NOT (aliases @> ARRAY[${normalizedAlias}]::text[])
  `)
}

/**
 * Remove an alias from the aliases array via Postgres native function.
 * Alias passed VERBATIM — chip strip already displays stored normalized form;
 * no re-normalize on remove.
 */
export async function removeFamilyAliasInDb(id: string, alias: string): Promise<void> {
  await db.execute(sql`
    UPDATE watch_families SET aliases = array_remove(aliases, ${alias}) WHERE id = ${id}
  `)
}

/**
 * Look up a brand name by id — used by the /admin/families page for the filter banner.
 */
export async function getBrandNameById(id: string): Promise<string | null> {
  const rows = await db.select({ name: brands.name }).from(brands).where(eq(brands.id, id)).limit(1)
  return rows[0]?.name ?? null
}
