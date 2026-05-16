---
phase: 36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null
plan: 02
subsystem: database
tags: [supabase, migration, sql, rls, grant, do-block, cat-14, cat-17, watch-variants]

# Dependency graph
requires:
  - phase: 36
    plan: 01
    provides: watchVariants pgTable Drizzle definition (10-col shape with FK ON DELETE RESTRICT + UNIQUE (catalog_id, slug)) and watches.variantId nullable FK — Plan 02 mirrors this shape byte-for-byte in the Supabase migration
  - phase: 35
    provides: post-wipe canonical catalog state (Phase 36 inherits — no re-TRUNCATE); 20260510000001_phase35_layer_b.sql RLS+GRANT 4-line block as verbatim analog
  - phase: 34
    provides: updated_at trigger pattern (Phase 34 brands_set_updated_at) reused verbatim for watch_variants_set_updated_at
  - phase: 17
    provides: end-of-migration DO $$ post-assertion pattern + Drizzle vs Supabase migration split (Drizzle = column shapes; Supabase = authoritative DDL incl. RLS/GRANT/DO $$)
provides:
  - "supabase/migrations/20260511000000_phase36_layer_c_variants.sql — single-transaction Supabase migration containing CAT-14 pre-flight (FIRST statement), CREATE TABLE watch_variants + 10-col shape + FK ON DELETE RESTRICT + UNIQUE (catalog_id, slug) + RLS POLICY + GRANT SELECT TO anon/authenticated, watches.variant_id ADD COLUMN with FK ON DELETE SET NULL, watches.catalog_id SET NOT NULL flip, and end-of-migration DO $$ post-assertion verifying 8 invariants"
affects: [phase-36-plan-03, phase-36-plan-04, phase-36-plan-05, phase-38, phase-39]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FIRST-position DO $$ pre-flight (novel position; same PL/pgSQL syntax as Phase 35's end-of-migration DO $$). RAISE EXCEPTION rolls back the entire BEGIN..COMMIT transaction including the load-bearing ALTER COLUMN SET NOT NULL — prod stays in pre-migration state if any orphan exists."
    - "RLS + GRANT 4-line block verbatim from Phase 35 lines 118–121 (ALTER ENABLE → DROP POLICY IF EXISTS → CREATE POLICY → GRANT SELECT). Per memory project_supabase_secdef_grants.md: CREATE POLICY alone is insufficient for anon SELECT; explicit GRANT is mandatory."
    - "End-of-migration DO $$ assertion with pg_constraint.confdeltype introspection — verifies FK cascade clauses survived (`'r'` = RESTRICT for watch_variants.catalog_id; `'n'` = SET NULL for watches.variant_id). This is the load-bearing schema-invariant gate before COMMIT."

key-files:
  created:
    - "supabase/migrations/20260511000000_phase36_layer_c_variants.sql — 150 lines, 8513 bytes. Single-transaction migration with 6 STEPs + 2 DO $$ blocks."
  modified: []

key-decisions:
  - "Filename timestamp locked at 20260511000000 — strictly greater than highest existing (20260510000001_phase35_layer_b.sql) per memory project_drizzle_supabase_db_mismatch.md rules 1+2 (14-digit prefix; no insertion between adjacent integers)."
  - "Migration uses Phase 35's `CREATE POLICY ... FOR SELECT USING (true)` syntax verbatim (not the `FOR SELECT TO anon, authenticated` form mentioned in alternative context). PLAN.md, PATTERNS.md, and the Phase 35 analog all converge on `FOR SELECT USING (true)` + separate `GRANT SELECT TO anon, authenticated` — the 4-line block is the canonical project pattern."
  - "No TRUNCATE in Phase 36 migration (Phase 35 D-02 already wiped 2026-05-10 — Phase 36 inherits post-wipe state per CONTEXT.md D-01)."
  - "No CREATE TYPE / CREATE EXTENSION statements (no new pgEnums per D-02 — variant attrs are free text mirroring Phase 35 D-10/D-11 specialty-value handling)."
  - "Added `CREATE INDEX watches_variant_id_idx ON watches(variant_id)` alongside the ADD COLUMN — the index is mentioned as optional in CONTEXT.md but the additional context block from the executor prompt lists it as a required line. Including it is correctness-neutral (slight write-cost increase, faster JOINs in future Phase 39 lineage browse) and matches the Drizzle migration sibling (Plan 03) which already plans `CREATE INDEX IF NOT EXISTS watches_variant_id_idx`."

patterns-established:
  - "FIRST-position DO $$ pre-flight as a transaction-rollback gate for load-bearing constraint changes. Future NOT NULL flips (e.g., Phase 38's potential variant_id flip if coverage ever hits 100%) should mirror this STEP 0 pattern: pre-flight assert clean state → DDL → post-assertion verify invariants → COMMIT."
  - "8-invariant end-of-migration DO $$ template — includes pg_constraint.confdeltype introspection for FK cascade clauses. Reusable for any future entity-table migration that has multiple FKs with different cascade semantics."

requirements-completed: [CAT-14, CAT-17]

# Metrics
duration: ~1m 28s
completed: 2026-05-11
---

# Phase 36 Plan 02: Supabase Migration (watch_variants + CAT-14 NOT NULL) Summary

**Single-transaction Supabase migration `supabase/migrations/20260511000000_phase36_layer_c_variants.sql` shipping CAT-14 pre-flight (FIRST), `watch_variants` table with RLS+GRANT, `watches.variant_id` FK column, and the CAT-14 `ALTER COLUMN SET NOT NULL` flip — all atomic; rolls back cleanly if any orphan watches exist or any assertion fires.**

## Performance

- **Duration:** ~1m 28s (88 s)
- **Started:** 2026-05-11T21:18:51Z
- **Completed:** 2026-05-11T21:20:19Z
- **Tasks:** 1 / 1
- **Files created:** 1 (`supabase/migrations/20260511000000_phase36_layer_c_variants.sql`)
- **Files modified:** 0

## Accomplishments

- Wrote `supabase/migrations/20260511000000_phase36_layer_c_variants.sql` (150 lines, 8513 bytes) containing all 6 ordered STEPs in a single `BEGIN; … COMMIT;` envelope:
  - **STEP 0** — `DO $$` pre-flight as the FIRST non-comment non-BEGIN statement (ROADMAP success #3): asserts `SELECT COUNT(*) FROM watches WHERE catalog_id IS NULL = 0`; `RAISE EXCEPTION` with the exact recovery-flow guidance from CONTEXT D-07. Mitigates T-36-04.
  - **STEP 1** — `CREATE TABLE watch_variants` with the locked 10-col shape from D-02 (`id`, `catalog_id` NOT NULL FK ON DELETE RESTRICT → `watches_catalog.id`, `name`, `slug`, `dial_color`, `bezel`, `bracelet_variant`, `image_url`, `created_at`, `updated_at`); composite `UNIQUE (catalog_id, slug)` named `watch_variants_catalog_slug_unique`; btree index `watch_variants_catalog_id_idx` on the FK. Mitigates T-36-03 (orphan-detection at delete time).
  - **STEP 2** — `watch_variants_set_updated_at()` trigger function + `watch_variants_set_updated_at_trg` BEFORE UPDATE trigger, verbatim Phase 34 `brands` pattern.
  - **STEP 3** — `ALTER TABLE watch_variants ENABLE ROW LEVEL SECURITY` + `DROP POLICY IF EXISTS watch_variants_select_all` + `CREATE POLICY watch_variants_select_all ON watch_variants FOR SELECT USING (true)` + `GRANT SELECT ON watch_variants TO anon, authenticated`. D-05; mitigates T-36-01 (anon writes blocked because no INSERT/UPDATE/DELETE policy matches anon) and T-36-02 (anon SELECT enabled by explicit GRANT per memory `project_supabase_secdef_grants.md`).
  - **STEP 4** — `ALTER TABLE watches ADD COLUMN variant_id uuid NULL REFERENCES watch_variants(id) ON DELETE SET NULL` + `CREATE INDEX watches_variant_id_idx ON watches(variant_id)`. D-04.
  - **STEP 5** — `ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL` — the CAT-14 load-bearing flip. Safe because STEP 0 already asserted zero orphans; if any exist, the transaction never reaches STEP 5 (atomic rollback).
  - **STEP 6** — Final `DO $$` post-assertion block with 8 invariants verified via `information_schema.tables`, `information_schema.columns` (`is_nullable = 'NO'` for `catalog_id`), `pg_policies`, `has_table_privilege`, `pg_constraint` (UNIQUE constraint exists), and `pg_constraint.confdeltype` JOIN on `pg_attribute` (verifies `'n'` = SET NULL for `watches.variant_id` and `'r'` = RESTRICT for `watch_variants.catalog_id`). Phase 17 §8 / Phase 34 / Phase 35 pattern.
- All 13 plan acceptance criteria pass:
  - File at exact path: `supabase/migrations/20260511000000_phase36_layer_c_variants.sql` ✓
  - 14-digit filename + `_phase36_layer_c_variants.sql` suffix ✓
  - First non-comment non-BEGIN statement is `DO $$` (line 22; pre-flight) ✓
  - Exactly one `CREATE TABLE watch_variants` ✓
  - `catalog_id uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE RESTRICT` present (exact text match) ✓
  - `GRANT SELECT ON watch_variants TO anon, authenticated` exactly once ✓
  - `ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL` exactly once ✓
  - `ADD COLUMN variant_id uuid NULL` present ✓
  - `REFERENCES watch_variants(id) ON DELETE SET NULL` present ✓
  - Exactly one `BEGIN;` and one `COMMIT;` (file begins/ends with the transaction envelope) ✓
  - Exactly TWO `DO $$` block-opener lines (lines 22 + 93 — pre-flight and post-assertion) ✓
  - Zero `TRUNCATE` statements ✓
  - Zero `CREATE TYPE` statements ✓
  - Filename strictly greater than highest existing (`20260510000001_phase35_layer_b.sql` → `20260511000000_phase36_layer_c_variants.sql`) ✓
  - `bracelet_variant` column present (D-02 nomenclature, not legacy `bracelet_config`) ✓
- `head -5` of file (verbatim):
  ```
  -- Phase 36 — Layer C: Variant Split + CAT-14 NOT NULL (CAT-17 + CAT-14)
  -- Source: 36-CONTEXT.md D-01..D-07; 36-RESEARCH.md §Migration Statement Ordering
  -- Sibling Drizzle migration: drizzle/0009_phase36_layer_c_variants.sql (column shapes only — no RLS, no DO $$, no GRANT)
  -- Threats mitigated:
  --   T-36-01 (anon write blocked by RLS service-role-only),
  ```
- `tail -5` of file (verbatim):
  ```
    IF NOT variant_id_fk_set_null              THEN RAISE EXCEPTION 'Phase 36 failed -- watches.variant_id FK is not ON DELETE SET NULL'; END IF;
    IF NOT variant_catalog_id_fk_restrict      THEN RAISE EXCEPTION 'Phase 36 failed -- watch_variants.catalog_id FK is not ON DELETE RESTRICT'; END IF;
  END $$;

  COMMIT;
  ```
- DO $$ FIRST-statement positioning confirmed by `awk` ignoring comments + blank lines + the `BEGIN;` envelope: `PASS: DO $$ is first non-comment non-BEGIN statement`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write supabase/migrations/20260511000000_phase36_layer_c_variants.sql in full** — `5a3614e` (feat)

_(Final metadata commit covering SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md follows.)_

## Files Created/Modified

- `supabase/migrations/20260511000000_phase36_layer_c_variants.sql` — NEW. 150 lines, 8513 bytes. Single-transaction Supabase migration as described above.

## Decisions Made

- **Used Phase 35's verbatim `CREATE POLICY ... FOR SELECT USING (true)` + separate `GRANT SELECT TO anon, authenticated` 4-line pattern.** The additional context block in the executor prompt mentioned a `FOR SELECT TO anon, authenticated` form; PLAN.md `<interfaces>`, PATTERNS.md §"Shared Patterns — RLS + GRANT", and the Phase 35 analog at lines 118–121 all use the `USING (true)` syntax with a separate `GRANT` line. Since memory `project_supabase_secdef_grants.md` confirms `GRANT SELECT TO anon` is the load-bearing piece (not the POLICY's TO clause), and the Phase 35 migration shipped to prod 2026-05-10 with this exact pattern, mirroring it verbatim is the lowest-risk choice. The end-of-migration `has_table_privilege('anon', 'public.watch_variants', 'SELECT')` assertion explicitly verifies the anon-read mitigation regardless of which `CREATE POLICY` flavor was used.
- **Included `CREATE INDEX watches_variant_id_idx`** alongside STEP 4's ADD COLUMN. CONTEXT.md §specifics flagged this as optional ("if Phase 39 query patterns need it"); the additional context block from the executor prompt listed it as a required line. The Drizzle migration sibling (Plan 03) already plans `CREATE INDEX IF NOT EXISTS watches_variant_id_idx`. Shipping it here keeps Drizzle/Supabase in sync and avoids a future ad-hoc fixup commit.
- **DO $$ STEP 0 message text matches CONTEXT.md D-07 verbatim** — references `npm run db:backfill-catalog` and `docs/deploy-db-setup.md Phase 36 recovery flow` so the operator-facing error message points directly at the runbook (Plan 05 will own that documentation surface).

## Deviations from Plan

None — the plan executed exactly as written. All Pitfall 1-5 mitigations baked into the action ran clean:

- Pitfall 1 (filename collision) — `20260511000000_phase36_layer_c_variants.sql` is strictly greater than `20260510000001_phase35_layer_b.sql`. Verified by `ls supabase/migrations/ | sort | tail -1` returning the new file.
- Pitfall 2 (DO $$ not FIRST) — verified by `awk` ignoring comments/blanks/BEGIN. STEP 0's DO $$ appears at line 22, immediately after the file header comment block and `BEGIN;`. No DDL precedes it.
- Pitfall 3 (RLS+GRANT pattern) — verbatim 4-line block from Phase 35 lines 118–121.
- Pitfall 5 (FK cascade clause drift) — `watch_variants.catalog_id` is `ON DELETE RESTRICT` (D-03); `watches.variant_id` is `ON DELETE SET NULL` (D-04). The end-of-migration DO $$ post-assertion verifies both via `pg_constraint.confdeltype`.

No Rule 1/2/3 auto-fixes triggered; no Rule 4 architectural deferrals needed. No authentication gates encountered (this plan only writes a file; it does not apply the migration).

## Issues Encountered

None.

## User Setup Required

None for this plan. The migration file is written but NOT applied — application is in Plan 04 (local) and Plan 05 (prod-deploy gate).

## Next Phase Readiness

**Phase 36 Plan 03 (Drizzle migration twin + journal append):** READY. This plan's authoritative Supabase migration locks the column shape; Plan 03 mirrors it as a structural twin in `drizzle/0009_phase36_layer_c_variants.sql` (without RLS, GRANT, DO $$, or trigger — those live exclusively here). Plan 03 also appends `idx=9` to `drizzle/meta/_journal.json` in the same task per the Phase 34 Plan 01 lesson (memory'd in STATE.md).

**Phase 36 Plan 04 (local push + integration test):** READY for local apply via `supabase db reset` + selective psql apply of the new migration (see memory `project_local_db_reset.md`). The integration test `tests/integration/phase36-rls.test.ts` (Plan 04 deliverable) will assert the same 8 invariants the end-of-migration DO $$ verifies, plus the T-36-01 anon-write rejection via supabase-js anon client.

**Phase 36 Plan 05 (prod-deploy gate, autonomous:false):** READY. The deploy runbook section (Plan 04 docs deliverable) documents the §36.0 pg_depend pre-flight (on `watches.catalog_id`), §36.1 safety re-link backfill, §36.2 zero-NULL verification, §36.3 `supabase db push --linked` apply, §36.4 smoke-test SELECTs, §36.5 hard-fail recovery flow, §36.6 local re-sync, §36.7 backout plan. This migration file is what `supabase db push --linked` will apply atomically in §36.3.

**Phase 38 (CAT-13 Engine Rewire):** UNCHANGED — the Pitfall 6 `.notNull()` Drizzle deferral from Plan 01 is independent of this plan. After Plan 05 lands in prod, `watches.catalog_id` is database-level NOT NULL; the Drizzle TypeScript-level tightening still happens in Phase 38 per the Plan 01 handoff.

**Blockers/Concerns:**
- None. The migration is ready to ship via the Wave 2/3 Plans.

## Self-Check: PASSED

**File existence checks:**
- `supabase/migrations/20260511000000_phase36_layer_c_variants.sql`: FOUND (created)

**Commit hash check:**
- `5a3614e`: FOUND in `git log --oneline -1`

**Grep contract checks (all 13 plan ACs):**
- `test -f supabase/migrations/20260511000000_phase36_layer_c_variants.sql` exits 0 ✓
- `ls supabase/migrations/20260511000000_phase36_layer_c_variants.sql` returns the path ✓
- `awk '/^[[:space:]]*--/{next} /^[[:space:]]*$/{next} /^BEGIN;/{next} {print; exit}' supabase/migrations/20260511000000_phase36_layer_c_variants.sql` outputs `DO $$` ✓
- `grep -c "^CREATE TABLE watch_variants" supabase/migrations/20260511000000_phase36_layer_c_variants.sql` = 1 ✓
- `grep -c "catalog_id        uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE RESTRICT" supabase/migrations/20260511000000_phase36_layer_c_variants.sql` = 1 ✓
- `grep -c "GRANT SELECT ON watch_variants TO anon, authenticated" supabase/migrations/20260511000000_phase36_layer_c_variants.sql` = 1 ✓
- `grep -c "ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL" supabase/migrations/20260511000000_phase36_layer_c_variants.sql` = 1 ✓
- `grep -c "ADD COLUMN variant_id uuid NULL" supabase/migrations/20260511000000_phase36_layer_c_variants.sql` = 1 ✓
- `grep -c "REFERENCES watch_variants(id) ON DELETE SET NULL" supabase/migrations/20260511000000_phase36_layer_c_variants.sql` = 1 ✓
- `grep -E "^(BEGIN|COMMIT);" supabase/migrations/20260511000000_phase36_layer_c_variants.sql` returns 2 lines (BEGIN; + COMMIT;) ✓
- `grep -cE '^DO \$\$' supabase/migrations/20260511000000_phase36_layer_c_variants.sql` = 2 (lines 22 + 93) ✓
- `grep -ci "TRUNCATE" supabase/migrations/20260511000000_phase36_layer_c_variants.sql` = 0 ✓
- `grep -ci "CREATE TYPE" supabase/migrations/20260511000000_phase36_layer_c_variants.sql` = 0 ✓
- `ls supabase/migrations/ | sort | tail -1` returns `20260511000000_phase36_layer_c_variants.sql` ✓

---
*Phase: 36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null*
*Completed: 2026-05-11*
