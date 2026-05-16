---
phase: 35
plan: "05"
subsystem: database-migrations
tags:
  - migration
  - supabase
  - drizzle
  - rls
  - cycle-trigger
  - phase35
  - layer-b
dependency_graph:
  requires:
    - "35-02 (schema.ts Wave 1 — pgEnums + watchLineageEdges declared in Drizzle)"
    - "Phase 34 (brands + watch_families tables must exist in prod before this migration runs)"
  provides:
    - "supabase/migrations/20260510000001_phase35_layer_b.sql — authoritative DDL"
    - "drizzle/0008_phase35_layer_b.sql — idempotent structural twin"
    - "drizzle/meta/_journal.json idx=8 — drizzle-kit recognition entry"
  affects:
    - "35-07 (deploy plan — runs supabase db push --linked with this file)"
    - "Phase 40 SRCH-16 (reads watches_catalog.movement_type enum)"
    - "Phase 39 (reads watch_lineage_edges)"
tech_stack:
  added:
    - "movement_type_enum pgEnum (auto, manual, quartz, spring_drive)"
    - "lineage_relationship_type pgEnum (successor, predecessor, remake, tribute, homage)"
    - "watch_era pgEnum (13 decade values 1900-1910 through 2020-2030)"
    - "watch_lineage_edges table with BEFORE INSERT cycle-detection trigger"
  patterns:
    - "Phase 34 RLS pattern verbatim: public-read SELECT + GRANT to anon/authenticated; service_role bypasses for writes"
    - "DO $$ assertion block (Phase 17 §8 / Phase 34 pattern) — 16 invariant guards, transaction-atomic rollback"
    - "Two-layered cycle prevention: CHECK constraint (self-loop) + bounded recursive CTE BEFORE INSERT trigger (depth 10)"
    - "Drizzle IF NOT EXISTS idempotence pattern (survives apply after supabase push)"
key_files:
  created:
    - "supabase/migrations/20260510000001_phase35_layer_b.sql"
    - "drizzle/0008_phase35_layer_b.sql"
    - "drizzle/0007_phase34_brands_families.sql (carried forward to worktree — was missing from branch)"
  modified:
    - "drizzle/meta/_journal.json (added idx=7 + idx=8 entries)"
decisions:
  - "Supabase migration is single-shot (no IF NOT EXISTS on CREATE TYPE — forward-only prod migration)"
  - "Drizzle migration is idempotent (CREATE TYPE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, DO $$ FK guards) — survives both apply orders"
  - "Phase 34 drizzle migration (idx=7) added to worktree branch (Rule 3 auto-fix for journal gap)"
  - "DO $$ assertion block checks 16 invariants including anon SELECT privilege on watch_lineage_edges (T-35-01)"
metrics:
  duration: "202s"
  completed: "2026-05-10"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 35 Plan 05: Write Supabase + Drizzle Migrations for Layer B Summary

**One-liner:** Authoritative Supabase migration with TRUNCATE + 4 pgEnum types + DROP/ADD column surgery on watches and watches_catalog + CREATE TABLE watch_lineage_edges + two-layered cycle prevention + RLS + 16-invariant DO $$ assertion block; paired with idempotent Drizzle structural twin and journal entry idx=8.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write supabase/migrations/20260510000001_phase35_layer_b.sql | e017593 | supabase/migrations/20260510000001_phase35_layer_b.sql |
| 2 | Write drizzle/0008_phase35_layer_b.sql + update journal | 7ddd827 | drizzle/0008_phase35_layer_b.sql, drizzle/0007_phase34_brands_families.sql, drizzle/meta/_journal.json |

## Decisions Made

1. **Single-shot Supabase migration** — No `IF NOT EXISTS` on CREATE TYPE statements. The Supabase migration is forward-only prod DDL; designed to run once. Subsequent applies would fail (by design).

2. **Idempotent Drizzle migration** — Uses `CREATE TYPE IF NOT EXISTS` via DO $$ blocks + `ADD COLUMN IF NOT EXISTS` + FK guards in DO $$ blocks. Survives apply after supabase db push has already run the CREATE TYPE and CREATE TABLE statements.

3. **TRUNCATE first (D-02)** — TRUNCATE watches CASCADE + TRUNCATE watches_catalog CASCADE at transaction start. Eliminates all value-mapping logic for the movement column rename. The transaction is atomic — if any subsequent DDL fails, TRUNCATE rolls back.

4. **Two-layered cycle prevention (D-06)** — CHECK constraint `no_self_loop` (predecessor_catalog_id <> successor_catalog_id) rejects self-loops cheaply before trigger fires. BEFORE INSERT trigger `check_lineage_cycle` uses bounded recursive CTE (depth < 10) for deeper cycle detection with RAISE EXCEPTION including both endpoint IDs.

5. **GRANT SELECT explicit** — Per memory rule project_supabase_secdef_grants.md, REVOKE FROM PUBLIC alone does not block anon in Supabase. Explicit `GRANT SELECT ON watch_lineage_edges TO anon, authenticated` is mandatory and verified by the DO $$ assertion block.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Missing prerequisite] Phase 34 Drizzle journal entry + migration absent from worktree branch**
- **Found during:** Task 2
- **Issue:** The worktree branch was created from a commit before Phase 34 landed on main. drizzle/meta/_journal.json had entries 0-6 only (idx=6 highest). Phase 34's idx=7 entry and migration file 0007_phase34_brands_families.sql were missing.
- **Fix:** Copied 0007_phase34_brands_families.sql from the main repo into the worktree and added both idx=7 (Phase 34, when=1778339534536) and idx=8 (Phase 35, new) to _journal.json in the same Task 2 commit. Journal now has 9 entries (0-8), no gaps.
- **Files modified:** drizzle/0007_phase34_brands_families.sql (created), drizzle/meta/_journal.json
- **Commit:** 7ddd827

## Verification Results

All Task acceptance criteria passed:

**Supabase migration (`20260510000001_phase35_layer_b.sql`):**
- BEGIN/COMMIT wrap: 1 each
- TRUNCATE watches CASCADE + TRUNCATE watches_catalog CASCADE: 1 each
- CREATE TYPE movement_type_enum, lineage_relationship_type, watch_era: 1 each
- DROP COLUMN IF EXISTS movement: 2 (watches + watches_catalog)
- ADD COLUMN movement_type: 2 (both tables)
- CREATE TABLE watch_lineage_edges: 1
- CONSTRAINT no_self_loop CHECK: 1
- CONSTRAINT lineage_edges_unique_triple UNIQUE: 1
- ON DELETE RESTRICT: 3 (predecessor FK + successor FK + updated_at trigger body)
- CREATE OR REPLACE FUNCTION check_lineage_cycle: 1
- RAISE EXCEPTION 'Lineage cycle detected': 1
- BEFORE INSERT ON watch_lineage_edges: 1
- ENABLE ROW LEVEL SECURITY: 1
- CREATE POLICY lineage_edges_select_all: 1
- GRANT SELECT ON watch_lineage_edges TO anon, authenticated: 1
- RAISE EXCEPTION 'Phase 35 failed' guards: 16
- depth < 10 guard in cycle trigger: 1
- watch_lineage_edges_predecessor_idx: 1
- watch_lineage_edges_successor_idx: 1

**Drizzle migration (`0008_phase35_layer_b.sql`):**
- movement_type_enum references: 4 (CREATE TYPE block + 2 column adds)
- lineage_relationship_type references: 3
- watch_era references: 3
- DROP COLUMN IF EXISTS "movement": 2
- ADD COLUMN IF NOT EXISTS: 7
- CREATE TABLE IF NOT EXISTS "watch_lineage_edges": 1
- ON DELETE restrict ON UPDATE no action: 2 (FK guards)
- watch_lineage_edges_predecessor_idx: 1
- watch_lineage_edges_successor_idx: 1
- lineage_edges_unique_triple: 1
- ENABLE ROW LEVEL SECURITY: 0 (correctly absent)
- check_lineage_cycle: 0 (correctly absent)
- no_self_loop: 0 (correctly absent)

**Journal:**
- 0008_phase35_layer_b entry present: 1
- entries.length: 9, last idx: 8
- JSON valid: OK

## Threat Surface Scan

No new threat surface introduced beyond what the threat_model in the plan anticipated:
- `watch_lineage_edges` is a new network-accessible table — covered by T-35-01 (RLS + GRANT pattern applied)
- No new API endpoints
- No new auth paths
- No schema changes at trust boundaries beyond what was planned

## Known Stubs

None. This plan creates only SQL migration files — no application code or UI rendering paths. No stub patterns applicable.

## Self-Check: PASSED

- supabase/migrations/20260510000001_phase35_layer_b.sql: FOUND
- drizzle/0008_phase35_layer_b.sql: FOUND
- drizzle/meta/_journal.json: FOUND, idx=8 entry present, JSON valid
- Commits e017593 and 7ddd827: present in git log
- No DB writes performed (no supabase db push / drizzle-kit push invoked)
- STATE.md not modified (orchestrator owns it)
- ROADMAP.md not modified (orchestrator owns it)
