-- Phase 45: CMS tables, profiles.is_admin column, RLS policies, CHECK constraints, owner seed
-- Naming convention: {table}_{operation}_own / {table}_select_published
-- auth.uid() always wrapped in (SELECT auth.uid()) for InitPlan optimization
-- D-07: RESTRICT FKs on catalog-referencing columns — plain FK, NO SECURITY DEFINER (intentional)
-- D-17: path_type is text + CHECK, not a Postgres enum
--
-- CR-01 SCOPE NOTE: the RLS policies below ONLY apply to access via the Supabase
-- JS client (user-JWT authenticated as `authenticated`/`anon`). The Phase 45 CMS
-- DAL runs through the Drizzle `db` client — a DIRECT Postgres connection
-- (DATABASE_URL) that bypasses RLS entirely. For all Phase 45 code paths the
-- enforced gates are: assertOwner() in every Server Action (writes) and the
-- explicit WHERE status='published' in every public-read DAL function (draft
-- leaks). These RLS policies are a backstop for any FUTURE Supabase-JS-client
-- access path (e.g. Phase 47 public reads) — they are NOT an active layer for
-- the Drizzle DAL.

-- ============================================================================
-- Step 1 (D-01): Add is_admin column to profiles
-- Owner identity — single source of truth for RLS and assertOwner()
-- ============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ============================================================================
-- Step 2: Create the five CMS tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.curated_lists (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title        text NOT NULL,
  curator_name text NOT NULL,
  cover_url    text,
  intro_markdown text,
  status       text NOT NULL DEFAULT 'draft',
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS curated_lists_status_sort_idx ON public.curated_lists (status, sort_order);

CREATE TABLE IF NOT EXISTS public.curated_list_items (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id     uuid NOT NULL REFERENCES public.curated_lists(id) ON DELETE CASCADE,
  -- D-07: plain RESTRICT FK — DB refuses catalog delete when referenced; no trigger, no SECURITY DEFINER
  catalog_id  uuid NOT NULL REFERENCES public.watches_catalog(id) ON DELETE RESTRICT,
  commentary  text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curated_list_items_unique_pair UNIQUE (list_id, catalog_id)
);

CREATE INDEX IF NOT EXISTS curated_list_items_list_id_idx    ON public.curated_list_items (list_id);
CREATE INDEX IF NOT EXISTS curated_list_items_catalog_id_idx ON public.curated_list_items (catalog_id);

CREATE TABLE IF NOT EXISTS public.collection_paths (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  -- D-07: RESTRICT on seed catalog reference as well
  seed_catalog_id uuid NOT NULL REFERENCES public.watches_catalog(id) ON DELETE RESTRICT,
  status          text NOT NULL DEFAULT 'draft',
  -- D-16/D-17: text column; vocabulary enforced by CHECK below (not a Postgres enum)
  path_type       text NOT NULL,
  rationale       text,
  -- SEED-008: forward-compat source field for future computed paths
  source          text NOT NULL DEFAULT 'manual',
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collection_paths_status_idx ON public.collection_paths (status);

CREATE TABLE IF NOT EXISTS public.collection_path_nodes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  path_id     uuid NOT NULL REFERENCES public.collection_paths(id) ON DELETE CASCADE,
  -- D-07: RESTRICT — blocks catalog watch deletion when referenced by a path node
  catalog_id  uuid NOT NULL REFERENCES public.watches_catalog(id) ON DELETE RESTRICT,
  rationale   text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- WR-06: one node per slot. Gives setPathNode's ON CONFLICT a real target so
  -- re-setting a slot UPDATEs the existing node (rationale edits) instead of
  -- inserting a duplicate row in the same slot.
  CONSTRAINT collection_path_nodes_unique_slot UNIQUE (path_id, sort_order)
);

CREATE INDEX IF NOT EXISTS collection_path_nodes_path_id_idx    ON public.collection_path_nodes (path_id);
CREATE INDEX IF NOT EXISTS collection_path_nodes_catalog_id_idx ON public.collection_path_nodes (catalog_id);

CREATE TABLE IF NOT EXISTS public.cms_settings (
  id              integer PRIMARY KEY DEFAULT 1,
  pinned_list_id  uuid REFERENCES public.curated_lists(id) ON DELETE SET NULL,
  pin_expires_at  timestamptz,
  -- SEED-008: hero format discriminated union — 'featured_collector' forward-compat
  hero_format     text NOT NULL DEFAULT 'featured_list',
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Step 3 (D-16/D-17): path_type CHECK constraint — four-value vocabulary
-- text column + CHECK (not a Postgres enum — easier to evolve)
-- ============================================================================
ALTER TABLE public.collection_paths
  ADD CONSTRAINT collection_paths_path_type_check
  CHECK (path_type IN ('Going Deeper', 'Branching Out', 'Trading Up', 'Filling a Gap'));

-- ============================================================================
-- Step 4: cms_settings single-row enforcement + seed row
-- ============================================================================
ALTER TABLE public.cms_settings
  ADD CONSTRAINT cms_settings_single_row CHECK (id = 1);

INSERT INTO public.cms_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Step 5: Enable RLS on all five CMS tables
-- ============================================================================

ALTER TABLE public.curated_lists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curated_list_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_paths      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_path_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_settings          ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- curated_lists RLS
-- D-03: non-owner public read = published only; owner SELECT = all rows incl. drafts
-- D-02: write policies gate on EXISTS(profiles.is_admin)
-- ----------------------------------------------------------------------------

-- Non-owner public read: published only (D-03 layer 1)
CREATE POLICY curated_lists_select_published ON public.curated_lists
  FOR SELECT TO authenticated, anon
  USING (status = 'published');

-- Owner read: all rows including drafts (D-03 owner-scoped SELECT)
CREATE POLICY curated_lists_select_own ON public.curated_lists
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

-- Owner write (D-02)
CREATE POLICY curated_lists_insert_own ON public.curated_lists
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

CREATE POLICY curated_lists_update_own ON public.curated_lists
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

CREATE POLICY curated_lists_delete_own ON public.curated_lists
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

-- ----------------------------------------------------------------------------
-- curated_list_items RLS
-- No status column: owner-all SELECT + public authenticated/anon SELECT
-- (Phase 47 list-detail page reads items of published lists; parent status gate
--  is enforced at the DAL join layer — explicit WHERE status='published' in every
--  public-read DAL function; this policy allows the join to complete)
-- D-02: write policies gate on EXISTS(profiles.is_admin)
-- ----------------------------------------------------------------------------

-- Owner SELECT (all items)
CREATE POLICY curated_list_items_select_own ON public.curated_list_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

-- Public SELECT (authenticated + anon may read items; parent list status gate at DAL layer)
CREATE POLICY curated_list_items_select_public ON public.curated_list_items
  FOR SELECT TO authenticated, anon
  USING (true);

-- Owner write (D-02)
CREATE POLICY curated_list_items_insert_own ON public.curated_list_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

CREATE POLICY curated_list_items_update_own ON public.curated_list_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

CREATE POLICY curated_list_items_delete_own ON public.curated_list_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

-- ----------------------------------------------------------------------------
-- collection_paths RLS
-- D-03: non-owner public read = published only; owner SELECT = all rows incl. drafts
-- D-02: write policies gate on EXISTS(profiles.is_admin)
-- ----------------------------------------------------------------------------

-- Non-owner public read: published only (D-03 layer 1)
CREATE POLICY collection_paths_select_published ON public.collection_paths
  FOR SELECT TO authenticated, anon
  USING (status = 'published');

-- Owner read: all rows including drafts (D-03 owner-scoped SELECT)
CREATE POLICY collection_paths_select_own ON public.collection_paths
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

-- Owner write (D-02)
CREATE POLICY collection_paths_insert_own ON public.collection_paths
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

CREATE POLICY collection_paths_update_own ON public.collection_paths
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

CREATE POLICY collection_paths_delete_own ON public.collection_paths
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

-- ----------------------------------------------------------------------------
-- collection_path_nodes RLS
-- No status column: owner-all SELECT + public authenticated/anon SELECT
-- (Phase 47 path-detail page reads nodes; parent path status gate at DAL layer)
-- D-02: write policies gate on EXISTS(profiles.is_admin)
-- ----------------------------------------------------------------------------

-- Owner SELECT (all nodes)
CREATE POLICY collection_path_nodes_select_own ON public.collection_path_nodes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

-- Public SELECT (authenticated + anon; parent path status gate enforced at DAL layer)
CREATE POLICY collection_path_nodes_select_public ON public.collection_path_nodes
  FOR SELECT TO authenticated, anon
  USING (true);

-- Owner write (D-02)
CREATE POLICY collection_path_nodes_insert_own ON public.collection_path_nodes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

CREATE POLICY collection_path_nodes_update_own ON public.collection_path_nodes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

CREATE POLICY collection_path_nodes_delete_own ON public.collection_path_nodes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

-- ----------------------------------------------------------------------------
-- cms_settings RLS
-- No sensitive data — Phase 47 hero reads it; public SELECT allowed
-- Only owner may UPDATE
-- ----------------------------------------------------------------------------

-- Public SELECT (authenticated + anon may read hero config)
CREATE POLICY cms_settings_select_public ON public.cms_settings
  FOR SELECT TO authenticated, anon
  USING (true);

-- Owner UPDATE only (D-02; no INSERT/DELETE — single row enforced by CHECK)
CREATE POLICY cms_settings_update_own ON public.cms_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

-- ============================================================================
-- Step 6 (D-04): Seed the owner row is_admin = true
-- Keyed by email — cross-DB-stable (local/prod profile UUIDs diverge via seed)
-- ============================================================================
UPDATE public.profiles
   SET is_admin = true
 WHERE id = (SELECT id FROM auth.users WHERE email = 'twwaneka@gmail.com');

-- ============================================================================
-- Step 7: Sanity assertion — column + all 5 tables present
-- D-07 note: NO SECURITY DEFINER function — plain RESTRICT FK approach avoids it.
-- The SECDEF REVOKE pattern (project_supabase_secdef_grants) is intentionally
-- NOT used here; see 45-RESEARCH.md §Pitfalls "SECURITY DEFINER functions without REVOKE".
-- ============================================================================
DO $$
DECLARE
  col_count   integer;
  tbl_count   integer;
BEGIN
  -- Verify is_admin column
  SELECT count(*) INTO col_count
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'profiles'
     AND column_name  = 'is_admin';
  IF col_count <> 1 THEN
    RAISE EXCEPTION 'phase 45: profiles.is_admin column missing (expected 1, got %)', col_count;
  END IF;

  -- Verify all five CMS tables exist
  SELECT count(*) INTO tbl_count
    FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN (
       'curated_lists',
       'curated_list_items',
       'collection_paths',
       'collection_path_nodes',
       'cms_settings'
     );
  IF tbl_count <> 5 THEN
    RAISE EXCEPTION 'phase 45: expected 5 CMS tables, found %', tbl_count;
  END IF;
END $$;
