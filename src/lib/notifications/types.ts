/**
 * Notification payload types — discriminated union over notification_type.
 *
 * Shapes locked by CONTEXT.md D-20 (stub copy) + <specifics> §"payload jsonb shape".
 * Phase 13 writes follow and watch_overlap only.
 * Phase 24 (DEBT-05): PriceDropPayload and TrendingPayload removed — stubs deleted.
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

export type NotificationPayload = FollowPayload | WatchOverlapPayload
