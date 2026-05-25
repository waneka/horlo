---
phase: 60-multi-photo-schema-dal
plan: "01"
subsystem: database-schema
tags: [schema, migration, rls, storage, drizzle, supabase]
dependency_graph:
  requires: []
  provides: [watch_photos-table, watch-photos-bucket, watches.image_url-dropped]
  affects: [src/db/schema.ts, supabase/migrations, drizzle/migrations]
tech_stack:
  added: [watch_photos pgTable, watch-photos storage bucket]
  patterns: [drizzle-pgTable-with-composite-index, supabase-migration-backfill-then-drop, owner-scoped-rls-policies, folder-rls-storage]
key_files:
  created:
    - supabase/migrations/20260525000000_phase60_watch_photos.sql
    - drizzle/0013_phase60_watch_photos.sql
    - tests/integration/phase60-watch-photos.test.ts
  modified:
    - src/db/schema.ts
    - drizzle/meta/_journal.json
decisions:
  - "drizzle-kit generate failed (non-TTY interactive prompt for column conflict); Drizzle migration written manually — matches authoritative shape from Supabase migration"
  - "Migration journal updated to include 0012 (previously missing from journal) + new 0013 entry"
  - "wave: verified grep check in plan verify command is intentionally loose (watchesCatalog.imageUrl and watchVariants.imageUrl remain by design per D-10)"
metrics:
  duration: "4m 26s"
  completed: "2026-05-25"
  tasks_completed: 3
  files_created: 3
  files_modified: 2
---

# Phase 60 Plan 01: watch_photos Schema + Migration + Wave 0 Tests Summary

**One-liner:** Drizzle watchPhotos pgTable + authoritative Supabase migration (backfill-then-drop + owner RLS + watch-photos bucket) with Wave 0 integration test stub, applied to local DB.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add watchPhotos Drizzle schema + remove watches.imageUrl | 7c2c059 | src/db/schema.ts |
| 2 | Write authoritative Supabase migration | 59d8911 | supabase/migrations/20260525000000_phase60_watch_photos.sql |
| 3 | Wave 0 test stub + Drizzle migration + local apply | ccb0f5c | tests/integration/phase60-watch-photos.test.ts, drizzle/0013_phase60_watch_photos.sql |

## What Was Built

**Task 1 — Drizzle schema:**
- Added `export const watchPhotos = pgTable('watch_photos', ...)` with id (uuid pk), watchId (uuid FK → watches.id ON DELETE CASCADE), storagePath (text), sortOrder (integer default 0), createdAt (timestamp)
- Added composite index `watch_photos_watch_id_sort_idx` on (watchId, sortOrder)
- Removed `imageUrl: text('image_url')` from the `watches` table definition (D-07)
- Header comment per Phase 53 pattern: column shapes only; RLS/bucket/backfill in SQL migration
- watches_catalog and watchVariants imageUrl fields unchanged (D-10)

**Task 2 — Authoritative Supabase migration:**
- Transaction-wrapped (BEGIN/COMMIT)
- Step ordering is load-bearing: CREATE TABLE → CREATE INDEX → BACKFILL INSERT → DO $$ lossless assert → DROP COLUMN → ENABLE RLS → 4 owner policies → bucket INSERT → 4 storage folder RLS policies → DO $$ post-migration assertion
- Backfill: `INSERT INTO watch_photos ... FROM watches WHERE image_url IS NOT NULL ON CONFLICT DO NOTHING` (idempotent)
- Pre-drop DO $$ assertion: raises EXCEPTION if any image_url row has no sort_order=0 photo row
- Owner-scoped RLS policies (select/insert/update/delete TO authenticated) using EXISTS subquery on watches.user_id
- RLS comment documents the subquery-caller gotcha (project_rls_subquery_caller_rls): non-owner reads go through service-role DAL (Plan 03)
- watch-photos bucket: private, 8MB limit, image/jpeg + image/png + image/webp
- 4 storage.objects folder RLS policies gating on `(storage.foldername(name))[1] = (SELECT auth.uid())::text`
- Post-migration DO $$ verifies table_count=1, policy_count>=4, bucket_count=1

**Task 3 — Wave 0 test stub + Drizzle migration + local apply:**
- `tests/integration/phase60-watch-photos.test.ts`: SC1 (schema assertions — PASS after migration), SC2 (cover resolution — RED until Plan 03), SC3 (cap enforcement — RED until Plan 03), cross-tenant test
- `drizzle/0013_phase60_watch_photos.sql`: manually written (drizzle-kit generate blocked by non-TTY prompt for column conflict resolution)
- `drizzle/meta/_journal.json`: updated with 0012 (previously unregistered) and 0013 entries
- Local apply sequence: Supabase migration applied first (psql -f) for backfill, then `drizzle-kit push --force` for column sync
- Local DB confirmed: watches.image_url = 0 rows, watch_photos = 1 table

## Deviations from Plan

### Auto-handled Issues

**1. [Rule 3 - Blocking] drizzle-kit generate non-TTY interactive prompt**
- **Found during:** Task 3
- **Issue:** `drizzle-kit generate` detected the `watches.image_url` column removal as a conflict requiring interactive selection (rename vs drop). Non-TTY env cannot respond to the prompt. Error: `Interactive prompts require a TTY terminal`
- **Fix:** Wrote `drizzle/0013_phase60_watch_photos.sql` manually following the format of prior Drizzle migrations (statement-breakpoint style, IF NOT EXISTS guards, DO $$ for FK constraint). Also added the previously unregistered 0012 entry to _journal.json.
- **Files modified:** drizzle/0013_phase60_watch_photos.sql, drizzle/meta/_journal.json
- **Commits:** ccb0f5c

**2. [Observation] Plan verify command false-positive for imageUrl removal**
- The plan's automated verify `! grep -q "imageUrl: text('image_url')" src/db/schema.ts` would fail because `watchesCatalog` and `watchVariants` tables still have `imageUrl: text('image_url')` — correctly preserved per D-10. The acceptance criteria clarifies "the watches column is removed", which is satisfied. This is a verify command wording issue, not a deviation from intent.

**3. [Observation] Backfill INSERT 0 rows (expected for local dev DB)**
- Local dev DB had no watches with `image_url` set, so `INSERT 0 0` on backfill. The DO $$ lossless assertion passed (0 missed rows = no exception). This is expected and correct — the migration is authoritative for prod where real data exists.

## Known Stubs

The Wave 0 integration tests have 4 intentionally RED test cases (SC2/SC3/cross-tenant) that will fail until Plan 03 ships the DAL extensions (`addWatchPhoto`, `bulkReorderPhotos`, `PhotoCapExceededError`, `MAX_PHOTOS_PER_WATCH`, and the cover join in `getWatchesByUser`). This is the expected Wave 0 state documented in the plan.

Additionally, `src/data/watches.ts` line 45 (`imageUrl: row.imageUrl ?? undefined`) references the now-removed DB column. This will be a TypeScript error until Plan 03 updates the mapper. Per the plan: "the build will be temporarily broken on row.imageUrl references until Plan 03 lands; that is expected and acceptable within the wave."

## Threat Surface Scan

Per the threat model in the plan, all threats were addressed in the migration:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-60-01 (Tampering: backfill→DROP ordering) | BACKFILL INSERT + DO $$ lossless assert run before DROP COLUMN; transaction-wrapped; idempotent via ON CONFLICT DO NOTHING + DROP COLUMN IF EXISTS |
| T-60-02 (EoP: storage path traversal) | Folder RLS `(storage.foldername(name))[1] = (SELECT auth.uid())::text` in migration — 4 policies on storage.objects |
| T-60-03 (Info Disclosure: cross-tenant read) | SELECT policy uses EXISTS subquery on watches (owner-only RLS); fails closed for non-owners. Service-role DAL is primary gate (Plan 03). |
| T-60-04 (Spoofing: cross-tenant INSERT) | INSERT RLS WITH CHECK EXISTS(... w.user_id = auth.uid()); DAL ownership check is primary gate (Plan 03) |

No new threat surface identified beyond what was in the plan's threat model.

## Self-Check

### Files Exist

- [x] supabase/migrations/20260525000000_phase60_watch_photos.sql — FOUND
- [x] drizzle/0013_phase60_watch_photos.sql — FOUND
- [x] tests/integration/phase60-watch-photos.test.ts — FOUND
- [x] src/db/schema.ts (modified) — FOUND

### Commits Exist

- [x] 7c2c059 — feat(60-01): add watchPhotos pgTable + remove watches.imageUrl column
- [x] 59d8911 — feat(60-01): authoritative Supabase migration
- [x] ccb0f5c — feat(60-01): Wave 0 integration test stub + Drizzle migration + local apply

### Local DB State

- [x] watches.image_url: 0 rows (column dropped)
- [x] watch_photos table: 1 (exists)

## Self-Check: PASSED
