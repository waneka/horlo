// DAL for brands — server-only.
// Provides listBrandsForQueue (with family count), confirmBrand, renameBrandInDb, mergeBrandInDb.
// Used by /admin/brands Server Component + brands Server Actions.
import 'server-only'

import { db } from '@/db'
import { brands, watchesCatalog, watchFamilies } from '@/db/schema'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { slugifyWithRandomSuffix } from '@/lib/slug'

// BrandRow extends the base brands row with a projected familyCount for the merge pre-flight dialog.
export type BrandRow = typeof brands.$inferSelect & { familyCount: number }

/**
 * Fetch all brands ordered by needs_review DESC, name ASC (review-required rows at top).
 * Projects familyCount via correlated subquery for the merge pre-flight dialog.
 */
export async function listBrandsForQueue(): Promise<BrandRow[]> {
  const rows = await db
    .select({
      id: brands.id,
      name: brands.name,
      nameNormalized: brands.nameNormalized,
      slug: brands.slug,
      countryOfOrigin: brands.countryOfOrigin,
      needsReview: brands.needsReview,
      createdAt: brands.createdAt,
      updatedAt: brands.updatedAt,
      familyCount: sql<number>`(SELECT COUNT(*)::int FROM watch_families WHERE brand_id = ${brands.id})`,
    })
    .from(brands)
    .orderBy(desc(brands.needsReview), asc(brands.name))
  return rows
}

/**
 * Flip needs_review = false on a brand row.
 * Called by confirmBrandAsNew Server Action.
 */
export async function confirmBrand(id: string): Promise<void> {
  await db.update(brands).set({ needsReview: false }).where(eq(brands.id, id))
}

/**
 * Rename a brand — updates name and regenerates slug via slugifyWithRandomSuffix.
 * The random suffix ensures no UNIQUE collision on brands.slug (D-82-14).
 */
export async function renameBrandInDb(id: string, name: string): Promise<void> {
  await db
    .update(brands)
    .set({
      name,
      slug: slugifyWithRandomSuffix(name),
    })
    .where(eq(brands.id, id))
}

/**
 * Merge a source brand into a target brand in a single atomic transaction.
 *
 * Transaction ordering (CRITICAL — RESEARCH Pitfall 2):
 *   Step 1: UPDATE watches_catalog SET brand_id=targetId WHERE brand_id=sourceId
 *   Step 2 (conditional): UPDATE watch_families SET brand_id=targetId WHERE brand_id=sourceId
 *          — MUST come BEFORE Step 3 because watch_families.brand_id has onDelete: 'restrict'
 *   Step 3: DELETE FROM brands WHERE id=sourceId
 *
 * Any throw inside the transaction block triggers an automatic ROLLBACK.
 */
export async function mergeBrandInDb(
  sourceId: string,
  targetId: string,
  moveFamilies: boolean,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Step 1: Move all watches_catalog rows to target brand
    await tx.execute(sql`
      UPDATE watches_catalog
      SET brand_id = ${targetId}
      WHERE brand_id = ${sourceId}
    `)

    // Step 2 (conditional): Move all watch_families rows to target brand.
    // MUST come BEFORE DELETE — watch_families.brand_id has onDelete: 'restrict'.
    // Skipped when moveFamilies=false (operator chose "Cancel — resolve families first").
    if (moveFamilies) {
      await tx.execute(sql`
        UPDATE watch_families
        SET brand_id = ${targetId}
        WHERE brand_id = ${sourceId}
      `)
    }

    // Step 3: Delete the source brand row.
    // Safe here because either (a) moveFamilies=true so families were moved in step 2,
    // or (b) moveFamilies=false so the Server Action already validated no families exist.
    await tx.execute(sql`
      DELETE FROM brands WHERE id = ${sourceId}
    `)
  })
}
