-- Phase 80 — NOT NULL flip on watches_catalog.brand_id + family_id (CANON-01, CANON-02)
--
-- Precondition: Phase 79's --apply backfilled brand_id + family_id on all 205
-- prod rows. Phase 79 MIG-04 post-flight assertion proved zero NULLs at
-- transaction commit time. This migration is the trust boundary that makes
-- Phase 81 RECO-01/02 JOIN-through path safe (no NULL FKs to defend against).
--
-- Sequencing: D-80-03 staged deploy — this migration runs AFTER the resolver
-- code has been deployed to prod and ONE manual extract has proved both
-- upsertCatalogFromExtractedUrl and upsertCatalogFromUserInput attach brand_id
-- and family_id to new catalog rows. Without that proof, the next ingest after
-- the migration would fail with 23502 and break the AddWatchFlow.
--
-- Defensive guard: this migration includes a count-zero precondition assertion
-- (DIFFERENT predicate from the operation per [[post-flight-assertion-predicate-divergence]]).
-- Pre-flight predicate: row-count WHERE IS NULL (catches a NULL row violating the future constraint).
-- Post-flight predicate: information_schema.columns is_nullable (inspects resulting schema state).
-- If for any reason a NULL slipped in between Phase 79 close and Phase 80 push,
-- the migration aborts before the ALTER TABLE runs.
--
-- Filename ordering: 20260626000000 sorts AFTER the most recent migration
-- 20260624000000_phase78_aliases_needs_review.sql per [[drizzle-supabase-db-mismatch]] gotcha #1.
--
-- Sibling Drizzle shape mirror: src/db/schema.ts § watchesCatalog brand_id +
-- family_id columns flipped from .references(...) to .notNull().references(...).
-- Drizzle-kit push handles local; this hand-written SQL handles prod.
--
-- No table rewrite: ALTER TABLE ... SET NOT NULL on a column that has NO NULL
-- rows is a metadata-only operation in Postgres 11+. At ~205 prod rows the
-- AccessExclusive lock is sub-millisecond regardless.

BEGIN;

-- 1. Defensive precondition. Phrased as "count rows that VIOLATE the new
--    constraint" — semantically different from the ALTER itself (which would
--    just abort silently with "column contains null values" if a NULL existed).
--    Per [[post-flight-assertion-predicate-divergence]], a check that mirrors
--    the operation can inherit the same bug.
DO $$
DECLARE
  null_brand_count integer;
  null_family_count integer;
BEGIN
  SELECT count(*) INTO null_brand_count
    FROM watches_catalog
   WHERE brand_id IS NULL;

  SELECT count(*) INTO null_family_count
    FROM watches_catalog
   WHERE family_id IS NULL;

  IF null_brand_count > 0 THEN
    RAISE EXCEPTION 'Phase 80 aborted — % watches_catalog rows have brand_id IS NULL. Run Phase 79 --apply first.', null_brand_count;
  END IF;

  IF null_family_count > 0 THEN
    RAISE EXCEPTION 'Phase 80 aborted — % watches_catalog rows have family_id IS NULL. Run Phase 79 --apply first.', null_family_count;
  END IF;
END $$;

-- 2. Flip brand_id NOT NULL (CANON-01).
ALTER TABLE watches_catalog
  ALTER COLUMN brand_id SET NOT NULL;

-- 3. Flip family_id NOT NULL (CANON-02).
ALTER TABLE watches_catalog
  ALTER COLUMN family_id SET NOT NULL;

-- 4. Post-flight assertion. Phrased against RESULTING STATE (information_schema)
--    NOT against re-running a SELECT NULL count (which would trivially still
--    pass because nothing inserted between the ALTERs and now).
--    This is the semantically DISTINCT predicate required by
--    [[post-flight-assertion-predicate-divergence]].
DO $$
DECLARE
  brand_id_nullable text;
  family_id_nullable text;
BEGIN
  SELECT is_nullable INTO brand_id_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'watches_catalog'
     AND column_name = 'brand_id';

  SELECT is_nullable INTO family_id_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'watches_catalog'
     AND column_name = 'family_id';

  IF brand_id_nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION 'Phase 80 failed — watches_catalog.brand_id is still nullable (got: %)', brand_id_nullable;
  END IF;

  IF family_id_nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION 'Phase 80 failed — watches_catalog.family_id is still nullable (got: %)', family_id_nullable;
  END IF;
END $$;

COMMIT;
