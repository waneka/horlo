-- Phase 36 — Layer C: Variant Split + CAT-14 NOT NULL (CAT-17 + CAT-14)
-- Source: 36-CONTEXT.md D-01..D-07; 36-RESEARCH.md §Migration Statement Ordering
-- Sibling Drizzle migration: drizzle/0009_phase36_layer_c_variants.sql (column shapes only — no RLS, no DO $$, no GRANT)
-- Threats mitigated:
--   T-36-01 (anon write blocked by RLS service-role-only),
--   T-36-02 (anon read via GRANT SELECT per memory project_supabase_secdef_grants.md),
--   T-36-03 (FK orphans blocked by ON DELETE RESTRICT on watch_variants.catalog_id),
--   T-36-04 (CAT-14 silent application — DO $$ pre-flight rolls back the entire
--            transaction if any orphan exists).
--
-- Inheritance: Phase 35 D-02 already wiped + re-seeded prod on 2026-05-10. Phase 36 does NOT re-wipe.
-- Per memory rule project_drizzle_supabase_db_mismatch.md rule 4 + 4a, pg_depend pre-flight runs in
-- docs/deploy-db-setup.md §36.0 BEFORE this file is applied to prod.

BEGIN;

-- ============================================================================
-- STEP 0: CAT-14 pre-flight (D-07). FIRST STATEMENT per ROADMAP success #3.
-- RAISE EXCEPTION aborts the entire transaction including the watch_variants
-- CREATE TABLE and the variant_id ADD COLUMN. Prod stays in pre-migration state.
-- ============================================================================
DO $$
DECLARE
  orphan_count int;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM watches WHERE catalog_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'CAT-14 pre-flight failed: % rows in watches have NULL catalog_id. Run npm run db:backfill-catalog or inspect manually (see docs/deploy-db-setup.md Phase 36 recovery flow), then retry the migration.', orphan_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 1: CREATE TABLE watch_variants (D-02 + D-03).
-- catalog_id ON DELETE RESTRICT — orphan-detection signal at delete time.
-- UNIQUE (catalog_id, slug) — composite uniqueness (slug NOT globally unique).
-- ============================================================================
CREATE TABLE watch_variants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id        uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE RESTRICT,
  name              text NOT NULL,
  slug              text NOT NULL,
  dial_color        text,
  bezel             text,
  bracelet_variant  text,
  image_url         text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT watch_variants_catalog_slug_unique UNIQUE (catalog_id, slug)
);

CREATE INDEX watch_variants_catalog_id_idx ON watch_variants(catalog_id);

-- ============================================================================
-- STEP 2: updated_at trigger (Phase 34 pattern verbatim).
-- ============================================================================
CREATE OR REPLACE FUNCTION watch_variants_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS watch_variants_set_updated_at_trg ON watch_variants;
CREATE TRIGGER watch_variants_set_updated_at_trg BEFORE UPDATE ON watch_variants
  FOR EACH ROW EXECUTE FUNCTION watch_variants_set_updated_at();

-- ============================================================================
-- STEP 3: RLS + GRANT (D-05; T-36-01 + T-36-02 mitigation).
-- Per memory rule project_supabase_secdef_grants.md: REVOKE FROM PUBLIC alone is
-- insufficient; explicit GRANT SELECT TO anon, authenticated is mandatory.
-- service_role bypasses RLS for writes — no INSERT/UPDATE/DELETE policy needed.
-- ============================================================================
ALTER TABLE watch_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS watch_variants_select_all ON watch_variants;
CREATE POLICY watch_variants_select_all ON watch_variants FOR SELECT USING (true);
GRANT SELECT ON watch_variants TO anon, authenticated;

-- ============================================================================
-- STEP 4: ADD COLUMN watches.variant_id (D-04).
-- Nullable; ON DELETE SET NULL — user never loses their watch due to admin curation.
-- ============================================================================
ALTER TABLE watches
  ADD COLUMN variant_id uuid NULL
    REFERENCES watch_variants(id) ON DELETE SET NULL;

CREATE INDEX watches_variant_id_idx ON watches(variant_id);

-- ============================================================================
-- STEP 5: CAT-14 NOT NULL flip — the load-bearing constraint change.
-- Safe because STEP 0 verified zero orphans; if any exist, we never reach here.
-- ============================================================================
ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL;

-- ============================================================================
-- STEP 6: Final assertion block (Phase 17 §8 / Phase 34 / Phase 35 pattern).
-- Raises RAISE EXCEPTION on any schema invariant failure; rollback is atomic.
-- ============================================================================
DO $$
DECLARE
  watch_variants_table_exists           boolean;
  watch_variants_select_policy_exists   boolean;
  anon_can_select_variants              boolean;
  variant_id_col_exists                 boolean;
  catalog_id_is_not_null                boolean;
  watch_variants_catalog_slug_unique    boolean;
  variant_id_fk_set_null                boolean;
  variant_catalog_id_fk_restrict        boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='watch_variants')
    INTO watch_variants_table_exists;

  SELECT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND policyname='watch_variants_select_all')
    INTO watch_variants_select_policy_exists;

  SELECT has_table_privilege('anon', 'public.watch_variants', 'SELECT')
    INTO anon_can_select_variants;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='watches' AND column_name='variant_id')
    INTO variant_id_col_exists;

  SELECT (is_nullable = 'NO') INTO catalog_id_is_not_null
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='watches' AND column_name='catalog_id';

  SELECT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname='watch_variants_catalog_slug_unique'
                    AND conrelid='watch_variants'::regclass)
    INTO watch_variants_catalog_slug_unique;

  SELECT EXISTS (SELECT 1 FROM pg_constraint c
                  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
                 WHERE c.contype = 'f' AND c.conrelid = 'watches'::regclass
                   AND a.attname = 'variant_id' AND c.confdeltype = 'n')
    INTO variant_id_fk_set_null;

  SELECT EXISTS (SELECT 1 FROM pg_constraint c
                  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
                 WHERE c.contype = 'f' AND c.conrelid = 'watch_variants'::regclass
                   AND a.attname = 'catalog_id' AND c.confdeltype = 'r')
    INTO variant_catalog_id_fk_restrict;

  IF NOT watch_variants_table_exists         THEN RAISE EXCEPTION 'Phase 36 failed -- watch_variants table missing'; END IF;
  IF NOT watch_variants_select_policy_exists THEN RAISE EXCEPTION 'Phase 36 failed -- watch_variants_select_all policy missing'; END IF;
  IF NOT anon_can_select_variants            THEN RAISE EXCEPTION 'Phase 36 failed -- anon cannot SELECT watch_variants (T-36-02 mitigation broken)'; END IF;
  IF NOT variant_id_col_exists               THEN RAISE EXCEPTION 'Phase 36 failed -- watches.variant_id column missing'; END IF;
  IF NOT catalog_id_is_not_null              THEN RAISE EXCEPTION 'Phase 36 failed -- watches.catalog_id is still nullable (CAT-14 flip missed)'; END IF;
  IF NOT watch_variants_catalog_slug_unique  THEN RAISE EXCEPTION 'Phase 36 failed -- watch_variants UNIQUE (catalog_id, slug) constraint missing'; END IF;
  IF NOT variant_id_fk_set_null              THEN RAISE EXCEPTION 'Phase 36 failed -- watches.variant_id FK is not ON DELETE SET NULL'; END IF;
  IF NOT variant_catalog_id_fk_restrict      THEN RAISE EXCEPTION 'Phase 36 failed -- watch_variants.catalog_id FK is not ON DELETE RESTRICT'; END IF;
END $$;

COMMIT;
