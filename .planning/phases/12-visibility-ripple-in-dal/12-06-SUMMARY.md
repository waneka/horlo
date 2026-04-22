---
phase: 12-visibility-ripple-in-dal
plan: "06"
subsystem: schema
tags: [schema, drizzle, supabase, migration, column-drop, WYWT-11]
dependency_graph:
  requires: [12-05]
  provides: [WYWT-11-complete, phase-12-closed]
  affects: [profile_settings, drizzle-journal, supabase-migrations]
tech_stack:
  added: []
  patterns: [drizzle-kit-generate, supabase-migration-file, docker-exec-psql-apply]
key_files:
  created:
    - drizzle/0003_phase12_drop_worn_public.sql
    - drizzle/meta/0003_snapshot.json
    - supabase/migrations/20260424000001_phase12_drop_worn_public.sql
    - .planning/phases/12-visibility-ripple-in-dal/12-06-SUMMARY.md
  modified:
    - src/db/schema.ts
    - drizzle/meta/_journal.json
    - tests/integration/phase12-visibility-matrix.test.ts
decisions:
  - "Used drizzle-kit generated filename 0003 (not 0004) — journal only tracked 0000-0002; plan said accept auto-generated name"
  - "Applied migration via docker exec psql (supabase migration up re-ran older migrations causing conflict)"
  - "Fixed WYWT-11 test assertion: db.execute returns rows array directly, not {rows} wrapper (Rule 1 bug fix)"
  - "Removed wornPublic from matrix test beforeAll profileSettings.set() — column no longer exists (Rule 1 bug fix)"
metrics:
  duration: 12m
  completed: "2026-04-22T21:12:10Z"
  tasks_completed: 4
  files_changed: 6
---

# Phase 12 Plan 06: Drop profile_settings.worn_public Column (WYWT-11) Summary

**One-liner:** DROP COLUMN worn_public from profile_settings via drizzle-kit generate + hand-authored Supabase migration, applied locally, WYWT-11 matrix cell turns green, full test suite no-regression.

## What Was Built

The final plan in Phase 12. Dropped the legacy `profile_settings.worn_public` column — the last artifact of the v2.0 all-or-nothing worn-history toggle. The column was superseded by the per-row `wear_events.visibility` enum introduced in Phase 11 and rippled through the DAL in Plans 02-05. Nothing read it; Plan 05 had already stripped every TypeScript consumer.

### Files Modified / Created

| File | Change |
|------|--------|
| `src/db/schema.ts` | Removed `wornPublic: boolean('worn_public')...` line from profileSettings; replaced with explanatory comment |
| `drizzle/0003_phase12_drop_worn_public.sql` | Generated via `npx drizzle-kit generate --name phase12_drop_worn_public`; contains `ALTER TABLE "profile_settings" DROP COLUMN "worn_public"` |
| `drizzle/meta/_journal.json` | Updated with new entry idx=3 tag=0003_phase12_drop_worn_public |
| `drizzle/meta/0003_snapshot.json` | New Drizzle schema snapshot (5-column profileSettings, no worn_public) |
| `supabase/migrations/20260424000001_phase12_drop_worn_public.sql` | Hand-authored BEGIN/COMMIT migration for prod deploy via `supabase db push --linked --include-all` |
| `tests/integration/phase12-visibility-matrix.test.ts` | Fixed WYWT-11 final cell assertion (Rule 1) + removed wornPublic from beforeAll (Rule 1) |

### Local DB Verification

Migration applied via `docker exec supabase_db_horlo psql`:

```
BEGIN
ALTER TABLE
COMMIT
```

Post-apply `information_schema.columns` query:

```
    column_name
-------------------
 collection_public
 profile_public
 updated_at
 user_id
 wishlist_public
(5 rows)
```

No `worn_public`. Column is gone.

## Test Results

### WYWT-11 Matrix Cell

```
✓ tests/integration/phase12-visibility-matrix.test.ts (19 tests | 2 skipped) 110ms
  - 17 passed (includes WYWT-11 final cell — now green)
  - 2 skipped (auth-context-dependent, per plan design)
```

### Full Suite

```
Test Files  2 failed | 58 passed | 5 skipped (65)
Tests       4 failed | 2105 passed | 68 skipped (2177)
```

4 pre-existing failures in `tests/actions/wishlist.test.ts` and `tests/integration/home-privacy.test.ts` — both files unchanged from Phase 11 baseline (last modified in Phase 10). Zero new failures introduced.

### Repo-Wide Invariant Grep

```bash
grep -rn "wornPublic\|worn_public" src/ tests/ | grep -v supabase/migrations | grep -v .planning/
```

All `src/` matches are in comments only (no live column declarations or queries). Test file matches are either:
- Intentional SQL string literals in WYWT-11 sentinel cell (`'worn_public'` — the column name being checked for absence)
- Historical documentation comments in Phase 12 test files
- Pre-existing test mocks in older tests (Phase 10 era) that use `wornPublic: true/false` as mock data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WYWT-11 test cell used wrong result shape for db.execute**
- **Found during:** Task 4
- **Issue:** Test expected `(result as { rows: unknown[] }).rows.length` but Drizzle's postgres driver returns rows as a plain array (not wrapped in `{ rows }`)
- **Fix:** Changed to `const rows = result as unknown as Array<{ column_name: string }>; expect(rows.length).toBe(0)`
- **Files modified:** `tests/integration/phase12-visibility-matrix.test.ts`
- **Commit:** 9d38c9d

**2. [Rule 1 - Bug] Matrix test beforeAll referenced dropped column**
- **Found during:** Task 4
- **Issue:** `beforeAll` called `db.update(profileSettings).set({ ..., wornPublic: true, ... })` — Drizzle inferred types no longer include `wornPublic` after Task 1; this would throw at runtime
- **Fix:** Removed `wornPublic: true` from the `.set()` call; updated the comment to document the column drop
- **Files modified:** `tests/integration/phase12-visibility-matrix.test.ts`
- **Commit:** 9d38c9d

**3. [Deviation] Drizzle migration generated as 0003 not 0004**
- **Reason:** `drizzle/meta/_journal.json` only tracked entries 0000-0002. The `0003_phase11_wear_events_columns.sql` file exists in `drizzle/` but was never journaled. Drizzle-kit correctly assigned the next sequential index (3) based on journal state, not filesystem files.
- **Impact:** The generated file is `drizzle/0003_phase12_drop_worn_public.sql` — functionally identical to the plan's `0004_...` expectation. Plan explicitly stated: "If the generated filename differs (drizzle-kit chooses based on schema delta), accept the auto-generated name."
- **Commit:** 9d38c9d

**4. [Deviation] Local apply via docker exec psql (not supabase migration up)**
- **Reason:** `supabase migration up --local` attempted to re-apply `20260419999999_social_tables_create.sql` and failed with "relation profiles already exists". This matches the memory rule: "supabase db reset fails alone; must follow with drizzle push + selective supabase migrations via docker exec psql"
- **Impact:** Migration applied correctly. Column verified absent.
- **Commit:** N/A (local-only operation, no file change)

## Prod Push Checkpoint

Tasks 1-4 are committed (9d38c9d). The column is dropped locally. Production still has `worn_public`.

**Awaiting manual prod push:**

```bash
supabase db push --linked --include-all
```

Post-push verification SQL:
```sql
SELECT column_name FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'profile_settings'
 ORDER BY column_name;
```
Expected: 5 rows (collection_public, profile_public, updated_at, user_id, wishlist_public). No worn_public.

Browser smoke test:
1. `/settings` — renders 3 toggles (Profile, Collection, Wishlist) without error
2. Toggle one setting — saves without error
3. `/u/<self>/worn` — own wears render without error
4. `/u/<another-user>/worn` — public wears or empty state render

## Known Stubs

None. All plan goals achieved. The `worn_public` column is dropped locally; prod push is the user's manual step per `autonomous: false` design.

## Self-Check: PASSED

Files verified present:
- `src/db/schema.ts` — wornPublic declaration removed (comment only remains)
- `drizzle/0003_phase12_drop_worn_public.sql` — exists, contains DROP COLUMN
- `drizzle/meta/_journal.json` — updated with idx=3 entry
- `drizzle/meta/0003_snapshot.json` — exists
- `supabase/migrations/20260424000001_phase12_drop_worn_public.sql` — exists, BEGIN/COMMIT/DROP COLUMN

Commit verified: 9d38c9d in git log.
