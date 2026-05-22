-- Phase 53 — Tables + RLS + profile_settings columns (v6.0 social: likes + comments)
-- Source: 53-CONTEXT.md D-01..D-10; 53-RESEARCH.md §Architecture Patterns
-- Sibling Drizzle schema: src/db/schema.ts (column shapes only — no RLS, no GRANT, no DO $$)
--
-- Threats mitigated:
--   SEC-01 (anon SELECT on watch_likes/wear_likes/comments — blocked by REVOKE + TO authenticated)
--   SEC-06 (orphan likes/comments on watch/wear delete — blocked by ON DELETE CASCADE)
--   LIKE-05 (duplicate likes — blocked by UNIQUE(user_id, watch_id/wear_event_id))
--
-- Phase 53 is purely ADDITIVE — no DROP, no ALTER COLUMN type-change.
--
-- Per memory rule project_drizzle_supabase_db_mismatch.md:
--   drizzle-kit push is LOCAL ONLY; prod uses supabase db push --linked
--   Do NOT run drizzle-kit push before this file is applied (Plan 02 applies it).

BEGIN;

-- ============================================================================
-- STEP 1: CREATE TABLE watch_likes (D-01, LIKE-05, SEC-06)
-- IF NOT EXISTS: idempotent when drizzle-kit push has already materialized the table.
-- UNIQUE inline: covered by DO $$ assertion + the Drizzle unique() definition.
-- ============================================================================
CREATE TABLE IF NOT EXISTS watch_likes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  watch_id    uuid        NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT watch_likes_unique_pair UNIQUE (user_id, watch_id)
);

-- ============================================================================
-- STEP 2: CREATE TABLE wear_likes (D-01, LIKE-05, SEC-06)
-- ============================================================================
CREATE TABLE IF NOT EXISTS wear_likes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  wear_event_id  uuid        NOT NULL REFERENCES wear_events(id)  ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wear_likes_unique_pair UNIQUE (user_id, wear_event_id)
);

-- ============================================================================
-- STEP 3: CREATE TABLE comments (D-02, D-04, SEC-06)
-- Two nullable FKs: exactly one must be non-null (CHECK comments_exactly_one_target).
-- Body constraints at DB layer (D-04, CMNT-04): length <= 500 AND non-blank.
-- CHECK inline: only fires on CREATE; the DO $$ block below re-adds if missing
-- (covers the case where drizzle-kit push created the table without CHECKs).
-- ============================================================================
CREATE TABLE IF NOT EXISTS comments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id      uuid        NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  watch_id       uuid                 REFERENCES watches(id)      ON DELETE CASCADE,
  wear_event_id  uuid                 REFERENCES wear_events(id)  ON DELETE CASCADE,
  body           text        NOT NULL,
  edited_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comments_exactly_one_target
    CHECK ((watch_id IS NULL) <> (wear_event_id IS NULL)),
  CONSTRAINT comments_body_length
    CHECK (char_length(body) <= 500 AND btrim(body) <> '')
);

-- ============================================================================
-- STEP 4: Idempotent CHECK constraint guards (phase11_notifications lines 53-64 pattern)
-- Ensures the CHECKs are present even if the table was created by drizzle-kit push
-- (Drizzle 0.45.2 cannot express CHECK constraints in pg-core DSL).
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'comments_exactly_one_target'
       AND conrelid = 'public.comments'::regclass
  ) THEN
    ALTER TABLE comments
      ADD CONSTRAINT comments_exactly_one_target
      CHECK ((watch_id IS NULL) <> (wear_event_id IS NULL));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'comments_body_length'
       AND conrelid = 'public.comments'::regclass
  ) THEN
    ALTER TABLE comments
      ADD CONSTRAINT comments_body_length
      CHECK (char_length(body) <= 500 AND btrim(body) <> '');
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Indexes (IF NOT EXISTS — idempotent re-apply)
-- watch_likes / wear_likes: watch_id and wear_event_id for GROUP BY count queries;
--   user_id for actor lookup ("has this user liked?").
-- comments: partial composite (target_id, created_at ASC) for newest-first reads;
--   author_id for edit/delete permission + author affordance display.
-- ============================================================================
CREATE INDEX IF NOT EXISTS watch_likes_watch_id_idx     ON watch_likes(watch_id);
CREATE INDEX IF NOT EXISTS watch_likes_user_id_idx      ON watch_likes(user_id);
CREATE INDEX IF NOT EXISTS wear_likes_wear_event_id_idx ON wear_likes(wear_event_id);
CREATE INDEX IF NOT EXISTS wear_likes_user_id_idx       ON wear_likes(user_id);

-- Partial composite indexes (D-11 grandfather; newest-first list reads)
CREATE INDEX IF NOT EXISTS comments_watch_id_created_at_idx
  ON comments(watch_id, created_at ASC)
  WHERE watch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS comments_wear_event_id_created_at_idx
  ON comments(wear_event_id, created_at ASC)
  WHERE wear_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS comments_author_id_idx ON comments(author_id);

-- ============================================================================
-- STEP 6: updated_at trigger for comments (RESEARCH Open Question 2 recommendation)
-- Mirrors Phase 37 divestments_set_updated_at() pattern (lines 84-88).
-- BEFORE UPDATE sets NEW.updated_at := now() on every row UPDATE.
-- ============================================================================
CREATE OR REPLACE FUNCTION comments_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS comments_set_updated_at_trg ON comments;
CREATE TRIGGER comments_set_updated_at_trg BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION comments_set_updated_at();

-- ============================================================================
-- STEP 7: ENABLE ROW LEVEL SECURITY (ENABLE is idempotent when already enabled)
-- ============================================================================
ALTER TABLE watch_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wear_likes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments    ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 8: RLS POLICIES — watch_likes (3 policies)
-- DROP-THEN-CREATE pattern (safe re-apply; phase11_notifications lines 94-113).
-- All auth.uid() wrapped as (SELECT auth.uid()) — InitPlan optimization convention
-- per supabase/migrations/20260420000001_social_tables_rls.sql lines 11-27.
-- GATE-02 asymmetry: likes are open to all authenticated users on ALL watch
-- statuses including wishlist (D-08). No watches subquery in likes policies.
-- ============================================================================
DROP POLICY IF EXISTS watch_likes_select ON watch_likes;
CREATE POLICY watch_likes_select ON watch_likes
  FOR SELECT TO authenticated
  USING (true);                                            -- GATE-02: likes open to all authed (D-08)

DROP POLICY IF EXISTS watch_likes_insert ON watch_likes;
CREATE POLICY watch_likes_insert ON watch_likes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));              -- actor must be the liker (T-53-06)

DROP POLICY IF EXISTS watch_likes_delete ON watch_likes;
CREATE POLICY watch_likes_delete ON watch_likes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));                   -- only the liker can unlike

-- ============================================================================
-- STEP 9: RLS POLICIES — wear_likes (3 policies, identical shape to watch_likes)
-- ============================================================================
DROP POLICY IF EXISTS wear_likes_select ON wear_likes;
CREATE POLICY wear_likes_select ON wear_likes
  FOR SELECT TO authenticated
  USING (true);                                            -- GATE-02: likes open to all authed (D-08)

DROP POLICY IF EXISTS wear_likes_insert ON wear_likes;
CREATE POLICY wear_likes_insert ON wear_likes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));              -- actor must be the liker

DROP POLICY IF EXISTS wear_likes_delete ON wear_likes;
CREATE POLICY wear_likes_delete ON wear_likes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));                   -- only the liker can unlike

-- ============================================================================
-- STEP 10: RLS POLICIES — comments (4 policies)
-- D-06: mutual-follow gate in BOTH SELECT USING and INSERT WITH CHECK clauses.
-- Gate structure (RESEARCH Pattern 2, lines 218-279):
--   wear_event targets: open to all authenticated (no gate needed)
--   watch targets:
--     - owned/sold/grail: readable/commentable by all authenticated
--     - owner always: w.user_id = (SELECT auth.uid()) — GATE-04
--     - wishlist: requires bidirectional follows EXISTS (mutual-follow gate, GATE-02)
-- D-07 / SEC-04: inline follows EXISTS subquery — zero SECDEF helpers introduced.
-- Viable because follows_select_all TO authenticated USING(true) exists
-- (verified: supabase/migrations/20260420000001_social_tables_rls.sql:17).
-- ============================================================================
DROP POLICY IF EXISTS comments_select ON comments;
CREATE POLICY comments_select ON comments
  FOR SELECT TO authenticated
  USING (
    -- wear_event target: open to all authenticated (no status gate on wear events)
    wear_event_id IS NOT NULL
    OR
    -- watch target: gate by watch status + mutual-follow for wishlist
    (
      watch_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM watches w WHERE w.id = comments.watch_id
          AND (
            w.status IN ('owned', 'sold', 'grail')
            OR w.user_id = (SELECT auth.uid())              -- owner always sees their own (GATE-04)
            OR (
              w.status = 'wishlist'
              AND EXISTS (
                SELECT 1 FROM follows
                 WHERE follower_id = (SELECT auth.uid()) AND following_id = w.user_id
              )
              AND EXISTS (
                SELECT 1 FROM follows
                 WHERE follower_id = w.user_id AND following_id = (SELECT auth.uid())
              )
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS comments_insert ON comments;
CREATE POLICY comments_insert ON comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())                        -- mass-assignment guard (T-53-06)
    AND (
      -- wear_event target: open to all authenticated
      wear_event_id IS NOT NULL
      OR
      -- watch target: same mutual-follow gate as SELECT (D-06 both-clause requirement)
      (
        watch_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM watches w WHERE w.id = comments.watch_id
            AND (
              w.status IN ('owned', 'sold', 'grail')
              OR w.user_id = (SELECT auth.uid())            -- owner can always comment on own watch
              OR (
                w.status = 'wishlist'
                AND EXISTS (
                  SELECT 1 FROM follows
                   WHERE follower_id = (SELECT auth.uid()) AND following_id = w.user_id
                )
                AND EXISTS (
                  SELECT 1 FROM follows
                   WHERE follower_id = w.user_id AND following_id = (SELECT auth.uid())
                )
              )
            )
        )
      )
    )
  );

DROP POLICY IF EXISTS comments_update ON comments;
CREATE POLICY comments_update ON comments
  FOR UPDATE TO authenticated
  USING      (author_id = (SELECT auth.uid()))             -- only author can edit
  WITH CHECK (author_id = (SELECT auth.uid()));            -- mass-assignment guard on edit

DROP POLICY IF EXISTS comments_delete ON comments;
CREATE POLICY comments_delete ON comments
  FOR DELETE TO authenticated
  USING (author_id = (SELECT auth.uid()));                 -- only author can delete

-- ============================================================================
-- STEP 11: GRANT + REVOKE (phase37 lines 120-126 exact idiom — verified)
-- Explicit GRANT to authenticated; explicit REVOKE from anon AND public.
-- REVOKE FROM PUBLIC alone is insufficient — Supabase auto-grants directly to anon.
-- The DO $$ assertion below confirms has_table_privilege('anon', ...) = false.
-- ============================================================================
GRANT SELECT, INSERT, DELETE          ON watch_likes TO authenticated;
REVOKE ALL ON watch_likes FROM anon;
REVOKE ALL ON watch_likes FROM public;

GRANT SELECT, INSERT, DELETE          ON wear_likes  TO authenticated;
REVOKE ALL ON wear_likes  FROM anon;
REVOKE ALL ON wear_likes  FROM public;

GRANT SELECT, INSERT, UPDATE, DELETE  ON comments    TO authenticated;
REVOKE ALL ON comments    FROM anon;
REVOKE ALL ON comments    FROM public;

-- ============================================================================
-- STEP 12: profile_settings ADD COLUMN (D-10; phase13 lines 14-33 exact pattern)
-- IF NOT EXISTS: idempotent when drizzle-kit push has already added the column.
-- NOT NULL DEFAULT true: Postgres fills default into existing rows immediately.
-- Belt-and-suspenders UPDATE: covers the case where drizzle-kit push ran first
-- with a different default (phase13 lines 31-33 pattern).
-- ============================================================================
ALTER TABLE profile_settings
  ADD COLUMN IF NOT EXISTS notify_on_like    boolean NOT NULL DEFAULT true;

ALTER TABLE profile_settings
  ADD COLUMN IF NOT EXISTS notify_on_comment boolean NOT NULL DEFAULT true;

UPDATE profile_settings
   SET notify_on_like    = true
 WHERE notify_on_like IS NULL;

UPDATE profile_settings
   SET notify_on_comment = true
 WHERE notify_on_comment IS NULL;

-- ============================================================================
-- STEP 13: Final DO $$ assertion block (phase37 lines 133-239 structure)
-- Verifies every invariant before COMMIT. Any failure raises EXCEPTION and the
-- entire transaction rolls back atomically.
-- Exception message format: 'Phase 53 failed -- <invariant> (<REQ>)'
-- ============================================================================
DO $$
DECLARE
  -- Table existence
  watch_likes_table_exists        boolean;
  wear_likes_table_exists         boolean;
  comments_table_exists           boolean;
  -- FK cascade checks (confdeltype = 'c' means ON DELETE CASCADE)
  watch_likes_user_fk_cascade     boolean;
  watch_likes_watch_fk_cascade    boolean;
  wear_likes_user_fk_cascade      boolean;
  wear_likes_wear_fk_cascade      boolean;
  comments_author_fk_cascade      boolean;
  comments_watch_fk_cascade       boolean;
  comments_wear_fk_cascade        boolean;
  -- UNIQUE constraint checks
  watch_likes_unique_exists       boolean;
  wear_likes_unique_exists        boolean;
  -- CHECK constraint checks
  comments_one_target_check       boolean;
  comments_body_check             boolean;
  -- Policy count checks
  watch_likes_policy_count        int;
  wear_likes_policy_count         int;
  comments_policy_count           int;
  -- Anon privilege checks (SEC-01)
  anon_cannot_select_watch_likes  boolean;
  anon_cannot_select_wear_likes   boolean;
  anon_cannot_select_comments     boolean;
  -- profile_settings column checks
  notify_on_like_col_exists       boolean;
  notify_on_comment_col_exists    boolean;
BEGIN
  -- Table existence (information_schema pattern from phase37 lines 186-189)
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'watch_likes')
    INTO watch_likes_table_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'wear_likes')
    INTO wear_likes_table_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'comments')
    INTO comments_table_exists;

  -- FK cascade types (confdeltype = 'c'; phase37 lines 204-218 pattern)
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f' AND c.conrelid = 'public.watch_likes'::regclass
      AND a.attname = 'user_id' AND c.confdeltype = 'c'
  ) INTO watch_likes_user_fk_cascade;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f' AND c.conrelid = 'public.watch_likes'::regclass
      AND a.attname = 'watch_id' AND c.confdeltype = 'c'
  ) INTO watch_likes_watch_fk_cascade;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f' AND c.conrelid = 'public.wear_likes'::regclass
      AND a.attname = 'user_id' AND c.confdeltype = 'c'
  ) INTO wear_likes_user_fk_cascade;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f' AND c.conrelid = 'public.wear_likes'::regclass
      AND a.attname = 'wear_event_id' AND c.confdeltype = 'c'
  ) INTO wear_likes_wear_fk_cascade;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f' AND c.conrelid = 'public.comments'::regclass
      AND a.attname = 'author_id' AND c.confdeltype = 'c'
  ) INTO comments_author_fk_cascade;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f' AND c.conrelid = 'public.comments'::regclass
      AND a.attname = 'watch_id' AND c.confdeltype = 'c'
  ) INTO comments_watch_fk_cascade;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f' AND c.conrelid = 'public.comments'::regclass
      AND a.attname = 'wear_event_id' AND c.confdeltype = 'c'
  ) INTO comments_wear_fk_cascade;

  -- UNIQUE constraint existence (LIKE-05)
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'watch_likes_unique_pair'
       AND conrelid = 'public.watch_likes'::regclass
  ) INTO watch_likes_unique_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'wear_likes_unique_pair'
       AND conrelid = 'public.wear_likes'::regclass
  ) INTO wear_likes_unique_exists;

  -- CHECK constraint existence (D-02, D-04)
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'comments_exactly_one_target'
       AND conrelid = 'public.comments'::regclass
  ) INTO comments_one_target_check;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'comments_body_length'
       AND conrelid = 'public.comments'::regclass
  ) INTO comments_body_check;

  -- Policy counts (phase37 lines 191-193 pattern)
  SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'watch_likes'
    INTO watch_likes_policy_count;

  SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'wear_likes'
    INTO wear_likes_policy_count;

  SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'comments'
    INTO comments_policy_count;

  -- Anon privilege checks (phase37 lines 200-201 exact idiom — SEC-01)
  SELECT NOT has_table_privilege('anon', 'public.watch_likes', 'SELECT')
    INTO anon_cannot_select_watch_likes;
  SELECT NOT has_table_privilege('anon', 'public.wear_likes', 'SELECT')
    INTO anon_cannot_select_wear_likes;
  SELECT NOT has_table_privilege('anon', 'public.comments', 'SELECT')
    INTO anon_cannot_select_comments;

  -- profile_settings column checks (phase13 lines 52-73 pattern)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'profile_settings'
       AND column_name = 'notify_on_like'
       AND data_type = 'boolean'
       AND is_nullable = 'NO'
       AND column_default = 'true'
  ) INTO notify_on_like_col_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'profile_settings'
       AND column_name = 'notify_on_comment'
       AND data_type = 'boolean'
       AND is_nullable = 'NO'
       AND column_default = 'true'
  ) INTO notify_on_comment_col_exists;

  -- Raise on any failure (phase37 lines 221-238 pattern)
  IF NOT watch_likes_table_exists
    THEN RAISE EXCEPTION 'Phase 53 failed -- watch_likes table missing'; END IF;
  IF NOT wear_likes_table_exists
    THEN RAISE EXCEPTION 'Phase 53 failed -- wear_likes table missing'; END IF;
  IF NOT comments_table_exists
    THEN RAISE EXCEPTION 'Phase 53 failed -- comments table missing'; END IF;
  IF NOT watch_likes_user_fk_cascade
    THEN RAISE EXCEPTION 'Phase 53 failed -- watch_likes.user_id FK is not ON DELETE CASCADE (SEC-06)'; END IF;
  IF NOT watch_likes_watch_fk_cascade
    THEN RAISE EXCEPTION 'Phase 53 failed -- watch_likes.watch_id FK is not ON DELETE CASCADE (SEC-06)'; END IF;
  IF NOT wear_likes_user_fk_cascade
    THEN RAISE EXCEPTION 'Phase 53 failed -- wear_likes.user_id FK is not ON DELETE CASCADE (SEC-06)'; END IF;
  IF NOT wear_likes_wear_fk_cascade
    THEN RAISE EXCEPTION 'Phase 53 failed -- wear_likes.wear_event_id FK is not ON DELETE CASCADE (SEC-06)'; END IF;
  IF NOT comments_author_fk_cascade
    THEN RAISE EXCEPTION 'Phase 53 failed -- comments.author_id FK is not ON DELETE CASCADE (SEC-06)'; END IF;
  IF NOT comments_watch_fk_cascade
    THEN RAISE EXCEPTION 'Phase 53 failed -- comments.watch_id FK is not ON DELETE CASCADE (SEC-06)'; END IF;
  IF NOT comments_wear_fk_cascade
    THEN RAISE EXCEPTION 'Phase 53 failed -- comments.wear_event_id FK is not ON DELETE CASCADE (SEC-06)'; END IF;
  IF NOT watch_likes_unique_exists
    THEN RAISE EXCEPTION 'Phase 53 failed -- watch_likes_unique_pair UNIQUE constraint missing (LIKE-05)'; END IF;
  IF NOT wear_likes_unique_exists
    THEN RAISE EXCEPTION 'Phase 53 failed -- wear_likes_unique_pair UNIQUE constraint missing (LIKE-05)'; END IF;
  IF NOT comments_one_target_check
    THEN RAISE EXCEPTION 'Phase 53 failed -- comments_exactly_one_target CHECK constraint missing (D-02)'; END IF;
  IF NOT comments_body_check
    THEN RAISE EXCEPTION 'Phase 53 failed -- comments_body_length CHECK constraint missing (D-04)'; END IF;
  IF watch_likes_policy_count <> 3
    THEN RAISE EXCEPTION 'Phase 53 failed -- watch_likes expected 3 RLS policies, got %', watch_likes_policy_count; END IF;
  IF wear_likes_policy_count <> 3
    THEN RAISE EXCEPTION 'Phase 53 failed -- wear_likes expected 3 RLS policies, got %', wear_likes_policy_count; END IF;
  IF comments_policy_count <> 4
    THEN RAISE EXCEPTION 'Phase 53 failed -- comments expected 4 RLS policies, got %', comments_policy_count; END IF;
  IF NOT anon_cannot_select_watch_likes
    THEN RAISE EXCEPTION 'Phase 53 failed -- anon has SELECT on watch_likes (SEC-01 broken)'; END IF;
  IF NOT anon_cannot_select_wear_likes
    THEN RAISE EXCEPTION 'Phase 53 failed -- anon has SELECT on wear_likes (SEC-01 broken)'; END IF;
  IF NOT anon_cannot_select_comments
    THEN RAISE EXCEPTION 'Phase 53 failed -- anon has SELECT on comments (SEC-01 broken)'; END IF;
  IF NOT notify_on_like_col_exists
    THEN RAISE EXCEPTION 'Phase 53 failed -- profile_settings.notify_on_like column missing or wrong shape (D-10)'; END IF;
  IF NOT notify_on_comment_col_exists
    THEN RAISE EXCEPTION 'Phase 53 failed -- profile_settings.notify_on_comment column missing or wrong shape (D-10)'; END IF;
END $$;

COMMIT;
