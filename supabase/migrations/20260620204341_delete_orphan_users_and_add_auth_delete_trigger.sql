-- Delete orphan public.users rows + install an on_auth_user_deleted trigger.
--
-- BACKGROUND
-- 20260413000000_sync_auth_users.sql installed an on_auth_user_created trigger
-- to mirror auth.users INSERTs into public.users (which carries the FKs for
-- watches/follows/activities/etc.). It did NOT install a corresponding DELETE
-- mirror — so deleting a user from the Supabase dashboard auth panel leaves
-- the public.users row (and its dependent watches/follows/activities) intact.
-- These ghost rows continue to surface in the UI (profile pages resolve,
-- follow counts include them, activities/collectors-to-follow lists show them).
--
-- WHAT THIS MIGRATION DOES
-- 1. DELETEs orphan public.users (no matching auth.users row). The existing
--    ON DELETE CASCADE on watches.user_id / follows.follower_id /
--    follows.following_id / activities.user_id / etc. cleans up dependents.
-- 2. Installs an on_auth_user_deleted trigger that mirrors future auth.users
--    deletions to public.users, preventing recurrence.
--
-- Apply via: supabase db push --linked
-- Per memory: project_drizzle_supabase_db_mismatch
-- Post-flight assertion uses a DIFFERENT predicate (LEFT JOIN + count NULLs)
-- than the DELETE WHERE (NOT EXISTS) per
-- project_post_flight_assertion_predicate_divergence.

BEGIN;

-- ----- Step 1: report what we're about to delete (sanity) -----
DO $$
DECLARE orphan_count int;
BEGIN
  SELECT count(*) INTO orphan_count
    FROM public.users u
    LEFT JOIN auth.users au ON au.id = u.id
    WHERE au.id IS NULL;
  RAISE NOTICE 'pre-flight: % orphan public.users rows will be deleted', orphan_count;
END $$;

-- ----- Step 2: delete orphans (cascades clean dependents) -----
DELETE FROM public.users u
 WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id);

-- ----- Step 3: install the on_auth_user_deleted trigger -----
-- SECURITY DEFINER so the trigger function can DELETE from public.users
-- regardless of the caller's role (mirrors the existing
-- handle_new_auth_user pattern). search_path pinned to public to prevent
-- function-resolution hijacking via temporary schema entries.
CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_deleted();

-- ----- Step 4: post-flight assertions -----
-- Predicate-divergence: the DELETE used `NOT EXISTS (SELECT 1 FROM auth.users)`;
-- this assertion uses a LEFT JOIN + WHERE au.id IS NULL — same intent, different
-- SQL phrasing. If both miss the same row, they fail for the same reason
-- (genuine concurrent insert) rather than for a shared blind spot.
DO $$
DECLARE remaining_orphans int;
DECLARE trig_count int;
BEGIN
  SELECT count(*) INTO remaining_orphans
    FROM public.users u
    LEFT JOIN auth.users au ON au.id = u.id
    WHERE au.id IS NULL;
  IF remaining_orphans <> 0 THEN
    RAISE EXCEPTION 'post-flight: % orphan public.users rows still present', remaining_orphans;
  END IF;

  SELECT count(*) INTO trig_count
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_deleted'
      AND tgrelid = 'auth.users'::regclass;
  IF trig_count <> 1 THEN
    RAISE EXCEPTION 'post-flight: on_auth_user_deleted trigger missing (count=%)', trig_count;
  END IF;
END $$;

COMMIT;
