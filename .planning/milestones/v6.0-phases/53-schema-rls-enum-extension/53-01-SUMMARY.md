---
phase: 53-schema-rls-enum-extension
plan: 01
subsystem: database
tags: [postgres, drizzle, supabase, rls, migrations, social, likes, comments, notifications]

# Dependency graph
requires:
  - phase: 52-cache-components-fix
    provides: stable auth + profile routing foundation
  - phase: 37-layer-d
    provides: REVOKE ALL FROM anon + has_table_privilege assertion pattern (phase37_layer_d.sql)
  - phase: 11-notifications
    provides: idempotent CREATE TABLE IF NOT EXISTS + CHECK guard DO $$ + DROP/CREATE POLICY pattern
  - phase: 13-profile-settings
    provides: ADD COLUMN IF NOT EXISTS notify_on_* pattern with belt-and-suspenders UPDATE
provides:
  - watch_likes and wear_likes tables (per-target, cascade FKs, UNIQUE pair, 3 RLS policies each)
  - comments table (nullable XOR FKs, body CHECK, mutual-follow gate in both RLS clauses, 4 policies)
  - REVOKE ALL FROM anon/public on all 3 tables with DO $$ assertion (SEC-01)
  - profile_settings.notify_on_like and notify_on_comment columns (D-10)
  - notification_type enum extended to 6 values (watch_like, wear_like, watch_comment, wear_comment)
  - Drizzle column-shape exports for watchLikes, wearLikes, comments
affects: [54-dal-mutual-follow-gate, 55-server-actions-likes-comments, 56-like-button-ui, 57-comment-ui, 58-bell-notifications]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-target likes tables pattern (separate watch_likes / wear_likes vs polymorphic)"
    - "Mutual-follow gate encoded in BOTH RLS SELECT USING and INSERT WITH CHECK clauses (D-06)"
    - "Non-transactional enum extension file (no BEGIN/COMMIT, ALTER TYPE ADD VALUE)"
    - "(SELECT auth.uid()) InitPlan wrapper convention on all RLS auth.uid() references"
    - "Idempotent CHECK guard DO $$ blocks for constraints Drizzle cannot express"

key-files:
  created:
    - supabase/migrations/20260522000000_phase53_likes_comments_rls.sql
    - supabase/migrations/20260522000001_phase53_notification_enum.sql
  modified:
    - src/db/schema.ts
    - src/data/notifications.ts
    - src/components/notifications/NotificationRow.tsx

key-decisions:
  - "Per-target likes tables (D-01): separate watch_likes / wear_likes over polymorphic reactions table"
  - "Zero SECDEF helpers (D-07): inline follows EXISTS subquery viable because follows_select_all TO authenticated USING(true) exists from Phase 7/20"
  - "Mutual-follow gate in BOTH clauses (D-06): SELECT USING + INSERT WITH CHECK both carry the watches subquery with bidirectional follows EXISTS"
  - "Enum migration in separate file (D-09): ALTER TYPE ADD VALUE cannot run inside BEGIN/COMMIT"
  - "NotificationRow.tsx type widened defensively: B-8 guard renders null for unknown types; Phase 58 will add rendering for new types"

patterns-established:
  - "Pattern 1: Non-transactional enum extension — separate file, no BEGIN/COMMIT, IF NOT EXISTS guard, DO $$ count assertion"
  - "Pattern 2: Dual-clause RLS gate — encode access predicate in both SELECT USING and INSERT WITH CHECK for information-disclosure-resistant design"
  - "Pattern 3: Idempotent CHECK guard — DO $$ block inside main migration re-adds CHECK if absent (handles drizzle-kit push pre-run)"

requirements-completed: [SEC-01, SEC-04, SEC-06, LIKE-05, GATE-02]

# Metrics
duration: 6min
completed: 2026-05-22
---

# Phase 53 Plan 01: Schema + RLS + Enum Extension Summary

**Three social interaction tables (watch_likes, wear_likes, comments) with cascade FKs, UNIQUE dedup, bidirectional-follows RLS gate in both clauses, anon REVOKE, and non-transactional notification_type enum extension to 6 values**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-22T15:35:27Z
- **Completed:** 2026-05-22T15:41:00Z
- **Tasks:** 3
- **Files modified:** 5 (2 new migrations, schema.ts + 2 notification type files)

## Accomplishments

- Authored the complete v6.0 social DB layer — 3 tables, 9 RLS policies (3+3+4), REVOKE ALL FROM anon/public on each, FK cascade assertions, UNIQUE/CHECK constraint assertions, and profile_settings opt-out columns
- Encoded the mutual-follow gate in BOTH the `comments_select` USING clause AND the `comments_insert` WITH CHECK clause (D-06 / SEC-02 both-layer requirement at RLS), using inline `follows` EXISTS subqueries — zero SECURITY DEFINER helpers
- Extended `notification_type` enum to 6 values via a separate non-transactional migration file (no BEGIN/COMMIT wrapper), with a post-apply count=6 assertion

## Task Commits

1. **Task 1: Extend schema.ts** - `511a1a9` (feat) — watchLikes, wearLikes, comments pgTable defs; enum extension; profileSettings columns; NotificationRow type widening
2. **Task 2: Write main DDL migration** - `85f2471` (feat) — tables + constraints + RLS + REVOKE + profile_settings ALTER + DO $$ assertions
3. **Task 3: Write enum extension migration** - `3a22d90` (feat) — non-transactional ADD VALUE x4 + count=6 assertion

## Files Created/Modified

- `/Users/tylerwaneka/Documents/horlo/supabase/migrations/20260522000000_phase53_likes_comments_rls.sql` — Authoritative DDL: tables, FK cascade, UNIQUE, CHECK, RLS (9 policies), REVOKE, profile_settings ALTER, DO $$ assertion block
- `/Users/tylerwaneka/Documents/horlo/supabase/migrations/20260522000001_phase53_notification_enum.sql` — Non-transactional enum extension (ADD VALUE x4) + count=6 DO $$ assertion
- `/Users/tylerwaneka/Documents/horlo/src/db/schema.ts` — watchLikes/wearLikes/comments pgTable exports; notificationTypeEnum extended to 6 values; profileSettings notify_on_like/notify_on_comment columns
- `/Users/tylerwaneka/Documents/horlo/src/data/notifications.ts` — NotificationRow.type union widened to accept 6 enum values
- `/Users/tylerwaneka/Documents/horlo/src/components/notifications/NotificationRow.tsx` — NotificationRowData.type widened; exhaustive-check fallbacks updated for new values (B-8 guard renders null for unrendered types)

## Decisions Made

- **Zero SECURITY DEFINER** (D-07 confirmed): `follows_select_all ON public.follows FOR SELECT TO authenticated USING (true)` already exists from Phase 7/20, making the inline EXISTS subquery viable without elevated privileges
- **Separate enum migration file** (D-09): `ALTER TYPE ... ADD VALUE` cannot run inside a `BEGIN`/`COMMIT` block — splitting into `20260522000001` is the cleanest approach and avoids any implicit transaction risk
- **NotificationRow.tsx type widening**: The interface `NotificationRowData.type` was widened to accept all 6 enum values; the existing B-8 guard (`if (row.type !== 'follow' && row.type !== 'watch_overlap') return null`) continues to render null for new types until Phase 58 adds rendering — this is intentional forward-compatible design

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed NotificationRow.tsx and notifications.ts type errors from enum extension**
- **Found during:** Task 1 (schema.ts enum extension)
- **Issue:** Extending `notificationTypeEnum` to 6 values caused TypeScript errors: `NotificationRow` interface had hardcoded `type: 'follow' | 'watch_overlap'`; `NotificationRowData` in `NotificationRow.tsx` also had narrow type; two helper functions (`resolveHref`, `resolveCopy`) used `never` exhaustive checks that became unreachable with the wider type
- **Fix:** Widened both `NotificationRow.type` and `NotificationRowData.type` to include all 6 values; replaced `never` exhaustive checks with safe fallbacks (`'#'` for href, `null` for copy) since the B-8 early-return guard prevents these paths from being reached
- **Files modified:** `src/data/notifications.ts`, `src/components/notifications/NotificationRow.tsx`
- **Verification:** `npx tsc --noEmit` passes with zero errors in `src/` (3 pre-existing errors in test files unrelated to this change)
- **Committed in:** `511a1a9` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — type bug from enum extension)
**Impact on plan:** Required fix for TypeScript compilation. Widening the notification type union is the correct forward-compatible approach; the B-8 guard in `NotificationRow.tsx` ensures new types render as null until Phase 58 implements their UI.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None — this plan authors files only. The migrations are NOT applied in Plan 01. Plan 02 applies the migrations to the local database.

## Next Phase Readiness

Plan 02 (apply migrations locally and verify DO $$ assertions pass) is ready to run. The three artifacts are authored and committed:
- `20260522000000_phase53_likes_comments_rls.sql` — ready for `supabase db push` local
- `20260522000001_phase53_notification_enum.sql` — ready for `supabase db push` local (must apply AFTER the main migration since it adds values to the enum)
- `src/db/schema.ts` — ready for `npx drizzle-kit push` after migrations apply

No blockers. Phase 54 (DAL with mutual-follow gate) depends on the tables existing in the local DB, which Plan 02 delivers.

---
*Phase: 53-schema-rls-enum-extension*
*Completed: 2026-05-22*
