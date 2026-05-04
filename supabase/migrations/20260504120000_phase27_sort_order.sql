-- Phase 27 — drizzle-side schema: sort_order column on watches.
-- Ported from drizzle/0006_phase27_sort_order.sql so prod can apply via
-- `supabase db push --linked`.
-- Idempotent: ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS so
-- local re-applies are no-ops (drizzle-kit push has already run locally).

BEGIN;

ALTER TABLE "watches"
  ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "watches_user_sort_idx"
  ON "watches" (user_id, sort_order);

-- Per-user backfill: assign 0..N to each user's wishlist+grail rows in
-- created_at DESC order (newest watch = sort_order 0, matches current display
-- order so no visible change post-deploy). D-02.
--
-- WR-05 fix — guard the backfill so a re-run does NOT clobber user-driven
-- reorders. Skip if any wishlist/grail row already has sort_order > 0 —
-- a non-zero value can only have come from prior backfill execution OR
-- from the Phase 27 reorder UX writing the user's chosen order. Either
-- way, re-running would destroy state. The schema-side `ADD COLUMN
-- IF NOT EXISTS` keeps the migration idempotent on the schema axis;
-- this gate makes the data-write idempotent too.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM watches
     WHERE status IN ('wishlist', 'grail')
       AND sort_order > 0
     LIMIT 1
  ) THEN
    RAISE NOTICE 'Phase 27 wishlist+grail backfill: skipping (already applied; rows with sort_order > 0 exist)';
  ELSE
    WITH ranked AS (
      SELECT id,
             row_number() OVER (
               PARTITION BY user_id
               ORDER BY created_at DESC
             ) - 1 AS rn
        FROM watches
       WHERE status IN ('wishlist', 'grail')
    )
    UPDATE watches
       SET sort_order = ranked.rn
      FROM ranked
     WHERE watches.id = ranked.id;
  END IF;
END $$;

-- Symmetric backfill for owned/sold (D-02 — either is acceptable; we choose
-- per-user-per-status ranking for symmetry so a future Collection-tab reorder
-- (deferred per CONTEXT) inherits a clean starting state at zero cost).
--
-- WR-05 — same idempotency gate as wishlist+grail above.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM watches
     WHERE status IN ('owned', 'sold')
       AND sort_order > 0
     LIMIT 1
  ) THEN
    RAISE NOTICE 'Phase 27 owned+sold backfill: skipping (already applied; rows with sort_order > 0 exist)';
  ELSE
    WITH ranked_collection AS (
      SELECT id,
             row_number() OVER (
               PARTITION BY user_id, status
               ORDER BY created_at DESC
             ) - 1 AS rn
        FROM watches
       WHERE status IN ('owned', 'sold')
    )
    UPDATE watches
       SET sort_order = ranked_collection.rn
      FROM ranked_collection
     WHERE watches.id = ranked_collection.id;
  END IF;
END $$;

-- Post-migration assertion (Phase 11 / Phase 24 precedent): no duplicate
-- (user_id, sort_order) tuples in the wishlist+grail set. Owned/sold can
-- have collisions across statuses (PARTITION BY status above) — only the
-- wishlist+grail set must be tie-free because that's the set the reorder
-- UX writes to.
DO $$
DECLARE
  dup_users int;
BEGIN
  SELECT count(*) INTO dup_users
    FROM (
      SELECT user_id, sort_order, count(*) c
        FROM watches
       WHERE status IN ('wishlist', 'grail')
       GROUP BY user_id, sort_order
       HAVING count(*) > 1
    ) t;

  IF dup_users > 0 THEN
    RAISE EXCEPTION 'Phase 27 post-check: % (user_id, sort_order) duplicates in wishlist+grail backfill', dup_users;
  END IF;
END $$;

COMMIT;
