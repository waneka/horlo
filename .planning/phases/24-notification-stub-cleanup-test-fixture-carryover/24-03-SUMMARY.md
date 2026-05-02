---
phase: 24-notification-stub-cleanup-test-fixture-carryover
plan: 03
subsystem: db-migration
tags: [prod-apply, debt-04, notification-cleanup, footgun, partial-index]
requires:
  - supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql
  - scripts/preflight-notification-types.ts
provides:
  - prod-applied-migration:20260501000000_phase24_notification_enum_cleanup
  - docs:T-24-PRODAPPLY-runbook
  - docs:T-24-PARTIDX-footgun
affects:
  - docs/deploy-db-setup.md
  - supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql
  - tests/integration/phase24-notification-enum-cleanup.test.ts
tech_stack_added: []
patterns_used:
  - drop-recreate-enum-bound-dependents-across-rename
  - in-migration-post-check-do-block
  - regression-test-asserts-pg_indexes-predicate
key_files_created: []
key_files_modified:
  - docs/deploy-db-setup.md
  - supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql
  - tests/integration/phase24-notification-enum-cleanup.test.ts
decisions:
  - "First push attempt FAILED at the ALTER COLUMN TYPE step with `operator does not exist: notification_type = notification_type_old`. Single-transaction rolled back cleanly — prod was left in pre-migration state, no manual recovery needed."
  - "Root cause: Phase 11 created a UNIQUE partial index `notifications_watch_overlap_dedup WHERE type = 'watch_overlap'::notification_type`. Postgres binds the enum literal to the type's OID at index creation. After RENAME, the predicate was bound to `notification_type_old`, and the column rewrite couldn't reconcile the two distinct enum types."
  - "Local 24-02 test missed it because `drizzle-kit push` rebuilds schema from `src/db/schema.ts`, which does NOT include the Phase 11 partial index — false-OK. Reinforces `project_drizzle_supabase_db_mismatch.md` (drizzle push is local-only; supabase migrations contain prod-truth)."
  - "Fix: DROP INDEX before the RENAME, CREATE INDEX after the column type swap, in the same transaction. Same shape as Phase 11 definition. AccessExclusive lock on `notifications` for the whole window guarantees no concurrent writes race the dedup gap."
  - "Defense in depth: extended the in-migration post-check `DO $$` to assert the index was recreated (so future edits that drop step 5 fail fast). Added a regression test that asserts the index predicate text contains the new type name (locks the dependency in CI)."
  - "Documented as Footgun T-24-PARTIDX (new) alongside T-24-PRODAPPLY in `docs/deploy-db-setup.md`. T-24-PARTIDX includes a generic recovery pattern (query `pg_depend`, drop+recreate enum-bound dependents) so future enum-cleanup phases can apply the same template."
metrics:
  duration_minutes: 15
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 3
completed_date: "2026-05-01"
requirements_satisfied: [DEBT-04]
---

# Phase 24 Plan 03: Prod-apply gate + deploy doc runbook

The [BLOCKING] [autonomous: false] human gate that bridges plan 24-02 (migration committed) and plan 24-04 (Drizzle pgEnum narrow). The migration was applied to prod via `supabase db push --linked` after a one-attempt failure that surfaced a previously-unknown footgun (T-24-PARTIDX) and was fixed in-place. Prod is in the target state, the deploy doc captures both T-24-PRODAPPLY and T-24-PARTIDX with recovery patterns.

## Objective

Apply `20260501000000_phase24_notification_enum_cleanup.sql` to prod and document the prod-apply runbook + footguns.

## What was done

**Task 1 — manual prod-apply (BLOCKING)**

Executed against prod with the user's explicit `go` authorization:

1. `npm run db:preflight-notification-cleanup` against prod (DATABASE_URL extracted from line 7 of `.env.local` for the duration of the run, no file modification) — exit 0, zero out-of-whitelist rows. Layer 1 clean.
2. `echo "Y" | supabase db push --linked` — **first attempt failed** at statement 4 (the ALTER COLUMN TYPE step) with:
   ```
   ERROR: operator does not exist: notification_type = notification_type_old (SQLSTATE 42883)
   ```
   Single-transaction rolled the migration back. Prod left in pre-migration state.
3. Diagnosed via `pg_depend` against prod. Three dependents on `notification_type`: the array type (internal), the `notifications.type` column (expected), and the `notifications_watch_overlap_dedup` UNIQUE partial index (the culprit).
4. Fixed migration in-place: DROP INDEX before RENAME, CREATE INDEX after the column type swap. Extended in-migration post-check to assert the index was recreated. Added regression test asserting the predicate is bound to the new type.
5. Committed the fix as `a67aac7 fix(24-02): drop+recreate notifications_watch_overlap_dedup across enum rename`.
6. `echo "Y" | supabase db push --linked` — **second attempt succeeded.** Migration applied to prod.
7. Verified prod state via four queries:
   - `pg_enum`: exactly 2 values, `follow` and `watch_overlap` ✓
   - `information_schema.columns`: `notifications.type.udt_name = notification_type` ✓
   - `pg_type`: `notification_type_old` count = 0 ✓
   - `pg_indexes`: `notifications_watch_overlap_dedup` exists with predicate `WHERE (type = 'watch_overlap'::notification_type)` (bound to NEW type) ✓

**Task 2 — auto append runbook**

Appended `## Phase 24 — notification_type ENUM cleanup runbook` section to `docs/deploy-db-setup.md` (after the Phase 21 SMTP backout, file ending at line 472). Section contains:

- 4-step D-05 sequencing block (preflight → push → verify → merge 24-04)
- Footgun T-24-PRODAPPLY (Drizzle leads SQL → mismatched type system) — the originally-anticipated gate
- Footgun T-24-PARTIDX (enum-bound partial index blocks ALTER COLUMN TYPE) — discovered during this run, with a generic recovery pattern (query `pg_depend`, drop+recreate enum-bound dependents) for future enum cleanups
- Backout procedure (revert prod to 4-value enum) — extended to also drop+recreate the partial index across the rollback rename so a future revert doesn't repeat T-24-PARTIDX

## Acceptance criteria

- [x] User has executed `npm run db:preflight-notification-cleanup` against prod with exit 0
- [x] User has executed `supabase db push --linked` with exit 0 (after one fix-and-retry cycle)
- [x] Prod's `notification_type` enum has exactly 2 values: `follow`, `watch_overlap`
- [x] Prod's `notifications.type` column references `notification_type` (not `_old`)
- [x] `notifications_watch_overlap_dedup` partial index restored with predicate bound to new type
- [x] `docs/deploy-db-setup.md` contains `## Phase 24 — notification_type ENUM cleanup runbook` with both T-24-PRODAPPLY and T-24-PARTIDX footguns
- [x] Backout procedure is documented and includes the partial-index drop+recreate

## Notable deviations

**T-24-PARTIDX discovery (new footgun).** The plan as written assumed local `docker exec psql` apply was sufficient validation. It wasn't — the local schema did not contain the Phase 11 partial index because that index lives only in the supabase migration (not in `src/db/schema.ts`), and local was rebuilt from `drizzle-kit push`. The migration was modified in-place during this plan's execution (commit `a67aac7`) to handle the dependency, and the deploy doc now documents the failure mode + recovery pattern so a future enum cleanup catches it sooner. This deviation is captured in the migration file's own header comment block referencing `project_drizzle_supabase_db_mismatch.md`.

**Plan 24-04 unblocked.** With prod migration applied and the partial-index dependency handled, plan 24-04 (Drizzle pgEnum narrow) can now safely land. T-24-PRODAPPLY guard remains intact: code changes that ship before prod is migrated are still the documented failure mode for ANY future enum cleanup, even though this specific migration is now in the past.
