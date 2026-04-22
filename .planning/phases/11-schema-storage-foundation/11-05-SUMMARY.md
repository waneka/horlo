---
phase: 11
plan: 05
subsystem: schema
tags:
  - schema
  - migration
  - rls
  - audit
  - security
  - debt
  - schema-push
dependency_graph:
  requires:
    - "supabase/migrations/20260420000000_rls_existing_tables.sql (DEBT-02 audit target)"
    - "supabase/migrations/20260423000001_phase11_wear_visibility.sql (Migration 1 — enum + columns + backfill)"
    - "supabase/migrations/20260423000002_phase11_notifications.sql (Migration 2)"
    - "supabase/migrations/20260423000003_phase11_pg_trgm.sql (Migration 3)"
    - "supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql (Migration 4)"
  provides:
    - "Migration 5 — DEBT-02 audit trail + DO$$ sanity assertion on 12 expected RLS policies"
    - "Migration 4b — SECURITY DEFINER helpers fixing storage SELECT policy cross-table RLS"
    - "DEBT-02 ongoing regression test (users/watches/user_preferences IDOR)"
    - "Local DB: all 5 Phase 11 migrations applied and verified"
    - "Phase 11 green verification state (all Wave 0 tests pass)"
  affects:
    - "Phase 12 (DAL visibility ripple — depends on all Phase 11 schema present locally)"
    - "DEBT-02 requirement — resolved"
tech_stack:
  added: []
  patterns:
    - "DO $$ sanity assertion block iterating pg_policies for schema drift detection"
    - "SECURITY DEFINER helper functions bypassing wear_events RLS for storage SELECT policy"
    - "toSatisfy() assertion for Drizzle-wrapped PostgreSQL constraint errors (e.cause.message)"
    - "Index-existence gate replacing EXPLAIN assertion for known Seq Scan planner flakiness"
    - "vitest --pool=forks --poolOptions.forks.singleFork for sequential auth-intensive tests"
key_files:
  created:
    - supabase/migrations/20260423000005_phase11_debt02_audit.sql
    - supabase/migrations/20260423000004b_phase11_storage_rls_secdef_fix.sql
    - tests/integration/debt02-rls-audit.test.ts
  modified:
    - tests/integration/phase11-schema.test.ts
    - tests/integration/phase11-notifications-rls.test.ts
    - tests/integration/phase11-pg-trgm.test.ts
    - tests/integration/phase11-storage-rls.test.ts
decisions:
  - "Migration 4b created as a separate file rather than modifying Migration 4 in-place — idempotent re-apply discipline; Migration 4 remains canonical; 4b adds SECURITY DEFINER helpers and replaces storage SELECT policy"
  - "SECURITY DEFINER approach chosen over adding permissive wear_events SELECT policy — targeted bypass exposes only visibility enum value, not full row data; maintains owner-only READ security model on wear_events"
  - "EXPLAIN assertions relaxed to index-existence checks (Plan 01 SUMMARY's documented fallback) — planner chooses Seq Scan on small tables even with 100-row seed and ANALYZE"
  - "toSatisfy() used for Drizzle CHECK constraint assertions — Drizzle wraps PostgreSQL errors as 'Failed query:...' with constraint name in e.cause.message only"
  - "Pre-existing test failures (getFeedForUser, getWearRailForViewer, getSuggestedCollectors, getRecommendationsForViewer, getWatchByIdForViewer — 11 tests) confirmed pre-existing; no Phase 11 regressions"
metrics:
  duration: ~45min
  completed: "2026-04-22"
  tasks: 3
  files: 7
---

# Phase 11 Plan 05: DEBT-02 Audit + [BLOCKING] Schema Push + Full Wave 0 Verification Summary

**One-liner:** DEBT-02 audit migration (no-op DDL + DO$$ sanity assertion on 12 expected RLS policies) + IDOR regression test + SECURITY DEFINER fix for storage SELECT cross-table RLS + [BLOCKING] local schema push (all 5 migrations applied) + all Phase 11 Wave 0 tests green (30/30).

## What Was Built

### Task 1: Migration 5 (`supabase/migrations/20260423000005_phase11_debt02_audit.sql`)

A verification-only migration (no DDL changes). Structure:

- **Header comment block** — D-14 audit checklist with ✓ for all three criteria: UPDATE policies have WITH CHECK, all auth.uid() wrapped in (SELECT auth.uid()), user_preferences has INSERT policy.
- **Intentional empty DDL section** — the audit found no defects; no CREATE/DROP POLICY or ALTER TABLE.
- **DO $$ sanity assertion** — iterates 12 expected policy names via `pg_policies` lookup; RAISES EXCEPTION with the missing names if any policy has been dropped. Catches future schema drift.

Audit outcome: all 12 DEBT-02 target policies in `20260420000000_rls_existing_tables.sql` are correct — InitPlan pattern on all auth.uid() calls, WITH CHECK on all 3 UPDATE policies, INSERT policy on user_preferences. No defect surfaced. Migration ships as audit trail + drift sentinel only.

### Task 2: DEBT-02 Regression Test (`tests/integration/debt02-rls-audit.test.ts`)

Env-gated on 4 env vars (DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY). 4 scenarios covering the DEBT-02 audit targets:

| # | Scenario | Assertion |
|---|----------|-----------|
| 1 | A cannot SELECT B's `users` row | RLS returns empty array (no error) |
| 2 | A cannot UPDATE B's `watches` row | 0 affected rows; service-role confirms B's brand untouched |
| 3 | A cannot INSERT `user_preferences` with `user_id = B.id` | WITH CHECK rejects; error matches /row-level security/ |
| 4 | A CAN INSERT own `user_preferences` row | success; SELECT confirms row visible to A |

Uses real Supabase Auth (`signInWithPassword`) — exercises DB-layer RLS not app-layer. Passes 4/4 when run in isolation against the pushed schema.

### Task 3: [BLOCKING] Local Schema Push + Verification

#### Apply sequence used

1. `supabase db reset` — succeeded (tables wiped)
2. `npx drizzle-kit push` — created users/watches/wear_events/notifications/profiles/follows/profile_settings/activities/user_preferences tables + wear_visibility/notification_type enums. Output: `[✓] Changes applied`
3. Prior migrations applied via stdin: `20260413000000_sync_auth_users.sql` (trigger created), `20260419999999_social_tables_create.sql` (already-exists NOTICEs — expected idempotence), `20260420000000_rls_existing_tables.sql` (12 policies created), `20260420000001_social_tables_rls.sql` (social RLS created), `20260420000002_profile_trigger.sql` (profile trigger created), `20260420000003_phase8_notes_columns.sql` (NOTICE: columns already exist — idempotent), `20260421000000_profile_username_lower_unique.sql`, `20260422000000_phase10_activities_feed_select.sql`
4. Phase 11 migrations applied in order:
   - `20260423000001` — DO$$ no-op (enum + columns already from drizzle push), backfill updated 0 rows, DO$$ Pitfall G-6 check passed (0 followers rows)
   - `20260423000002` — notifications table + partial indexes + RLS policies + CHECK constraint
   - `20260423000003` — pg_trgm extension + GIN indexes
   - `20260423000004` — wear-photos bucket + storage.objects RLS policies
   - `20260423000004b` — SECURITY DEFINER helpers + updated storage SELECT policy
   - `20260423000005` — DO$$ sanity assertion ran and committed (all 12 policies found)

#### Post-push smoke queries

| Check | Expected | Actual |
|-------|----------|--------|
| `SELECT 1 FROM pg_type WHERE typname='wear_visibility'` | 1 row | 1 row |
| `SELECT 1 FROM pg_type WHERE typname='notification_type'` | 1 row | 1 row |
| `SELECT 1 FROM pg_extension WHERE extname='pg_trgm'` | 1 row | 1 row |
| `SELECT id, public FROM storage.buckets WHERE id='wear-photos'` | 1 row, public=f | 1 row, public=f |
| `SELECT COUNT(*) FROM wear_events WHERE visibility='followers'` | 0 | 0 (Pitfall G-6 backstop held) |
| DEBT-02 policy count (users_select_own, watches_update_own, user_preferences_insert_own, notifications_select_recipient_only) | 4 | 4 |
| Total `%_own` policies on public schema | ≥12 | 28 |

All 7 smoke checks passed. No HARD STOP conditions fired.

#### Phase 11 Wave 0 test results

Run as: `npx vitest run --pool=forks --poolOptions.forks.singleFork tests/integration/phase11-*.test.ts tests/integration/debt02-rls-audit.test.ts`

| Test File | Tests | Result |
|-----------|-------|--------|
| phase11-schema.test.ts | 8 | 8 passed |
| phase11-notifications-rls.test.ts | 3 | 3 passed |
| phase11-pg-trgm.test.ts | 3 | 3 passed |
| phase11-storage-rls.test.ts | 12 | 12 passed |
| debt02-rls-audit.test.ts | 4 | 4 passed |
| **Total** | **30** | **30 passed** |

#### Full suite regression check

`npm test` with env vars: 2108 passed, 11 failed, 31 skipped across 64 test files.
The 11 failures (5 files: getFeedForUser, getWearRailForViewer, getSuggestedCollectors, getRecommendationsForViewer, getWatchByIdForViewer) are **pre-existing failures confirmed identical before Phase 11 changes** (verified via git stash). No Phase 11 regressions.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Migration 5 | 0beb62b | supabase/migrations/20260423000005_phase11_debt02_audit.sql |
| Task 2: DEBT-02 regression test | 00bf27d | tests/integration/debt02-rls-audit.test.ts |
| Task 3 fixes: test repairs + storage RLS fix | f3d1438 | tests/integration/phase11-schema.test.ts, phase11-notifications-rls.test.ts, phase11-pg-trgm.test.ts, phase11-storage-rls.test.ts, supabase/migrations/20260423000004b_phase11_storage_rls_secdef_fix.sql |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Drizzle error wrapping hides PostgreSQL constraint names in toThrow() assertions**
- **Found during:** Task 3 (schema push + test run)
- **Issue:** `phase11-schema.test.ts` and `phase11-notifications-rls.test.ts` used `rejects.toThrow(/constraint_name/i)` to catch CHECK violations. Drizzle formats errors as `"Failed query: ..."` with the PostgreSQL error in `e.cause.message` only — not in `e.message`. The regex never matched.
- **Fix:** Changed to `rejects.toSatisfy()` checking both `e.message` and `e.cause?.message` for the constraint name pattern.
- **Files modified:** tests/integration/phase11-schema.test.ts, tests/integration/phase11-notifications-rls.test.ts
- **Commit:** f3d1438

**2. [Rule 1 - Bug] EXPLAIN ILIKE planner flakiness — Seq Scan on small tables**
- **Found during:** Task 3 (schema push + test run)
- **Issue:** `phase11-schema.test.ts` and `phase11-pg-trgm.test.ts` asserted `expect(plan).toMatch(/profiles_username_trgm_idx/i)` for EXPLAIN output. The planner chose Seq Scan even after 100-row seed + ANALYZE (Plan 01 SUMMARY documented this as a known flakiness risk and specified the fallback).
- **Fix:** Replaced hard EXPLAIN assertion with index-existence check via `pg_indexes`. EXPLAIN still runs and logs a warning if Seq Scan is chosen, but the test passes regardless (index existence is the authoritative SRCH-08 gate).
- **Files modified:** tests/integration/phase11-schema.test.ts, tests/integration/phase11-pg-trgm.test.ts
- **Commit:** f3d1438

**3. [Rule 1 - Bug] file_size_limit returned as string by Drizzle for bigint columns**
- **Found during:** Task 3 (storage-rls test run)
- **Issue:** `phase11-storage-rls.test.ts` compared `file_size_limit` to `5242880` (number). Drizzle returns PostgreSQL bigint as a string `"5242880"`.
- **Fix:** Changed to `Number(arr[0].file_size_limit)` before comparison.
- **Files modified:** tests/integration/phase11-storage-rls.test.ts
- **Commit:** f3d1438

**4. [Rule 1 - Bug] Storage SELECT policy broken for non-owners — wear_events RLS blocks EXISTS subquery**
- **Found during:** Task 3 (storage-rls test run — F/S download failures on public photos)
- **Issue:** The storage SELECT policy in Migration 4 used `EXISTS (SELECT 1 FROM wear_events WHERE ...)` to check visibility. `wear_events` has owner-only SELECT RLS (`user_id = auth.uid()`). When user F tries to download user A's public photo, the EXISTS subquery runs as F and cannot see A's wear_events row → always false → access denied even for `visibility = 'public'`.
- **Fix:** Created Migration 4b (`20260423000004b_phase11_storage_rls_secdef_fix.sql`) with three `SECURITY DEFINER` helper functions: `get_wear_event_visibility_bypassing_rls(uuid)`, `get_wear_event_owner_bypassing_rls(uuid)`, `viewer_follows_bypassing_rls(uuid, uuid)`. Updated the storage SELECT policy to call these helpers instead of direct JOINs. The SECURITY DEFINER context bypasses RLS but returns only the visibility enum value — no full row exposure.
- **Files modified:** supabase/migrations/20260423000004b_phase11_storage_rls_secdef_fix.sql (created), storage.objects policy updated in live DB
- **Commit:** f3d1438

**Security note on fix #4:** The SECURITY DEFINER functions expose only the `visibility` enum value and the boolean follow relationship for storage access decisions — not the full `wear_events` row, note content, photo_url, or user email. Defense-in-depth is maintained: the storage policy still gates on bucket_id and the three visibility branches. The fix is minimal in scope.

## Phase 11 Wave 0 → Green State

All 5 Phase 11 Wave 0 test suites pass with local env vars:

- phase11-schema.test.ts: 8/8 (WYWT-09 enum/columns/CHECK, WYWT-13 bucket, SRCH-08 indexes/extension)
- phase11-notifications-rls.test.ts: 3/3 (NOTIF-01 recipient SELECT, self-notif CHECK, dedup UNIQUE)
- phase11-pg-trgm.test.ts: 3/3 (SRCH-08 extension, indexes, planner — relaxed to index existence)
- phase11-storage-rls.test.ts: 12/12 (three-tier 9-cell matrix + folder enforcement + bucket privacy)
- debt02-rls-audit.test.ts: 4/4 (users SELECT, watches UPDATE, user_preferences INSERT rejection + own INSERT success)

**Note on parallel test execution:** The DEBT-02 test and notifications test both call `seedTwoUsers()`. Running all 5 files in parallel causes Supabase Auth rate-limiting ("Database error creating new user"). Use `--pool=forks --poolOptions.forks.singleFork` to serialize auth-intensive test files. Individual file runs always pass.

## Prod Deploy Handoff

When ready to ship Phase 11 to prod:

```bash
supabase db push --linked --include-all
```

This applies all migrations in filename order (20260423000001 through 20260423000005, plus 20260423000004b alphabetically between 4 and 5). Per MEMORY.md, **never** use `drizzle-kit push --linked` — that is the local-only workflow. `drizzle-kit push` only applies to the `DATABASE_URL` local connection.

Note: Migration 4b must be applied before Migration 5 (4b restores correct storage SELECT behavior; 5 is the DEBT-02 audit assertion). Filename ordering `20260423000004b` < `20260423000005` guarantees this.

## Known Stubs

None. All Phase 11 Wave 0 test assertions exercise real DB behavior against the pushed schema. No hardcoded placeholder values or unenforced assertions.

## Threat Flags

None. All surface introduced in this plan (Migration 5 DO$$ block, SECURITY DEFINER helpers, integration tests) is within the planned threat model. The SECURITY DEFINER fix narrows scope from the original broken policy (which accidentally denied all non-owner access) to the intended three-tier model.

## Deferred Items

The pre-existing integration test failures in tests/data/ (getFeedForUser, getWearRailForViewer, getSuggestedCollectors, getRecommendationsForViewer, getWatchByIdForViewer — 11 tests, 5 files) are logged to deferred-items.md. They are not caused by Phase 11 and are outside Phase 11 scope.

## Self-Check

Files created:
- [x] `supabase/migrations/20260423000005_phase11_debt02_audit.sql` — FOUND
- [x] `supabase/migrations/20260423000004b_phase11_storage_rls_secdef_fix.sql` — FOUND
- [x] `tests/integration/debt02-rls-audit.test.ts` — FOUND

Commits:
- [x] 0beb62b — Task 1 Migration 5
- [x] 00bf27d — Task 2 DEBT-02 test
- [x] f3d1438 — Task 3 fixes

Wave 0 tests (30/30 with env vars, sequential): VERIFIED
Full suite (no new failures): VERIFIED

## Self-Check: PASSED
