-- Phase 11 Migration 2/5: notifications table + RLS + dedup UNIQUE + self-notif CHECK
-- Source: 11-CONTEXT.md D-09..D-13, 11-RESEARCH.md §SQL Snippet 2
-- Requirements: NOTIF-01
-- Pitfalls addressed: B-3 (dedup UNIQUE), B-4 (recipient-only RLS SELECT), B-7 (cascade on user delete),
--                     B-9 (self-notif CHECK)
--
-- Single atomic transaction. If any step fails, the whole migration rolls back.
--
-- IDEMPOTENCE: Every non-transactional DDL is guarded so this migration is safe to
-- re-apply after `drizzle-kit push` has already created `notifications` + `notification_type`
-- from src/db/schema.ts. Matches Phase 8 precedent (ADD COLUMN IF NOT EXISTS).
-- Policies are dropped-then-created (standard Phase 10 shape) so they can re-apply safely.

BEGIN;

-- Enum: all four v3.0 notification types (D-09). Guarded because drizzle-kit push
-- may have already created it from `notificationTypeEnum` in src/db/schema.ts.
-- price_drop and trending_collector are stubs (no v3.0 write-path) — defined upfront so Phase 13
-- / future data-wiring phases do not need ALTER TYPE ADD VALUE (which cannot run in a transaction).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM (
      'follow',
      'watch_overlap',
      'price_drop',
      'trending_collector'
    );
  END IF;
END $$;

-- Table. IF NOT EXISTS so the statement no-ops when drizzle-kit push has already
-- materialized the columns. Note: if the table already exists, the inline
-- `CONSTRAINT notifications_no_self_notification` is NOT re-applied — a separate
-- guarded ALTER TABLE below handles that case.
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id    uuid              NULL     REFERENCES users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  payload     jsonb             NOT NULL DEFAULT '{}'::jsonb,
  read_at     timestamptz       NULL,
  created_at  timestamptz       NOT NULL DEFAULT now(),
  -- D-12 / Pitfall B-9: no self-notifications at the DB layer.
  -- NULL actor_id is allowed for system notifications (price_drop, trending_collector).
  CONSTRAINT notifications_no_self_notification
    CHECK (actor_id IS NULL OR actor_id != user_id)
);

-- Ensure the self-notif CHECK is present even if the table was created by drizzle-kit push
-- (Drizzle cannot express CHECK constraints in pg-core; the CONSTRAINT in CREATE TABLE
-- above only runs when the table is being created, not when it already exists).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'notifications_no_self_notification'
       AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_no_self_notification
      CHECK (actor_id IS NULL OR actor_id != user_id);
  END IF;
END $$;

-- Indexes — all guarded with IF NOT EXISTS so re-apply is a no-op.
-- Full index on user_id (recipient filter is the hot path for every DAL read)
CREATE INDEX IF NOT EXISTS notifications_user_id_idx
  ON notifications (user_id);

-- Partial index on unread rows — Phase 13 getUnreadCount() reads this.
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id)
  WHERE read_at IS NULL;

-- List/sort index for /notifications page (newest-first)
CREATE INDEX IF NOT EXISTS notifications_user_created_at_idx
  ON notifications (user_id, created_at DESC);

-- Watch-overlap dedup UNIQUE partial index (D-11, Pitfall B-3).
-- Semantics: "same recipient + same normalized watch + same UTC calendar day = one notification."
-- The 30-day window is enforced in the Phase 13 Server Action with a pre-insert query;
-- the DB only enforces per-day idempotence. Both layers needed per D-11.
-- Uses UTC-anchored day bucket to avoid timezone-boundary bugs in multi-timezone futures.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_watch_overlap_dedup
  ON notifications (
    user_id,
    (payload->>'watch_brand_normalized'),
    (payload->>'watch_model_normalized'),
    ((created_at AT TIME ZONE 'UTC')::date)
  )
  WHERE type = 'watch_overlap';

-- RLS (D-13). ENABLE is idempotent when already enabled.
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies: DROP-THEN-CREATE pattern (Phase 10 shape) so re-apply is safe.
-- Recipient-only SELECT (Pitfall B-4).
-- InitPlan-optimized: (SELECT auth.uid()) is cached once per statement.
DROP POLICY IF EXISTS notifications_select_recipient_only ON notifications;
CREATE POLICY notifications_select_recipient_only ON notifications
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Recipient-only UPDATE — used by "Mark all read" (read_at toggle).
-- WITH CHECK prevents a recipient from reassigning user_id to someone else.
DROP POLICY IF EXISTS notifications_update_recipient_only ON notifications;
CREATE POLICY notifications_update_recipient_only ON notifications
  FOR UPDATE
  TO authenticated
  USING      (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Explicitly NO INSERT policy for anon or authenticated (D-13).
-- All inserts go through Phase 13 Server Actions running under the service-role
-- Drizzle client, which bypasses RLS by design.
--
-- Explicitly NO DELETE policy. Deletions only happen via cascade from the
-- users table — users are never soft-deleted; if a user row is removed, their
-- notifications (as recipient AND as actor) are cascaded automatically.

COMMIT;
