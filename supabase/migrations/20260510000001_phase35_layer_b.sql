-- Phase 35 — Layer B: Lineage Edges + Structured Movement + Era/Material (CAT-16)
-- Source: 35-CONTEXT.md D-01..D-14; 35-RESEARCH.md §3, §4, §5, §6, §9
-- Sibling Drizzle migration: drizzle/0008_phase35_layer_b.sql (column shapes only — no RLS, no trigger, no CHECK)
-- Threats mitigated: T-35-01 (anon write blocked by RLS service-role-only), T-35-03 (cycle trigger),
--                    T-35-04 (TRUNCATE-first eliminates movement value-mapping risk per D-02; pg_depend pre-flight in deploy runbook),
--                    T-35-05 (ON DELETE RESTRICT on lineage edge FKs catches catalog deletions).
--
-- WARNING: This migration begins with TRUNCATE watches CASCADE + TRUNCATE watches_catalog CASCADE.
-- Per memory rule project_db_wipeable_2026_05_09.md, the prod DB is single-user (twwaneka@gmail.com).
-- Re-seed runbook is documented in docs/deploy-db-setup.md §35.
-- Per memory rule project_drizzle_supabase_db_mismatch.md rule 4, run pg_depend pre-flight (D-03b)
-- BEFORE applying this file to prod.

BEGIN;

-- ============================================================================
-- STEP 0: TRUNCATE (D-02) — wipe both tables before column-shape changes.
-- Inside the same transaction; rollback-safe if any later DDL fails.
-- ============================================================================
TRUNCATE watches CASCADE;
TRUNCATE watches_catalog CASCADE;

-- ============================================================================
-- STEP 1: CREATE TYPE statements (D-01, D-04, D-09).
-- Must precede any DDL that references these types.
-- ============================================================================
CREATE TYPE movement_type_enum AS ENUM ('auto', 'manual', 'quartz', 'spring_drive');

CREATE TYPE lineage_relationship_type AS ENUM ('successor', 'predecessor', 'remake', 'tribute', 'homage');

CREATE TYPE watch_era AS ENUM (
  '1900-1910', '1910-1920', '1920-1930', '1930-1940', '1940-1950',
  '1950-1960', '1960-1970', '1970-1980', '1980-1990', '1990-2000',
  '2000-2010', '2010-2020', '2020-2030'
);

-- ============================================================================
-- STEP 2: ALTER watches — drop old movement; add movement_type + movement_caliber (D-03).
-- ============================================================================
ALTER TABLE watches
  DROP COLUMN IF EXISTS movement,
  ADD COLUMN  movement_type    movement_type_enum NULL,
  ADD COLUMN  movement_caliber TEXT NULL;

-- ============================================================================
-- STEP 3: ALTER watches_catalog — drop old movement; add 5 new columns (D-03, D-09, D-10, D-11).
-- ============================================================================
ALTER TABLE watches_catalog
  DROP COLUMN IF EXISTS movement,
  ADD COLUMN  movement_type    movement_type_enum NULL,
  ADD COLUMN  movement_caliber TEXT NULL,
  ADD COLUMN  era              watch_era NULL,
  ADD COLUMN  case_material    TEXT NULL,
  ADD COLUMN  bracelet_config  TEXT NULL;

-- ============================================================================
-- STEP 4: CREATE TABLE watch_lineage_edges (D-04, D-05, D-06, D-07).
-- Two-layered cycle prevention: CHECK constraint (self-loop) + BEFORE INSERT trigger (deeper cycles).
-- ============================================================================
CREATE TABLE watch_lineage_edges (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  predecessor_catalog_id uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE RESTRICT,
  successor_catalog_id   uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE RESTRICT,
  relationship_type      lineage_relationship_type NOT NULL,
  metadata               jsonb NOT NULL DEFAULT '{}',
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_loop                CHECK (predecessor_catalog_id <> successor_catalog_id),
  CONSTRAINT lineage_edges_unique_triple UNIQUE (predecessor_catalog_id, successor_catalog_id, relationship_type)
);

CREATE INDEX watch_lineage_edges_predecessor_idx ON watch_lineage_edges (predecessor_catalog_id);
CREATE INDEX watch_lineage_edges_successor_idx   ON watch_lineage_edges (successor_catalog_id);

-- updated_at trigger (Phase 34 pattern)
CREATE OR REPLACE FUNCTION watch_lineage_edges_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS watch_lineage_edges_set_updated_at_trg ON watch_lineage_edges;
CREATE TRIGGER watch_lineage_edges_set_updated_at_trg BEFORE UPDATE ON watch_lineage_edges
  FOR EACH ROW EXECUTE FUNCTION watch_lineage_edges_set_updated_at();

-- ============================================================================
-- STEP 5: Cycle-detection BEFORE INSERT trigger (D-06).
-- Bounded recursive CTE: depth limit 10 matches CAT-16 SC#2 read-CTE depth.
-- RAISE EXCEPTION includes both endpoints in the message for downstream debug.
-- ============================================================================
CREATE OR REPLACE FUNCTION check_lineage_cycle() RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE walk AS (
      SELECT successor_catalog_id AS node, 1 AS depth
        FROM watch_lineage_edges
       WHERE predecessor_catalog_id = NEW.successor_catalog_id
      UNION ALL
      SELECT e.successor_catalog_id, w.depth + 1
        FROM watch_lineage_edges e
        JOIN walk w ON e.predecessor_catalog_id = w.node
       WHERE w.depth < 10
    )
    SELECT 1 FROM walk WHERE node = NEW.predecessor_catalog_id
  ) THEN
    RAISE EXCEPTION 'Lineage cycle detected: % -> %',
      NEW.predecessor_catalog_id, NEW.successor_catalog_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_lineage_cycle
  BEFORE INSERT ON watch_lineage_edges
  FOR EACH ROW EXECUTE FUNCTION check_lineage_cycle();

-- ============================================================================
-- STEP 6: RLS + GRANT (Phase 34 pattern verbatim; T-35-01 mitigation).
-- Per memory rule project_supabase_secdef_grants.md: REVOKE FROM PUBLIC alone is insufficient;
-- explicit GRANT SELECT TO anon, authenticated is mandatory. service_role bypasses RLS for writes.
-- ============================================================================
ALTER TABLE watch_lineage_edges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lineage_edges_select_all ON watch_lineage_edges;
CREATE POLICY lineage_edges_select_all ON watch_lineage_edges FOR SELECT USING (true);
GRANT SELECT ON watch_lineage_edges TO anon, authenticated;

-- ============================================================================
-- STEP 7: Final assertion block (Phase 17 §8 / Phase 34 pattern).
-- Raises RAISE EXCEPTION on any schema invariant failure; transaction aborts atomically.
-- ============================================================================
DO $$
DECLARE
  movement_type_enum_exists      boolean;
  lineage_rel_type_enum_exists   boolean;
  watch_era_enum_exists          boolean;
  watches_movement_type_col      boolean;
  catalog_movement_type_col      boolean;
  catalog_era_col                boolean;
  catalog_case_material_col      boolean;
  catalog_bracelet_config_col    boolean;
  lineage_table_exists           boolean;
  lineage_select_policy_exists   boolean;
  anon_can_select_lineage        boolean;
  cycle_trigger_exists           boolean;
  no_self_loop_check_exists      boolean;
  lineage_unique_triple_exists   boolean;
  watches_old_movement_gone      boolean;
  catalog_old_movement_gone      boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_type_enum')         INTO movement_type_enum_exists;
  SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lineage_relationship_type')  INTO lineage_rel_type_enum_exists;
  SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'watch_era')                  INTO watch_era_enum_exists;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='watches'         AND column_name='movement_type')
    INTO watches_movement_type_col;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='watches_catalog' AND column_name='movement_type')
    INTO catalog_movement_type_col;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='watches_catalog' AND column_name='era')
    INTO catalog_era_col;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='watches_catalog' AND column_name='case_material')
    INTO catalog_case_material_col;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='watches_catalog' AND column_name='bracelet_config')
    INTO catalog_bracelet_config_col;

  SELECT NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='public' AND table_name='watches'         AND column_name='movement')
    INTO watches_old_movement_gone;
  SELECT NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='public' AND table_name='watches_catalog' AND column_name='movement')
    INTO catalog_old_movement_gone;

  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='watch_lineage_edges')
    INTO lineage_table_exists;
  SELECT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND policyname='lineage_edges_select_all')
    INTO lineage_select_policy_exists;
  SELECT has_table_privilege('anon', 'public.watch_lineage_edges', 'SELECT')
    INTO anon_can_select_lineage;
  SELECT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgname='trg_check_lineage_cycle')
    INTO cycle_trigger_exists;
  SELECT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname='no_self_loop' AND conrelid='watch_lineage_edges'::regclass)
    INTO no_self_loop_check_exists;
  SELECT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname='lineage_edges_unique_triple' AND conrelid='watch_lineage_edges'::regclass)
    INTO lineage_unique_triple_exists;

  IF NOT movement_type_enum_exists       THEN RAISE EXCEPTION 'Phase 35 failed -- movement_type_enum type missing'; END IF;
  IF NOT lineage_rel_type_enum_exists    THEN RAISE EXCEPTION 'Phase 35 failed -- lineage_relationship_type type missing'; END IF;
  IF NOT watch_era_enum_exists           THEN RAISE EXCEPTION 'Phase 35 failed -- watch_era type missing'; END IF;
  IF NOT watches_movement_type_col       THEN RAISE EXCEPTION 'Phase 35 failed -- watches.movement_type column missing'; END IF;
  IF NOT catalog_movement_type_col       THEN RAISE EXCEPTION 'Phase 35 failed -- watches_catalog.movement_type column missing'; END IF;
  IF NOT catalog_era_col                 THEN RAISE EXCEPTION 'Phase 35 failed -- watches_catalog.era column missing'; END IF;
  IF NOT catalog_case_material_col       THEN RAISE EXCEPTION 'Phase 35 failed -- watches_catalog.case_material column missing'; END IF;
  IF NOT catalog_bracelet_config_col     THEN RAISE EXCEPTION 'Phase 35 failed -- watches_catalog.bracelet_config column missing'; END IF;
  IF NOT watches_old_movement_gone       THEN RAISE EXCEPTION 'Phase 35 failed -- watches.movement old column NOT dropped'; END IF;
  IF NOT catalog_old_movement_gone       THEN RAISE EXCEPTION 'Phase 35 failed -- watches_catalog.movement old column NOT dropped'; END IF;
  IF NOT lineage_table_exists            THEN RAISE EXCEPTION 'Phase 35 failed -- watch_lineage_edges table missing'; END IF;
  IF NOT lineage_select_policy_exists    THEN RAISE EXCEPTION 'Phase 35 failed -- lineage_edges_select_all policy missing'; END IF;
  IF NOT anon_can_select_lineage         THEN RAISE EXCEPTION 'Phase 35 failed -- anon cannot SELECT watch_lineage_edges (T-35-01 mitigation broken)'; END IF;
  IF NOT cycle_trigger_exists            THEN RAISE EXCEPTION 'Phase 35 failed -- trg_check_lineage_cycle trigger missing'; END IF;
  IF NOT no_self_loop_check_exists       THEN RAISE EXCEPTION 'Phase 35 failed -- no_self_loop CHECK constraint missing'; END IF;
  IF NOT lineage_unique_triple_exists    THEN RAISE EXCEPTION 'Phase 35 failed -- lineage_edges_unique_triple UNIQUE constraint missing'; END IF;
END $$;

COMMIT;
