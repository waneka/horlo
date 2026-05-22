/**
 * Notification payload types — discriminated union over notification_type.
 *
 * Shapes locked by CONTEXT.md D-20 (stub copy) + <specifics> §"payload jsonb shape".
 * Phase 13 writes follow and watch_overlap only.
 * Phase 24 (DEBT-05): PriceDropPayload and TrendingPayload removed — stubs deleted.
 * Phase 55 (NOTIF-13): WatchLikePayload, WearLikePayload, WatchCommentPayload,
 *   WearCommentPayload added. Payload key alignment is load-bearing — must match
 *   the dedup index expressions from migration 20260522000002 exactly.
 */

export interface FollowPayload {
  actor_username: string
  actor_display_name: string | null
}

export interface WatchOverlapPayload {
  actor_username: string
  actor_display_name: string | null
  watch_id: string
  watch_brand: string
  watch_model: string
  watch_brand_normalized: string // LOWER(TRIM(brand)) — feeds the partial UNIQUE dedup index
  watch_model_normalized: string // LOWER(TRIM(model))
}

export interface WatchLikePayload {
  actor_username: string
  actor_display_name: string | null
  watch_id: string           // MUST match payload->>'watch_id' in notifications_watch_like_dedup (migration 20260522000002) — one character off and the partial index never fires
  watch_brand: string
  watch_model: string
}

export interface WearLikePayload {
  actor_username: string
  actor_display_name: string | null
  wear_event_id: string      // MUST match payload->>'wear_event_id' in notifications_wear_like_dedup (migration 20260522000002) — NOT wear_id or wear_event
  watch_brand: string        // the watch worn at this event
  watch_model: string
}

export interface WatchCommentPayload {
  actor_username: string
  actor_display_name: string | null
  watch_id: string
  watch_brand: string
  watch_model: string
  comment_id: string
  comment_preview: string    // body.slice(0, 120)
}

export interface WearCommentPayload {
  actor_username: string
  actor_display_name: string | null
  wear_event_id: string      // column-style name, consistent with WearLikePayload — NOT wear_id
  watch_brand: string
  watch_model: string
  comment_id: string
  comment_preview: string    // body.slice(0, 120)
}

export type NotificationPayload =
  | FollowPayload
  | WatchOverlapPayload
  | WatchLikePayload
  | WearLikePayload
  | WatchCommentPayload
  | WearCommentPayload
