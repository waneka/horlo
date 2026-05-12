-- Phase 37 — Layer D: Provenance Fields + Divestments Table (CAT-18)
-- Source: 37-CONTEXT.md D-01..D-15; 37-RESEARCH.md §6 + §11; 37-PATTERNS.md §Supabase migration
-- Sibling Drizzle migration: drizzle/0010_phase37_layer_d.sql (column shapes only — no RLS, no GRANT, no DO $$)
--
-- Threats mitigated:
--   T-37-RLS-01 (anon SELECT divestments — blocked by per-user RLS + GRANT-to-authenticated-only)
--   T-37-RLS-02 (cross-user read — blocked by auth.uid() = user_id SELECT policy)
--   T-37-FK-01  (FK orphan: divestments row pointing at non-existent catalog — blocked by FK + ON DELETE RESTRICT)
--
-- Inheritance: Phase 36 shipped 2026-05-11; prod has watches.catalog_id NOT NULL.
-- Phase 37 is purely ADDITIVE — no DROP, no ALTER COLUMN type-change, no orphan check.
-- Per memory rule project_drizzle_supabase_db_mismatch.md:
--   Rule 1: 14-digit timestamp filename (20260511010000) strictly > Phase 36 (20260511000000)
--   Rule 2: no insertion between adjacent integers — Phase 37 is a fresh idx, no fill
--   Rule 3: extension schema qualification — N/A (no GIN indexes / extension-scoped operators)
--   Rule 4: pg_depend pre-check — N/A (Phase 37 only ADDS columns and tables; no drops, no type-changes on existing columns)

BEGIN;

-- ============================================================================
-- STEP 1: CREATE TYPE for 3 new pgEnums (D-02 + D-03 + D-05).
-- MUST precede ALTER TABLE ADD COLUMN (L-04) — ADD COLUMN with these types
-- as the column type requires the type to exist in the same transaction.
-- Mirrors Plan 01 src/db/schema.ts pgEnum exports (bare names, no `_enum` suffix).
-- ============================================================================
CREATE TYPE condition_grade AS ENUM (
  'mint', 'near_mint', 'excellent', 'good', 'fair', 'poor'
);

CREATE TYPE currency_code AS ENUM (
  'USD', 'EUR', 'GBP', 'JPY', 'CHF',
  'AUD', 'CAD', 'HKD', 'SGD', 'CNY'
);

CREATE TYPE box_papers_status AS ENUM (
  'none', 'box_only', 'papers_only', 'full_set'
);

-- ============================================================================
-- STEP 2: ADD 7 nullable columns to watches table (D-01..D-08).
-- All columns are NULL by default for existing rows (CAT-18 SC#1).
-- Order matches src/db/schema.ts insertion: after image_url, before catalog_id.
-- ============================================================================
ALTER TABLE watches
  ADD COLUMN serial               text,
  ADD COLUMN year_of_acquisition  integer,
  ADD COLUMN condition            condition_grade,
  ADD COLUMN box_papers           box_papers_status,
  ADD COLUMN service_history      text,
  ADD COLUMN paid_currency        currency_code,
  ADD COLUMN purchase_date        date;

-- ============================================================================
-- STEP 3: CREATE TABLE divestments (D-09 shape verbatim).
-- catalog_id     ON DELETE RESTRICT — entity FK per Phase 34 D-02 (mirrors brand/family/variant)
-- user_id        ON DELETE CASCADE  — per-user FK per Phase 17 D-04 (mirrors watches.user_id)
-- replaced_by_catalog_id ON DELETE SET NULL — soft hint; losing the canonical reference
--                does not invalidate the historical divestment record.
-- NO UNIQUE constraint (D-13: 1:1 is soft convention only).
-- ============================================================================
CREATE TABLE divestments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id               uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE RESTRICT,
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  divested_at              timestamptz NOT NULL DEFAULT now(),
  replaced_by_catalog_id   uuid REFERENCES watches_catalog(id) ON DELETE SET NULL,
  sale_price               real,
  sale_currency            currency_code,
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX divestments_user_id_idx        ON divestments(user_id);
CREATE INDEX divestments_catalog_id_idx     ON divestments(catalog_id);
-- Composite index for the future recommender's "recent divestments per user" query
-- (SEED-002 temporal decay weighting). DESC matches the typical scan direction.
CREATE INDEX divestments_user_divested_at_idx ON divestments(user_id, divested_at DESC);

-- ============================================================================
-- STEP 4: updated_at trigger (Phase 36 pattern verbatim, renamed).
-- BEFORE UPDATE sets NEW.updated_at := now() on every row UPDATE.
-- ============================================================================
CREATE OR REPLACE FUNCTION divestments_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS divestments_set_updated_at_trg ON divestments;
CREATE TRIGGER divestments_set_updated_at_trg BEFORE UPDATE ON divestments
  FOR EACH ROW EXECUTE FUNCTION divestments_set_updated_at();

-- ============================================================================
-- STEP 5: RLS + GRANT (D-10; T-37-RLS-01 + T-37-RLS-02 mitigation).
--
-- INVERTED from Phase 36: divestments is PER-USER data (sale prices, notes —
-- personal collector data), NOT public catalog data. The 4 policies mirror
-- watches (Phase 17 D-06) verbatim.
--
-- Per memory rule project_supabase_secdef_grants.md: explicit GRANT to
-- authenticated is mandatory. GRANT is NOT given to `anon` — anonymous
-- callers must receive no privilege, mitigating T-37-RLS-01 directly.
-- service_role bypasses RLS for any administrative needs (no explicit policy).
-- ============================================================================
ALTER TABLE divestments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "divestments_owner_select" ON divestments;
CREATE POLICY "divestments_owner_select" ON divestments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "divestments_owner_insert" ON divestments;
CREATE POLICY "divestments_owner_insert" ON divestments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "divestments_owner_update" ON divestments;
CREATE POLICY "divestments_owner_update" ON divestments
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "divestments_owner_delete" ON divestments;
CREATE POLICY "divestments_owner_delete" ON divestments
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON divestments TO authenticated;
-- Intentionally NO grant to anon — T-37-RLS-01 mitigation.

-- ============================================================================
-- STEP 6: Final assertion block (Phase 17 §8 / Phase 34 / Phase 35 / Phase 36 pattern).
-- Verifies every invariant before COMMIT. Any failure raises EXCEPTION and
-- the entire transaction rolls back atomically.
-- ============================================================================
DO $$
DECLARE
  condition_grade_exists          boolean;
  currency_code_exists            boolean;
  box_papers_status_exists        boolean;
  watches_serial_col_exists       boolean;
  watches_yoa_col_exists          boolean;
  watches_condition_col_exists    boolean;
  watches_box_papers_col_exists   boolean;
  watches_svc_history_col_exists  boolean;
  watches_paid_currency_col       boolean;
  watches_purchase_date_col       boolean;
  divestments_table_exists        boolean;
  divestments_policy_count        int;
  authenticated_can_select        boolean;
  authenticated_can_insert        boolean;
  anon_cannot_select              boolean;
  catalog_id_fk_restrict          boolean;
  user_id_fk_cascade              boolean;
  replaced_fk_set_null            boolean;
BEGIN
  -- pgEnum existence (V-03)
  SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'condition_grade')
    INTO condition_grade_exists;
  SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'currency_code')
    INTO currency_code_exists;
  SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'box_papers_status')
    INTO box_papers_status_exists;

  -- watches column presence (V-02)
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='watches' AND column_name='serial')
    INTO watches_serial_col_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='watches' AND column_name='year_of_acquisition')
    INTO watches_yoa_col_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='watches' AND column_name='condition')
    INTO watches_condition_col_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='watches' AND column_name='box_papers')
    INTO watches_box_papers_col_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='watches' AND column_name='service_history')
    INTO watches_svc_history_col_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='watches' AND column_name='paid_currency')
    INTO watches_paid_currency_col;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='watches' AND column_name='purchase_date')
    INTO watches_purchase_date_col;

  -- divestments table existence (V-04)
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='divestments')
    INTO divestments_table_exists;

  -- divestments policy count (V-06 — expects exactly 4)
  SELECT count(*)::int FROM pg_policies
   WHERE schemaname='public' AND tablename='divestments'
    INTO divestments_policy_count;

  -- GRANT assertions (V-07 + V-08)
  SELECT has_table_privilege('authenticated', 'public.divestments', 'SELECT')
    INTO authenticated_can_select;
  SELECT has_table_privilege('authenticated', 'public.divestments', 'INSERT')
    INTO authenticated_can_insert;
  SELECT NOT has_table_privilege('anon', 'public.divestments', 'SELECT')
    INTO anon_cannot_select;

  -- FK cascade types (V-05)
  SELECT EXISTS (SELECT 1 FROM pg_constraint c
                  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
                 WHERE c.contype = 'f' AND c.conrelid = 'divestments'::regclass
                   AND a.attname = 'catalog_id' AND c.confdeltype = 'r')
    INTO catalog_id_fk_restrict;
  SELECT EXISTS (SELECT 1 FROM pg_constraint c
                  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
                 WHERE c.contype = 'f' AND c.conrelid = 'divestments'::regclass
                   AND a.attname = 'user_id' AND c.confdeltype = 'c')
    INTO user_id_fk_cascade;
  SELECT EXISTS (SELECT 1 FROM pg_constraint c
                  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
                 WHERE c.contype = 'f' AND c.conrelid = 'divestments'::regclass
                   AND a.attname = 'replaced_by_catalog_id' AND c.confdeltype = 'n')
    INTO replaced_fk_set_null;

  -- Raise on any failure
  IF NOT condition_grade_exists         THEN RAISE EXCEPTION 'Phase 37 failed -- condition_grade pgEnum missing'; END IF;
  IF NOT currency_code_exists           THEN RAISE EXCEPTION 'Phase 37 failed -- currency_code pgEnum missing'; END IF;
  IF NOT box_papers_status_exists       THEN RAISE EXCEPTION 'Phase 37 failed -- box_papers_status pgEnum missing'; END IF;
  IF NOT watches_serial_col_exists      THEN RAISE EXCEPTION 'Phase 37 failed -- watches.serial column missing'; END IF;
  IF NOT watches_yoa_col_exists         THEN RAISE EXCEPTION 'Phase 37 failed -- watches.year_of_acquisition column missing'; END IF;
  IF NOT watches_condition_col_exists   THEN RAISE EXCEPTION 'Phase 37 failed -- watches.condition column missing'; END IF;
  IF NOT watches_box_papers_col_exists  THEN RAISE EXCEPTION 'Phase 37 failed -- watches.box_papers column missing'; END IF;
  IF NOT watches_svc_history_col_exists THEN RAISE EXCEPTION 'Phase 37 failed -- watches.service_history column missing'; END IF;
  IF NOT watches_paid_currency_col      THEN RAISE EXCEPTION 'Phase 37 failed -- watches.paid_currency column missing'; END IF;
  IF NOT watches_purchase_date_col      THEN RAISE EXCEPTION 'Phase 37 failed -- watches.purchase_date column missing'; END IF;
  IF NOT divestments_table_exists       THEN RAISE EXCEPTION 'Phase 37 failed -- divestments table missing'; END IF;
  IF divestments_policy_count <> 4      THEN RAISE EXCEPTION 'Phase 37 failed -- divestments expected 4 RLS policies, got %', divestments_policy_count; END IF;
  IF NOT authenticated_can_select       THEN RAISE EXCEPTION 'Phase 37 failed -- authenticated cannot SELECT divestments (T-37-RLS GRANT broken)'; END IF;
  IF NOT authenticated_can_insert       THEN RAISE EXCEPTION 'Phase 37 failed -- authenticated cannot INSERT divestments (T-37-RLS GRANT broken)'; END IF;
  IF NOT anon_cannot_select             THEN RAISE EXCEPTION 'Phase 37 failed -- anon has SELECT privilege on divestments (T-37-RLS-01 mitigation broken)'; END IF;
  IF NOT catalog_id_fk_restrict         THEN RAISE EXCEPTION 'Phase 37 failed -- divestments.catalog_id FK is not ON DELETE RESTRICT (T-37-FK-01 mitigation broken)'; END IF;
  IF NOT user_id_fk_cascade             THEN RAISE EXCEPTION 'Phase 37 failed -- divestments.user_id FK is not ON DELETE CASCADE'; END IF;
  IF NOT replaced_fk_set_null           THEN RAISE EXCEPTION 'Phase 37 failed -- divestments.replaced_by_catalog_id FK is not ON DELETE SET NULL'; END IF;
END $$;

COMMIT;
