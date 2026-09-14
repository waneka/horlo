-- Phase 85 — Collection lifecycle: previously_owned status + disposal metadata (LIFE-01, LIFE-02)
--
-- Decisions (85-CONTEXT.md): D-01 replaces the legacy watches.status = 'sold' value with
-- 'previously_owned'. D-02 adds three nullable disposal columns to watches (disposal_reason,
-- sell_price, disposal_date) — NOT on divestments, which is catalog_id-keyed and cannot
-- identify which specific watch copy was disposed of. D-03 leaves the divestments table,
-- its rows, its RLS policies and its FKs untouched — no DROP TABLE / DROP TYPE / DROP COLUMN /
-- DROP CONSTRAINT anywhere in this file. No pg_depend query is needed because nothing is
-- being dropped.
--
-- watches.status has no DB-level CHECK constraint and no pgEnum type today — it is a plain
-- Drizzle text('status', { enum: [...] }) column (TypeScript-only narrowing). The rename
-- therefore requires zero DDL on the status column itself, only a data UPDATE.
--
-- Idempotent by construction: local dev applies this file directly via
-- `docker exec -i supabase_db_horlo psql ... < this file` (drizzle-kit push cannot be used —
-- it crashes on the local pg_net domain CHECK introspection bug, see
-- .planning/todos/*/drizzle-kit-pg-net-introspection-bug.md); prod applies the identical file
-- via `supabase db push --linked` (operator-gated in Plan 85-11). Every step below is guarded
-- (IF NOT EXISTS / conditional DO block / idempotent UPDATE WHERE) so re-running this file
-- twice against the same database is a no-op the second time and both runs pass every
-- post-flight assertion.

BEGIN;

-- ============================================================================
-- STEP 0: Pre-flight — count rows that will be migrated, and abort if the data
-- doesn't match this migration's assumptions (unknown status values).
-- ============================================================================
DO $$
DECLARE
  sold_count integer;
  unknown_count integer;
BEGIN
  SELECT count(*) INTO sold_count FROM watches WHERE status = 'sold';
  RAISE NOTICE 'Phase 85: migrating % sold rows to previously_owned', sold_count;

  SELECT count(*) INTO unknown_count
    FROM watches
   WHERE status NOT IN ('owned', 'wishlist', 'sold', 'grail', 'previously_owned');

  IF unknown_count > 0 THEN
    RAISE EXCEPTION 'Phase 85 aborted — % watches rows have an unrecognized status value outside owned/wishlist/sold/grail/previously_owned', unknown_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 1: disposal_reason pgEnum (LIFE-02 / D-02), guarded so a re-run is a no-op.
-- Value order is exactly sold|lost|gifted|stolen|traded (D-02) — UI ordering
-- (Sold, Traded, Gifted, Lost, Stolen per UI-SPEC) lives in src/lib/constants.ts,
-- not in this type.
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'disposal_reason' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.disposal_reason AS ENUM ('sold', 'lost', 'gifted', 'stolen', 'traded');
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Three nullable disposal columns on watches (LIFE-02 / D-02). No
-- defaults, all nullable. Nothing added to divestments (D-02 / D-03).
-- ============================================================================
ALTER TABLE watches
  ADD COLUMN IF NOT EXISTS disposal_reason disposal_reason,
  ADD COLUMN IF NOT EXISTS sell_price real,
  ADD COLUMN IF NOT EXISTS disposal_date date;

-- ============================================================================
-- STEP 3: Backfill (D-01) — in-place UPDATE, no delete/reinsert. Idempotent:
-- once every sold row is migrated, the WHERE matches zero rows on a re-run.
-- ============================================================================
UPDATE watches
   SET status = 'previously_owned',
       disposal_reason = COALESCE(disposal_reason, 'sold'),
       updated_at = now()
 WHERE status = 'sold';

-- ============================================================================
-- STEP 4: RLS — comments_select / comments_insert (LIFE-01 D-01 follow-through).
-- Copied verbatim from 20260522000000_phase53_likes_comments_rls.sql (including
-- inline comments, TO authenticated, author_id guard, mutual-follow EXISTS
-- clauses) with only the literal status list changed: 'sold' -> 'previously_owned'.
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
            w.status IN ('owned', 'previously_owned', 'grail')
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
              w.status IN ('owned', 'previously_owned', 'grail')
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

-- ============================================================================
-- STEP 5: Post-flight assertions. Each predicate is DIFFERENT from the
-- operation it checks (project memory: post-flight must not reuse the gated
-- operation's own WHERE clause).
-- ============================================================================

-- (a) Broader existence check than "status = 'sold'": no watches row may carry
-- any status outside the four that remain valid post-migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM watches
     WHERE status NOT IN ('owned', 'wishlist', 'grail', 'previously_owned')
  ) THEN
    RAISE EXCEPTION 'Phase 85 failed — watches rows exist with a status outside owned/wishlist/grail/previously_owned';
  END IF;
END $$;

-- (b) Every previously_owned row must carry a disposal_reason (D-01 backfill
-- correctness) — a different predicate from the UPDATE's own WHERE.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM watches
     WHERE status = 'previously_owned' AND disposal_reason IS NULL
  ) THEN
    RAISE EXCEPTION 'Phase 85 failed — previously_owned watches rows exist with disposal_reason IS NULL';
  END IF;
END $$;

-- (c) information_schema shape assertion for the 3 new columns.
DO $$
DECLARE
  col_count integer;
  bad_count integer;
BEGIN
  SELECT count(*) INTO col_count
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'watches'
     AND column_name IN ('disposal_reason', 'sell_price', 'disposal_date');

  IF col_count <> 3 THEN
    RAISE EXCEPTION 'Phase 85 failed — expected 3 disposal columns on watches, found %', col_count;
  END IF;

  SELECT count(*) INTO bad_count
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'watches'
     AND (
       (column_name = 'disposal_reason' AND (is_nullable <> 'YES' OR udt_name <> 'disposal_reason'))
       OR (column_name = 'sell_price' AND (is_nullable <> 'YES' OR udt_name <> 'float4'))
       OR (column_name = 'disposal_date' AND (is_nullable <> 'YES' OR udt_name <> 'date'))
     );

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Phase 85 failed — % disposal column(s) have an unexpected type or nullability', bad_count;
  END IF;
END $$;

-- (d) comments RLS text no longer mentions 'sold' and now mentions
-- 'previously_owned' on both policies.
DO $$
DECLARE
  still_sold_count integer;
  has_previously_owned_count integer;
BEGIN
  SELECT count(*) INTO still_sold_count
    FROM pg_policies
   WHERE tablename = 'comments'
     AND policyname IN ('comments_select', 'comments_insert')
     AND (COALESCE(qual, '') LIKE '%''sold''%' OR COALESCE(with_check, '') LIKE '%''sold''%');

  IF still_sold_count > 0 THEN
    RAISE EXCEPTION 'Phase 85 failed — % comments RLS policy row(s) still reference the sold literal', still_sold_count;
  END IF;

  SELECT count(*) INTO has_previously_owned_count
    FROM pg_policies
   WHERE tablename = 'comments'
     AND policyname IN ('comments_select', 'comments_insert')
     AND (COALESCE(qual, '') LIKE '%previously_owned%' OR COALESCE(with_check, '') LIKE '%previously_owned%');

  IF has_previously_owned_count = 0 THEN
    RAISE EXCEPTION 'Phase 85 failed — no comments RLS policy row references previously_owned';
  END IF;
END $$;

COMMIT;
