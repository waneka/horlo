// src/lib/storage/avatarPhotos.ts
//
// Phase 43 PLSH-06: helpers for the avatars Supabase Storage bucket.
//
// Browser-safe only: path builder + uploader (used inside AvatarUploader component).
// The avatars bucket is public — no signed URL helper needed.
// RLS folder enforcement (phase43 migration) ensures a user can only write
// into {userId}/avatar.jpg paths.

import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const BUCKET_ID = 'avatars' as const

// ---------------------------------------------------------------------------
// Path convention (PLSH-06): {userId}/avatar.jpg — one file per user.
// upsert: true on upload — avatars replace in place.
// ---------------------------------------------------------------------------

/**
 * Build a Storage path for an avatar.
 *
 * @throws TypeError when userId is falsy
 */
export function buildAvatarPath(userId: string): string {
  if (!userId) {
    throw new TypeError('userId required')
  }
  return `${userId}/avatar.jpg`
}

// ---------------------------------------------------------------------------
// Browser-side: upload a JPEG blob to avatars
// ---------------------------------------------------------------------------

export type AvatarUploadResult = { publicUrl: string } | { error: string }

/**
 * Upload a JPEG blob to the avatars bucket via the user's browser session.
 * Storage RLS enforces folder ownership (avatars_insert_own_folder policy).
 *
 * upsert: true — avatars replace in place (unlike catalog-source-photos which uses upsert: false).
 * Public bucket — returns a permanent public CDN URL (no signed-URL expiry).
 */
export async function uploadAvatarPhoto(
  userId: string,
  jpeg: Blob,
): Promise<AvatarUploadResult> {
  let path: string
  try {
    path = buildAvatarPath(userId)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Invalid path inputs' }
  }

  const supabase = createSupabaseBrowserClient()
  const { error } = await supabase.storage.from(BUCKET_ID).upload(path, jpeg, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (error) {
    return { error: error.message }
  }

  // Public bucket — construct public URL directly (no signed URL needed).
  const { data } = supabase.storage.from(BUCKET_ID).getPublicUrl(path)
  return { publicUrl: data.publicUrl }
}
