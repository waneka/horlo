'use server'

// Unlike notifications.ts which uses updateTag (read-your-own-writes),
// hero pin is a GLOBAL shared cache — all visitors see it, not just the admin.
// revalidateTag('explore:hero', 'max') is the correct primitive here.
// See notifications.ts:14-55 for the source-level Next.js 16 rationale:
//   - revalidateTag('explore:hero', 'max') → stale-while-revalidate (SWR semantics)
//   - updateTag(tag) → immediate expiration for read-your-own-writes
//   The hero render path is visited by all users, not just the admin who pinned.
//   SWR semantics mean stale content is served while fresh content loads in the
//   background — acceptable for a curated hero feature updated infrequently.
//
// revalidateTag uses the two-argument form (single-arg is deprecated in Next.js 16).
// See node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md

import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { assertOwner } from '@/lib/auth'
import * as cmsSettingsDAL from '@/data/cmsSettings'
import type { ActionResult } from '@/lib/actionTypes'

// Mass-assignment protection: .strict() rejects unknown keys (T-45-16).
const setPinSchema = z
  .object({
    listId: z.string().uuid(),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .strict()

// ---------------------------------------------------------------------------
// setPinnedHero
// ---------------------------------------------------------------------------
export async function setPinnedHero(data: unknown): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  const parsed = setPinSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid pin data' }
  try {
    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null
    await cmsSettingsDAL.setPinnedHero(parsed.data.listId, expiresAt)
    // CRITICAL: two-argument form — single-arg is deprecated in Next.js 16 (AGENTS.md).
    // revalidateTag not updateTag — hero cache is GLOBAL, not read-your-own-writes.
    revalidateTag('explore:hero', 'max')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[setPinnedHero] unexpected error:', err)
    return { success: false, error: "Couldn't pin hero. Try again." }
  }
}

// ---------------------------------------------------------------------------
// clearPinnedHero
// ---------------------------------------------------------------------------
export async function clearPinnedHero(): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  try {
    await cmsSettingsDAL.clearPinnedHero()
    // CRITICAL: two-argument form — single-arg is deprecated in Next.js 16 (AGENTS.md).
    revalidateTag('explore:hero', 'max')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[clearPinnedHero] unexpected error:', err)
    return { success: false, error: "Couldn't clear hero pin. Try again." }
  }
}
