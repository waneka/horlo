-- Phase 7: RLS policies for social tables
-- Follows Phase 6 naming convention: {table}_{operation}_own
-- All auth.uid() wrapped in (SELECT auth.uid()) for InitPlan optimization

-- Username format constraint (D-04)
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format CHECK (username ~ '^[a-z][a-z0-9_]{2,29}$');

-- profiles: public read, owner write
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select_all ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY profiles_delete_own ON public.profiles FOR DELETE TO authenticated USING (id = (SELECT auth.uid()));

-- follows: public read, follower write
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY follows_select_all ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY follows_insert_own ON public.follows FOR INSERT TO authenticated WITH CHECK (follower_id = (SELECT auth.uid()));
CREATE POLICY follows_update_own ON public.follows FOR UPDATE TO authenticated USING (follower_id = (SELECT auth.uid())) WITH CHECK (follower_id = (SELECT auth.uid()));
CREATE POLICY follows_delete_own ON public.follows FOR DELETE TO authenticated USING (follower_id = (SELECT auth.uid()));

-- profile_settings: public read (for visibility checks), owner write
ALTER TABLE public.profile_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY profile_settings_select_all ON public.profile_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY profile_settings_insert_own ON public.profile_settings FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY profile_settings_update_own ON public.profile_settings FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY profile_settings_delete_own ON public.profile_settings FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- activities: owner only (Phase 10 will expand SELECT for feed)
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY activities_select_own ON public.activities FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY activities_insert_own ON public.activities FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY activities_update_own ON public.activities FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY activities_delete_own ON public.activities FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- wear_events: owner only (Phase 8 will gate reads via worn_public)
ALTER TABLE public.wear_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY wear_events_select_own ON public.wear_events FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY wear_events_insert_own ON public.wear_events FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY wear_events_update_own ON public.wear_events FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY wear_events_delete_own ON public.wear_events FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
