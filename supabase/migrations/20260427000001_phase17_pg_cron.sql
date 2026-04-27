-- Phase 17 Migration 2/2: pg_cron daily refresh function + SECDEF lockdown + schedule
-- Source: 17-CONTEXT.md D-15, D-16, D-17; 17-RESEARCH.md Pattern 6; Pitfalls 5 + 6
-- Requirements: CAT-09, CAT-10
--
-- Sibling migration: 20260427000000_phase17_catalog_schema.sql (Plan 01) MUST apply first.
--
-- This migration:
--   1. CREATE EXTENSION IF NOT EXISTS pg_cron (prod-only -- local Docker may lack it)
--   2. CREATE OR REPLACE FUNCTION public.refresh_watches_catalog_counts() -- SECDEF
--   3. REVOKE EXECUTE FROM PUBLIC, anon, authenticated, service_role
--      then GRANT EXECUTE TO service_role only (Pitfall 6 + memory project_supabase_secdef_grants.md)
--   4. Sanity assertion DO block -- fail LOUDLY if anon/authenticated retain EXECUTE
--   5. Guarded cron.schedule -- only registers the schedule if pg_cron extension is present (Pitfall 5)

BEGIN;

-- ============================================================
-- 1. pg_cron extension (prod-only effect; local Docker may not ship it)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- 2. Refresh function -- SECURITY DEFINER, search_path locked (CAT-09, D-15, D-16)
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_watches_catalog_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Recompute counts on watches_catalog from watches.status
  UPDATE watches_catalog wc
  SET
    owners_count   = COALESCE(c.owned, 0),
    wishlist_count = COALESCE(c.wishlisted, 0),
    updated_at     = now()
  FROM (
    SELECT
      catalog_id,
      COUNT(*) FILTER (WHERE status IN ('owned','grail'))   AS owned,
      COUNT(*) FILTER (WHERE status = 'wishlist')            AS wishlisted
    FROM watches
    WHERE catalog_id IS NOT NULL
    GROUP BY catalog_id
  ) c
  WHERE wc.id = c.catalog_id;

  -- Reset rows that no longer have any watches linked (e.g. after deletes)
  UPDATE watches_catalog wc
  SET owners_count = 0, wishlist_count = 0, updated_at = now()
  WHERE NOT EXISTS (
    SELECT 1 FROM watches w WHERE w.catalog_id = wc.id
  ) AND (wc.owners_count <> 0 OR wc.wishlist_count <> 0);

  -- Snapshot row for today -- idempotent on (catalog_id, snapshot_date) UNIQUE (D-15, D-16)
  INSERT INTO watches_catalog_daily_snapshots
    (catalog_id, snapshot_date, owners_count, wishlist_count)
  SELECT id, current_date::text, owners_count, wishlist_count
    FROM watches_catalog
  ON CONFLICT (catalog_id, snapshot_date) DO UPDATE SET
    owners_count   = EXCLUDED.owners_count,
    wishlist_count = EXCLUDED.wishlist_count;
END
$$;

-- ============================================================
-- 3. SECDEF lockdown (Pitfall 6 + memory project_supabase_secdef_grants.md)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.refresh_watches_catalog_counts()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_watches_catalog_counts()
  TO service_role;

-- ============================================================
-- 4. Sanity assertion (Phase 11 pattern verbatim)
-- ============================================================
DO $$
DECLARE
  anon_can boolean;
  authed_can boolean;
  service_can boolean;
BEGIN
  SELECT has_function_privilege('anon',          'public.refresh_watches_catalog_counts()', 'EXECUTE') INTO anon_can;
  SELECT has_function_privilege('authenticated', 'public.refresh_watches_catalog_counts()', 'EXECUTE') INTO authed_can;
  SELECT has_function_privilege('service_role',  'public.refresh_watches_catalog_counts()', 'EXECUTE') INTO service_can;

  IF anon_can OR authed_can THEN
    RAISE EXCEPTION 'Phase 17 SECDEF guard failed -- anon=%, authed=%', anon_can, authed_can;
  END IF;
  IF NOT service_can THEN
    RAISE EXCEPTION 'Phase 17 SECDEF guard failed -- service_role missing EXECUTE';
  END IF;
END
$$;

-- ============================================================
-- 5. Schedule daily 03:00 UTC -- guarded for local Docker (Pitfall 5)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_watches_catalog_counts_daily') THEN
      PERFORM cron.unschedule('refresh_watches_catalog_counts_daily');
    END IF;
    PERFORM cron.schedule(
      'refresh_watches_catalog_counts_daily',
      '0 3 * * *',
      $cron$SELECT public.refresh_watches_catalog_counts()$cron$
    );
  END IF;
END
$$;

COMMIT;
