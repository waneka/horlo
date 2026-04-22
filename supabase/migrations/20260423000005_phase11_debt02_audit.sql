-- Phase 11 Migration 5/5: DEBT-02 audit on users / watches / user_preferences
-- Source: 11-CONTEXT.md D-14/D-15/D-16, 11-RESEARCH.md §SQL Snippet 5, §Pitfall 6
-- Requirements: DEBT-02 (resolves MR-03)
--
-- DEBT-02 AUDIT SUMMARY (read before editing this migration):
-- --------------------------------------------------------------------
-- Audited policies in supabase/migrations/20260420000000_rls_existing_tables.sql:
--   - public.users:            4 policies (SELECT/INSERT/UPDATE/DELETE)
--   - public.watches:          4 policies (SELECT/INSERT/UPDATE/DELETE)
--   - public.user_preferences: 4 policies (SELECT/INSERT/UPDATE/DELETE)
--
-- Verification checklist (D-14):
--   [x] All UPDATE policies have WITH CHECK
--         users_update_own:            USING + WITH CHECK ✓
--         watches_update_own:          USING + WITH CHECK ✓
--         user_preferences_update_own: USING + WITH CHECK ✓
--   [x] All auth.uid() calls wrapped in (SELECT auth.uid())
--         All 12 policies use the InitPlan-cached form ✓
--   [x] user_preferences has INSERT policy
--         user_preferences_insert_own exists with WITH CHECK ✓
--
-- OUTCOME: The existing v2.0 migration ALREADY satisfies DEBT-02.
-- No DDL changes are required. This migration exists as:
--   (a) a no-op audit trail in version control (D-16 isolates it in its own file)
--   (b) a trigger for the accompanying integration test suite to run (D-15)
--   (c) a sanity assertion that catches future schema drift
--
-- If this audit were to reveal defects, fixes would go here
-- (DROP POLICY ...; CREATE POLICY ... WITH CHECK ...). For this repo at
-- 2026-04-22, nothing is broken. See RESEARCH.md §Migration 5 for the
-- surgical-fix example patterns (convert bare auth.uid(), add WITH CHECK,
-- add missing INSERT policy).
-- --------------------------------------------------------------------

BEGIN;

-- Intentionally empty: DEBT-02 audit passed on existing policies.
-- See comment block above for what was verified.
-- Integration tests in tests/integration/debt02-rls-audit.test.ts provide the ongoing regression
-- gate; this file exists to make the audit act visible in the migration history.

-- Sanity assertion: fail the migration if any of the expected 12 policies does not exist.
-- Catches future schema drift that silently loses a policy.
DO $$
DECLARE
  missing_policies text[];
  p_name text;
  expected_policies text[] := ARRAY[
    'users_select_own', 'users_insert_own', 'users_update_own', 'users_delete_own',
    'watches_select_own', 'watches_insert_own', 'watches_update_own', 'watches_delete_own',
    'user_preferences_select_own', 'user_preferences_insert_own',
    'user_preferences_update_own', 'user_preferences_delete_own'
  ];
BEGIN
  FOREACH p_name IN ARRAY expected_policies LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public'
         AND policyname = p_name
    ) THEN
      missing_policies := array_append(missing_policies, p_name);
    END IF;
  END LOOP;

  IF array_length(missing_policies, 1) > 0 THEN
    RAISE EXCEPTION 'DEBT-02 audit: missing expected policies: %', missing_policies;
  END IF;
END $$;

COMMIT;
