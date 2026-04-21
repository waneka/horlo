-- Phase 8 code review WR-05: make username uniqueness case-insensitive.
-- Background:
--   The profiles table has a plain-text UNIQUE constraint on `username`, which
--   treats 'Tyler' and 'tyler' as distinct values. The signup trigger in
--   20260420000002_profile_trigger.sql already lowercases new usernames, so
--   prod data today is consistent — but a future direct-INSERT path (bulk
--   import, admin tool, etc.) could introduce mixed-case duplicates and open
--   username-spoofing risk. This migration adds a unique index on
--   lower(username) as belt-and-suspenders.
--
-- Idempotent: CREATE UNIQUE INDEX IF NOT EXISTS lets the migration re-run
-- safely against environments that already have the index.

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique_idx
  ON public.profiles (lower(username));
