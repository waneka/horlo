-- Phase 55 Migration: notification like-dedup partial UNIQUE indexes (NOTIF-14)
-- Source: 55-CONTEXT.md D-01; 55-RESEARCH.md §Migration: Two New Dedup Indexes
-- Requirements: NOTIF-14 (DB-layer dedup for like notifications)
--
-- This migration is CREATE UNIQUE INDEX only (no ALTER TYPE ADD VALUE), so it CAN
-- run inside a BEGIN; ... COMMIT; transaction (unlike Phase 53 which was non-transactional
-- by necessity due to ALTER TYPE ADD VALUE restrictions).
--
-- Payload key alignment (LANDMINE — must match logger.ts WatchLikePayload/WearLikePayload exactly):
--   notifications_watch_like_dedup  → payload->>'watch_id'      (NOT 'watch', NOT 'id')
--   notifications_wear_like_dedup   → payload->>'wear_event_id' (NOT 'wear_id', NOT 'wear_event')
-- If the payload key does not match what logNotification() writes, the partial UNIQUE is
-- never triggered and ON CONFLICT DO NOTHING silently never dedups.
--
-- Dedup semantics: one like-notification per (recipient, actor, target-object).
-- Re-liking after an unlike sends the same payload → hits the index → ON CONFLICT DO NOTHING.
-- Unlike itself deletes the like row (DAL), NOT the notification row (inbox stays clean).

BEGIN;

-- notifications_watch_like_dedup: one like-notification per (recipient, actor, watch)
-- Mirrors the Phase 11 notifications_watch_overlap_dedup pattern (supabase/migrations/20260423000002_phase11_notifications.sql:85-92).
-- Key: (user_id, actor_id, watch_id-from-payload) WHERE type = 'watch_like'
CREATE UNIQUE INDEX IF NOT EXISTS notifications_watch_like_dedup
  ON notifications (user_id, actor_id, (payload->>'watch_id'))
  WHERE type = 'watch_like';

-- notifications_wear_like_dedup: one like-notification per (recipient, actor, wear event)
-- payload key is wear_event_id (column-style), NOT 'wear_id' or 'wear_event'.
-- Key: (user_id, actor_id, wear_event_id-from-payload) WHERE type = 'wear_like'
CREATE UNIQUE INDEX IF NOT EXISTS notifications_wear_like_dedup
  ON notifications (user_id, actor_id, (payload->>'wear_event_id'))
  WHERE type = 'wear_like';

COMMIT;
