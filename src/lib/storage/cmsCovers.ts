// src/lib/storage/cmsCovers.ts
//
// Phase 45 D-14 (CMS-03): helpers for the cms-covers Supabase Storage bucket.
//
// Browser-safe only: path builder + uploader (used inside CMS cover upload component).
// The cms-covers bucket is public — no signed URL helper needed.
// RLS enforces is_admin EXISTS predicate on all writes (phase45_cms_covers_bucket migration).
//
// Path convention: {listId}/{filename}.jpg — UUID-stamped filenames prevent collision.
// upsert: false — cover "replace" = upload a new file; update curated_lists.cover_url after.

import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const BUCKET_ID = 'cms-covers' as const

// ---------------------------------------------------------------------------
// Path convention (D-14): {listId}/{filename}.jpg
// UUID-stamped filenames; upsert: false (no overwrite).
// ---------------------------------------------------------------------------

/**
 * Build a Storage path for a curated-list cover image.
 *
 * @throws TypeError when listId is falsy
 * @throws TypeError when filename contains a slash (must be a basename)
 */
export function buildCmsCoverPath(listId: string, filename: string): string {
  if (!listId) {
    throw new TypeError('listId required')
  }
  if (!filename || filename.includes('/')) {
    throw new TypeError('filename must be a basename')
  }
  return `${listId}/${filename}`
}

/**
 * Generate a UUID-stamped JPEG filename for a fresh upload.
 * Uses crypto.randomUUID() (browser-safe + Node 19+).
 * Falls back to a timestamp + random suffix when crypto is unavailable.
 */
export function generateCmsCoverFilename(): string {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${id}.jpg`
}

// ---------------------------------------------------------------------------
// Browser-side: upload a JPEG blob to cms-covers
// ---------------------------------------------------------------------------

export type CmsCoverUploadResult = { publicUrl: string } | { error: string }

/**
 * Upload a JPEG blob to the cms-covers bucket via the user's browser session.
 * Storage RLS enforces is_admin ownership (cms_covers_insert_own policy).
 *
 * upsert: false — UUID-stamped filenames prevent collision; replacing a cover
 * means uploading a new file and updating curated_lists.cover_url in the DB.
 * Public bucket — returns a permanent public CDN URL (no signed-URL expiry).
 */
export async function uploadCmsCover(
  listId: string,
  jpeg: Blob,
  filename: string = generateCmsCoverFilename(),
): Promise<CmsCoverUploadResult> {
  let path: string
  try {
    path = buildCmsCoverPath(listId, filename)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Invalid path inputs' }
  }

  const supabase = createSupabaseBrowserClient()
  const { error } = await supabase.storage.from(BUCKET_ID).upload(path, jpeg, {
    contentType: 'image/jpeg',
    upsert: false, // UUID-stamped filenames prevent collision; cover replace = upload new file
  })
  if (error) {
    return { error: error.message }
  }

  // Public bucket — construct public URL directly (no signed URL needed).
  const { data } = supabase.storage.from(BUCKET_ID).getPublicUrl(path)
  return { publicUrl: data.publicUrl }
}
