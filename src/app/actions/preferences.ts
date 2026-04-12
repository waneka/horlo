'use server'

// TODO(Phase 4): Replace userId parameter with session-derived userId

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import * as preferencesDAL from '@/data/preferences'
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
 * Save (upsert) preferences for a user.
 * Validates partial input, delegates to DAL, revalidates the preferences path on success.
 * Returns ActionResult — never throws across the boundary (D-12).
 */
export async function savePreferences(
  userId: string,
  data: unknown,
): Promise<ActionResult<UserPreferences>> {
  const parsed = preferencesSchema.safeParse(data)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const summary = Object.entries(fieldErrors)
      .map(([field, errors]) => `${field}: ${(errors ?? []).join(', ')}`)
      .join('; ')
    return { success: false, error: `Invalid preferences data: ${summary}` }
  }

  try {
    const prefs = await preferencesDAL.upsertPreferences(userId, parsed.data)
    revalidatePath('/preferences')
    return { success: true, data: prefs }
  } catch (err) {
    console.error('[savePreferences] unexpected error:', err)
    return { success: false, error: 'Failed to save preferences' }
  }
}
