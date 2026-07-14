'use server'

// CRITICAL: assertOwner() is the SOLE enforced security gate for every CMS Server Action.
// The admin layout redirect is UX only — Server Actions are HTTP-callable and bypass
// layout guards. The CMS DAL runs through the Drizzle `db` client (direct Postgres
// connection), which BYPASSES RLS. D-06.
//
// revalidatePath is the correct invalidation primitive for admin queue pages.
// Admin pages have NO 'use cache' wrapper — they are standard dynamic Server Components.
// updateTag is NOT used here (it is for read-your-own-writes; these are admin mutations).
// See next16-revalidatetag-deprecated memory.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertOwner } from '@/lib/auth'
import { confirmBrand, renameBrandInDb, mergeBrandInDb } from '@/data/brands'
import type { ActionResult } from '@/lib/actionTypes'

// Mass-assignment protection: Zod strict() rejects unknown keys (T-82-02).
const confirmSchema = z.object({ id: z.string().uuid() }).strict()

const renameSchema = z
  .object({ id: z.string().uuid(), name: z.string().min(1).max(200) })
  .strict()

const mergeSchema = z
  .object({
    sourceId: z.string().uuid(),
    targetId: z.string().uuid(),
    moveFamilies: z.boolean(),
  })
  .strict()

// ---------------------------------------------------------------------------
// confirmBrandAsNew — flip needs_review = false
// ---------------------------------------------------------------------------
export async function confirmBrandAsNew(data: unknown): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  const parsed = confirmSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid data' }
  try {
    await confirmBrand(parsed.data.id)
    revalidatePath('/admin/brands')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[confirmBrandAsNew] unexpected error:', err)
    return { success: false, error: "Couldn't confirm brand. Try again." }
  }
}

// ---------------------------------------------------------------------------
// renameBrand — update name + regenerate slug via slugifyWithRandomSuffix (D-82-14)
// ---------------------------------------------------------------------------
export async function renameBrand(data: unknown): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  const parsed = renameSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid data' }
  try {
    await renameBrandInDb(parsed.data.id, parsed.data.name)
    revalidatePath('/admin/brands')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[renameBrand] unexpected error:', err)
    return { success: false, error: "Couldn't rename brand. Try again." }
  }
}

// ---------------------------------------------------------------------------
// mergeBrand — atomic transaction moving watches_catalog + watch_families (conditional)
//              then DELETE source brand. T-82-02: sourceId===targetId guard.
// ---------------------------------------------------------------------------
export async function mergeBrand(data: unknown): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  const parsed = mergeSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid data' }
  // T-82-02: prevent self-merge (no-op UPDATE + unexpected DELETE of the brand row)
  if (parsed.data.sourceId === parsed.data.targetId) {
    return { success: false, error: 'Invalid data' }
  }
  try {
    await mergeBrandInDb(parsed.data.sourceId, parsed.data.targetId, parsed.data.moveFamilies)
    revalidatePath('/admin/brands')
    // mergeBrand conditionally touches watch_families rows — invalidate families queue too
    revalidatePath('/admin/families')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[mergeBrand] unexpected error:', err)
    return { success: false, error: "Couldn't merge brand. Try again." }
  }
}
