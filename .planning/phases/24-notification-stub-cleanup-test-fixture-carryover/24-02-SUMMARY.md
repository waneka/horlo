---
phase: 24-notification-stub-cleanup-test-fixture-carryover
plan: 02
subsystem: database
tags: [migration, enum-cleanup, postgres, debt-04, integration-test]
requires:
  - 24-01 (preflight script — DEBT-03 layer 1)
provides:
  - supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql
  - tests/integration/phase24-notification-enum-cleanup.test.ts
affects:
  - notifications.type column (ALTER COLUMN TYPE via rename+recreate)
  - notification_type enum (reduced from 4 to 2 values)
tech_stack_added: []
patterns_used:
  - postgres-enum-rename-recreate
  - in-migration-do-block-assertion
  - drizzle-db-execute-integration-test
  - whitelist-not-blacklist-assertion
  - database-url-gated-test
key_files_created:
  - supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql
  - tests/integration/phase24-notification-enum-cleanup.test.ts
key_files_modified: []
decisions:
  - "Single-transaction migration (BEGIN/COMMIT) — any step failure rolls back to pre-migration state"
  - "Whitelist preflight per D-01: WHERE type::text NOT IN ('follow','watch_overlap') catches both known stubs and any unexpected/corrupt values"
  - "USING type::text::notification_type cast is mandatory — Postgres cannot directly cast between two distinct enum types"
  - "Post-migration DO $$ block verifies enum has exactly 2 values and notifications.type references the new (not _old) enum"
  - "Integration test uses @/db import (Vitest resolves @/* via vitest.config.ts alias) — consistent with phase11-schema.test.ts sibling"
  - "Test gated on DATABASE_URL so CI stays green without local Supabase stack"
  - "supabase db reset not used for local verification — per project_local_db_reset.md hybrid Drizzle+Supabase setup; applied via docker exec psql instead"
metrics:
  duration_minutes: 3
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
completed_date: "2026-05-02"
requirements_satisfied: [DEBT-04]
---

# Phase 24 Plan 02: Notification Enum Rename+Recreate Migration Summary

Rename+recreate migration that purges `price_drop` and `trending_collector` from the `notification_type` enum, with layer-2 in-migration whitelist preflight and post-rename verification; plus an integration test asserting the post-migration enum shape.

## Objective

Land the canonical rename+recreate migration implementing DEBT-04. The four-statement sequence is the only safe way to remove Postgres ENUM values (`ALTER TYPE … DROP VALUE` does not exist). Migration includes a `DO $$` whitelist preflight (layer-2 defense per D-01) and a post-rename verification block. Integration test asserts the DB shape post-migration so regression is caught in CI.

## What Was Built

### `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql` (NEW, 85 lines)

Single-transaction migration with three sections:

1. **Layer-2 preflight `DO $$` block** — queries `notifications` with `WHERE type::text NOT IN ('follow', 'watch_overlap')`. Raises exception with count if any out-of-whitelist rows exist. This is the second layer of defense; the standalone script (`scripts/preflight-notification-types.ts`) from plan 24-01 is the first.

2. **Four-statement rename+recreate sequence (in exact order):**
   - `ALTER TYPE notification_type RENAME TO notification_type_old`
   - `CREATE TYPE notification_type AS ENUM ('follow', 'watch_overlap')`
   - `ALTER TABLE notifications ALTER COLUMN type TYPE notification_type USING type::text::notification_type`
   - `DROP TYPE notification_type_old`

3. **Post-migration verification `DO $$` block** — asserts `notification_type` has exactly 2 values (via `pg_enum JOIN pg_type`) and `notifications.type` references the new enum (via `information_schema.columns`). Follows Phase 11/13 precedent.

Applied cleanly to local DB via `docker exec psql` (per `project_local_db_reset.md` — `supabase db reset` is not usable standalone in this hybrid Drizzle+Supabase setup). Post-migration verified: enum has `['follow', 'watch_overlap']`; column references `notification_type`; `notification_type_old` is dropped.

### `tests/integration/phase24-notification-enum-cleanup.test.ts` (NEW, 52 lines)

Three Vitest integration tests using `db.execute(sql\`...\`)` pattern from `phase11-schema.test.ts`:

1. **Enum labels test** — queries `pg_enum JOIN pg_type ORDER BY enumsortorder`, asserts `['follow', 'watch_overlap']` exactly.
2. **Column reference test** — queries `information_schema.columns` for `notifications.type.udt_name`, asserts `'notification_type'` (not `'notification_type_old'`).
3. **Old type gone test** — queries `pg_type WHERE typname = 'notification_type_old'`, asserts count is 0.

Gated on `DATABASE_URL` via `describe.skip` (CI-safe, per sibling test pattern). All 3 tests pass against local DB with migration applied.

## Key Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | `BEGIN; … COMMIT;` wraps the entire migration | Atomic rollback if any step fails — partial state (e.g., old type renamed but column not cast) is impossible |
| 2 | Whitelist `NOT IN ('follow','watch_overlap')` phrasing | Per D-01 / Pitfall 2: covers known stubs + any unexpected/corrupt values (blacklist would miss corruption) |
| 3 | `USING type::text::notification_type` cast | Postgres cannot directly cast between two distinct enum types — the text bridge is the only valid cast path |
| 4 | Post-migration `DO $$` verification block | Phase 11/13 precedent (20260423000047 and 20260425000000 migrations) — belt-and-suspenders; migration fails loudly if the column or enum shape is wrong |
| 5 | `@/db` import in integration test | Vitest resolves `@/*` via `vitest.config.ts` alias — consistent with `phase11-schema.test.ts` sibling (not relative `../../src/db`) |
| 6 | `describe.skip` when no `DATABASE_URL` | CI stays green without local Supabase stack; mirrors the existing integration test gating pattern |
| 7 | `docker exec psql` for local apply | `supabase db reset` fails on this hybrid setup (per `project_local_db_reset.md` memory) — direct psql apply is the documented workaround |

## Threat Model Coverage

| Threat ID | Disposition | Implementation |
|-----------|-------------|----------------|
| T-24-MIGRATE-01 | mitigate | Layer-2 in-migration `DO $$` whitelist preflight — RAISE EXCEPTION aborts the transaction if any out-of-whitelist rows exist |
| T-24-MIGRATE-02 | accept | Single-transaction migration; concurrent writes block on AccessExclusive lock. Atomic rollback on failure. |
| T-24-MIGRATE-03 | accept | RAISE EXCEPTION includes only the row count — no PII, no row IDs. |
| T-24-MIGRATE-04 | accept | RLS policies reference `user_id` (not `type`); dedup partial index `WHERE type = 'watch_overlap'` continues to function because `'watch_overlap'` is in the new enum. |
| T-24-MIGRATE-05 | accept | Preflight guarantees every remaining row casts cleanly; NOT NULL constraint is never violated. |

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create rename+recreate migration with belt-and-suspenders DO $$ blocks (DEBT-04) | 4eb5d06 | supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql |
| 2 | Create post-migration enum-shape integration test (DEBT-04) | 39b1514 | tests/integration/phase24-notification-enum-cleanup.test.ts |

## Verification

### Acceptance Criteria — Task 1

- [x] File `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql` exists
- [x] File contains `BEGIN;` and `COMMIT;` (single-transaction wrap)
- [x] File contains `type::text NOT IN ('follow', 'watch_overlap')` (whitelist preflight)
- [x] File contains `RAISE EXCEPTION 'Phase 24 preflight failed:` with count interpolation
- [x] File contains `ALTER TYPE notification_type RENAME TO notification_type_old`
- [x] File contains `CREATE TYPE notification_type AS ENUM ('follow', 'watch_overlap')`
- [x] File contains `USING type::text::notification_type`
- [x] File contains `DROP TYPE notification_type_old`
- [x] File contains 2 functional `DO $$` blocks (preflight + post-check)
- [x] File contains post-migration assertions against `pg_enum JOIN pg_type` and `information_schema.columns`
- [x] Local apply via `docker exec psql` exits 0; enum has exactly 2 values; column references new enum

### Acceptance Criteria — Task 2

- [x] File `tests/integration/phase24-notification-enum-cleanup.test.ts` exists
- [x] File contains 3 `it(...)` tests asserting: enum has exactly 2 labels, column references new enum, `_old` type is dropped
- [x] File queries `pg_enum JOIN pg_type` for label assertion
- [x] File queries `information_schema.columns` for column-type assertion
- [x] All 3 tests pass against local DB with migration applied

## Deviations from Plan

### Environment: supabase db reset not usable for local verification

**Found during:** Task 1 verification
**Issue:** `supabase db reset` fails with `ERROR: relation "public.users" does not exist` at migration `20260419999999_social_tables_create.sql` — a pre-existing structural issue documented in `project_local_db_reset.md` (hybrid Drizzle+Supabase setup where social tables are created by Drizzle, not Supabase migrations).
**Fix:** Applied the migration via `docker exec -i supabase_db_horlo psql -U postgres -d postgres < migration.sql` per the documented local reset workflow. First ran `npx drizzle-kit push` to rebuild the schema (including the 4-value `notification_type` enum), then applied the migration.
**Outcome:** Migration applied cleanly (exit 0 for all 8 DDL statements); post-migration state verified correctly.
**Rule:** Rule 3 (auto-fix blocking issue — deviated from the plan's `supabase db reset` instruction in favor of the documented workaround).

### Test file: using @/db instead of ../../src/db

**Found during:** Task 2
**Issue:** The PLAN.md `<interfaces>` showed `from '../../src/db'` in the test template, but the sibling integration tests (`phase11-schema.test.ts`, `phase11-pg-trgm.test.ts`) all use `from '@/db'`.
**Fix:** Used `@/db` to match the sibling test pattern. Vitest resolves `@/*` via `vitest.config.ts` alias — both work, but `@/db` is consistent with project conventions.
**Rule:** Rule 2 (auto-apply correct pattern — convention consistency is a correctness requirement per CLAUDE.md "Imports" section).

## Known Stubs

None — this plan produces a migration file and integration test, not UI components.

## Threat Flags

No new security-relevant surface introduced beyond what is documented in the plan's `<threat_model>`. The migration operates entirely on DDL and a system catalog query; no new network endpoints, auth paths, or schema changes outside the planned `notification_type` enum reduction.

## Self-Check: PASSED
