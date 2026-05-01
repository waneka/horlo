'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import * as preferencesDAL from '@/data/preferences'
import { getCurrentUser } from '@/lib/auth'
import type { ActionResult } from '@/lib/actionTypes'
import type { UserPreferences } from '@/lib/types'

// Hand-written Zod schema — drizzle-orm/zod is not exported in this version.
// All fields are optional because savePreferences accepts partial updates (upsert pattern).
const preferencesSchema = z.object({
  preferredStyles: z.array(z.string()).optional(),
  dislikedStyles: z.array(z.string()).optional(),
  preferredDesignTraits: z.array(z.string()).optional(),
  dislikedDesignTraits: z.array(z.string()).optional(),
  preferredComplications: z.array(z.string()).optional(),
  complicationExceptions: z.array(z.string()).optional(),
  preferredDialColors: z.array(z.string()).optional(),
  dislikedDialColors: z.array(z.string()).optional(),
  preferredCaseSizeRange: z
    .object({
      min: z.number(),
      max: z.number(),
    })
    .optional(),
  overlapTolerance: z.enum(['low', 'medium', 'high']).optional(),
  collectionGoal: z
    .enum(['balanced', 'specialist', 'variety-within-theme', 'brand-loyalist'])
    .optional(),
  notes: z.string().optional(),
})

/**
 * Save (upsert) preferences for the current session user.
 * Reads userId from session — callers do not pass userId (D-02).
 * Validates partial input, delegates to DAL, revalidates the preferences path on success.
 * Returns ActionResult — never throws across the boundary (D-12, D-15).
 */
export async function savePreferences(data: unknown): Promise<ActionResult<UserPreferences>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }

  const parsed = preferencesSchema.safeParse(data)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const summary = Object.entries(fieldErrors)
      .map(([field, errors]) => `${field}: ${(errors ?? []).join(', ')}`)
      .join('; ')
    return { success: false, error: `Invalid preferences data: ${summary}` }
  }

  try {
    const prefs = await preferencesDAL.upsertPreferences(user.id, parsed.data)
    revalidatePath('/preferences')
    // FG-3 (Phase 22 UI-SPEC): /preferences now redirects to
    // /settings#preferences (Plan 22-02 D-15); the live preferences surface
    // is the Preferences tab inside /settings, so revalidate that path too
    // — without this the tab would show stale data after a save until the
    // next full-page navigation.
    revalidatePath('/settings')
    return { success: true, data: prefs }
  } catch (err) {
    console.error('[savePreferences] unexpected error:', err)
    return { success: false, error: 'Failed to save preferences' }
  }
}
