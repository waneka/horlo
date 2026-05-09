-- Phase 34 — Layer A: brand + family entities (CAT-15)
-- Source: 34-CONTEXT.md D-01..D-06; 34-RESEARCH.md §Pattern 2
-- Sibling Drizzle migration: drizzle/0007_phase34_brands_families.sql (column shapes only, also idempotent).
-- Threats mitigated: T-34-01 (anon write), T-34-02 (anon read enabled), T-34-03 (FK orphans).

BEGIN;

-- 1. brands table (D-01)
CREATE TABLE IF NOT EXISTS brands (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  name_normalized   text GENERATED ALWAYS AS (lower(trim(name))) STORED,
  slug              text NOT NULL,
  country_of_origin text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brands_slug_unique') THEN
    ALTER TABLE brands ADD CONSTRAINT brands_slug_unique UNIQUE (slug);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brands_name_normalized_unique') THEN
    ALTER TABLE brands ADD CONSTRAINT brands_name_normalized_unique UNIQUE (name_normalized);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION brands_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS brands_set_updated_at_trg ON brands;
CREATE TRIGGER brands_set_updated_at_trg BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION brands_set_updated_at();
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brands_select_all ON brands;
CREATE POLICY brands_select_all ON brands FOR SELECT USING (true);
GRANT SELECT ON brands TO anon, authenticated;

-- 2. watch_families table (D-01)
CREATE TABLE IF NOT EXISTS watch_families (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  name_normalized text GENERATED ALWAYS AS (lower(trim(name))) STORED,
  slug            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'watch_families_brand_name_unique') THEN
    ALTER TABLE watch_families
      ADD CONSTRAINT watch_families_brand_name_unique UNIQUE (brand_id, name_normalized);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS watch_families_brand_id_idx ON watch_families (brand_id);
CREATE OR REPLACE FUNCTION watch_families_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS watch_families_set_updated_at_trg ON watch_families;
CREATE TRIGGER watch_families_set_updated_at_trg BEFORE UPDATE ON watch_families
  FOR EACH ROW EXECUTE FUNCTION watch_families_set_updated_at();
ALTER TABLE watch_families ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS watch_families_select_all ON watch_families;
CREATE POLICY watch_families_select_all ON watch_families FOR SELECT USING (true);
GRANT SELECT ON watch_families TO anon, authenticated;

-- 3. watches_catalog FK column adds (D-02; T-34-03 mitigation)
ALTER TABLE watches_catalog
  ADD COLUMN IF NOT EXISTS brand_id  uuid REFERENCES brands(id)         ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES watch_families(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS watches_catalog_brand_id_idx  ON watches_catalog (brand_id);
CREATE INDEX IF NOT EXISTS watches_catalog_family_id_idx ON watches_catalog (family_id);

-- 4. Final assertion block (Phase 17 §8 pattern)
DO $$
DECLARE
  brands_select_policy_exists boolean;
  families_select_policy_exists boolean;
  brand_id_col_exists boolean;
  family_id_col_exists boolean;
  brand_normalized_is_generated boolean;
  family_normalized_is_generated boolean;
  anon_can_select_brands boolean;
  anon_can_select_families boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname='brands_select_all') INTO brands_select_policy_exists;
  SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname='watch_families_select_all') INTO families_select_policy_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='watches_catalog' AND column_name='brand_id') INTO brand_id_col_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='watches_catalog' AND column_name='family_id') INTO family_id_col_exists;
  SELECT (is_generated = 'ALWAYS') INTO brand_normalized_is_generated FROM information_schema.columns WHERE table_schema='public' AND table_name='brands' AND column_name='name_normalized';
  SELECT (is_generated = 'ALWAYS') INTO family_normalized_is_generated FROM information_schema.columns WHERE table_schema='public' AND table_name='watch_families' AND column_name='name_normalized';
  SELECT has_table_privilege('anon', 'public.brands', 'SELECT') INTO anon_can_select_brands;
  SELECT has_table_privilege('anon', 'public.watch_families', 'SELECT') INTO anon_can_select_families;

  IF NOT brands_select_policy_exists       THEN RAISE EXCEPTION 'Phase 34 failed -- brands SELECT policy missing'; END IF;
  IF NOT families_select_policy_exists     THEN RAISE EXCEPTION 'Phase 34 failed -- watch_families SELECT policy missing'; END IF;
  IF NOT brand_id_col_exists               THEN RAISE EXCEPTION 'Phase 34 failed -- watches_catalog.brand_id missing'; END IF;
  IF NOT family_id_col_exists              THEN RAISE EXCEPTION 'Phase 34 failed -- watches_catalog.family_id missing'; END IF;
  IF NOT brand_normalized_is_generated     THEN RAISE EXCEPTION 'Phase 34 failed -- brands.name_normalized not GENERATED ALWAYS'; END IF;
  IF NOT family_normalized_is_generated    THEN RAISE EXCEPTION 'Phase 34 failed -- watch_families.name_normalized not GENERATED ALWAYS'; END IF;
  IF NOT anon_can_select_brands            THEN RAISE EXCEPTION 'Phase 34 failed -- anon cannot SELECT brands (T-34-02)'; END IF;
  IF NOT anon_can_select_families          THEN RAISE EXCEPTION 'Phase 34 failed -- anon cannot SELECT watch_families (T-34-02)'; END IF;
END $$;

COMMIT;
