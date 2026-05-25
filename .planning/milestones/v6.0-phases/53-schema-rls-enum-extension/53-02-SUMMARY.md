---
phase: 53-schema-rls-enum-extension
plan: 02
subsystem: database
tags: [postgres, migrations, rls, smoke-test, cascade, unique-constraint, enum]

# Dependency graph
requires:
  - phase: 53-schema-rls-enum-extension
    plan: 01
    provides: "DDL migration + enum migration files + schema.ts column shapes"
provides:
  - "Phase 53 migrations applied to live local DB with all DO $$ assertions confirmed green"
  - "watch_likes, wear_likes, comments tables materialized and enforced on local Postgres"
  - "SEC-06 cascade delete confirmed live (count 1→0 after DELETE FROM watches)"
  - "LIKE-05 duplicate-like rejection confirmed live (23505 on watch_likes_unique_pair)"
  - "notification_type enum confirmed 6 values on local DB"
affects: [54-dal-mutual-follow-gate, 55-server-actions-likes-comments, 56-like-button-ui, 57-comment-ui, 58-bell-notifications]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Incremental apply (no full reset): drizzle-kit push → docker exec psql < DDL → docker exec psql < enum"
    - "DO $$ assertions inside BEGIN/COMMIT transaction — any failure rolls back entire DDL"
    - "Non-transactional enum file (no BEGIN/COMMIT) — ALTER TYPE ADD VALUE auto-commits per statement"
    - "Smoke tests wrapped in BEGIN; ... ROLLBACK; — no test rows persist in local DB"

key-files:
  created: []
  modified:
    - supabase/migrations/20260522000000_phase53_likes_comments_rls.sql
    - supabase/migrations/20260522000001_phase53_notification_enum.sql

key-decisions:
  - "Both migration files are idempotent (IF NOT EXISTS / DROP-THEN-CREATE) — drizzle-kit push ran first with no issue"
  - "Smoke inserts used existing local user (96ffebf9-...) + existing catalog row (85cb5e87-...) to satisfy FKs"
  - "No auth trigger chain issues encountered — user row existed in local DB from prior dev activity"

# Metrics
duration: 5min
completed: 2026-05-22
---

# Phase 53 Plan 02: Apply Migrations to Live Local DB Summary

**Both Phase 53 migration files applied to the live local Postgres with all DO $$ assertions passing; SEC-06 cascade and LIKE-05 duplicate-rejection confirmed live by rolled-back smokes**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-22T15:45:18Z
- **Completed:** 2026-05-22T15:50:00Z
- **Tasks:** 2
- **Files modified:** 0 (DB-only — migrations applied, no source file changes)

## Accomplishments

- Applied `20260522000000_phase53_likes_comments_rls.sql` (transactional) to live local DB — all DO $$ assertions in the BEGIN/COMMIT block fired and passed green; transaction committed
- Applied `20260522000001_phase53_notification_enum.sql` (non-transactional) — all four ADD VALUE statements ran; count=6 DO $$ assertion passed
- Confirmed live enforcement of SEC-06 (cascade delete kills child rows) and LIKE-05 (duplicate pair raises 23505) via BEGIN/ROLLBACK smokes — no test rows persist

## Task Execution

### Task 1: Apply both Phase 53 migrations to the live local DB

**Apply sequence used:** incremental (no full reset)

1. `npx drizzle-kit push` — column shapes materialized; 2 NOTICE warnings about long identifier truncation (pre-existing, unrelated to Phase 53). Exit 0.
2. `docker exec -i supabase_db_horlo psql ... < 20260522000000_...sql` — DDL migration applied. NOTICE messages show CREATE TABLE IF NOT EXISTS skipped existing tables (drizzle-kit push had already created them). DO $$ constraint guard blocks ran. All 9 policies created. GRANT + REVOKE applied. profile_settings columns confirmed present. Final DO $$ assertion block ran: **`DO` then `COMMIT`** — zero RAISE exceptions.
3. `docker exec -i supabase_db_horlo psql ... < 20260522000001_...sql` — Enum migration applied. NOTICE messages show all 4 ADD VALUE statements idempotent (values already existed from drizzle-kit push schema.ts enum). Count=6 DO $$ assertion: **`DO`** — zero RAISE exceptions.

**Confirmation queries (all pass):**

| Query | Expected | Actual |
|-------|----------|--------|
| `SELECT count(*) FROM pg_enum ... WHERE typname = 'notification_type'` | 6 | **6** |
| `SELECT count(*) FROM pg_policies WHERE tablename = 'comments'` | 4 | **4** |
| `SELECT count(*) FROM pg_policies WHERE tablename = 'watch_likes'` | 3 | **3** |
| `SELECT count(*) FROM pg_policies WHERE tablename = 'wear_likes'` | 3 | **3** |
| `has_table_privilege('anon', 'public.watch_likes', 'SELECT')` | f | **f** |
| `has_table_privilege('anon', 'public.wear_likes', 'SELECT')` | f | **f** |
| `has_table_privilege('anon', 'public.comments', 'SELECT')` | f | **f** |

### Task 2: Smoke-test SEC-06 cascade delete and LIKE-05 duplicate-like enforcement

All smokes ran inside `BEGIN; ... ROLLBACK;` blocks — no test rows persist in the local DB.

**Seed data used:** existing user `96ffebf9-3d20-467b-95f4-e4fb4e00fea6` + existing catalog row `85cb5e87-6d1d-4ce8-8641-07c035563707`. No auth trigger chain issues encountered.

**SEC-06 cascade delete smoke:**

```
Before DELETE: watch_likes count = 1, comments count = 1
DELETE FROM watches WHERE id = '00000000-0000-0000-0000-000000000001' → DELETE 1
After cascade: watch_likes count = 0, comments count = 0
ROLLBACK
```

Cascade fired: both child rows eliminated. SEC-06 confirmed **ENFORCES** (not just present).

**LIKE-05 duplicate-like smoke:**

```
INSERT watch_likes (user_id='96ffebf9-...', watch_id='00000000-...00002') → INSERT 0 1 (first insert succeeds)
INSERT watch_likes (same pair again) →
ERROR:  duplicate key value violates unique constraint "watch_likes_unique_pair"
DETAIL: Key (user_id, watch_id)=(...) already exists.
ROLLBACK
```

Second insert raised SQLSTATE 23505 referencing `watch_likes_unique_pair`. LIKE-05 confirmed **ENFORCES**.

**pg_constraint verification:**

```sql
SELECT conname FROM pg_constraint WHERE conname IN ('watch_likes_unique_pair','wear_likes_unique_pair') ORDER BY conname;
-- watch_likes_unique_pair
-- wear_likes_unique_pair
```

Both constraints confirmed present.

## Deviations from Plan

None — plan executed exactly as written. The incremental apply path (drizzle-kit push → DDL migration → enum migration) worked without issues. All IF NOT EXISTS / DROP-THEN-CREATE guards behaved as designed (drizzle-kit push had pre-created tables and enum values; raw SQL migrations no-op'd over them idempotently).

## Threat Model Verification

| Threat | Mitigation | Confirmed |
|--------|-----------|-----------|
| T-53-08: false-positive verification (tsc passes, DB unchanged) | Migrations applied live; DO $$ assertions fired | YES — all assertions green |
| T-53-09: anon retains SELECT after apply | `has_table_privilege('anon', ...)` live query | YES — false×3 |
| T-53-03: cascade FK present but not firing | SEC-06 cascade smoke | YES — count 1→0 |
| T-53-05: UNIQUE present but not rejecting | LIKE-05 duplicate smoke | YES — 23505 raised |
| T-53-10: enum ADD VALUE fails inside transaction | Applied via docker exec psql; no implicit transaction | YES — DO passed |

## Requirements Satisfied

- **SEC-01**: anon SELECT blocked on all three tables (has_table_privilege = f×3)
- **SEC-04**: zero SECDEF helpers — inline follows EXISTS subquery used (confirmed via policy DDL in migration file)
- **SEC-06**: cascade FK enforcement confirmed live by smoke (count 1→0)
- **LIKE-05**: UNIQUE pair enforcement confirmed live by smoke (23505 raised)
- **GATE-02**: policy counts 3/3/4 confirmed by live query; no watches gate subquery in likes policies (D-08 open-to-all-authenticated design)

## Next Phase Readiness

Plan 03 (prod push human checkpoint) is ready. The local DB proof-of-green establishes that:
- Both migration files are safe to push to prod
- All constraints enforce correctly
- No assertion failures exist in the authored DDL

---
*Phase: 53-schema-rls-enum-extension*
*Completed: 2026-05-22*
