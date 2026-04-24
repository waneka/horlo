'use client'

// src/lib/storage/wearPhotos.ts
//
// Client-direct upload helper for the wear-photos Supabase Storage bucket.
//
// Path convention: `{userId}/{wearEventId}.jpg` — enforced by Phase 11
// Storage RLS (`(storage.foldername(name))[1] = auth.uid()::text`). Defense
// in depth: client convention here + DB-level RLS enforcement.
//
// References:
// - 15-RESEARCH.md §Pattern 7 — client-direct upload helper
// - 15-RESEARCH.md §Pitfall 12 — folder enforcement
// - 15-CONTEXT.md D-15 — pipeline step 2 (client-direct upload)
// - 11-schema-storage-foundation/11-CONTEXT.md D-01..D-03 — RLS

import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export type UploadResult = { path: string } | { error: string }

const UUID_RE = /^[0-9a-f-]{36}$/i

/**
 * Build the Storage path for a wear-event photo.
 *
 * @throws TypeError when userId is falsy or wearEventId is not a UUID.
 */
export function buildWearPhotoPath(
  userId: string,
  wearEventId: string,
): string {
  if (!userId) {
    throw new TypeError('userId required')
  }
  if (!UUID_RE.test(wearEventId)) {
    throw new TypeError('wearEventId must be a UUID')
  }
  return `${userId}/${wearEventId}.jpg`
}

/**
 * Upload a JPEG blob to the wear-photos bucket using the user's session-
 * scoped Supabase client. RLS enforces the folder boundary.
 *
 * Returns `{path}` on success, `{error}` on failure.
 *
 * `upsert: false` per Pitfall F-4 — never overwrite existing objects.
 * Each wear event gets a fresh upload at a UUID-stamped path; collision
 * is effectively impossible (UUID v4 collision probability ~2^-122).
 */
export async function uploadWearPhoto(
  userId: string,
  wearEventId: string,
  jpeg: Blob,
): Promise<UploadResult> {
  let path: string
  try {
    path = buildWearPhotoPath(userId, wearEventId)
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Invalid path inputs',
    }
  }

  const supabase = createSupabaseBrowserClient()
  const { error } = await supabase.storage
    .from('wear-photos')
    .upload(path, jpeg, {
      contentType: 'image/jpeg',
      upsert: false, // Pitfall F-4 — never overwrite
    })
  if (error) {
    return { error: error.message }
  }
  return { path }
}
