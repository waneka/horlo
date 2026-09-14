---
phase: 85-collection-lifecycle
plan: 01
subsystem: database
tags: [postgres, supabase, drizzle, migration, rls, pgenum]

# Dependency graph
requires: []
provides:
  - "watches.previously_owned status (replaces legacy 'sold') on local Supabase"
  - "watches.disposal_reason / sell_price / disposal_date nullable columns"
  - "disposalReasonEnum pgEnum mirrored in src/db/schema.ts"
  - "comments_select / comments_insert RLS policies updated for previously_owned"
affects: [85-02, 85-03, 85-04, 85-05, 85-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent Supabase migration: guarded CREATE TYPE (pg_type existence check), ADD COLUMN IF NOT EXISTS, WHERE-scoped UPDATE backfill"
    - "Divergent pre/post-flight assertion predicates (post-flight NOT IN is broader than pre-flight = 'sold')"
    - "DROP POLICY IF EXISTS + CREATE POLICY re-create idiom for RLS literal-list changes"

key-files:
  created:
    - supabase/migrations/20260913000000_phase85_collection_lifecycle.sql
  modified:
    - src/db/schema.ts

key-decisions:
  - "disposal_reason is a pgEnum (matches condition_grade/box_papers_status precedent), not text+CHECK (D-02 discretion)"
  - "watches.status stays plain text{enum:[...]} — no DB CHECK/pgEnum conversion; the rename is a pure data UPDATE, zero column-type DDL"
  - "No backfill of disposal_date/sell_price from divestments rows (CONTEXT default: don't)"
  - "divestments table, rows, RLS and FKs left completely untouched (D-03) — no DROP anywhere in the migration"

patterns-established:
  - "Pattern: guard CREATE TYPE with a pg_type/pg_namespace existence check so re-running the same migration file is a no-op the second time"

requirements-completed: [LIFE-01, LIFE-02]

# Metrics
duration: ~20min
completed: 2026-09-14
---

# Phase 85 Plan 01: DB migration + Drizzle mirror Summary

**One idempotent Supabase migration renamed every local `sold` watch to `previously_owned` (with `disposal_reason='sold'`), added `disposal_reason`/`sell_price`/`disposal_date` nullable columns, and re-created the two comments RLS policies — applied twice against local Supabase with zero drift, proven on a real fixture row.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3 (all auto; Task 3 was `[BLOCKING]`)
- **Files modified:** 2 (1 new migration, 1 schema.ts)

## Accomplishments
- Wrote `supabase/migrations/20260913000000_phase85_collection_lifecycle.sql`: guarded `disposal_reason` pgEnum creation, 3 nullable `ADD COLUMN IF NOT EXISTS` columns on `watches`, in-place `sold → previously_owned` backfill with `disposal_reason` set, `comments_select`/`comments_insert` RLS re-created with `previously_owned` substituted for `sold`, and 4 post-flight `DO $$` assertion blocks using predicates divergent from the operations they check. Zero `DROP TABLE`/`DROP TYPE`/`DROP COLUMN`/`DROP CONSTRAINT` anywhere in the file (D-03).
- Mirrored the migration in `src/db/schema.ts`: exported `disposalReasonEnum`, swapped `'sold'` for `'previously_owned'` in the `watches.status` column enum array, added `disposalReason`/`sellPrice`/`disposalDate` columns, and reworded the `divestments` table's header comment so it no longer contains the literal `'sold'` while explaining Phase 85 D-03 (table stays in place, no longer written to).
- Applied the migration to local Supabase (`supabase_db_horlo` container) twice — both runs exited 0, proving idempotency. Created a real `sold` fixture row on `vintage_anna` (local username, no hyphen — differs from the plan's `vintage-anna` reference) before the first apply to exercise the backfill on live data, then confirmed it migrated to `previously_owned` / `disposal_reason='sold'`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the idempotent Phase 85 lifecycle migration** - `106b9dd4` (feat)
2. **Task 2: Mirror the migration in the Drizzle schema** - `7f5bdc40` (feat)
3. **Task 3: Apply the migration to LOCAL Supabase and assert the result** - no repo commit (DB-only; no files modified per plan's `<files>` spec)

**Plan metadata:** (this commit)

## Files Created/Modified
- `supabase/migrations/20260913000000_phase85_collection_lifecycle.sql` - New idempotent migration: disposal_reason pgEnum, 3 nullable watches columns, sold→previously_owned backfill, comments RLS re-create, pre/post-flight assertions
- `src/db/schema.ts` - `disposalReasonEnum` export, `watches.status` enum swap, 3 new nullable columns, divestments comment reworded

## Decisions Made
None beyond what CONTEXT.md already locked — plan executed exactly as specified (pgEnum for disposal_reason, no CHECK constraint on status, no divestments backfill).

## Deviations from Plan

None — plan executed exactly as written. One incidental discovery worth recording (not a deviation, just a data-shape note): the local seed data's `vintage-anna` username referenced in the plan's Task 3 action text is actually stored locally as `vintage_anna` (underscore). Resolved by querying `profiles` directly rather than assuming the hyphenated form; the plan's own fallback clause ("any seeded user that has an owned watch") covered this without needing a deviation.

## Issues Encountered

None. Local Supabase stack was already running (`supabase status` showed the DB, API, Studio, etc. up; only non-DB peripheral services — imgproxy, edge-runtime, pooler — were stopped, which does not affect this plan's psql/docker-exec workflow).

## Local Verification (Task 3 detail)

- **BEFORE_COUNTS:** `owned=16` (no `wishlist`/`grail`/`sold` rows existed locally before this plan)
- **CHECK constraints on `watches`:** none found — confirmed safe to proceed without additional guard
- **SOLD_FIXTURE_ID:** `a915158f-1692-405e-882e-c08a2fe5969f` (copied from an owned Rolex Submariner owned by `vintage_anna` / user `00000000-0000-0000-0000-000000000002`, `notes='phase85 sold fixture'`) — left in place per the plan's instruction; Plan 85-11's walk will use it to confirm the migrated row renders as previously owned
- **First apply output:** `BEGIN` → `NOTICE: Phase 85: migrating 1 sold rows to previously_owned` → `DO`/`DO`/`ALTER TABLE`/`UPDATE 1` → (comments policies didn't exist locally yet, so `DROP POLICY IF EXISTS` printed "does not exist, skipping" before `CREATE POLICY` succeeded for both) → 4× `DO` (post-flight) → `COMMIT`. Exit 0.
- **Second apply output (idempotency proof):** `NOTICE: Phase 85: migrating 0 sold rows` → `NOTICE: column "disposal_reason"/"sell_price"/"disposal_date" of relation "watches" already exists, skipping` → `UPDATE 0` → `DROP POLICY`/`CREATE POLICY` (both policies now pre-existing, cleanly re-created) → 4× `DO` → `COMMIT`. Exit 0.
- **AFTER_COUNTS:** `owned=16` (unchanged), `previously_owned=1` (the fixture; before-sold-count 0 + 1 fixture)
- **Verify query result:** `0|3|1` (0 rows with an unrecognized status; 3 disposal columns present; 1 row matching the fixture's fully-migrated shape) — exact match to the plan's acceptance criterion
- **comments RLS check:** 2 (both `comments_select` and `comments_insert` now reference `previously_owned`, neither references `'sold'`)
- **divestments count:** 0 before and after — untouched (D-03)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Local Supabase now carries the full LIFE-01/LIFE-02 shape; `src/db/schema.ts` matches it exactly.
- **Expected and intentional:** `npm run build` currently fails on the remaining `'sold'` literal references in `src/data/watches.ts` (`mapDomainToRow`) and `src/app/actions/divestments.ts` — this was called out explicitly in 85-01-PLAN.md's objective as NOT this plan's gate. Plans 85-02/85-03 remove those references (85-03 deletes `divestments.ts`); 85-04 owns the build-green gate. Do not treat this as a regression.
- Prod migration push (`supabase db push --linked`) is intentionally NOT run here — it is operator-gated in Plan 85-11.
- The local `phase85 sold fixture` row (`a915158f-1692-405e-882e-c08a2fe5969f`) is intentionally left in the local DB as a previously_owned fixture for later UI verification.

---
*Phase: 85-collection-lifecycle*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: supabase/migrations/20260913000000_phase85_collection_lifecycle.sql
- FOUND: src/db/schema.ts
- FOUND: .planning/phases/85-collection-lifecycle/85-01-SUMMARY.md
- FOUND commit: 106b9dd4 (Task 1)
- FOUND commit: 7f5bdc40 (Task 2)
- FOUND commit: 082db106 (SUMMARY)
