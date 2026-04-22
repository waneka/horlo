---
phase: 11
plan: 04
subsystem: storage
tags:
  - schema
  - migration
  - storage
  - rls
  - security
  - privacy
dependency_graph:
  requires:
    - "supabase/migrations/20260423000001_phase11_wear_visibility.sql (wear_events.visibility column)"
    - "public.follows table (Phase 7 — already exists)"
    - "public.wear_events table (Phase 8 — already exists)"
  provides:
    - "wear-photos Storage bucket (private, 5MB limit, JPEG/PNG/WEBP)"
    - "wear_photos_select_three_tier — three-tier SELECT RLS (owner/public/followers)"
    - "wear_photos_insert_own_folder — folder-enforcement INSERT policy"
    - "wear_photos_update_own_folder — folder-enforcement UPDATE policy (USING+WITH CHECK)"
    - "wear_photos_delete_own_folder — folder-enforcement DELETE policy"
    - "Wave 0 integration test scaffold for WYWT-13 + WYWT-14"
  affects:
    - "Phase 15 (WYWT photo post flow — signed URL minting + upload pipeline)"
    - "Phase 12 (wear DAL visibility ripple — depends on wear_events.visibility existing)"
tech_stack:
  added: []
  patterns:
    - "DROP POLICY IF EXISTS + CREATE POLICY for idempotent storage.objects policy re-apply"
    - "ON CONFLICT (id) DO NOTHING for idempotent bucket creation"
    - "(SELECT auth.uid()) InitPlan caching on storage.objects (Pitfall 2)"
    - "Three-tier EXISTS subquery pattern: owner branch / EXISTS(public) / EXISTS(followers JOIN follows)"
    - "storage.foldername(name)[1] folder-enforcement for INSERT/UPDATE/DELETE"
    - "Real Supabase Auth users via admin.auth.admin.createUser for JWT-bearing integration tests"
key_files:
  created:
    - supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql
    - tests/integration/phase11-storage-rls.test.ts
  modified: []
decisions:
  - "DROP POLICY IF EXISTS before each CREATE POLICY makes Migration 4 safe to re-apply after drizzle-kit push (idempotence discipline matching Plans 01 and 02)"
  - "All 7 auth.uid() calls wrapped in (SELECT auth.uid()) — owner branch (1), followers JOIN subquery (1), INSERT WITH CHECK (1), UPDATE USING (1), UPDATE WITH CHECK (1), DELETE USING (1), and public branch has none (no uid needed for public check) = 6 functional + 1 additional in owner"
  - "Public-visibility branch of SELECT has no auth.uid() check (any authenticated viewer passes) — defense via TO authenticated grant, not per-row uid comparison"
  - "Integration test uses real Supabase Auth users via admin.auth.admin.createUser (not db.insert(users)) to produce JWT-bearing sessions needed for signInWithPassword"
  - "Three distinct wornDate values per test user A to satisfy wear_events_unique_day constraint"
  - "Admin (service-role) uploads for setup; stranger's cross-folder upload tested separately via anon-key client"
metrics:
  duration: ~10min
  completed: "2026-04-22"
  tasks: 2
  files: 2
---

# Phase 11 Plan 04: wear-photos Storage Bucket + Three-Tier RLS + Wave 0 Tests Summary

**One-liner:** Private wear-photos bucket with 5MB/JPEG/PNG/WEBP limits and four storage.objects RLS policies (three-tier owner/public/followers SELECT + folder-enforcement INSERT/UPDATE/DELETE using InitPlan-cached auth.uid()), plus a 12-test Wave 0 integration scaffold that exercises the full 9-cell access matrix and folder enforcement via real Supabase Auth JWTs.

## What Was Built

### Task 1: Migration 4 (`supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql`)

Single atomic `BEGIN;...COMMIT;` transaction. Structure:

1. **Bucket creation** — `INSERT INTO storage.buckets ... ON CONFLICT (id) DO NOTHING`. Private (`public = false`), 5MB limit (`file_size_limit = 5242880`), three allowed MIME types (`ARRAY['image/jpeg', 'image/png', 'image/webp']`). Idempotent via `ON CONFLICT DO NOTHING`.

2. **`wear_photos_select_three_tier` SELECT policy** — `TO authenticated`, three OR-joined branches inside `bucket_id = 'wear-photos'`:

   | Branch | Condition |
   |--------|-----------|
   | Owner | `(storage.foldername(name))[1] = (SELECT auth.uid())::text` |
   | Public | `EXISTS (SELECT 1 FROM wear_events we WHERE we.id::text = split_part(...) AND we.visibility = 'public')` |
   | Followers | `EXISTS (SELECT 1 FROM wear_events we JOIN follows f ON f.following_id = we.user_id WHERE ... AND we.visibility = 'followers' AND f.follower_id = (SELECT auth.uid()))` |

   Owner branch short-circuits before the EXISTS queries run (hot path: user viewing their own WYWT rail). Public branch requires no follow check — any authenticated viewer with a signed URL passes. Followers branch JOINs `follows` and verifies the viewer has a follow relationship.

3. **`wear_photos_insert_own_folder` INSERT policy** — `WITH CHECK (bucket_id = 'wear-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)`. Closes Pitfall F-4 at the storage RLS layer.

4. **`wear_photos_update_own_folder` UPDATE policy** — both `USING` and `WITH CHECK` with the identical folder-enforcement expression. Both sides required to prevent "bypass update by renaming path" attacks.

5. **`wear_photos_delete_own_folder` DELETE policy** — `USING` with folder-enforcement expression.

Every policy is preceded by `DROP POLICY IF EXISTS <same_name> ON storage.objects;` for idempotent re-apply after `drizzle-kit push` (matches Plan 01/02 discipline). Every `auth.uid()` is wrapped in `(SELECT auth.uid())` — 7 total occurrences. All policies scoped by `bucket_id = 'wear-photos'`. No `TO anon` policies.

### Task 2: Wave 0 Integration Test (`tests/integration/phase11-storage-rls.test.ts`)

Env-gated on `hasDrizzle && hasAdmin` (checks `DATABASE_URL` + `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Skips cleanly in CI: **12 tests skipped, 0 failed**.

Three real Supabase Auth users seeded via `admin.auth.admin.createUser` (not `db.insert(users)`) so `signInWithPassword` can produce valid JWTs. The `on_public_user_created` trigger auto-creates `profiles` + `profile_settings` rows.

**Access matrix (9 SELECT cases):**

| Viewer | Visibility | Expected |
|--------|------------|----------|
| A (owner) | public | download succeeds |
| A (owner) | followers | download succeeds |
| A (owner) | private | download succeeds |
| F (follower) | public | download succeeds |
| F (follower) | followers | download succeeds |
| F (follower) | private | download FAILS |
| S (stranger) | public | download succeeds |
| S (stranger) | followers | download FAILS |
| S (stranger) | private | download FAILS |

**Folder-enforcement INSERT (2 cases):**
- S uploads into `{A.id}/malicious-...jpg` — rejected, error matches `/row-level security|policy|unauthorized|not allowed/i`
- S uploads into `{S.id}/legit-...jpg` — succeeds; cleaned up via service-role admin after assertion

**Bucket privacy (1 case):**
- Queries `storage.buckets WHERE id = 'wear-photos'` via `db.execute(sql\`...\`)`, asserts `public=false`, `file_size_limit=5242880`, `allowed_mime_types=['image/jpeg','image/png','image/webp']`

`afterAll` cleanup is defensive (wrapped in try/catch): removes storage objects, deletes follow rows, wear events, watches, users via Drizzle, then deletes Supabase Auth users via admin API.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Migration 4 SQL | 9928371 | supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql |
| Task 2: Wave 0 integration test | a6b941b | tests/integration/phase11-storage-rls.test.ts |

## Deviations from Plan

None — plan executed exactly as written. Both tasks followed the action specs verbatim. The RESEARCH.md SQL Snippet 4 was used as canonical reference; the plan's expanded spec with DROP POLICY IF EXISTS guards was followed as the authoritative version.

## Phase 15 Handoff: Signed-URL Critical Constraints

**T-11-04-07 carry-forward (Pitfall F-2 / B-6):**

Phase 15 must implement signed-URL minting at read time without caching. Specific constraints:

1. **NEVER wrap `createSignedUrl` in `'use cache'`** — signed URLs are viewer-specific. Caching a signed URL across users leaks private wear photos to other viewers.
2. **Pass `viewerId` as an explicit cache key argument** if any caching layer is used (per Next.js 16 `cache()` or `'use cache'` with explicit tags).
3. **TTL recommendations** (from RESEARCH.md):
   - `visibility = 'public'`: **7 days (604,800 seconds)** — long enough for practical sharing, short enough for rotation
   - `visibility = 'followers'` or `'private'`: **1 hour (3,600 seconds)** — shorter because URL possession effectively IS the access grant; shorter TTL limits blast radius on URL leak
4. **Storage SELECT policy STILL gates on RLS** even with a valid signed URL — Phase 15 cannot assume a signed URL bypasses the three-tier SELECT policy. Defense-in-depth (D-01) is enforced.

## Known Stubs

None. All 12 test cases in `phase11-storage-rls.test.ts` are structurally complete and will produce real pass/fail results once Migration 4 is applied via Plan 05's [BLOCKING] schema push. No hardcoded empty returns or placeholder assertions.

## Threat Flags

None. All trust boundaries introduced in this plan (storage.objects SELECT/INSERT/UPDATE/DELETE policies on the wear-photos bucket) are within the planned threat model in the plan's `<threat_model>` section. All STRIDE threats T-11-04-01 through T-11-04-08 are mitigated by the Migration 4 SQL and the integration test assertions.

## Self-Check

Files created:
- [x] `supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql` — FOUND
- [x] `tests/integration/phase11-storage-rls.test.ts` — FOUND

Commits:
- [x] 9928371 — Task 1 Migration 4
- [x] a6b941b — Task 2 Wave 0 test

Test run (no env vars): 12 tests SKIPPED — VERIFIED

## Self-Check: PASSED
