-- Phase 11 Migration 6: REVOKE PUBLIC + GRANT authenticated on SECDEF helpers (WR-01 fix)
-- Source: Code review 11-REVIEW.md WR-01 + Verification 11-HUMAN-UAT.md #1
--
-- Problem: Migration 4b's three SECURITY DEFINER helpers
-- (get_wear_event_visibility_bypassing_rls, get_wear_event_owner_bypassing_rls,
-- viewer_follows_bypassing_rls) were created without REVOKE/GRANT clauses.
-- Postgres grants EXECUTE to PUBLIC by default, so any anon or authenticated caller
-- could probe wear-event visibility, owner user_id, and arbitrary follow relationships
-- via PostgREST RPC — exposure wider than the storage SELECT policy needs.
-- Confirmed live: `has_function_privilege('anon', '...', 'EXECUTE')` returned true.
--
-- Fix strategy:
--   1. REVOKE EXECUTE FROM PUBLIC, anon  — removes the default grant AND Supabase's
--      ALTER DEFAULT PRIVILEGES grant to anon (Supabase auto-grants EXECUTE on all
--      public-schema functions to anon/authenticated/service_role at creation time).
--      PUBLIC alone is insufficient — anon has a direct grant.
--   2. GRANT EXECUTE TO authenticated remains (default grant preserved, documented
--      explicitly for clarity and idempotence).
--   3. service_role retains EXECUTE — it is trusted (superuser-equivalent for SDK),
--      used for test setup and admin workflows; not a production-RPC attack surface.
--   4. anon is explicitly revoked — the storage policy is `TO authenticated`, so anon
--      never reaches these helpers via the policy path, and RPC access is now closed.
--
-- Net effect: helpers remain callable from inside the storage.objects RLS policy for
-- authenticated users (storage access matrix still works), and from service_role admin
-- contexts. Direct anon RPC probing is blocked.
--
-- Idempotent: REVOKE and GRANT are both no-ops when already in desired state.

BEGIN;

-- Revoke default PUBLIC grant + Supabase's direct grant to anon.
REVOKE EXECUTE ON FUNCTION public.get_wear_event_visibility_bypassing_rls(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_wear_event_owner_bypassing_rls(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.viewer_follows_bypassing_rls(uuid, uuid) FROM PUBLIC, anon;

-- Authenticated grant (restated for idempotence and explicitness).
GRANT EXECUTE ON FUNCTION public.get_wear_event_visibility_bypassing_rls(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_wear_event_owner_bypassing_rls(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.viewer_follows_bypassing_rls(uuid, uuid) TO authenticated;

-- Sanity assertion: confirm the grants landed correctly.
-- Fails the migration if anon still has access or authenticated lost access.
DO $$
DECLARE
  anon_visibility boolean;
  anon_owner boolean;
  anon_follows boolean;
  authed_visibility boolean;
  authed_owner boolean;
  authed_follows boolean;
BEGIN
  SELECT has_function_privilege('anon', 'public.get_wear_event_visibility_bypassing_rls(uuid)', 'EXECUTE') INTO anon_visibility;
  SELECT has_function_privilege('anon', 'public.get_wear_event_owner_bypassing_rls(uuid)', 'EXECUTE') INTO anon_owner;
  SELECT has_function_privilege('anon', 'public.viewer_follows_bypassing_rls(uuid, uuid)', 'EXECUTE') INTO anon_follows;
  SELECT has_function_privilege('authenticated', 'public.get_wear_event_visibility_bypassing_rls(uuid)', 'EXECUTE') INTO authed_visibility;
  SELECT has_function_privilege('authenticated', 'public.get_wear_event_owner_bypassing_rls(uuid)', 'EXECUTE') INTO authed_owner;
  SELECT has_function_privilege('authenticated', 'public.viewer_follows_bypassing_rls(uuid, uuid)', 'EXECUTE') INTO authed_follows;

  IF anon_visibility OR anon_owner OR anon_follows THEN
    RAISE EXCEPTION 'Migration 6 WR-01 fix failed — anon still has EXECUTE: visibility=%, owner=%, follows=%',
      anon_visibility, anon_owner, anon_follows;
  END IF;

  IF NOT (authed_visibility AND authed_owner AND authed_follows) THEN
    RAISE EXCEPTION 'Migration 6 WR-01 fix failed — authenticated missing EXECUTE: visibility=%, owner=%, follows=%',
      authed_visibility, authed_owner, authed_follows;
  END IF;
END $$;

COMMIT;
