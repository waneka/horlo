---
phase: 60-multi-photo-schema-dal
plan: "04"
subsystem: database-schema
tags: [migration, prod-deploy, supabase, rls, storage, operator-run]
dependency_graph:
  requires: [watch_photos-table, watches.image_url-dropped, cover-resolution-dal, image_url-readers-repointed]
  provides: [prod-watch_photos-applied, prod-image_url-dropped, prod-watch-photos-bucket]
  affects: [production-database]
tech_stack:
  added: []
  patterns: [supabase-db-push-linked, operator-run-prod-migration]
key_files:
  created: []
  modified: []
decisions:
  - "Operator ran `git push origin main` (Vercel deploy of repointed readers) then `supabase db push --linked` to apply the Phase 60 migration to prod"
  - "Migration 20260525000000_phase60_watch_photos.sql applied and Finished with no DO $$ RAISE/abort — backfill→drop transaction committed cleanly"
  - "The 8 'policy ... does not exist, skipping' NOTICEs are expected idempotent DROP POLICY IF EXISTS guards firing on first apply (policies created immediately after)"
  - "Prod verification queries + app smoke-check confirmed by operator (approved)"
metrics:
  duration: "operator-run"
  completed: "2026-05-25"
  tasks_completed: 1
  files_created: 0
  files_modified: 0
---

# Phase 60 Plan 04: Prod Migration Push + Verification Summary

## Tasks Completed

- **Task 1 [BLOCKING, checkpoint:human-action]:** Apply the Phase 60 migration to PROD via `supabase db push --linked` + verify on prod — operator-run, approved.

## What Was Built

No new code — this plan applies the artifact written by Plan 01 (`supabase/migrations/20260525000000_phase60_watch_photos.sql`) to the live production database and verifies it.

Operator sequence:
1. `git push origin main` — pushed the Phase 60 commits (repointed cover-resolution readers from Plan 03) so Vercel deploys code that reads `watch_photos`, not the dropped `watches.image_url` column.
2. `supabase db push --linked` — applied `20260525000000_phase60_watch_photos.sql` to prod. Output: migration applied, "Finished supabase db push." No `DO $$` RAISE EXCEPTION; the BEGIN/COMMIT transaction (CREATE `watch_photos` → backfill → pre-drop lossless `DO $$` assert → DROP `watches.image_url` → owner-scoped RLS → `watch-photos` bucket → post-migration `DO $$` assert) committed cleanly. The 8 `policy "..." does not exist, skipping` NOTICEs are the idempotent `DROP POLICY IF EXISTS` guards on first apply (expected; policies created immediately after).
3. Prod verification queries + app smoke-check (collection grid + watch detail page render covers, no dropped-column 500s) — confirmed by operator approval.

## Deviations from Plan

None. The migration applied as authored; no filename-skip gotcha (14-digit filename held), no assertion abort.

## Threat Surface Scan

- **T-60-PRODDROP (irreversible DROP COLUMN):** Mitigated — in-transaction backfill + pre-drop `DO $$` lossless assertion would have aborted the whole transaction on any unbacked row; readers (Plan 03) were deployed before the column drop.
- **T-60-SKIP (silently skipped migration):** Mitigated — push output explicitly shows `Applying migration 20260525000000_phase60_watch_photos.sql...` then `Finished`.
- **T-60-PRODRLS (RLS subquery-caller gotcha on prod):** Accepted — owner reads go through the service-role DAL (the real read gate); the `watch_photos` SELECT policy is an anon-block + owner backstop. Verified non-blocking by the prod smoke check.

## Self-Check

### Migration Applied
- `supabase db push --linked` reported the migration applied and "Finished" — no RAISE/abort.

### Prod Verification (operator-confirmed)
- `watch_photos` table + `(watch_id, sort_order)` index + ≥4 RLS policies + `watch-photos` bucket exist; `watches.image_url` dropped; `sort_order=0` backfill lossless; `watches_catalog` untouched (D-10/SC5).

### App Smoke-Check (operator-confirmed)
- Collection grid + watch detail page render covers on prod with no dropped-column query errors.

## Self-Check: PASSED
