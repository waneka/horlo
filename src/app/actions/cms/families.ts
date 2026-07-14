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
import {
  confirmFamily,
  renameFamilyInDb,
  addFamilyAliasInDb,
  removeFamilyAliasInDb,
} from '@/data/families'
import type { ActionResult } from '@/lib/actionTypes'

// Mass-assignment protection: Zod strict() rejects unknown keys (T-82-02).
const confirmSchema = z.object({ id: z.string().uuid() }).strict()

const renameSchema = z
  .object({ id: z.string().uuid(), name: z.string().min(1).max(200) })
  .strict()

const addAliasSchema = z
  .object({
    id: z.string().uuid(),
    alias: z.string().min(1).max(100),
  })
  .strict()

const removeAliasSchema = z
  .object({
    id: z.string().uuid(),
    alias: z.string().min(1).max(100),
  })
  .strict()

// ---------------------------------------------------------------------------
// confirmFamilyAsNew — flip needs_review = false
// ---------------------------------------------------------------------------
export async function confirmFamilyAsNew(data: unknown): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  const parsed = confirmSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid data' }
  try {
    await confirmFamily(parsed.data.id)
    revalidatePath('/admin/families')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[confirmFamilyAsNew] unexpected error:', err)
    return { success: false, error: "Couldn't confirm family. Try again." }
  }
}

// ---------------------------------------------------------------------------
// renameFamily — update name only (slug unchanged per D-82-14 + RESEARCH Open Q2)
// ---------------------------------------------------------------------------
export async function renameFamily(data: unknown): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  const parsed = renameSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid data' }
  try {
    await renameFamilyInDb(parsed.data.id, parsed.data.name)
    revalidatePath('/admin/families')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[renameFamily] unexpected error:', err)
    return { success: false, error: "Couldn't rename family. Try again." }
  }
}

// ---------------------------------------------------------------------------
// addFamilyAlias — normalize BEFORE storage; MUST match resolver Tier 2 lower(trim($1))
//                  at catalog-resolver.ts L249 (RESEARCH Pitfall 3)
// ---------------------------------------------------------------------------
export async function addFamilyAlias(data: unknown): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  const parsed = addAliasSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid data' }
  // Normalize BEFORE storage — matches resolver Tier 2 lower(trim($1)) at catalog-resolver.ts L249
  const normalized = parsed.data.alias.trim().toLowerCase()
  // Post-normalization empty guard (catches whitespace-only inputs that pass Zod min(1))
  if (normalized.length === 0) return { success: false, error: 'Invalid data' }
  try {
    await addFamilyAliasInDb(parsed.data.id, normalized)
    revalidatePath('/admin/families')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[addFamilyAlias] unexpected error:', err)
    return { success: false, error: "Couldn't add alias. Try again." }
  }
}

// ---------------------------------------------------------------------------
// removeFamilyAlias — pass alias VERBATIM (chip strip shows stored normalized form;
//                     no re-normalize on remove)
// ---------------------------------------------------------------------------
export async function removeFamilyAlias(data: unknown): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  const parsed = removeAliasSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid data' }
  try {
    await removeFamilyAliasInDb(parsed.data.id, parsed.data.alias)
    revalidatePath('/admin/families')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[removeFamilyAlias] unexpected error:', err)
    return { success: false, error: "Couldn't remove alias. Try again." }
  }
}
