-- Phase 6: Enable RLS on existing tables
-- Applied via: supabase db push --linked
-- CRITICAL: Each table's ALTER TABLE ENABLE and all CREATE POLICY statements
-- must be in the same migration. Never enable RLS without policies (D-08).
-- Connection notes:
--   Drizzle DATABASE_URL (service role) bypasses RLS by design (D-01).
--   Supabase anon key (PostgREST) is subject to these policies.
--   Auth trigger (handle_new_auth_user) runs as SECURITY DEFINER, bypasses RLS.

-- ============================================================================
-- public.users — ownership column: id (matches auth.uid() directly)
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON public.users
  FOR SELECT
  USING (id = (SELECT auth.uid()));

CREATE POLICY users_insert_own ON public.users
  FOR INSERT
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY users_delete_own ON public.users
  FOR DELETE
  USING (id = (SELECT auth.uid()));

-- ============================================================================
-- public.watches — ownership column: user_id
-- ============================================================================

ALTER TABLE public.watches ENABLE ROW LEVEL SECURITY;

CREATE POLICY watches_select_own ON public.watches
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY watches_insert_own ON public.watches
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY watches_update_own ON public.watches
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY watches_delete_own ON public.watches
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- ============================================================================
-- public.user_preferences — ownership column: user_id
-- ============================================================================

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_preferences_select_own ON public.user_preferences
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY user_preferences_insert_own ON public.user_preferences
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY user_preferences_update_own ON public.user_preferences
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY user_preferences_delete_own ON public.user_preferences
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));
