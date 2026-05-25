'use client'

// src/lib/storage/watchPhotos.ts
//
// Client-direct upload helper for the watch-photos Supabase Storage bucket.
//
// Path convention: `{userId}/{photoId}.jpg` — enforced by Phase 60
// Storage RLS (`(storage.foldername(name))[1] = auth.uid()::text`). Defense
// in depth: client convention here + DB-level RLS enforcement.
//
// References:
// - 60-RESEARCH.md §Pattern 7 — client-direct upload helper (D-15)
// - 60-RESEARCH.md §Pitfall 12 — folder enforcement
// - 60-CONTEXT.md D-15 — pipeline step 2 (client-direct upload)
// - 60-02-PLAN.md T-60-TRAVERSAL, T-60-UPSERT — threat mitigations

import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export type WatchPhotoUploadResult = { path: string } | { error: string }

const UUID_RE = /^[0-9a-f-]{36}$/i
const BUCKET_ID = 'watch-photos' as const

/**
 * Build the Storage path for a watch photo.
 *
 * Convention: `{userId}/{photoId}.jpg` — enforced by Phase 60 Storage RLS.
 *
 * @throws TypeError when userId is falsy or photoId is not a UUID.
 *
 * Security: photoId validated against UUID_RE before path construction.
 * A crafted `../` photoId fails the UUID test and throws (T-60-TRAVERSAL).
 */
export function buildWatchPhotoPath(
  userId: string,
  photoId: string,
): string {
  if (!userId) {
    throw new TypeError('userId required')
  }
  if (!UUID_RE.test(photoId)) {
    throw new TypeError('photoId must be a UUID')
  }
  return `${userId}/${photoId}.jpg`
}

/**
 * Upload a JPEG blob to the watch-photos bucket using the user's session-
 * scoped Supabase client. RLS enforces the folder boundary.
 *
 * Returns `{path}` on success, `{error}` on failure.
 *
 * `upsert: false` per T-60-UPSERT — never overwrite existing objects.
 * Each photo gets a fresh upload at a UUID-stamped path; collision is
 * effectively impossible (UUID v4 collision probability ~2^-122).
 * Mirrors wearPhotos.ts precedent (D-15).
 */
export async function uploadWatchPhoto(
  userId: string,
  photoId: string,
  jpeg: Blob,
): Promise<WatchPhotoUploadResult> {
  let path: string
  try {
    path = buildWatchPhotoPath(userId, photoId)
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Invalid path inputs',
    }
  }

  const supabase = createSupabaseBrowserClient()
  const { error } = await supabase.storage
    .from(BUCKET_ID)
    .upload(path, jpeg, {
      contentType: 'image/jpeg',
      upsert: false, // T-60-UPSERT — never overwrite
    })
  if (error) {
    return { error: error.message }
  }
  return { path }
}
