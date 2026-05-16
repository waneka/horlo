---
phase: 37
plan: 02
subsystem: database
tags: [supabase, migration, rls, pgenum, ddl, security, divestments, provenance]
dependency_graph:
  requires:
    - "supabase/migrations/20260511000000_phase36_layer_c_variants.sql (Phase 36 — watches.catalog_id NOT NULL precondition)"
    - "watches_catalog table (referenced by divestments.catalog_id FK)"
    - "auth.users table (referenced by divestments.user_id FK)"
  provides:
    - "supabase/migrations/20260511010000_phase37_layer_d.sql (authoritative DDL for Phase 37)"
    - "3 pgEnum types: condition_grade, currency_code, box_papers_status"
    - "7 nullable provenance columns on watches table"
    - "divestments table with per-user RLS + GRANT-to-authenticated-only"
  affects:
    - "watches table (7 new columns)"
    - "divestments table (new)"
tech_stack:
  added: []
  patterns:
    - "Per-user RLS inversion: auth.uid() = user_id policies (inverted from Phase 36 public-read)"
    - "DO $$ assertion block pattern (Phase 17/34/35/36 continuation)"
    - "BEGIN/COMMIT atomic migration wrapper"
key_files:
  created:
    - supabase/migrations/20260511010000_phase37_layer_d.sql
  modified: []
decisions:
  - "Per-user RLS on divestments (NOT public-read): divestments contain personal sale prices and notes — mirrors watches (Phase 17) not watch_variants (Phase 36)"
  - "GRANT to authenticated ONLY (no anon): T-37-RLS-01 mitigation — anon must have zero privilege on divestments"
  - "NO UNIQUE constraint on divestments: D-13 — 1:1 watch-to-divestment is soft convention only, not enforced at DB level"
  - "NO DO $$ pre-flight: Phase 37 is purely additive — no orphan check needed, unlike Phase 36"
  - "catalog_id ON DELETE RESTRICT: T-37-FK-01 mitigation — admin must reassign before deleting catalog row"
  - "replaced_by_catalog_id ON DELETE SET NULL: historical record preserved even if canonical reference is removed"
metrics:
  duration: "109 seconds"
  completed: "2026-05-12"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 37 Plan 02: Supabase Migration — Layer D DDL Summary

Single authoritative Supabase migration file: 3 pgEnums + 7 nullable watches columns + divestments table with per-user RLS (auth.uid() = user_id inversion of Phase 36) + GRANT to authenticated only + updated_at trigger + final DO $$ assertion block.

## File Produced

| Property | Value |
|----------|-------|
| Path | `supabase/migrations/20260511010000_phase37_layer_d.sql` |
| Filename timestamp | `20260511010000` (strictly > Phase 36 `20260511000000`) |
| Lines | 236 |
| Size | ~14 KB |
| Commit | `042a758` |

## Line Ranges by Step

| Step | Content | Lines |
|------|---------|-------|
| Header comment block | Threat mitigations, inheritance notes, Rule citations | 1–17 |
| `BEGIN;` | Transaction wrapper open | 18 |
| STEP 1: CREATE TYPE | 3 pgEnums (condition_grade, currency_code, box_papers_status) | 26–39 |
| STEP 2: ALTER TABLE watches ADD COLUMN | 7 nullable columns (serial, year_of_acquisition, condition, box_papers, service_history, paid_currency, purchase_date) | 43–51 |
| STEP 3: CREATE TABLE divestments | 10 columns + 3 FKs | 61–72 |
| CREATE INDEX | 3 indexes on divestments | 74–78 |
| STEP 4: updated_at trigger | divestments_set_updated_at / divestments_set_updated_at_trg | 84–88 |
| STEP 5: RLS + GRANT | ENABLE RLS + 4 DROP/CREATE POLICY + 1 GRANT | 102–121 |
| STEP 6: DO $$ assertion block | 18 variable assertions covering all invariants | 128–234 |
| `COMMIT;` | Transaction wrapper close | 236 |

## Grep Verification Table

| Criterion | Command | Result |
|-----------|---------|--------|
| File exists | `test -f supabase/migrations/20260511010000_phase37_layer_d.sql` | PASS |
| Filename strictly > Phase 36 | `ls supabase/migrations/ \| tail -3` | PASS (`20260511010000` > `20260511000000`) |
| 3 CREATE TYPE | `grep -c "^CREATE TYPE " ...` | 3 |
| condition_grade enum | `grep -q "^CREATE TYPE condition_grade AS ENUM"` | PASS |
| currency_code enum | `grep -q "^CREATE TYPE currency_code AS ENUM"` | PASS |
| box_papers_status enum | `grep -q "^CREATE TYPE box_papers_status AS ENUM"` | PASS |
| 7 ADD COLUMN | `grep -c "^  ADD COLUMN "` | 7 |
| All 7 column names present | grep each column name | PASS (all 7) |
| 1 CREATE TABLE divestments | `grep -c "^CREATE TABLE divestments"` | 1 |
| catalog_id ON DELETE RESTRICT | `grep -q "catalog_id.*REFERENCES watches_catalog(id) ON DELETE RESTRICT"` | PASS |
| user_id ON DELETE CASCADE | `grep -q "user_id.*REFERENCES auth.users(id) ON DELETE CASCADE"` | PASS |
| replaced_by ON DELETE SET NULL | `grep -q "replaced_by_catalog_id.*ON DELETE SET NULL"` | PASS |
| 3 CREATE INDEX divestments_ | `grep -c "^CREATE INDEX divestments_"` | 3 |
| ENABLE RLS | `grep -q "ALTER TABLE divestments ENABLE ROW LEVEL SECURITY"` | PASS |
| 4 CREATE POLICY | `grep -c "^CREATE POLICY \"divestments_owner_"` | 4 |
| auth.uid() = user_id (>= 5) | `grep -c "auth.uid() = user_id"` | 5 |
| 1 GRANT to authenticated | `grep -c "^GRANT SELECT, INSERT, UPDATE, DELETE ON divestments TO authenticated"` | 1 |
| NO GRANT to anon | `grep -E "^GRANT .* ON divestments TO anon"` | no match (PASS) |
| NO standalone UNIQUE | `grep -E "^UNIQUE"` | no match (PASS) |
| Trigger present | `grep -q "divestments_set_updated_at_trg"` | PASS |
| BEGIN/COMMIT wrapper | `grep -q "^BEGIN;"` + `grep -q "^COMMIT;"` | PASS |
| DO $$ block present | `grep -q "^DO "` | PASS |
| First statement after BEGIN | `awk '/^BEGIN;/{f=1; next} f && !/^--/ && !/^$/{print; exit}'` | `CREATE TYPE condition_grade AS ENUM (` |

## Threat-Mitigation Cross-Reference

| Threat ID | Category | Mitigation in Migration |
|-----------|----------|------------------------|
| T-37-RLS-01 | anon SELECT divestments | `ALTER TABLE divestments ENABLE ROW LEVEL SECURITY` + `CREATE POLICY "divestments_owner_select" ... USING (auth.uid() = user_id)` + `GRANT ... TO authenticated` (no anon grant) + DO $$ asserts `NOT has_table_privilege('anon', ...)` |
| T-37-RLS-02 | Cross-user read | `FOR SELECT USING (auth.uid() = user_id)` — predicate excludes all rows where user_id != caller's auth.uid |
| T-37-RLS-03 | anon INSERT/UPDATE/DELETE | RLS enabled + no GRANT to anon = double-protected |
| T-37-FK-01 | INSERT with non-existent catalog_id | `catalog_id uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE RESTRICT` — Postgres rejects with SQLSTATE 23503 |
| T-37-FK-02 | Delete catalog row with divestments | `ON DELETE RESTRICT` blocks the parent delete; admin must reassign first |

## Decisions Made

1. Per-user RLS on divestments (mirrors watches Phase 17) — divestments contain personal sale prices and notes, not public catalog data.
2. GRANT to authenticated ONLY — no anon grant prevents T-37-RLS-01. Per memory `project_supabase_secdef_grants.md`: REVOKE FROM PUBLIC alone is insufficient; explicit non-grant + explicit RLS policies are both required.
3. No DO $$ pre-flight — Phase 37 is purely additive (no DROP, no type-change on existing columns, no orphan check needed).
4. CREATE TYPE statements before ALTER TABLE ADD COLUMN — L-04 ordering rule: pgEnum types must exist before any ADD COLUMN references them, within same transaction.
5. No UNIQUE constraint on divestments — D-13: 1:1 watch-to-divestment is soft convention only.

## Notes

- NO local apply attempt in Plan 02. Local Docker apply is Plan 05's BLOCKING task (`schema_push_requirement`).
- Plan 05 will apply via `docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260511010000_phase37_layer_d.sql` locally and `supabase db push --linked` for production.
- The DO $$ assertion block will verify all invariants at apply time — any failure rolls back the entire transaction atomically.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `supabase/migrations/20260511010000_phase37_layer_d.sql` exists: CONFIRMED
- Commit `042a758` exists: CONFIRMED via `git log --oneline -1`
- All 27 grep acceptance criteria: PASSED
