-- Phase 11 Migration 3/5: pg_trgm extension + GIN trigram indexes on profiles
-- Source: 11-CONTEXT.md, 11-RESEARCH.md §SQL Snippet 3, §Pitfall 3, §Pitfall 4
-- Requirements: SRCH-08
--
-- Why GIN (not GiST): 3x faster reads; profiles is a read-heavy table.
-- Why WITH SCHEMA extensions: Supabase-idiomatic; passes advisor lint 0015_extension_in_public.
-- Why NOT add a lowercase column: ILIKE is already case-insensitive with gin opclass.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- GIN trigram index on profiles.username for ILIKE acceleration.
-- Coexists with the existing `profiles_username_idx` B-tree (from Phase 7) —
-- the planner picks whichever matches the query pattern.
-- Opclass is schema-qualified because pg_trgm was installed into `extensions`,
-- which is not on the default search_path during migration.
CREATE INDEX IF NOT EXISTS profiles_username_trgm_idx
  ON profiles USING gin (username extensions.gin_trgm_ops);

-- GIN trigram index on profiles.bio for ILIKE acceleration.
-- The 4-char minimum guard for bio queries is enforced at the DAL layer (Phase 16).
CREATE INDEX IF NOT EXISTS profiles_bio_trgm_idx
  ON profiles USING gin (bio extensions.gin_trgm_ops);

COMMIT;
