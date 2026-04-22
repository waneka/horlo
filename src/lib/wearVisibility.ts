/**
 * Three-tier wear visibility (Phase 11 schema; Phase 12 DAL ripple).
 *
 * Mirrors the Postgres `wear_visibility` enum declared in
 * src/db/schema.ts:17-21. Kept as an explicit literal union (rather than
 * `typeof wearVisibilityEnum.enumValues[number]`) for clarity at call
 * sites that don't already import the schema.
 *
 * Per CONTEXT.md D-10, this type is the source of truth for the
 * `metadata.visibility` field carried in `watch_worn` activity rows
 * (see WatchWornMetadata in src/data/activities.ts after Phase 12
 * Plan 03).
 */
export type WearVisibility = 'public' | 'followers' | 'private'
