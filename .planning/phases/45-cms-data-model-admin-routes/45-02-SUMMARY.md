---
phase: 45-cms-data-model-admin-routes
plan: "02"
subsystem: storage
tags: [storage, supabase, rls, cms, migration]
dependency_graph:
  requires: [45-01]
  provides: [cms-covers-bucket, cms-covers-upload-helper]
  affects: [45-05]
tech_stack:
  added: []
  patterns: [supabase-storage-bucket, is_admin-rls-policy, browser-safe-upload-helper]
key_files:
  created:
    - supabase/migrations/20260518210000_phase45_cms_covers_bucket.sql
    - src/lib/storage/cmsCovers.ts
  modified: []
decisions:
  - "Public bucket (cms-covers): cover images are non-sensitive editorial assets; intentional public-read (T-45-08 accepted)"
  - "SELECT policy included even with upsert:false — Supabase Storage does an object lookup that requires SELECT (Pitfall 2 from Phase 43)"
  - "upsert:false with UUID filenames: cover replace = new upload + DB update, not overwrite in place"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-18"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 45 Plan 02: cms-covers Bucket + Upload Helper Summary

**One-liner:** cms-covers public Supabase Storage bucket with 4 is_admin-gated RLS policies and a browser-callable uploadCmsCover() helper returning a public CDN URL.

## What Was Built

### Task 1: cms-covers bucket migration (commit aec12e6)

`supabase/migrations/20260518210000_phase45_cms_covers_bucket.sql` creates:

- **Bucket:** `cms-covers`, public, 4 MB limit, JPEG/PNG/WEBP allowed MIME types, `ON CONFLICT DO NOTHING`
- **4 RLS policies** on `storage.objects`, all gated on `bucket_id = 'cms-covers' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin)`:
  - `cms_covers_select_own` (SELECT) — required for the storage-api object lookup during upload
  - `cms_covers_insert_own` (INSERT)
  - `cms_covers_update_own` (UPDATE, with both USING and WITH CHECK)
  - `cms_covers_delete_own` (DELETE)
- **DO $$ sanity assertion** — raises EXCEPTION if bucket count != 1 or policy count != 4

Timestamp `20260518210000` correctly orders after `20260518200000` (phase45_cms_tables), which creates `profiles.is_admin` that these policies depend on.

### Task 2: cmsCovers.ts upload helper (commit c40905a)

`src/lib/storage/cmsCovers.ts` exports:

- `buildCmsCoverPath(listId, filename)` — returns `${listId}/${filename}`; throws TypeError for empty listId or filename containing `/`
- `generateCmsCoverFilename()` — returns a `crypto.randomUUID()`-stamped `.jpg` filename with non-crypto fallback
- `uploadCmsCover(listId, jpeg, filename?)` — uploads to `cms-covers` with `contentType: 'image/jpeg'` and `upsert: false`; returns `{ publicUrl }` on success via `getPublicUrl()` or `{ error }` on failure

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints or auth paths introduced. The cms-covers bucket is public-read by design (T-45-08 accepted). Write paths are gated on `is_admin` (T-45-06 mitigated). No new SECURITY DEFINER functions introduced (no REVOKE needed). No threat flags beyond what is documented in the plan's threat model.

## Known Stubs

None — this plan produces infrastructure (migration + utility module), not UI. No placeholder data flows.

## Self-Check: PASSED

- [x] `supabase/migrations/20260518210000_phase45_cms_covers_bucket.sql` — FOUND
- [x] `src/lib/storage/cmsCovers.ts` — FOUND
- [x] 4 CREATE POLICY statements in migration — CONFIRMED
- [x] DO $$ sanity assertion in migration — CONFIRMED
- [x] 3 named exports in cmsCovers.ts — CONFIRMED
- [x] cmsCovers.ts has no TypeScript errors — CONFIRMED (pre-existing errors in unrelated test files only)
- [x] commit aec12e6 exists — CONFIRMED
- [x] commit c40905a exists — CONFIRMED
