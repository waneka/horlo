'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { divestments, watches } from '@/db/schema'
import * as watchDAL from '@/data/watches'
import { getCurrentUser } from '@/lib/auth'
import type { ActionResult } from '@/lib/actionTypes'

/**
 * Phase 37 D-11 — recordDivestment input schema.
 * Mirrors the optional-shape divestments columns the future v5.x sell-dialog
 * will populate. All fields are optional in Phase 37 (D-12 — sell-dialog UI
 * is deferred; status-chip-click writes an empty-metadata divestment row).
 *
 * T-37-INPUT-01 mitigation: safeParse() returns early on any malformed input,
 * surfacing field-level errors back to the caller via ActionResult.
 */
const recordDivestmentSchema = z.object({
  salePrice: z.number().optional(),
  saleCurrency: z.enum([
    'USD', 'EUR', 'GBP', 'JPY', 'CHF',
    'AUD', 'CAD', 'HKD', 'SGD', 'CNY',
  ]).optional(),
  replacedByCatalogId: z.string().uuid().optional(),
  notes: z.string().optional(),
})

export type RecordDivestmentInput = z.infer<typeof recordDivestmentSchema>

/**
 * Phase 37 D-11 — record a divestment (collector sold this watch).
 *
 * Return shape: `ActionResult<{ divestmentId: string }>` (with `success`/
 * `error` keys per `src/lib/actionTypes.ts`) — INTENTIONAL deviation from
 * CONTEXT.md D-11's `{ ok }` sketch. ActionResult is the project-wide
 * Server Action convention (mirrors addWatch / editWatch / removeWatch).
 *
 * Atomic dual-write per D-11 step 4: INSERT into divestments + UPDATE
 * watches.status='sold' wrapped in db.transaction(). If either side fails,
 * BOTH roll back — the collector never ends up with a divestment row but
 * no status flip, or a status flip but no historical record.
 *
 * Threats mitigated:
 *   T-37-OWN-01 (called without auth — getCurrentUser throws → return early)
 *   T-37-OWN-02 (called on watch user does not own — getWatchById returns null → return error)
 *   T-37-INPUT-01 (malformed zod input — safeParse early-return with field errors)
 *
 * NOTE: this is the canonical implementation of the dual-write. editWatch
 * (src/app/actions/watches.ts) detects the owned→sold transition server-side
 * and inlines an equivalent transaction — both paths are atomic.
 */
export async function recordDivestment(
  watchId: string,
  data?: unknown,
): Promise<ActionResult<{ divestmentId: string }>> {
  // T-37-OWN-01: auth gate.
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  // T-37-INPUT-01: zod input validation.
  const parsed = recordDivestmentSchema.safeParse(data ?? {})
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const summary = Object.entries(fieldErrors)
      .map(([field, errors]) => `${field}: ${(errors ?? []).join(', ')}`)
      .join('; ')
    return { success: false, error: `Invalid divestment data: ${summary}` }
  }
  const input: RecordDivestmentInput = parsed.data

  try {
    // T-37-OWN-02: ownership check via existing DAL pattern.
    // getWatchById(userId, watchId) returns Watch | null — null means not
    // found OR not owned by userId (RLS enforced on watches).
    const watch = await watchDAL.getWatchById(user.id, watchId)
    if (!watch) {
      return { success: false, error: 'Not found' }
    }

    // D-11 step 2: post-CAT-14 invariant — watches.catalog_id IS NOT NULL.
    // Defensive check because the Drizzle .notNull() tightening is deferred
    // to Phase 38 (Phase 36 Plan 01 Rule 4) — the TS type is still nullable.
    if (!watch.catalogId) {
      return { success: false, error: 'Watch has no catalog link — cannot record divestment' }
    }

    // D-11 steps 3 + 4: atomic dual-write. FIRST db.transaction() in codebase.
    // ALL writes go through `tx`, NOT `db`. Both writes succeed or both
    // roll back. divestedAt + createdAt + updatedAt default at DB level
    // (timestamptz NOT NULL DEFAULT now()).
    const divestmentId = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(divestments)
        .values({
          catalogId: watch.catalogId!,
          userId: user.id,
          salePrice: input.salePrice,
          saleCurrency: input.saleCurrency,
          replacedByCatalogId: input.replacedByCatalogId,
          notes: input.notes,
        })
        .returning({ id: divestments.id })

      await tx
        .update(watches)
        .set({ status: 'sold' })
        .where(eq(watches.id, watchId))

      return inserted[0].id
    })

    // Fan-out per existing editWatch pattern (watches.ts lines 342–351).
    // The status change to 'sold' shifts owners_count + wishlist_count on
    // next pg_cron refresh; explore rails must recompute.
    revalidatePath('/')
    revalidatePath('/u/[username]', 'layout')
    revalidateTag('explore', 'max')

    return { success: true, data: { divestmentId } }
  } catch (err) {
    console.error('[recordDivestment] unexpected error:', err)
    if (err instanceof Error && err.message.includes('not found or access denied')) {
      return { success: false, error: 'Not found' }
    }
    return { success: false, error: 'Failed to record divestment' }
  }
}
