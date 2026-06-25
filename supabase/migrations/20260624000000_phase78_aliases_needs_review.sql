-- Phase 78 — Schema Additions for v8.4 Catalog Brand+Model Canonicalization
-- Requirements: CANON-03 (aliases text[] + GIN index), CANON-04 (needs_review boolean on brands + watch_families)
--
-- Decisions honored:
--   D-78-08 — aliases ships EMPTY in Phase 78; population is owned by Phase 79's
--             `--apply` driven by the operator queue at
--             .planning/v8.4-family-merge-decisions.md. We add the column +
--             GIN containment index here so Phase 79 has the index ready to
--             write into. Pre-seeding alias values in this migration was
--             explicitly rejected in 78-CONTEXT.md (single source of truth for
--             alias data is the operator queue, not hardcoded migration).
--
-- Why this migration is pure additive ADD COLUMN + CREATE INDEX:
--   Per RESEARCH.md R-FIND-01 (Q2 + Pattern 1 Note), the additive shape here is
--   pure ADD COLUMN + CREATE INDEX with the default `array_ops` GIN opclass.
--   No helper function is defined and no extension-schema function is called
--   at index-build time. The MIG-05 portability requirement reduces to
--   filename + ordering convention here. The dry-run script (Plan 03) DOES
--   call word_similarity at runtime, schema-qualified — that's handled in
--   script SQL at runtime, not at index-build time, so the index-build
--   search-path pitfall does not apply to this migration.
--
-- Filename ordering: `20260624000000` sorts AFTER the most recent migration
--   `20260623200000_quick_260623_uua_search_unaccent_trgm.sql` per
--   `project_drizzle_supabase_db_mismatch` gotcha #1.
--
-- Sibling Drizzle shape mirror: drizzle/0014_phase78_aliases_needs_review.sql
--   (LOCAL ONLY per `project_drizzle_supabase_db_mismatch`; this hand-written
--   SQL file is the authoritative migration that ships to prod via
--   `supabase db push --linked` in Plan 04).
--
-- ADD COLUMN ... DEFAULT '{}' locking (Pitfall 4): Postgres 11+ optimizes
--   `ADD COLUMN ... NOT NULL DEFAULT <constant>` to NOT rewrite the table —
--   the default is stored in metadata and served on read for old rows. Using
--   bare `'{}'` (not `'{}'::text[]`) keeps the default classifiable as a
--   constant. Supabase prod runs Postgres 15+; sub-second even on a rewrite.

BEGIN;

-- 1. CANON-04 — needs_review boolean on brands
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

-- 2. CANON-04 — needs_review boolean on watch_families
ALTER TABLE watch_families
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

-- 3. CANON-03 — aliases text[] on watch_families (Phase 78 ships EMPTY per D-78-08)
--    Bare `'{}'` (not `'{}'::text[]`) per Pitfall 4 — keeps the default as a
--    constant so Postgres 11+ skips the table rewrite (metadata-only column add).
ALTER TABLE watch_families
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';

-- 4. CANON-03 — GIN containment index on aliases for @> lookup
--    Plain GIN with default `array_ops` opclass supports @> (strategy 2).
--    NOT `gin_trgm_ops` (that's for ILIKE/similarity on a SINGLE text column).
--    Aliases are exact-string mapping by design (D-78-08 + 78-CONTEXT.md
--    deferred section); no trigram needed on the array itself — fuzzy
--    matching happens upstream on name_normalized via the existing
--    trigram index from quick-260623-uua.
CREATE INDEX IF NOT EXISTS watch_families_aliases_gin_idx
  ON watch_families USING GIN (aliases);

-- 5. Post-flight assertion. Phrased against RESULTING STATE
--    (information_schema.columns / pg_indexes) NOT against re-running the
--    ALTER TABLE predicates — per `project_post_flight_assertion_predicate_divergence`.
--    An assertion using the same WHERE-clause as the DDL silently inherits
--    the same bug.
DO $$
DECLARE
  brands_needs_review_default text;
  families_needs_review_default text;
  aliases_default text;
  aliases_is_nullable text;
  gin_idx_exists boolean;
BEGIN
  SELECT column_default
    INTO brands_needs_review_default
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'brands'
     AND column_name = 'needs_review';

  SELECT column_default
    INTO families_needs_review_default
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'watch_families'
     AND column_name = 'needs_review';

  SELECT column_default, is_nullable
    INTO aliases_default, aliases_is_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'watch_families'
     AND column_name = 'aliases';

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = 'watch_families_aliases_gin_idx'
  ) INTO gin_idx_exists;

  IF brands_needs_review_default IS NULL OR brands_needs_review_default NOT LIKE 'false%' THEN
    RAISE EXCEPTION 'Phase 78 failed — brands.needs_review default not "false" (got: %)', brands_needs_review_default;
  END IF;
  IF families_needs_review_default IS NULL OR families_needs_review_default NOT LIKE 'false%' THEN
    RAISE EXCEPTION 'Phase 78 failed — watch_families.needs_review default not "false" (got: %)', families_needs_review_default;
  END IF;
  IF aliases_default IS NULL OR aliases_default NOT LIKE '%''{}''%' THEN
    RAISE EXCEPTION 'Phase 78 failed — watch_families.aliases default not "{}" (got: %)', aliases_default;
  END IF;
  IF aliases_is_nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION 'Phase 78 failed — watch_families.aliases is nullable (got is_nullable: %)', aliases_is_nullable;
  END IF;
  IF NOT gin_idx_exists THEN
    RAISE EXCEPTION 'Phase 78 failed — watch_families_aliases_gin_idx missing from pg_indexes';
  END IF;
END $$;

COMMIT;
