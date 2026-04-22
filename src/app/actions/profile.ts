'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import * as profilesDAL from '@/data/profiles'
import { getCurrentUser } from '@/lib/auth'
import type { ActionResult } from '@/lib/actionTypes'

// Mass-assignment protection (T-08-03): explicit allow list, .strict() rejects
// unknown keys. Username and id are NEVER accepted.
const updateProfileSchema = z
  .object({
    displayName: z.string().max(80).nullable().optional(),
    avatarUrl: z.string().url().max(500).nullable().optional(),
    bio: z.string().max(500).nullable().optional(),
  })
  .strict()

export async function updateProfile(data: unknown): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = updateProfileSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid profile data' }
  }

  try {
    await profilesDAL.updateProfileFields(user.id, parsed.data)
    revalidatePath('/u/[username]', 'layout')
    revalidatePath('/settings')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[updateProfile] unexpected error:', err)
    return { success: false, error: "Couldn't save your profile. Try again." }
  }
}

// T-08-04: Zod enum whitelist of the four visibility fields.
// Arbitrary column updates impossible.
const VISIBILITY_FIELDS = [
  'profilePublic',
  'collectionPublic',
  'wishlistPublic',
] as const

const updateSettingsSchema = z
  .object({
    field: z.enum(VISIBILITY_FIELDS),
    value: z.boolean(),
  })
  .strict()

export async function updateProfileSettings(data: unknown): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = updateSettingsSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid settings payload' }
  }

  try {
    await profilesDAL.updateProfileSettingsField(
      user.id,
      parsed.data.field,
      parsed.data.value
    )
    revalidatePath('/settings')
    revalidatePath('/u/[username]', 'layout')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[updateProfileSettings] unexpected error:', err)
    return { success: false, error: "Couldn't save your privacy settings. Try again." }
  }
}
