---
phase: 55-server-actions-notification-dedup
plan: "02"
subsystem: notifications
status: complete
tags: [migration, dedup, notifications, actionTypes, WR-03]
dependency_graph:
  requires: [55-01]
  provides: [55-03, 55-04, 55-05]
  affects: [notifications, actionTypes]
tech_stack:
  added: []
  patterns:
    - partial UNIQUE index (same as Phase 11 notifications_watch_overlap_dedup)
    - presence-based DO $$ assertion (replaces exact-count WR-03 assertion)
    - optional discriminant code field on ActionResult failure branch
key_files:
  created:
    - supabase/migrations/20260522000002_phase55_notif_like_dedup.sql
  modified:
    - supabase/migrations/20260522000001_phase53_notification_enum.sql
    - src/lib/actionTypes.ts
decisions:
  - "Transactional BEGIN/COMMIT wrapper on Phase 55 migration (CREATE UNIQUE INDEX only — no ALTER TYPE ADD VALUE so transaction is safe)"
  - "Plain CREATE UNIQUE INDEX (not CONCURRENTLY) — CONCURRENTLY cannot run inside BEGIN/COMMIT; no existing like-notification rows to lock"
  - "Presence-of-4-values check (WR-03 fix) replaces exact enum_count <> 6; in-place edit of Phase 53 file (local reset correctness only)"
  - "code?: string (not tighter union) on ActionResult failure branch — least-disruptive; callers that don't check code are unaffected"
metrics:
  duration: "~10m"
  completed: "2026-05-22"
  tasks_completed: 3
  files_changed: 3
---

# Phase 55 Plan 02: Dedup Index Migration + WR-03 Fix + ActionResult code Field

One-liner: Partial UNIQUE dedup indexes on notifications for like types, WR-03 presence-based assertion fix in Phase 53 migration, and ActionResult extended with optional code discriminant for gate errors.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Author dedup-index migration + WR-03 in-place fix | f80a75d | supabase/migrations/20260522000002_phase55_notif_like_dedup.sql (created), supabase/migrations/20260522000001_phase53_notification_enum.sql (modified) |
| 2 | Apply migration to live local DB and verify indexes | (DB-only — no file commit) | — |
| 3 | Extend ActionResult with optional code field (D-09) | 3e2c31e | src/lib/actionTypes.ts |

## Local DB Apply — Task 2 Verification Output

Migration applied via:
```bash
docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260522000002_phase55_notif_like_dedup.sql
# Output: BEGIN / CREATE INDEX / CREATE INDEX / COMMIT
```

Both indexes confirmed present on the local `notifications` table:
```
           indexname            |                                                  indexdef
--------------------------------+--------------------------------------------------------------------------------------------------------------------------
 notifications_watch_like_dedup | CREATE UNIQUE INDEX notifications_watch_like_dedup ON public.notifications USING btree (user_id, actor_id, ((payload ->> 'watch_id'::text))) WHERE (type = 'watch_like'::notification_type)
 notifications_wear_like_dedup  | CREATE UNIQUE INDEX notifications_wear_like_dedup ON public.notifications USING btree (user_id, actor_id, ((payload ->> 'wear_event_id'::text))) WHERE (type = 'wear_like'::notification_type)
(2 rows)
```

WR-03 enum assertion validated: notification_type has 6 values (follow, watch_overlap, watch_like, wear_like, watch_comment, wear_comment). Missing-count for the 4 Phase 53 values = 0.

`supabase db push --linked` was NOT run in this plan (deferred to plan 06 per D-03).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. The dedup indexes implement the T-55-SPAM mitigation (DB-layer enforcement against duplicate like-notification rows). The T-55-KEYMISS landmine was avoided — `payload->>'watch_id'` and `payload->>'wear_event_id'` key strings match exactly.

## Self-Check

Files created/modified:
- supabase/migrations/20260522000002_phase55_notif_like_dedup.sql — FOUND
- supabase/migrations/20260522000001_phase53_notification_enum.sql — FOUND (modified)
- src/lib/actionTypes.ts — FOUND (modified)

Commits:
- f80a75d — Task 1 (dedup migration + WR-03 fix)
- 3e2c31e — Task 3 (ActionResult code field)

## Self-Check: PASSED
