// src/lib/storage/catalogSourcePhotos.ts
//
// Phase 19.1 D-20: helpers for the catalog-source-photos Supabase Storage bucket.
//
// This file has TWO sections:
//   - Browser-safe: path builder + uploader (used inside Client Components).
//   - Server-only: signed URL helper (used inside the enricher / Server Action).
//
// The browser uploader uses createSupabaseBrowserClient — RLS folder enforcement
// (Plan 01 migration) ensures a user can only write into {userId}/{...} paths.
//
// The server-side signed URL helper is gated behind a runtime window check so a
// client component cannot accidentally call it. We DO NOT import 'server-only' at
// the top of this file because the file ALSO exposes browser-safe utilities. The
// server-only gate lives at the function level via a runtime check — callers that
// reach here from a client context will get a runtime error, not a build error. If
// stricter compile-time enforcement is needed, split into two files later.

import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const BUCKET_ID = 'catalog-source-photos' as const
const UUID_RE = /^[0-9a-f-]{36}$/i

// ---------------------------------------------------------------------------
// Path convention (D-20): {userId}/{catalogIdOrPending}/{filename}.jpg
// ---------------------------------------------------------------------------

export type CatalogPhotoMiddle = string // UUID or literal 'pending'

/**
 * Build a Storage path for a catalog reference photo.
 *
 * @throws TypeError when userId is falsy
 * @throws TypeError when middle is neither 'pending' nor a UUID
 * @throws TypeError when filename contains a slash (must be a basename)
 */
export function buildCatalogSourcePhotoPath(
  userId: string,
  middle: CatalogPhotoMiddle,
  filename: string,
): string {
  if (!userId) {
    throw new TypeError('userId required')
  }
  if (middle !== 'pending' && !UUID_RE.test(middle)) {
    throw new TypeError("middle must be 'pending' or a UUID")
  }
  if (!filename || filename.includes('/')) {
    throw new TypeError('filename must be a basename, not a path')
  }
  return `${userId}/${middle}/${filename}`
}

/**
 * Generate a UUID-stamped JPEG filename for a fresh upload.
 * Uses crypto.randomUUID() (browser-safe + Node 19+).
 */
export function generateCatalogPhotoFilename(): string {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${id}.jpg`
}

// ---------------------------------------------------------------------------
// Browser-side: upload a JPEG blob to catalog-source-photos
// ---------------------------------------------------------------------------

export type CatalogPhotoUploadResult = { path: string } | { error: string }

/**
 * Upload a JPEG blob to catalog-source-photos via the user's browser session.
 * Storage RLS enforces folder ownership (catalog_source_photos_insert_own_folder policy).
 *
 * upsert: false — never overwrite. UUID-stamped filenames prevent collision.
 */
export async function uploadCatalogSourcePhoto(
  userId: string,
  middle: CatalogPhotoMiddle,
  jpeg: Blob,
  filename: string = generateCatalogPhotoFilename(),
): Promise<CatalogPhotoUploadResult> {
  let path: string
  try {
    path = buildCatalogSourcePhotoPath(userId, middle, filename)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Invalid path inputs' }
  }

  const supabase = createSupabaseBrowserClient()
  const { error } = await supabase.storage.from(BUCKET_ID).upload(path, jpeg, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) {
    return { error: error.message }
  }
  return { path }
}

// ---------------------------------------------------------------------------
// Server-side: signed URL for vision-mode enrichment (is server-only)
// ---------------------------------------------------------------------------

/**
 * Server-side signed-URL fetch for the catalog-source-photos bucket.
 * 60-second TTL (T-19.1-04-02 mitigation).
 *
 * Uses inline createClient with service-role key — mirrors the pattern in
 * src/lib/taste/enricher.ts fetchPhotoBytes. Both use:
 *   createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *     { auth: { persistSession: false, autoRefreshToken: false } })
 * No shared admin helper — intentional (Plan 02 SUMMARY confirmation).
 *
 * Returns null on failure (file missing, bucket misconfig, env vars absent, etc.)
 * — caller falls back to text-only enrichment per D-08.
 *
 * NOTE: This function is server-only — never import from a Client Component.
 */
export async function getCatalogSourcePhotoSignedUrl(
  path: string,
  ttlSeconds: number = 60,
): Promise<string | null> {
  if (typeof window !== 'undefined') {
    throw new Error('getCatalogSourcePhotoSignedUrl is server-only')
  }
  // Lazy-import the admin client so the bundler does not pull it into client chunks.
  const { createClient } = await import('@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await admin.storage
    .from(BUCKET_ID)
    .createSignedUrl(path, ttlSeconds)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}
